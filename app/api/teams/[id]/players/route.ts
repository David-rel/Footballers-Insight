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

    // Players/parents cannot access team players (staff only)
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

    // Get all players for this team
    const playersResult = await pool.query(
      `SELECT 
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
        u.name as parent_name,
        u.email,
        u.phone_number as parent_phone_number,
        u.email_verified,
        u.onboarded
      FROM players p
      JOIN users u ON p.parent_user_id = u.id
      WHERE p.team_id = $1
      ORDER BY p.last_name, p.first_name`,
      [teamId]
    );

    const players = playersResult.rows.map((row) => ({
      id: row.id,
      parentUserId: row.parent_user_id,
      teamId: row.team_id,
      firstName: row.first_name,
      lastName: row.last_name,
      dob: row.dob,
      ageGroup: row.age_group,
      gender: row.gender,
      dominantFoot: row.dominant_foot,
      notes: row.notes,
      selfSupervised: row.self_supervised,
      parentName: row.parent_name,
      parentPhoneNumber: row.parent_phone_number,
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
    const {
      firstName,
      lastName,
      // New model: supervisor account is always a 'parent' user (can be self-supervised player)
      hasParent,
      parentMode, // legacy (no longer supported in UI)
      existingParentId, // legacy (no longer supported)
      parentName,
      parentEmail,
      selfSupervised,
      selfSupervisorEmail,
    } = body;

    if (!firstName || !lastName) {
      return NextResponse.json(
        { error: "First name and last name are required" },
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

    // Players/parents cannot add players to teams
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

    // Validate supervisor selection (mutually exclusive)
    const wantsParent = !!hasParent && !selfSupervised;
    const wantsSelf = !!selfSupervised && !hasParent;

    if (!wantsParent && !wantsSelf) {
      return NextResponse.json(
        {
          error:
            "Please choose either: link to a parent/guardian, or mark the player as self-supervised.",
        },
        { status: 400 }
      );
    }

    let supervisorUserId: string;
    let supervisorEmail: string;

    // Build origin/loginUrl once for emails
    const origin =
      request.headers.get("origin") ||
      process.env.NEXTAUTH_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
      "http://localhost:3000";
    const loginUrl = `${origin}/login`;

    // Get team name (for emails)
    const teamNameResult = await pool.query(
      "SELECT name FROM teams WHERE id = $1",
      [teamId]
    );
    const teamName = teamNameResult.rows[0]?.name || "Your Team";

    if (wantsParent) {
      // Security: do NOT allow selecting arbitrary parent IDs.
      if (existingParentId || parentMode === "existing") {
        return NextResponse.json(
          { error: "Selecting an existing parent is not allowed." },
          { status: 400 }
        );
      }

      // Create or reuse parent by email
      if (!parentEmail) {
        return NextResponse.json(
          { error: "Parent/guardian email is required." },
          { status: 400 }
        );
      }
      if (!parentName) {
        return NextResponse.json(
          { error: "Parent/guardian name is required." },
          { status: 400 }
        );
      }

      const existing = await pool.query(
        "SELECT id, role, name FROM users WHERE email = $1",
        [parentEmail]
      );

      if (existing.rows.length > 0) {
        const u = existing.rows[0];
        if (u.role === "owner" || u.role === "admin" || u.role === "coach") {
          return NextResponse.json(
            {
              error:
                "User with this email already exists as staff. Please use a different email.",
            },
            { status: 400 }
          );
        }

        // Convert legacy player users to parent
        if (u.role !== "parent") {
          await pool.query("UPDATE users SET role = 'parent' WHERE id = $1", [
            u.id,
          ]);
        }

        // Ensure company_id is set
        await pool.query(
          "UPDATE users SET company_id = $1 WHERE id = $2 AND company_id IS NULL",
          [companyId, u.id]
        );

        supervisorUserId = u.id;
        supervisorEmail = parentEmail;

        // Notify existing parent that a player was added (no new invite sent)
        try {
          await sendPlayerAddedNotificationEmail(
            parentEmail,
            u.name || "Parent",
            `${firstName} ${lastName}`,
            teamName,
            loginUrl
          );
        } catch (emailError) {
          console.error(
            "Failed to send player added notification email:",
            emailError
          );
        }
      } else {
        // Create parent user with temp password (onboarded = FALSE)
        const tempPassword =
          Math.random().toString(36).slice(-12) +
          Math.random().toString(36).slice(-12).toUpperCase() +
          "!@#";
        const hashedPassword = await bcrypt.hash(tempPassword, 10);
        const emailCode = Math.floor(
          100000 + Math.random() * 900000
        ).toString();

        const newUserResult = await pool.query(
          `INSERT INTO users (name, email, hashed_password, role, company_id, email_code, email_verified, onboarded)
           VALUES ($1, $2, $3, 'parent', $4, $5, TRUE, FALSE)
           RETURNING id`,
          [parentName, parentEmail, hashedPassword, companyId, emailCode]
        );

        supervisorUserId = newUserResult.rows[0].id;
        supervisorEmail = parentEmail;

        // Send invitation email (reusing existing template for now)
        try {
          await sendPlayerInvitationEmail(
            parentEmail,
            parentName,
            `${firstName} ${lastName}`,
            teamName,
            tempPassword,
            loginUrl,
            false
          );
        } catch (emailError) {
          console.error("Failed to send parent invitation email:", emailError);
        }
      }
    } else {
      // Self-supervised player: login account is still a 'parent' role user (same person)
      if (!selfSupervisorEmail) {
        return NextResponse.json(
          {
            error: "Supervisor email is required for self-supervised players.",
          },
          { status: 400 }
        );
      }

      supervisorEmail = selfSupervisorEmail;
      const existing = await pool.query(
        "SELECT id, role FROM users WHERE email = $1",
        [selfSupervisorEmail]
      );

      if (existing.rows.length > 0) {
        const u = existing.rows[0];
        if (u.role === "owner" || u.role === "admin" || u.role === "coach") {
          return NextResponse.json(
            {
              error:
                "User with this email already exists as staff. Please use a different email.",
            },
            { status: 400 }
          );
        }
        if (u.role !== "parent") {
          await pool.query("UPDATE users SET role = 'parent' WHERE id = $1", [
            u.id,
          ]);
        }
        await pool.query(
          "UPDATE users SET company_id = $1 WHERE id = $2 AND company_id IS NULL",
          [companyId, u.id]
        );
        supervisorUserId = u.id;

        // Notify existing user that a player was added/linked
        try {
          // self-supervised may not have a perfect name; use DB name if available
          const nameRes = await pool.query(
            "SELECT name FROM users WHERE id = $1",
            [u.id]
          );
          await sendPlayerAddedNotificationEmail(
            selfSupervisorEmail,
            nameRes.rows[0]?.name || "Parent",
            `${firstName} ${lastName}`,
            teamName,
            loginUrl
          );
        } catch (emailError) {
          console.error(
            "Failed to send player added notification email:",
            emailError
          );
        }
      } else {
        const tempPassword =
          Math.random().toString(36).slice(-12) +
          Math.random().toString(36).slice(-12).toUpperCase() +
          "!@#";
        const hashedPassword = await bcrypt.hash(tempPassword, 10);
        const emailCode = Math.floor(
          100000 + Math.random() * 900000
        ).toString();

        // Name is required by schema; for self-supervised we store the player's name.
        const derivedName = `${firstName} ${lastName}`;

        const newUserResult = await pool.query(
          `INSERT INTO users (name, email, hashed_password, role, company_id, email_code, email_verified, onboarded)
           VALUES ($1, $2, $3, 'parent', $4, $5, TRUE, FALSE)
           RETURNING id`,
          [
            derivedName,
            selfSupervisorEmail,
            hashedPassword,
            companyId,
            emailCode,
          ]
        );
        supervisorUserId = newUserResult.rows[0].id;

        try {
          await sendPlayerInvitationEmail(
            selfSupervisorEmail,
            derivedName,
            `${firstName} ${lastName}`,
            teamName,
            tempPassword,
            loginUrl,
            true
          );
        } catch (emailError) {
          console.error(
            "Failed to send self-supervised invitation email:",
            emailError
          );
        }
      }
    }

    // Prevent duplicates for same team + name + supervisor
    const existingPlayer = await pool.query(
      `SELECT id FROM players 
       WHERE team_id = $1 AND first_name = $2 AND last_name = $3 AND parent_user_id = $4`,
      [teamId, firstName, lastName, supervisorUserId]
    );

    if (existingPlayer.rows.length > 0) {
      return NextResponse.json(
        { error: "This player is already on this team" },
        { status: 400 }
      );
    }

    // Create player record
    const playerResult = await pool.query(
      `INSERT INTO players (parent_user_id, team_id, first_name, last_name, self_supervised)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, parent_user_id, team_id, first_name, last_name, dob, age_group, gender, dominant_foot, notes, self_supervised, created_at, updated_at`,
      [supervisorUserId, teamId, firstName, lastName, !!selfSupervised]
    );

    const player = playerResult.rows[0];

    // Get user email info
    const userInfo = await pool.query(
      "SELECT email, email_verified, onboarded FROM users WHERE id = $1",
      [supervisorUserId]
    );

    return NextResponse.json(
      {
        player: {
          id: player.id,
          parentUserId: player.parent_user_id,
          teamId: player.team_id,
          firstName: player.first_name,
          lastName: player.last_name,
          dob: player.dob,
          ageGroup: player.age_group,
          gender: player.gender,
          dominantFoot: player.dominant_foot,
          notes: player.notes,
          selfSupervised: player.self_supervised,
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
