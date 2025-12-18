export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session || !session.user?.email || !session.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Check if user is owner
    const userResult = await pool.query(
      "SELECT role FROM users WHERE id = $1",
      [session.user.id]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (userResult.rows[0].role !== "owner") {
      return NextResponse.json(
        { error: "Only owners can view admins" },
        { status: 403 }
      );
    }

    // Get company
    const companyResult = await pool.query(
      "SELECT id FROM companies WHERE owner_id = $1",
      [session.user.id]
    );

    if (companyResult.rows.length === 0) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const companyId = companyResult.rows[0].id;

    // Get all admins
    const adminsResult = await pool.query(
      `SELECT u.id, u.name, u.email, u.image_url
       FROM users u
       WHERE u.company_id = $1 AND u.role = 'admin'
       ORDER BY u.name`,
      [companyId]
    );

    const admins = adminsResult.rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      imageUrl: row.image_url,
    }));

    return NextResponse.json({ admins }, { status: 200 });
  } catch (error: any) {
    console.error("Get admins error:", error);
    return NextResponse.json(
      { error: "Failed to get admins", details: error.message },
      { status: 500 }
    );
  }
}

