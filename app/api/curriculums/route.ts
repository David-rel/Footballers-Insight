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

    // Coaches, players, and parents cannot access curriculums
    const userResult = await pool.query(
      "SELECT role FROM users WHERE id = $1",
      [session.user.id]
    );

    if (userResult.rows.length > 0) {
      const role = userResult.rows[0].role;
      if (role === "coach" || role === "player" || role === "parent") {
        return NextResponse.json(
          { error: "Access denied" },
          { status: 403 }
        );
      }
    }

    // Get all curriculums
    const curriculumsResult = await pool.query(
      `SELECT id, name, description, tests, created_at, updated_at
       FROM curriculums
       ORDER BY name`
    );

    const curriculums = curriculumsResult.rows.map((row) => {
      // Parse JSONB tests field
      const testsArray = typeof row.tests === 'string' 
        ? JSON.parse(row.tests) 
        : (row.tests || []);
      
      return {
        id: row.id,
        name: row.name,
        description: row.description,
        tests: testsArray,
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

    // Coaches, players, and parents cannot create curriculums
    const userResult = await pool.query(
      "SELECT role FROM users WHERE id = $1",
      [session.user.id]
    );

    if (userResult.rows.length > 0) {
      const role = userResult.rows[0].role;
      if (role === "coach" || role === "player" || role === "parent") {
        return NextResponse.json(
          { error: "Access denied" },
          { status: 403 }
        );
      }
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

    // Create the curriculum
    const insertResult = await pool.query(
      `INSERT INTO curriculums (name, description, tests)
       VALUES ($1, $2, $3::jsonb)
       RETURNING id, name, description, tests, created_at, updated_at`,
      [name, description || null, tests ? JSON.stringify(tests) : "[]"]
    );

    const curriculum = insertResult.rows[0];

    // Parse JSONB tests field
    const testsArray = typeof curriculum.tests === 'string' 
      ? JSON.parse(curriculum.tests) 
      : (curriculum.tests || []);

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

