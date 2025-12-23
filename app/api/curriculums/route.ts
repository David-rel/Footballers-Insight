export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { auth } from "@/lib/auth";

// GET - Fetch all curriculums
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session || !session.user?.email || !session.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Get user role
    const userResult = await pool.query(
      "SELECT role FROM users WHERE id = $1",
      [session.user.id]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const role = userResult.rows[0].role;

    // Players and parents cannot access curriculums
    if (role === "player" || role === "parent") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Coaches can only see curriculums they created
    // Admins and owners can see all curriculums
    let curriculumsQuery = `
      SELECT id, name, description, tests, created_by, created_at, updated_at
      FROM curriculums
    `;
    const queryParams: any[] = [];

    if (role === "coach") {
      curriculumsQuery += ` WHERE created_by = $1`;
      queryParams.push(session.user.id);
    }

    curriculumsQuery += ` ORDER BY name`;

    const curriculumsResult = await pool.query(curriculumsQuery, queryParams);

    const curriculums = curriculumsResult.rows.map((row) => {
      // Parse JSONB tests field
      const testsArray =
        typeof row.tests === "string" ? JSON.parse(row.tests) : row.tests || [];

      return {
        id: row.id,
        name: row.name,
        description: row.description,
        tests: testsArray,
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    });

    return NextResponse.json({ curriculums }, { status: 200 });
  } catch (error: any) {
    console.error("Get curriculums error:", error);
    return NextResponse.json(
      { error: "Failed to get curriculums", details: error.message },
      { status: 500 }
    );
  }
}

// POST - Create a new curriculum
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session || !session.user?.email || !session.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Get user role
    const userResult = await pool.query(
      "SELECT role FROM users WHERE id = $1",
      [session.user.id]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const role = userResult.rows[0].role;

    // Players and parents cannot create curriculums
    // Coaches, admins, and owners can create curriculums
    if (role === "player" || role === "parent") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

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

    // Create the curriculum with created_by
    const insertResult = await pool.query(
      `INSERT INTO curriculums (name, description, tests, created_by)
       VALUES ($1, $2, $3::jsonb, $4)
       RETURNING id, name, description, tests, created_by, created_at, updated_at`,
      [
        name,
        description || null,
        tests ? JSON.stringify(tests) : "[]",
        session.user.id,
      ]
    );

    const curriculum = insertResult.rows[0];

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
          createdBy: curriculum.created_by,
          createdAt: curriculum.created_at,
          updatedAt: curriculum.updated_at,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Create curriculum error:", error);
    return NextResponse.json(
      { error: "Failed to create curriculum", details: error.message },
      { status: 500 }
    );
  }
}
