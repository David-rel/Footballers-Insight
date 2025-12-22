export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { auth } from "@/lib/auth";
import { put } from "@vercel/blob";

// GET - Fetch all teams for the user's company
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session || !session.user?.email || !session.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
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

    // Players/parents cannot access teams
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

    // For coaches, only show teams where they are the assigned coach
    // For owners/admins, show all teams in the company
    let teamsQuery = `
      SELECT 
        t.id,
        t.name,
        t.description,
        t.image_url,
        t.curriculum_id,
        t.coach_id,
        t.created_at,
        t.updated_at,
        c.name as curriculum_name,
        c.description as curriculum_description,
        c.tests as curriculum_tests,
        u.name as coach_name,
        u.email as coach_email,
        COUNT(p.id) as player_count
      FROM teams t
      LEFT JOIN curriculums c ON t.curriculum_id = c.id
      LEFT JOIN users u ON t.coach_id = u.id
      LEFT JOIN players p ON t.id = p.team_id
      WHERE t.company_id = $1
    `;

    const queryParams: any[] = [companyId];

    if (userRole === "coach") {
      teamsQuery += ` AND t.coach_id = $2`;
      queryParams.push(session.user.id);
    }

    teamsQuery += ` GROUP BY t.id, c.name, c.description, c.tests, u.name, u.email ORDER BY t.created_at DESC`;

    const teamsResult = await pool.query(teamsQuery, queryParams);

    const teams = teamsResult.rows.map((row) => {
      // Parse JSONB tests field
      let testsArray = [];
      if (row.curriculum_tests) {
        testsArray =
          typeof row.curriculum_tests === "string"
            ? JSON.parse(row.curriculum_tests)
            : row.curriculum_tests || [];
      }

      return {
        id: row.id,
        name: row.name,
        description: row.description,
        imageUrl: row.image_url,
        curriculumId: row.curriculum_id,
        curriculum: row.curriculum_id
          ? {
              id: row.curriculum_id,
              name: row.curriculum_name,
              description: row.curriculum_description,
              tests: testsArray,
            }
          : null,
        coachId: row.coach_id,
        coach: row.coach_id
          ? {
              id: row.coach_id,
              name: row.coach_name,
              email: row.coach_email,
            }
          : null,
        playerCount: parseInt(row.player_count) || 0,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    });

    return NextResponse.json({ teams }, { status: 200 });
  } catch (error: any) {
    console.error("Get teams error:", error);
    return NextResponse.json(
      { error: "Failed to get teams", details: error.message },
      { status: 500 }
    );
  }
}

// POST - Create a new team
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session || !session.user?.email || !session.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const formData = await request.formData();
    const name = formData.get("name") as string | null;
    const description = formData.get("description") as string | null;
    const imageUrl = formData.get("imageUrl") as string | null;
    const curriculumId = formData.get("curriculumId") as string | null;
    const coachId = formData.get("coachId") as string | null;
    const image = formData.get("image") as File | null;

    if (!name) {
      return NextResponse.json(
        { error: "Team name is required" },
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

    // Players and coaches cannot create teams
    if (userRole === "player" || userRole === "coach") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    let companyId: string | null = userResult.rows[0].company_id;

    // Handle image upload
    let finalImageUrl: string | null = imageUrl || null;
    if (image) {
      const blob = await put(
        `team-banners/${session.user.id}-${Date.now()}-${image.name}`,
        image,
        {
          access: "public",
          token: process.env.BLOB_READ_WRITE_TOKEN,
        }
      );
      finalImageUrl = blob.url;
    }

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

    // Verify coach belongs to the same company if coachId is provided
    if (coachId) {
      const coachResult = await pool.query(
        "SELECT id, role, company_id FROM users WHERE id = $1",
        [coachId]
      );

      if (coachResult.rows.length === 0) {
        return NextResponse.json({ error: "Coach not found" }, { status: 404 });
      }

      const coach = coachResult.rows[0];
      if (coach.company_id !== companyId) {
        return NextResponse.json(
          { error: "Coach does not belong to your company" },
          { status: 403 }
        );
      }

      if (coach.role !== "coach") {
        return NextResponse.json(
          { error: "Selected user is not a coach" },
          { status: 400 }
        );
      }
    }

    // Verify curriculum exists if curriculumId is provided
    if (curriculumId) {
      const curriculumResult = await pool.query(
        "SELECT id FROM curriculums WHERE id = $1",
        [curriculumId]
      );

      if (curriculumResult.rows.length === 0) {
        return NextResponse.json(
          { error: "Curriculum not found" },
          { status: 404 }
        );
      }
    }

    // Create the team
    const insertResult = await pool.query(
      `INSERT INTO teams (company_id, name, description, image_url, curriculum_id, coach_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, description, image_url, curriculum_id, coach_id, created_at, updated_at`,
      [
        companyId,
        name,
        description || null,
        finalImageUrl,
        curriculumId || null,
        coachId || null,
      ]
    );

    const team = insertResult.rows[0];

    // Fetch related data
    let curriculum = null;
    let coach = null;

    if (team.curriculum_id) {
      const curriculumResult = await pool.query(
        "SELECT id, name, description, tests FROM curriculums WHERE id = $1",
        [team.curriculum_id]
      );
      if (curriculumResult.rows.length > 0) {
        const testsData = curriculumResult.rows[0].tests;
        const testsArray =
          typeof testsData === "string"
            ? JSON.parse(testsData)
            : testsData || [];

        curriculum = {
          id: curriculumResult.rows[0].id,
          name: curriculumResult.rows[0].name,
          description: curriculumResult.rows[0].description,
          tests: testsArray,
        };
      }
    }

    if (team.coach_id) {
      const coachResult = await pool.query(
        "SELECT id, name, email FROM users WHERE id = $1",
        [team.coach_id]
      );
      if (coachResult.rows.length > 0) {
        coach = {
          id: coachResult.rows[0].id,
          name: coachResult.rows[0].name,
          email: coachResult.rows[0].email,
        };
      }
    }

    return NextResponse.json(
      {
        team: {
          id: team.id,
          name: team.name,
          description: team.description,
          imageUrl: team.image_url,
          curriculumId: team.curriculum_id,
          curriculum,
          coachId: team.coach_id,
          coach,
          createdAt: team.created_at,
          updatedAt: team.updated_at,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Create team error:", error);
    return NextResponse.json(
      { error: "Failed to create team", details: error.message },
      { status: 500 }
    );
  }
}
