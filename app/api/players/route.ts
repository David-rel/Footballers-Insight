export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { auth } from "@/lib/auth";

// GET - Fetch all players with their team and coach information
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

    // Build query to get all players with team and coach information
    // For coaches, only show players from their teams
    // For parents/players, only show player records they supervise
    let playersQuery = `
      SELECT 
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
        u.image_url,
        t.name as team_name,
        t.company_id as team_company_id,
        t.coach_id as team_coach_id,
        coach.name as coach_name,
        coach.email as coach_email
      FROM players p
      JOIN users u ON p.parent_user_id = u.id
      JOIN teams t ON p.team_id = t.id
      LEFT JOIN users coach ON t.coach_id = coach.id
      WHERE t.company_id = $1
    `;

    const queryParams: any[] = [companyId];

    // If user is a parent/player, only show player records they supervise
    if (userRole === "parent" || userRole === "player") {
      playersQuery += ` AND p.parent_user_id = $2`;
      queryParams.push(session.user.id);
    }
    // If user is a coach, only show players from their teams
    else if (userRole === "coach") {
      playersQuery += ` AND t.coach_id = $2`;
      queryParams.push(session.user.id);
    }

    playersQuery += ` ORDER BY p.last_name, p.first_name`;

    const playersResult = await pool.query(playersQuery, queryParams);

    const players = playersResult.rows.map((row) => {
      // Calculate age from date of birth
      let age: number | null = null;
      if (row.dob) {
        const birthDate = new Date(row.dob);
        const today = new Date();
        age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (
          monthDiff < 0 ||
          (monthDiff === 0 && today.getDate() < birthDate.getDate())
        ) {
          age--;
        }
      }

      return {
        id: row.id,
        parentUserId: row.parent_user_id,
        teamId: row.team_id,
        firstName: row.first_name,
        lastName: row.last_name,
        fullName: `${row.first_name} ${row.last_name}`,
        dob: row.dob,
        age,
        ageGroup: row.age_group,
        gender: row.gender,
        dominantFoot: row.dominant_foot,
        notes: row.notes,
        selfSupervised: row.self_supervised,
        email: row.email,
        emailVerified: row.email_verified,
        onboarded: row.onboarded,
        imageUrl: row.image_url,
        teamName: row.team_name,
        coachId: row.team_coach_id,
        coachName: row.coach_name,
        coachEmail: row.coach_email,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    });

    return NextResponse.json({ players }, { status: 200 });
  } catch (error: any) {
    console.error("Get players error:", error);
    return NextResponse.json(
      { error: "Failed to get players", details: error.message },
      { status: 500 }
    );
  }
}

