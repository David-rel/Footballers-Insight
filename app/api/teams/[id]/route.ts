export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { auth } from "@/lib/auth";
import { put } from "@vercel/blob";

// PUT - Update a team
export async function PUT(
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
    const formData = await request.formData();
    const name = formData.get("name") as string | null;
    const description = formData.get("description") as string | null;
    const imageUrl = formData.get("imageUrl") as string | null;
    const curriculumId = formData.get("curriculumId") as string | null;
    const coachId = formData.get("coachId") as string | null;
    const image = formData.get("image") as File | null;

    // Get user's role and company_id
    const userCheckResult = await pool.query(
      "SELECT role FROM users WHERE id = $1",
      [session.user.id]
    );

    if (userCheckResult.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userRole = userCheckResult.rows[0].role;

    // Players and coaches cannot update teams
    if (userRole === "player" || userRole === "coach") {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    // Get company_id
    const userResult = await pool.query(
      "SELECT company_id FROM users WHERE id = $1",
      [session.user.id]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
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
      "SELECT id, company_id FROM teams WHERE id = $1",
      [teamId]
    );

    if (teamResult.rows.length === 0) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    if (teamResult.rows[0].company_id !== companyId) {
      return NextResponse.json(
        { error: "Unauthorized to update this team" },
        { status: 403 }
      );
    }

    // Verify coach belongs to the same company if coachId is provided
    if (coachId) {
      const coachResult = await pool.query(
        "SELECT id, role, company_id FROM users WHERE id = $1",
        [coachId]
      );

      if (coachResult.rows.length === 0) {
        return NextResponse.json(
          { error: "Coach not found" },
          { status: 404 }
        );
      }

      const coach = coachResult.rows[0];
      if (coach.company_id !== companyId) {
        return NextResponse.json(
          { error: "Coach does not belong to your company" },
          { status: 403 }
        );
      }

      // Allow coaches, admins, and owners to be assigned as coaches
      if (!["coach", "admin", "owner"].includes(coach.role)) {
        return NextResponse.json(
          { error: "Selected user cannot be assigned as a coach" },
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

    // Handle image upload
    let finalImageUrl: string | null | undefined = imageUrl;
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

    // Update the team
    const updateResult = await pool.query(
      `UPDATE teams 
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           image_url = COALESCE($3, image_url),
           curriculum_id = COALESCE($4, curriculum_id),
           coach_id = COALESCE($5, coach_id),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6
       RETURNING id, name, description, image_url, curriculum_id, coach_id, created_at, updated_at`,
      [
        name || null,
        description !== undefined ? description : null,
        finalImageUrl !== undefined ? finalImageUrl : null,
        curriculumId !== undefined ? curriculumId : null,
        coachId !== undefined ? coachId : null,
        teamId,
      ]
    );

    const team = updateResult.rows[0];

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
        const testsArray = typeof testsData === 'string' 
          ? JSON.parse(testsData) 
          : (testsData || []);
        
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
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Update team error:", error);
    return NextResponse.json(
      { error: "Failed to update team", details: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Delete a team
export async function DELETE(
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

    // Get user's role first to check permissions
    const userCheckResult = await pool.query(
      "SELECT role FROM users WHERE id = $1",
      [session.user.id]
    );

    if (userCheckResult.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userRole = userCheckResult.rows[0].role;

    // Players and coaches cannot delete teams
    if (userRole === "player" || userRole === "coach") {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    // Get user's company_id
    const userResult = await pool.query(
      "SELECT company_id FROM users WHERE id = $1",
      [session.user.id]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
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
      "SELECT id, company_id FROM teams WHERE id = $1",
      [teamId]
    );

    if (teamResult.rows.length === 0) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    if (teamResult.rows[0].company_id !== companyId) {
      return NextResponse.json(
        { error: "Unauthorized to delete this team" },
        { status: 403 }
      );
    }

    // Delete the team
    await pool.query("DELETE FROM teams WHERE id = $1", [teamId]);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error("Delete team error:", error);
    return NextResponse.json(
      { error: "Failed to delete team", details: error.message },
      { status: 500 }
    );
  }
}

