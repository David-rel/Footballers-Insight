export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { auth } from "@/lib/auth";

// GET - Fetch all evaluations for a team
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session || !session.user?.email || !session.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id } = await params;
    const teamId = id;

    // Get user's role and company_id
    const userResult = await pool.query(
      "SELECT role, company_id FROM users WHERE id = $1",
      [session.user.id]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userRole = userResult.rows[0].role;

    // Players/parents cannot access evaluations
    if (userRole === "player" || userRole === "parent") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

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

    // Get all evaluations for this team
    const evaluationsResult = await pool.query(
      `SELECT 
        e.id,
        e.team_id,
        e.created_by,
        e.name,
        e.one_v_one_rounds,
        e.skill_moves_count,
        e.scores,
        e.created_at,
        e.updated_at,
        u.name as created_by_name
      FROM evaluations e
      JOIN users u ON e.created_by = u.id
      WHERE e.team_id = $1
      ORDER BY e.created_at DESC`,
      [teamId]
    );

    const evaluations = evaluationsResult.rows.map((row) => ({
      id: row.id,
      teamId: row.team_id,
      createdBy: row.created_by,
      createdByName: row.created_by_name,
      name: row.name,
      oneVOneRounds: row.one_v_one_rounds,
      skillMovesCount: row.skill_moves_count,
      scores: typeof row.scores === "string" ? JSON.parse(row.scores) : row.scores,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return NextResponse.json({ evaluations }, { status: 200 });
  } catch (error: any) {
    console.error("Get evaluations error:", error);
    return NextResponse.json(
      { error: "Failed to get evaluations", details: error.message },
      { status: 500 }
    );
  }
}

// POST - Create a new evaluation
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session || !session.user?.email || !session.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id } = await params;
    const teamId = id;
    const body = await request.json();
    const { name, oneVOneRounds, skillMovesCount } = body;

    // Validate required fields
    if (!name || !oneVOneRounds || !skillMovesCount) {
      return NextResponse.json(
        { error: "Name, oneVOneRounds, and skillMovesCount are required" },
        { status: 400 }
      );
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

    // Players/parents cannot create evaluations
    if (userRole === "player" || userRole === "parent") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

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

    // Coaches can only create evaluations for their own teams
    if (userRole === "coach" && team.coach_id !== session.user.id) {
      return NextResponse.json(
        { error: "Unauthorized to create evaluation for this team" },
        { status: 403 }
      );
    }

    // Owners/admins can only create evaluations for teams in their company
    if (userRole !== "coach" && team.company_id !== companyId) {
      return NextResponse.json(
        { error: "Unauthorized to create evaluation for this team" },
        { status: 403 }
      );
    }

    // Create evaluation
    const result = await pool.query(
      `INSERT INTO evaluations (team_id, created_by, name, one_v_one_rounds, skill_moves_count, scores)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       RETURNING id, team_id, created_by, name, one_v_one_rounds, skill_moves_count, scores, created_at, updated_at`,
      [teamId, session.user.id, name, oneVOneRounds, skillMovesCount, "{}"]
    );

    const evaluation = result.rows[0];

    return NextResponse.json(
      {
        evaluation: {
          id: evaluation.id,
          teamId: evaluation.team_id,
          createdBy: evaluation.created_by,
          name: evaluation.name,
          oneVOneRounds: evaluation.one_v_one_rounds,
          skillMovesCount: evaluation.skill_moves_count,
          scores: typeof evaluation.scores === "string" ? JSON.parse(evaluation.scores) : evaluation.scores,
          createdAt: evaluation.created_at,
          updatedAt: evaluation.updated_at,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Create evaluation error:", error);
    return NextResponse.json(
      { error: "Failed to create evaluation", details: error.message },
      { status: 500 }
    );
  }
}

