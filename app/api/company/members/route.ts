export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { auth } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { sendAdminInvitationEmail } from "@/lib/email";

// GET - Fetch all company members
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session || !session.user?.email || !session.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Get user's role and company_id
    const userResult = await pool.query(
      "SELECT role, company_id FROM users WHERE id = $1",
      [session.user.id]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userRole = userResult.rows[0].role;
    let companyId: string | null = userResult.rows[0].company_id;

    // If owner, get company from companies table
    if (userRole === "owner" && !companyId) {
      const companyResult = await pool.query(
        "SELECT id FROM companies WHERE owner_id = $1",
        [session.user.id]
      );
      if (companyResult.rows.length > 0) {
        companyId = companyResult.rows[0].id;
      }
    }

    if (!companyId) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    // Get all members for this company (exclude players - they're shown on Players page)
    const membersResult = await pool.query(
      `SELECT u.id, u.name, u.email, u.phone_number, u.image_url, u.role, u.created_at, u.onboarded
       FROM users u
       WHERE u.company_id = $1 AND u.role != 'player'
       ORDER BY u.role, u.name`,
      [companyId]
    );

    const members = membersResult.rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      phoneNumber: row.phone_number,
      imageUrl: row.image_url,
      role: row.role,
      createdAt: row.created_at,
      onboarded: row.onboarded,
    }));

    return NextResponse.json(
      { members, currentUserRole: userRole },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Get members error:", error);
    return NextResponse.json(
      { error: "Failed to get members", details: error.message },
      { status: 500 }
    );
  }
}

// POST - Add a new member
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session || !session.user?.email || !session.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { name, email, role } = body;

    if (!name || !email || !role) {
      return NextResponse.json(
        { error: "Name, email, and role are required" },
        { status: 400 }
      );
    }

    if (!["admin", "coach"].includes(role)) {
      return NextResponse.json(
        { error: "Role must be admin or coach" },
        { status: 400 }
      );
    }

    // Get current user's role and company_id
    const userResult = await pool.query(
      "SELECT role, company_id FROM users WHERE id = $1",
      [session.user.id]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const currentUserRole = userResult.rows[0].role;
    let companyId: string | null = userResult.rows[0].company_id;
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
    } else if (currentUserRole === "admin" && companyId) {
      // Get company name
      const companyResult = await pool.query(
        "SELECT name FROM companies WHERE id = $1",
        [companyId]
      );
      if (companyResult.rows.length > 0) {
        companyName = companyResult.rows[0].name;
      }
    }

    if (!companyId) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    // Check if user already exists
    const existingUser = await pool.query(
      "SELECT id, company_id FROM users WHERE email = $1",
      [email]
    );

    let userId: string;

    if (existingUser.rows.length > 0) {
      userId = existingUser.rows[0].id;
      // Update existing user's company_id and role
      await pool.query(
        `UPDATE users SET company_id = $1, role = $2 WHERE id = $3`,
        [companyId, role, userId]
      );
    } else {
      // Create new user with auto-generated password
      const randomPassword =
        Math.random().toString(36).slice(-12) +
        Math.random().toString(36).slice(-12).toUpperCase() +
        "!@#";
      const hashedPassword = await bcrypt.hash(randomPassword, 10);

      const newUserResult = await pool.query(
        `INSERT INTO users (name, email, hashed_password, role, company_id, email_verified, onboarded)
         VALUES ($1, $2, $3, $4, $5, TRUE, FALSE)
         RETURNING id`,
        [name, email, hashedPassword, role, companyId]
      );
      userId = newUserResult.rows[0].id;

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
          email,
          name,
          companyName,
          randomPassword,
          loginUrl
        );
      } catch (emailError) {
        console.error(
          `Failed to send invitation email to ${email}:`,
          emailError
        );
      }
    }

    return NextResponse.json({ success: true, userId }, { status: 200 });
  } catch (error: any) {
    console.error("Add member error:", error);
    return NextResponse.json(
      { error: "Failed to add member", details: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Delete a member
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();

    if (!session || !session.user?.email || !session.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get("id");

    if (!memberId) {
      return NextResponse.json(
        { error: "Member ID is required" },
        { status: 400 }
      );
    }

    // Get current user's role and company_id
    const userResult = await pool.query(
      "SELECT role, company_id FROM users WHERE id = $1",
      [session.user.id]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const currentUserRole = userResult.rows[0].role;
    let companyId: string | null = userResult.rows[0].company_id;

    // If owner, get company from companies table
    if (currentUserRole === "owner" && !companyId) {
      const companyResult = await pool.query(
        "SELECT id FROM companies WHERE owner_id = $1",
        [session.user.id]
      );
      if (companyResult.rows.length > 0) {
        companyId = companyResult.rows[0].id;
      }
    }

    if (!companyId) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    // Get member's role
    const memberResult = await pool.query(
      "SELECT role FROM users WHERE id = $1",
      [memberId]
    );

    if (memberResult.rows.length === 0) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    const memberRole = memberResult.rows[0].role;

    // Admins cannot delete owners
    if (currentUserRole === "admin" && memberRole === "owner") {
      return NextResponse.json(
        { error: "Admins cannot delete owners" },
        { status: 403 }
      );
    }

    // Cannot delete owner
    if (memberRole === "owner") {
      return NextResponse.json(
        { error: "Cannot delete owner" },
        { status: 403 }
      );
    }

    // Delete user (they're only in this company)
    await pool.query("DELETE FROM users WHERE id = $1", [memberId]);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error("Delete member error:", error);
    return NextResponse.json(
      { error: "Failed to delete member", details: error.message },
      { status: 500 }
    );
  }
}
