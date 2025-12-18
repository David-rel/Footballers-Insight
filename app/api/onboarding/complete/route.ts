export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { auth } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { sendAdminInvitationEmail } from "@/lib/email";
import { put } from "@vercel/blob";

interface AdminInvite {
  email: string;
  name: string;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session || !session.user?.email || !session.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Check if user is already onboarded
    const userCheck = await pool.query(
      "SELECT onboarded, role FROM users WHERE id = $1",
      [session.user.id]
    );

    if (userCheck.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const user = userCheck.rows[0];
    if (user.onboarded) {
      return NextResponse.json(
        { error: "User already onboarded" },
        { status: 400 }
      );
    }

    if (user.role !== "owner") {
      return NextResponse.json(
        { error: "Only owners can complete onboarding" },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const companyName = formData.get("companyName") as string;
    const companyUrl = formData.get("companyUrl") as string | null;
    const companyLogo = formData.get("companyLogo") as File | null;
    const phoneNumber = formData.get("phoneNumber") as string | null;
    const userImage = formData.get("userImage") as File | null;
    const adminInvitesJson = formData.get("adminInvites") as string;

    if (!companyName) {
      return NextResponse.json(
        { error: "Company name is required" },
        { status: 400 }
      );
    }

    // Parse admin invites
    let adminInvites: AdminInvite[] = [];
    try {
      adminInvites = JSON.parse(adminInvitesJson || "[]");
    } catch (e) {
      adminInvites = [];
    }

    // Upload images to Vercel Blob if provided
    let companyLogoUrl: string | null = null;
    if (companyLogo) {
      const blob = await put(
        `company-logos/${session.user.id}-${Date.now()}-${companyLogo.name}`,
        companyLogo,
        {
          access: "public",
          token: process.env.BLOB_READ_WRITE_TOKEN,
        }
      );
      companyLogoUrl = blob.url;
    }

    let userImageUrl: string | null = null;
    if (userImage) {
      const blob = await put(
        `user-images/${session.user.id}-${Date.now()}-${userImage.name}`,
        userImage,
        {
          access: "public",
          token: process.env.BLOB_READ_WRITE_TOKEN,
        }
      );
      userImageUrl = blob.url;
    }

    // Start transaction
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // 1. Create company
      const companyResult = await client.query(
        `INSERT INTO companies (name, owner_id, website_url, company_logo)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [companyName, session.user.id, companyUrl, companyLogoUrl]
      );
      const companyId = companyResult.rows[0].id;

      // 2. Update user profile (set company_id and onboarded)
      const updateFields: string[] = ["onboarded = TRUE", `company_id = $1`];
      const updateValues: any[] = [companyId];
      let paramIndex = 2;

      if (phoneNumber) {
        updateFields.push(`phone_number = $${paramIndex}`);
        updateValues.push(phoneNumber);
        paramIndex++;
      }

      if (userImageUrl) {
        updateFields.push(`image_url = $${paramIndex}`);
        updateValues.push(userImageUrl);
        paramIndex++;
      }

      updateValues.push(session.user.id);

      await client.query(
        `UPDATE users SET ${updateFields.join(", ")} WHERE id = $${paramIndex}`,
        updateValues
      );

      // 3. Create admin users and send invitations
      // Get base URL from request headers or environment
      const origin =
        request.headers.get("origin") ||
        process.env.NEXTAUTH_URL ||
        process.env.NEXT_PUBLIC_APP_URL ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
        "http://localhost:3000";
      const loginUrl = `${origin}/login`;

      for (const invite of adminInvites) {
        if (!invite.email || !invite.name) continue;

        // Check if user already exists
        const existingUser = await client.query(
          "SELECT id FROM users WHERE email = $1",
          [invite.email]
        );

        let adminUserId: string;

        if (existingUser.rows.length > 0) {
          // User exists, update their company_id and role
          adminUserId = existingUser.rows[0].id;
          await client.query(
            `UPDATE users SET company_id = $1, role = 'admin' WHERE id = $2`,
            [companyId, adminUserId]
          );
        } else {
          // Generate random password
          const randomPassword =
            Math.random().toString(36).slice(-12) +
            Math.random().toString(36).slice(-12).toUpperCase() +
            "!@#";
          const hashedPassword = await bcrypt.hash(randomPassword, 10);

          // Create new user with company_id
          const newUserResult = await client.query(
            `INSERT INTO users (name, email, hashed_password, role, company_id, email_verified)
             VALUES ($1, $2, $3, 'admin', $4, TRUE)
             RETURNING id`,
            [invite.name, invite.email, hashedPassword, companyId]
          );
          adminUserId = newUserResult.rows[0].id;

          // Send invitation email
          try {
            await sendAdminInvitationEmail(
              invite.email,
              invite.name,
              companyName,
              randomPassword,
              loginUrl
            );
          } catch (emailError) {
            console.error(
              `Failed to send invitation email to ${invite.email}:`,
              emailError
            );
            // Continue even if email fails
          }
        }
      }

      await client.query("COMMIT");

      return NextResponse.json({ success: true, companyId }, { status: 200 });
    } catch (error: any) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error("Onboarding completion error:", error);
    return NextResponse.json(
      { error: "Failed to complete onboarding", details: error.message },
      { status: 500 }
    );
  }
}
