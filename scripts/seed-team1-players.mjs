#!/usr/bin/env node

/**
 * Seed 16 players to team 1 (2015 boys)
 * All players will have verified email and be onboarded
 */

import { config as loadEnv } from "dotenv";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

loadEnv({ path: ".env.local" });
loadEnv();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error(
    "❌ DATABASE_URL is not set. Export it before running this script."
  );
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: connectionString.includes("sslmode=require")
    ? { rejectUnauthorized: false }
    : undefined,
});

// Sample first and last names for 2015 boys
const firstNames = [
  "Liam",
  "Noah",
  "Oliver",
  "William",
  "James",
  "Benjamin",
  "Lucas",
  "Henry",
  "Alexander",
  "Mason",
  "Michael",
  "Ethan",
  "Daniel",
  "Jacob",
  "Logan",
  "Jackson",
];

const lastNames = [
  "Smith",
  "Johnson",
  "Williams",
  "Brown",
  "Jones",
  "Garcia",
  "Miller",
  "Davis",
  "Rodriguez",
  "Martinez",
  "Hernandez",
  "Lopez",
  "Wilson",
  "Anderson",
  "Thomas",
  "Taylor",
];

async function seedPlayers() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    console.log("🔍 Finding team 1...");

    // Find team 1
    const teamResult = await client.query(
      "SELECT id, company_id FROM teams WHERE name = $1 LIMIT 1",
      ["team 1"]
    );

    if (teamResult.rows.length === 0) {
      console.error("❌ team 1 not found. Please create team 1 first.");
      await client.query("ROLLBACK");
      process.exit(1);
    }

    const teamId = teamResult.rows[0].id;
    const companyId = teamResult.rows[0].company_id;

    console.log(`✅ Found team 1 (ID: ${teamId})`);

    // Check how many players already exist in team 1
    const existingPlayersResult = await client.query(
      "SELECT COUNT(*) as count FROM players WHERE team_id = $1",
      [teamId]
    );
    const existingCount = parseInt(existingPlayersResult.rows[0].count);
    console.log(`📊 Current players in team 1: ${existingCount}`);

    // Generate a default password hash
    const defaultPassword = "password123";
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    console.log("👥 Creating 16 players...");

    // Create 16 players
    for (let i = 0; i < 16; i++) {
      const firstName = firstNames[i];
      const lastName = lastNames[i];
      const email = `player${
        i + 1 + existingCount
      }.team1.2015@footballers.test`;
      const fullName = `${firstName} ${lastName}`;

      // Create user with role "player"
      const userResult = await client.query(
        `INSERT INTO users (
          name, email, hashed_password, role, company_id, 
          email_verified, onboarded
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id`,
        [fullName, email, hashedPassword, "player", companyId, true, true]
      );

      const userId = userResult.rows[0].id;

      // Calculate DOB for 2015 (assuming mid-year birthday for age group)
      const dob = new Date("2015-06-15");

      // Create player record
      await client.query(
        `INSERT INTO players (
          user_id, team_id, first_name, last_name, dob, age_group, gender, dominant_foot
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          userId,
          teamId,
          firstName,
          lastName,
          dob,
          "2015",
          "male",
          i % 3 === 0 ? "left" : i % 3 === 1 ? "right" : "both", // Mix of dominant feet
        ]
      );

      console.log(`  ✅ Created ${fullName} (${email})`);
    }

    await client.query("COMMIT");
    console.log("\n✅ Successfully seeded 16 players to team 1!");
    console.log("📝 All players have:");
    console.log("   - Email verified: true");
    console.log("   - Onboarded: true");
    console.log("   - Age group: 2015");
    console.log("   - Gender: male");
    console.log(`   - Default password: ${defaultPassword}`);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Seed failed:");
    console.error(error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

seedPlayers().catch((error) => {
  console.error("❌ Unexpected error during seed:");
  console.error(error);
  process.exit(1);
});
