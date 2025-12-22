export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { auth } from "@/lib/auth";

// GET - Fetch a single player by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; playerId: string }> }
) {
  try {
    const session = await auth();

    if (!session || !session.user?.email || !session.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id: teamId, playerId } = await params;

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

    // Verify team exists and belongs to user's company
    const teamResult = await pool.query(
      "SELECT id, company_id, coach_id FROM teams WHERE id = $1",
      [teamId]
    );

    if (teamResult.rows.length === 0) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    const team = teamResult.rows[0];

    // Coaches can only see their own teams
    if (userRole === "coach" && team.coach_id !== session.user.id) {
      return NextResponse.json(
        { error: "Unauthorized to view this team" },
        { status: 403 }
      );
    }

    // Owners/admins can only see teams in their company
    if (userRole !== "coach" && team.company_id !== companyId) {
      return NextResponse.json(
        { error: "Unauthorized to view this team" },
        { status: 403 }
      );
    }

    // Get player details
    const playerResult = await pool.query(
      `SELECT 
        p.id,
        p.parent_user_id,
        p.team_id,
        p.first_name,
        p.last_name,
        p.dob,
        p.age_group,
        p.gender,
        p.dominant_foot,
        p.notes,
        p.self_supervised,
        p.created_at,
        p.updated_at,
        u.email,
        u.email_verified,
        u.onboarded,
        u.image_url
      FROM players p
      JOIN users u ON p.parent_user_id = u.id
      WHERE p.id = $1 AND p.team_id = $2`,
      [playerId, teamId]
    );

    if (playerResult.rows.length === 0) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }

    const row = playerResult.rows[0];
    
    // Parents/players can only view player records they supervise
    if ((userRole === "player" || userRole === "parent") && row.parent_user_id !== session.user.id) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }
    
    const player = {
      id: row.id,
      parentUserId: row.parent_user_id,
      teamId: row.team_id,
      firstName: row.first_name,
      lastName: row.last_name,
      dob: row.dob,
      ageGroup: row.age_group,
      gender: row.gender,
      dominantFoot: row.dominant_foot,
      notes: row.notes,
      selfSupervised: row.self_supervised,
      email: row.email,
      emailVerified: row.email_verified,
      onboarded: row.onboarded,
      imageUrl: row.image_url,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };

    return NextResponse.json({ player }, { status: 200 });
  } catch (error: any) {
    console.error("Get player error:", error);
    return NextResponse.json(
      { error: "Failed to get player", details: error.message },
      { status: 500 }
    );
  }
}

// PUT - Update a player
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; playerId: string }> }
) {
  try {
    const session = await auth();

    if (!session || !session.user?.email || !session.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id: teamId, playerId } = await params;
    const body = await request.json();
    const { firstName, lastName, dob, gender, dominantFoot, notes } = body;

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

    // Verify team exists and belongs to user's company
    const teamResult = await pool.query(
      "SELECT id, company_id, coach_id FROM teams WHERE id = $1",
      [teamId]
    );

    if (teamResult.rows.length === 0) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    const team = teamResult.rows[0];

    // Coaches can only edit players in their own teams
    if (userRole === "coach" && team.coach_id !== session.user.id) {
      return NextResponse.json(
        { error: "Unauthorized to edit players in this team" },
        { status: 403 }
      );
    }

    // Owners/admins can only edit players in teams in their company
    if (userRole !== "coach" && team.company_id !== companyId) {
      return NextResponse.json(
        { error: "Unauthorized to edit players in this team" },
        { status: 403 }
      );
    }

    // Verify player exists and belongs to this team
    const playerCheck = await pool.query(
      "SELECT id, parent_user_id FROM players WHERE id = $1 AND team_id = $2",
      [playerId, teamId]
    );

    if (playerCheck.rows.length === 0) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }

    // Parents/players can only update player records they supervise
    if ((userRole === "player" || userRole === "parent") && playerCheck.rows[0].parent_user_id !== session.user.id) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    // Calculate age group from DOB if provided
    let ageGroup = null;
    if (dob) {
      const birthYear = new Date(dob).getFullYear();
      ageGroup = birthYear.toString();
    }

    // Update player
    await pool.query(
      `UPDATE players 
       SET first_name = $1, last_name = $2, dob = $3, age_group = $4, gender = $5, dominant_foot = $6, notes = $7
       WHERE id = $8 AND team_id = $9`,
      [firstName, lastName, dob || null, ageGroup, gender || null, dominantFoot || null, notes || null, playerId, teamId]
    );

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error("Update player error:", error);
    return NextResponse.json(
      { error: "Failed to update player", details: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Delete a player
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; playerId: string }> }
) {
  try {
    const session = await auth();

    if (!session || !session.user?.email || !session.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id: teamId, playerId } = await params;

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

    // Verify team exists and belongs to user's company
    const teamResult = await pool.query(
      "SELECT id, company_id, coach_id FROM teams WHERE id = $1",
      [teamId]
    );

    if (teamResult.rows.length === 0) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    const team = teamResult.rows[0];

    // Players/parents and coaches cannot delete players
    if (userRole === "player" || userRole === "parent" || userRole === "coach") {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    // Owners/admins can only delete players in teams in their company
    if (team.company_id !== companyId) {
      return NextResponse.json(
        { error: "Unauthorized to delete players in this team" },
        { status: 403 }
      );
    }

    // Verify player exists and belongs to this team
    const playerCheck = await pool.query(
      "SELECT id FROM players WHERE id = $1 AND team_id = $2",
      [playerId, teamId]
    );

    if (playerCheck.rows.length === 0) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }

    // Delete player (this will NOT delete the user account, only the player record)
    await pool.query(
      "DELETE FROM players WHERE id = $1 AND team_id = $2",
      [playerId, teamId]
    );

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error("Delete player error:", error);
    return NextResponse.json(
      { error: "Failed to delete player", details: error.message },
      { status: 500 }
    );
  }
}
