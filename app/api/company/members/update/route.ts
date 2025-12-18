export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { auth } from "@/lib/auth";

// PUT - Update a member
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();

    if (!session || !session.user?.email || !session.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { memberId, name, email, phoneNumber, role } = body;

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

    // Get member's role
    const memberResult = await pool.query(
      "SELECT role FROM users WHERE id = $1",
      [memberId]
    );

    if (memberResult.rows.length === 0) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    const memberRole = memberResult.rows[0].role;

    // Admins cannot edit owners
    if (currentUserRole === "admin" && memberRole === "owner") {
      return NextResponse.json(
        { error: "Admins cannot edit owners" },
        { status: 403 }
      );
    }

    // Get current user's company_id
    const currentUserResult = await pool.query(
      "SELECT company_id FROM users WHERE id = $1",
      [session.user.id]
    );
    
    let companyId: string | null = currentUserResult.rows[0]?.company_id;
    
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
      return NextResponse.json(
        { error: "Company not found" },
        { status: 404 }
      );
    }

    // Update user fields
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    let paramIndex = 1;

    if (name) {
      updateFields.push(`name = $${paramIndex}`);
      updateValues.push(name);
      paramIndex++;
    }

    if (email) {
      updateFields.push(`email = $${paramIndex}`);
      updateValues.push(email);
      paramIndex++;
    }

    if (phoneNumber !== undefined) {
      updateFields.push(`phone_number = $${paramIndex}`);
      updateValues.push(phoneNumber || null);
      paramIndex++;
    }

    // Update role if provided and not owner
    if (role && memberRole !== "owner" && ["admin", "coach"].includes(role)) {
      updateFields.push(`role = $${paramIndex}`);
      updateValues.push(role);
      paramIndex++;
    }

    if (updateFields.length > 0) {
      updateValues.push(memberId);
      await pool.query(
        `UPDATE users SET ${updateFields.join(", ")} WHERE id = $${paramIndex}`,
        updateValues
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error("Update member error:", error);
    return NextResponse.json(
      { error: "Failed to update member", details: error.message },
      { status: 500 }
    );
  }
}

