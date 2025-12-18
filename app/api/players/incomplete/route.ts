export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { auth } from "@/lib/auth";

// GET - Check for incomplete players for the current user
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session || !session.user?.email || !session.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Get all players for this user that are missing required fields
    const incompletePlayers = await pool.query(
      `SELECT 
        p.id,
        p.team_id,
        p.first_name,
        p.last_name,
        p.dob,
        p.gender,
        p.dominant_foot,
        t.name as team_name
      FROM players p
      JOIN teams t ON p.team_id = t.id
      WHERE p.user_id = $1 
        AND (p.dob IS NULL OR p.gender IS NULL OR p.dominant_foot IS NULL)
      ORDER BY p.created_at ASC
      LIMIT 1`,
      [session.user.id]
    );

    if (incompletePlayers.rows.length > 0) {
      const player = incompletePlayers.rows[0];
      return NextResponse.json(
        {
          hasIncomplete: true,
          player: {
            id: player.id,
            teamId: player.team_id,
            firstName: player.first_name,
            lastName: player.last_name,
            teamName: player.team_name,
            dob: player.dob,
            gender: player.gender,
            dominantFoot: player.dominant_foot,
          },
        },
        { status: 200 }
      );
    }

    return NextResponse.json({ hasIncomplete: false }, { status: 200 });
  } catch (error: any) {
    console.error("Check incomplete players error:", error);
    return NextResponse.json(
      { error: "Failed to check incomplete players", details: error.message },
      { status: 500 }
    );
  }
}
