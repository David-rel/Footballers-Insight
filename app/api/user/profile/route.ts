export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { auth } from "@/lib/auth";
import { put } from "@vercel/blob";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session || !session.user?.email || !session.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Get user profile with company_id
    const userResult = await pool.query(
      "SELECT id, name, email, image_url, phone_number, role, company_id FROM users WHERE id = $1",
      [session.user.id]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const user = userResult.rows[0];
    let company = null;

    // Get company info - use company_id if available, otherwise get from companies table for owners
    let companyId = user.company_id;
    
    if (user.role === "owner" && !companyId) {
      const companyResult = await pool.query(
        "SELECT id, name, company_logo, website_url FROM companies WHERE owner_id = $1",
        [user.id]
      );
      if (companyResult.rows.length > 0) {
        company = companyResult.rows[0];
        companyId = companyResult.rows[0].id;
      }
    } else if (companyId) {
      const companyResult = await pool.query(
        "SELECT id, name, company_logo, website_url FROM companies WHERE id = $1",
        [companyId]
      );
      if (companyResult.rows.length > 0) {
        company = companyResult.rows[0];
      }
    }

    return NextResponse.json(
      {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          imageUrl: user.image_url,
          phoneNumber: user.phone_number,
          role: user.role,
        },
        company: company
          ? {
              id: company.id,
              name: company.name,
              logo: company.company_logo,
              websiteUrl: company.website_url,
            }
          : null,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Get profile error:", error);
    return NextResponse.json(
      { error: "Failed to get profile", details: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await auth();

    if (!session || !session.user?.email || !session.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const formData = await request.formData();
    const name = formData.get("name") as string | null;
    const phoneNumber = formData.get("phoneNumber") as string | null;
    const image = formData.get("image") as File | null;

    // Build update query dynamically
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    let paramIndex = 1;

    if (name !== null) {
      updateFields.push(`name = $${paramIndex}`);
      updateValues.push(name);
      paramIndex++;
    }

    if (phoneNumber !== null) {
      updateFields.push(`phone_number = $${paramIndex}`);
      updateValues.push(phoneNumber || null);
      paramIndex++;
    }

    let imageUrl: string | null = null;
    if (image) {
      const blob = await put(
        `user-images/${session.user.id}-${Date.now()}-${image.name}`,
        image,
        {
          access: "public",
          token: process.env.BLOB_READ_WRITE_TOKEN,
        }
      );
      imageUrl = blob.url;
      updateFields.push(`image_url = $${paramIndex}`);
      updateValues.push(imageUrl);
      paramIndex++;
    }

    if (updateFields.length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    updateValues.push(session.user.id);

    await pool.query(
      `UPDATE users SET ${updateFields.join(", ")} WHERE id = $${paramIndex}`,
      updateValues
    );

    return NextResponse.json(
      { message: "Profile updated successfully" },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Update profile error:", error);
    return NextResponse.json(
      { error: "Failed to update profile", details: error.message },
      { status: 500 }
    );
  }
}
