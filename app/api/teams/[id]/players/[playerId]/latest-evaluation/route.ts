import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
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

    const userRole = userResult.rows[0].role as string;
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

    // Verify player exists and belongs to this team + get parent_user_id for access checks
    const playerCheck = await pool.query(
      "SELECT id, parent_user_id FROM players WHERE id = $1 AND team_id = $2",
      [playerId, teamId]
    );

    if (playerCheck.rows.length === 0) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }

    // Parents/players can only view player records they supervise
    if (
      (userRole === "player" || userRole === "parent") &&
      playerCheck.rows[0].parent_user_id !== session.user.id
    ) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const latestEval = await pool.query(
      `SELECT id, player_id, team_id, evaluation_id, name, created_at
       FROM player_evaluations
       WHERE player_id = $1 AND team_id = $2
       ORDER BY created_at DESC NULLS LAST
       LIMIT 1`,
      [playerId, teamId]
    );

    if (latestEval.rows.length === 0) {
      return NextResponse.json({ playerEvaluation: null }, { status: 200 });
    }

    const pe = latestEval.rows[0];

    const joined = await pool.query(
      `SELECT
        ts.scores as test_scores,
        os.scores as overall_scores,
        dna.dna as player_dna,
        pc.cluster as player_cluster
      FROM player_evaluations pe
      LEFT JOIN test_scores ts ON ts.player_evaluation_id = pe.id
      LEFT JOIN overall_scores os ON os.player_evaluation_id = pe.id
      LEFT JOIN player_dna dna ON dna.player_evaluation_id = pe.id
      LEFT JOIN player_cluster pc ON pc.player_evaluation_id = pe.id
      WHERE pe.id = $1`,
      [pe.id]
    );

    const row = joined.rows[0] ?? {};

    return NextResponse.json(
      {
        playerEvaluation: {
          id: pe.id,
          playerId: pe.player_id,
          teamId: pe.team_id,
          evaluationId: pe.evaluation_id,
          name: pe.name,
          createdAt: pe.created_at,
        },
        testScores: row.test_scores ?? null,
        overallScores: row.overall_scores ?? null,
        playerDna: row.player_dna ?? null,
        playerCluster: row.player_cluster ?? null,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Get latest player evaluation error:", error);
    return NextResponse.json(
      {
        error: "Failed to get latest player evaluation",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
