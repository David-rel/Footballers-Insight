export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function POST(request: NextRequest) {
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
        { error: "Only owners can transfer ownership" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { newOwnerId } = body;

    if (!newOwnerId) {
      return NextResponse.json(
        { error: "New owner ID is required" },
        { status: 400 }
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

    // Check if new owner is an admin in the company
    const adminCheck = await pool.query(
      "SELECT id FROM users WHERE id = $1 AND company_id = $2 AND role = 'admin'",
      [newOwnerId, companyId]
    );

    if (adminCheck.rows.length === 0) {
      return NextResponse.json(
        { error: "New owner must be an admin in the company" },
        { status: 400 }
      );
    }

    // Start transaction
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Update company owner
      await client.query(
        "UPDATE companies SET owner_id = $1 WHERE id = $2",
        [newOwnerId, companyId]
      );

      // Update old owner's role to admin and ensure company_id is set
      await client.query(
        "UPDATE users SET role = 'admin', company_id = $1 WHERE id = $2",
        [companyId, session.user.id]
      );

      // Update new owner's role to owner (company_id already set)
      await client.query(
        "UPDATE users SET role = 'owner' WHERE id = $1",
        [newOwnerId]
      );

      await client.query("COMMIT");

      return NextResponse.json(
        { message: "Ownership transferred successfully" },
        { status: 200 }
      );
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error("Transfer ownership error:", error);
    return NextResponse.json(
      { error: "Failed to transfer ownership", details: error.message },
      { status: 500 }
    );
  }
}

