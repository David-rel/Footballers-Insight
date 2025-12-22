export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { auth } from "@/lib/auth";

// PUT - Update a curriculum
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session || !session.user?.email || !session.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Coaches, players, and parents cannot update curriculums
    const userResult = await pool.query(
      "SELECT role FROM users WHERE id = $1",
      [session.user.id]
    );

    if (userResult.rows.length > 0) {
      const role = userResult.rows[0].role;
      if (role === "coach" || role === "player" || role === "parent") {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
    }

    const { id } = await params;
    const curriculumId = id;
    const body = await request.json();
    const { name, description, tests } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Curriculum name is required" },
        { status: 400 }
      );
    }

    // Validate tests is an array if provided
    if (tests !== undefined && !Array.isArray(tests)) {
      return NextResponse.json(
        { error: "Tests must be an array" },
        { status: 400 }
      );
    }

    // Verify curriculum exists
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

    // Update the curriculum
    const updateResult = await pool.query(
      `UPDATE curriculums 
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           tests = COALESCE($3::jsonb, tests),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING id, name, description, tests, created_at, updated_at`,
      [
        name || null,
        description !== undefined ? description : null,
        tests !== undefined ? JSON.stringify(tests) : null,
        curriculumId,
      ]
    );

    const curriculum = updateResult.rows[0];

    // Parse JSONB tests field
    const testsArray =
      typeof curriculum.tests === "string"
        ? JSON.parse(curriculum.tests)
        : curriculum.tests || [];

    return NextResponse.json(
      {
        curriculum: {
          id: curriculum.id,
          name: curriculum.name,
          description: curriculum.description,
          tests: testsArray,
          createdAt: curriculum.created_at,
          updatedAt: curriculum.updated_at,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Update curriculum error:", error);
    return NextResponse.json(
      { error: "Failed to update curriculum", details: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Delete a curriculum
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session || !session.user?.email || !session.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Coaches, players, and parents cannot delete curriculums
    const userResult = await pool.query(
      "SELECT role FROM users WHERE id = $1",
      [session.user.id]
    );

    if (userResult.rows.length > 0) {
      const role = userResult.rows[0].role;
      if (role === "coach" || role === "player" || role === "parent") {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
    }

    const { id } = await params;
    const curriculumId = id;

    // Verify curriculum exists
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

    // Delete the curriculum
    await pool.query("DELETE FROM curriculums WHERE id = $1", [curriculumId]);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error("Delete curriculum error:", error);
    return NextResponse.json(
      { error: "Failed to delete curriculum", details: error.message },
      { status: 500 }
    );
  }
}
