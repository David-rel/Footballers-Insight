export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { auth } from "@/lib/auth";
import bcrypt from "bcryptjs";

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

    if (user.role !== "player") {
      return NextResponse.json(
        { error: "This endpoint is for players only" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { newPassword, dob, ageGroup, gender, dominantFoot, notes } = body;

    if (!newPassword || newPassword.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters long" },
        { status: 400 }
      );
    }

    if (!dob) {
      return NextResponse.json(
        { error: "Date of birth is required" },
        { status: 400 }
      );
    }

    if (!gender) {
      return NextResponse.json(
        { error: "Gender is required" },
        { status: 400 }
      );
    }

    if (!dominantFoot) {
      return NextResponse.json(
        { error: "Dominant foot is required" },
        { status: 400 }
      );
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Get player's team_id
    const playerResult = await pool.query(
      "SELECT team_id FROM players WHERE user_id = $1",
      [session.user.id]
    );

    if (playerResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Player record not found" },
        { status: 404 }
      );
    }

    const teamId = playerResult.rows[0].team_id;

    // Start transaction to update both user and player
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Update user password and mark as onboarded
      await client.query(
        "UPDATE users SET hashed_password = $1, onboarded = TRUE WHERE id = $2",
        [hashedPassword, session.user.id]
      );

      // Update player information
      await client.query(
        `UPDATE players 
         SET dob = $1, age_group = $2, gender = $3, dominant_foot = $4, notes = $5
         WHERE user_id = $6 AND team_id = $7`,
        [
          dob,
          ageGroup || null,
          gender,
          dominantFoot,
          notes || null,
          session.user.id,
          teamId,
        ]
      );

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error("Player onboarding completion error:", error);
    return NextResponse.json(
      { error: "Failed to complete onboarding", details: error.message },
      { status: 500 }
    );
  }
}

