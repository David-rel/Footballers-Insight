export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function DELETE(request: NextRequest) {
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

    const userRole = userResult.rows[0].role;

    if (userRole === "owner") {
      // Owners cannot delete their account - they must transfer ownership first
      return NextResponse.json(
        {
          error:
            "Cannot delete account. You must transfer ownership to an admin first before you can delete your account.",
        },
        { status: 400 }
      );
    }

    // Admins and coaches can delete their account

    // Delete user (cascade will handle company if owner)
    await pool.query("DELETE FROM users WHERE id = $1", [session.user.id]);

    return NextResponse.json(
      { message: "Account deleted successfully" },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Delete account error:", error);
    return NextResponse.json(
      { error: "Failed to delete account", details: error.message },
      { status: 500 }
    );
  }
}
