export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { auth } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { sendAdminInvitationEmail } from "@/lib/email";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session || !session.user?.email || !session.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { memberId } = body;

    if (!memberId) {
      return NextResponse.json(
        { error: "Member ID is required" },
        { status: 400 }
      );
    }

    // Get current user's role
    const userResult = await pool.query(
      "SELECT role FROM users WHERE id = $1",
      [session.user.id]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const currentUserRole = userResult.rows[0].role;

    // Get current user's company_id
    const currentUserResult = await pool.query(
      "SELECT company_id FROM users WHERE id = $1",
      [session.user.id]
    );
    
    let companyId: string | null = currentUserResult.rows[0]?.company_id;
    let companyName = "";
    
    // If owner, get company from companies table
    if (currentUserRole === "owner" && !companyId) {
      const companyResult = await pool.query(
        "SELECT id, name FROM companies WHERE owner_id = $1",
        [session.user.id]
      );
      if (companyResult.rows.length > 0) {
        companyId = companyResult.rows[0].id;
        companyName = companyResult.rows[0].name;
      }
    } else if (companyId) {
      const companyResult = await pool.query(
        "SELECT name FROM companies WHERE id = $1",
        [companyId]
      );
      if (companyResult.rows.length > 0) {
        companyName = companyResult.rows[0].name;
      }
    }

    if (!companyId) {
      return NextResponse.json(
        { error: "Company not found" },
        { status: 404 }
      );
    }

    // Get member info
    const memberResult = await pool.query(
      "SELECT id, name, email, role, company_id, onboarded FROM users WHERE id = $1",
      [memberId]
    );

    if (memberResult.rows.length === 0) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    const member = memberResult.rows[0];

    // Check if member is part of this company
    if (member.role === "owner") {
      const ownerCompany = await pool.query(
        "SELECT id FROM companies WHERE owner_id = $1",
        [memberId]
      );
      if (ownerCompany.rows.length === 0 || ownerCompany.rows[0].id !== companyId) {
        return NextResponse.json(
          { error: "Member not found in this company" },
          { status: 404 }
        );
      }
    } else if (member.company_id !== companyId) {
      return NextResponse.json(
        { error: "Member not found in this company" },
        { status: 404 }
      );
    }

    // Generate new password
    const randomPassword =
      Math.random().toString(36).slice(-12) +
      Math.random().toString(36).slice(-12).toUpperCase() +
      "!@#";
    const hashedPassword = await bcrypt.hash(randomPassword, 10);

    // Update user password
    await pool.query("UPDATE users SET hashed_password = $1 WHERE id = $2", [
      hashedPassword,
      memberId,
    ]);

    // Send invitation email
    const origin =
      request.headers.get("origin") ||
      process.env.NEXTAUTH_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
      "http://localhost:3000";
    const loginUrl = `${origin}/login`;

    try {
      await sendAdminInvitationEmail(
        member.email,
        member.name,
        companyName,
        randomPassword,
        loginUrl
      );
    } catch (emailError) {
      console.error(
        `Failed to send invitation email to ${member.email}:`,
        emailError
      );
      return NextResponse.json(
        { error: "Failed to send invitation email", details: emailError },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, message: "Invitation email sent successfully" },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Resend invitation error:", error);
    return NextResponse.json(
      { error: "Failed to resend invitation", details: error.message },
      { status: 500 }
    );
  }
}

