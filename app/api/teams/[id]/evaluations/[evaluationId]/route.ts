export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { auth } from "@/lib/auth";

// GET - Fetch a single evaluation
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; evaluationId: string }> }
) {
  try {
    const session = await auth();

    if (!session || !session.user?.email || !session.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id, evaluationId } = await params;
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

    // Get evaluation
    const evaluationResult = await pool.query(
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
      WHERE e.id = $1 AND e.team_id = $2`,
      [evaluationId, teamId]
    );

    if (evaluationResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Evaluation not found" },
        { status: 404 }
      );
    }

    const row = evaluationResult.rows[0];

    const evaluation = {
      id: row.id,
      teamId: row.team_id,
      createdBy: row.created_by,
      createdByName: row.created_by_name,
      name: row.name,
      oneVOneRounds: row.one_v_one_rounds,
      skillMovesCount: row.skill_moves_count,
      scores:
        typeof row.scores === "string" ? JSON.parse(row.scores) : row.scores,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };

    return NextResponse.json({ evaluation }, { status: 200 });
  } catch (error: any) {
    console.error("Get evaluation error:", error);
    return NextResponse.json(
      { error: "Failed to get evaluation", details: error.message },
      { status: 500 }
    );
  }
}

// PUT - Update evaluation scores
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; evaluationId: string }> }
) {
  try {
    const session = await auth();

    if (!session || !session.user?.email || !session.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id, evaluationId } = await params;
    const teamId = id;
    const body = await request.json();
    const { scores } = body;

    if (!scores || typeof scores !== "object") {
      return NextResponse.json(
        { error: "Scores object is required" },
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

    // Players/parents cannot update evaluations
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

    // Coaches can only update evaluations for their own teams
    if (userRole === "coach" && team.coach_id !== session.user.id) {
      return NextResponse.json(
        { error: "Unauthorized to update evaluation for this team" },
        { status: 403 }
      );
    }

    // Owners/admins can only update evaluations for teams in their company
    if (userRole !== "coach" && team.company_id !== companyId) {
      return NextResponse.json(
        { error: "Unauthorized to update evaluation for this team" },
        { status: 403 }
      );
    }

    // Update evaluation scores
    const result = await pool.query(
      `UPDATE evaluations 
       SET scores = $1::jsonb, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND team_id = $3
       RETURNING id, team_id, created_by, name, one_v_one_rounds, skill_moves_count, scores, created_at, updated_at`,
      [JSON.stringify(scores), evaluationId, teamId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Evaluation not found" },
        { status: 404 }
      );
    }

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
          scores:
            typeof evaluation.scores === "string"
              ? JSON.parse(evaluation.scores)
              : evaluation.scores,
          createdAt: evaluation.created_at,
          updatedAt: evaluation.updated_at,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Update evaluation error:", error);
    return NextResponse.json(
      { error: "Failed to update evaluation", details: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Delete an evaluation
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; evaluationId: string }> }
) {
  try {
    const session = await auth();

    if (!session || !session.user?.email || !session.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id, evaluationId } = await params;
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

    // Players/parents cannot delete evaluations
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

    // Coaches can only delete evaluations for their own teams
    if (userRole === "coach" && team.coach_id !== session.user.id) {
      return NextResponse.json(
        { error: "Unauthorized to delete evaluation for this team" },
        { status: 403 }
      );
    }

    // Owners/admins can only delete evaluations for teams in their company
    if (userRole !== "coach" && team.company_id !== companyId) {
      return NextResponse.json(
        { error: "Unauthorized to delete evaluation for this team" },
        { status: 403 }
      );
    }

    // Delete evaluation
    const result = await pool.query(
      "DELETE FROM evaluations WHERE id = $1 AND team_id = $2 RETURNING id",
      [evaluationId, teamId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Evaluation not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error("Delete evaluation error:", error);
    return NextResponse.json(
      { error: "Failed to delete evaluation", details: error.message },
      { status: 500 }
    );
  }
}
