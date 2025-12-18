export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { auth } from "@/lib/auth";
import bcrypt from "bcryptjs";
import {
  sendPlayerInvitationEmail,
  sendPlayerAddedNotificationEmail,
} from "@/lib/email";

// GET - Fetch all players for a team
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

    // Players cannot access team players
    if (userRole === "player") {
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

    // Get all players for this team
    const playersResult = await pool.query(
      `SELECT 
        p.id,
        p.user_id,
        p.team_id,
        p.first_name,
        p.last_name,
        p.dob,
        p.age_group,
        p.gender,
        p.dominant_foot,
        p.notes,
        p.created_at,
        p.updated_at,
        u.email,
        u.email_verified,
        u.onboarded
      FROM players p
      JOIN users u ON p.user_id = u.id
      WHERE p.team_id = $1
      ORDER BY p.last_name, p.first_name`,
      [teamId]
    );

    const players = playersResult.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      teamId: row.team_id,
      firstName: row.first_name,
      lastName: row.last_name,
      dob: row.dob,
      ageGroup: row.age_group,
      gender: row.gender,
      dominantFoot: row.dominant_foot,
      notes: row.notes,
      email: row.email,
      emailVerified: row.email_verified,
      onboarded: row.onboarded,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return NextResponse.json({ players }, { status: 200 });
  } catch (error: any) {
    console.error("Get players error:", error);
    return NextResponse.json(
      { error: "Failed to get players", details: error.message },
      { status: 500 }
    );
  }
}

// POST - Add a new player to a team
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
    const { firstName, lastName, email } = body;

    if (!firstName || !lastName || !email) {
      return NextResponse.json(
        { error: "First name, last name, and email are required" },
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

    // Players cannot add players to teams
    if (userRole === "player") {
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

    // Coaches can only add players to their own teams
    if (userRole === "coach" && team.coach_id !== session.user.id) {
      return NextResponse.json(
        { error: "Unauthorized to add players to this team" },
        { status: 403 }
      );
    }

    // Owners/admins can only add players to teams in their company
    if (userRole !== "coach" && team.company_id !== companyId) {
      return NextResponse.json(
        { error: "Unauthorized to add players to this team" },
        { status: 403 }
      );
    }

    // Check if user with this email already exists
    let userId: string;
    const existingUser = await pool.query(
      "SELECT id, role FROM users WHERE email = $1",
      [email]
    );

    if (existingUser.rows.length > 0) {
      // User exists, check if they're already a player
      userId = existingUser.rows[0].id;
      const existingRole = existingUser.rows[0].role;

      if (existingRole !== "player") {
        return NextResponse.json(
          {
            error: "User with this email already exists with a different role",
          },
          { status: 400 }
        );
      }

      // Check if this exact player (same user, team, first name, last name) already exists
      // This allows multiple players (like siblings) to share the same user/email
      const existingPlayer = await pool.query(
        "SELECT id FROM players WHERE user_id = $1 AND team_id = $2 AND first_name = $3 AND last_name = $4",
        [userId, teamId, firstName, lastName]
      );

      if (existingPlayer.rows.length > 0) {
        return NextResponse.json(
          { error: "This player is already on this team" },
          { status: 400 }
        );
      }

      // User exists and is a player - create a new player record for this team
      // This allows multiple player records (siblings) to share the same user account/email

      // Send notification email to let them know another player has been added
      try {
        // Get user's first name from their account
        const userInfoResult = await pool.query(
          "SELECT name FROM users WHERE id = $1",
          [userId]
        );
        const userFirstName =
          userInfoResult.rows[0]?.name?.split(" ")[0] || firstName;

        // Get team name
        const teamNameResult = await pool.query(
          "SELECT name FROM teams WHERE id = $1",
          [teamId]
        );
        const teamName = teamNameResult.rows[0]?.name || "Your Team";

        const origin =
          request.headers.get("origin") ||
          process.env.NEXTAUTH_URL ||
          process.env.NEXT_PUBLIC_APP_URL ||
          (process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : null) ||
          "http://localhost:3000";
        const loginUrl = `${origin}/login`;

        await sendPlayerAddedNotificationEmail(
          email,
          userFirstName,
          `${firstName} ${lastName}`,
          teamName,
          loginUrl
        );
      } catch (emailError) {
        console.error(
          "Failed to send player added notification email:",
          emailError
        );
        // Continue even if email fails
      }
    } else {
      // Create new user account
      // IMPORTANT: onboarded MUST be FALSE so player can complete onboarding and set their password/profile
      const tempPassword =
        Math.random().toString(36).slice(-12) +
        Math.random().toString(36).slice(-12).toUpperCase() +
        "!@#";
      const hashedPassword = await bcrypt.hash(tempPassword, 10);
      const emailCode = Math.floor(100000 + Math.random() * 900000).toString();

      const newUserResult = await pool.query(
        `INSERT INTO users (name, email, hashed_password, role, company_id, email_code, email_verified, onboarded)
         VALUES ($1, $2, $3, $4, $5, $6, TRUE, FALSE)
         RETURNING id`,
        [
          `${firstName} ${lastName}`,
          email,
          hashedPassword,
          "player",
          companyId,
          emailCode,
        ]
      );

      userId = newUserResult.rows[0].id;

      // Send invitation email
      try {
        // Get team name
        const teamNameResult = await pool.query(
          "SELECT name FROM teams WHERE id = $1",
          [teamId]
        );
        const teamName = teamNameResult.rows[0]?.name || "Your Team";

        const origin =
          request.headers.get("origin") ||
          process.env.NEXTAUTH_URL ||
          process.env.NEXT_PUBLIC_APP_URL ||
          (process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : null) ||
          "http://localhost:3000";
        const loginUrl = `${origin}/login`;

        await sendPlayerInvitationEmail(
          email,
          firstName,
          lastName,
          `${firstName} ${lastName}`,
          teamName,
          tempPassword,
          loginUrl
        );
      } catch (emailError) {
        console.error("Failed to send invitation email:", emailError);
        // Continue even if email fails
      }
    }

    // Create player record
    const playerResult = await pool.query(
      `INSERT INTO players (user_id, team_id, first_name, last_name)
       VALUES ($1, $2, $3, $4)
       RETURNING id, user_id, team_id, first_name, last_name, dob, age_group, gender, dominant_foot, notes, created_at, updated_at`,
      [userId, teamId, firstName, lastName]
    );

    const player = playerResult.rows[0];

    // Get user email info
    const userInfo = await pool.query(
      "SELECT email, email_verified, onboarded FROM users WHERE id = $1",
      [userId]
    );

    return NextResponse.json(
      {
        player: {
          id: player.id,
          userId: player.user_id,
          teamId: player.team_id,
          firstName: player.first_name,
          lastName: player.last_name,
          dob: player.dob,
          ageGroup: player.age_group,
          gender: player.gender,
          dominantFoot: player.dominant_foot,
          notes: player.notes,
          email: userInfo.rows[0].email,
          emailVerified: userInfo.rows[0].email_verified,
          onboarded: userInfo.rows[0].onboarded,
          createdAt: player.created_at,
          updatedAt: player.updated_at,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Create player error:", error);
    return NextResponse.json(
      { error: "Failed to create player", details: error.message },
      { status: 500 }
    );
  }
}
