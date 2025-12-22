#!/usr/bin/env node

import { Pool } from "pg";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });
loadEnv();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("❌ DATABASE_URL is not set.");
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: connectionString.includes("sslmode=require")
    ? { rejectUnauthorized: false }
    : undefined,
});

async function showPlayerStats() {
  try {
    // Get Cycle 1 evaluation
    const evalResult = await pool.query(
      "SELECT id, team_id, scores FROM evaluations WHERE name = 'Cycle 1' LIMIT 1"
    );

    if (evalResult.rows.length === 0) {
      console.log("No Cycle 1 evaluation found");
      process.exit(1);
    }

    const evaluation = evalResult.rows[0];
    const scores =
      typeof evaluation.scores === "string"
        ? JSON.parse(evaluation.scores)
        : evaluation.scores;

    // Get first 2 players
    const playerResult = await pool.query(
      "SELECT id, first_name, last_name FROM players WHERE team_id = $1 ORDER BY first_name LIMIT 2",
      [evaluation.team_id]
    );

    if (playerResult.rows.length === 0) {
      console.log("No players found");
      process.exit(1);
    }

    // Display each player
    for (const player of playerResult.rows) {
      const playerScores = scores[player.id] || {};

      console.log("\n" + "=".repeat(60));
      console.log(`PLAYER: ${player.first_name} ${player.last_name}`);
      console.log("=".repeat(60));
      console.log("");

      // Power
      console.log("POWER:");
      for (let i = 1; i <= 4; i++) {
        console.log(
          `  Strong attempt ${i}: ${playerScores[`power_strong_${i}`] || "—"}`
        );
      }
      for (let i = 1; i <= 4; i++) {
        console.log(
          `  Weak attempt ${i}: ${playerScores[`power_weak_${i}`] || "—"}`
        );
      }
      console.log("");

      // Serve Distance
      console.log("SERVE DISTANCE:");
      for (let i = 1; i <= 4; i++) {
        console.log(
          `  Strong attempt ${i}: ${playerScores[`serve_strong_${i}`] || "—"}`
        );
      }
      for (let i = 1; i <= 4; i++) {
        console.log(
          `  Weak attempt ${i}: ${playerScores[`serve_weak_${i}`] || "—"}`
        );
      }
      console.log("");

      // Figure 8 Loops
      console.log("FIGURE 8 LOOPS:");
      console.log(`  Strong foot: ${playerScores.figure8_strong || "—"}`);
      console.log(`  Weak foot: ${playerScores.figure8_weak || "—"}`);
      console.log(`  Both feet: ${playerScores.figure8_both || "—"}`);
      console.log("");

      // Passing Gates
      console.log("PASSING GATES:");
      console.log(`  Strong foot: ${playerScores.passing_strong || "—"}`);
      console.log(`  Weak foot: ${playerScores.passing_weak || "—"}`);
      console.log("");

      // 1v1
      console.log("1V1:");
      for (let i = 1; i <= 6; i++) {
        console.log(
          `  Round ${i} score: ${playerScores[`onevone_round_${i}`] || "—"}`
        );
      }
      console.log("");

      // Juggling
      console.log("JUGGLING:");
      for (let i = 1; i <= 4; i++) {
        console.log(
          `  Attempt ${i} touches: ${playerScores[`juggling_${i}`] || "—"}`
        );
      }
      console.log("");

      // Skill Moves
      console.log("SKILL MOVES:");
      for (let i = 1; i <= 6; i++) {
        console.log(
          `  Move ${i} rating: ${playerScores[`skillmove_${i}`] || "—"}`
        );
      }
      console.log("");

      // Agility
      console.log("5-10-5 AGILITY:");
      for (let i = 1; i <= 3; i++) {
        console.log(`  Trial ${i} time: ${playerScores[`agility_${i}`] || "—"}`);
      }
      console.log("");

      // Reaction Sprint
      console.log("REACTION SPRINT:");
      for (let i = 1; i <= 3; i++) {
        console.log(
          `  Reaction trial ${i} time: ${playerScores[`reaction_cue_${i}`] || "—"}`
        );
        console.log(
          `  Reaction total trial ${i} time: ${playerScores[`reaction_total_${i}`] || "—"}`
        );
      }
      console.log("");

      // Single-leg Hop
      console.log("SINGLE-LEG HOP:");
      for (let i = 1; i <= 3; i++) {
        console.log(
          `  Left attempt ${i} distance: ${playerScores[`hop_left_${i}`] || "—"}`
        );
      }
      for (let i = 1; i <= 3; i++) {
        console.log(
          `  Right attempt ${i} distance: ${playerScores[`hop_right_${i}`] || "—"}`
        );
      }
      console.log("");

      // Double-leg Jumps
      console.log("DOUBLE-LEG JUMPS:");
      console.log(`  Count at 10 seconds: ${playerScores.jumps_10s || "—"}`);
      console.log(`  Count at 20 seconds: ${playerScores.jumps_20s || "—"}`);
      console.log(`  Count at 30 seconds: ${playerScores.jumps_30s || "—"}`);
      console.log("");

      // Ankle Dorsiflexion
      console.log("ANKLE DORSIFLEXION:");
      console.log(`  Left distance: ${playerScores.ankle_left || "—"}`);
      console.log(`  Right distance: ${playerScores.ankle_right || "—"}`);
      console.log("");

      // Core Plank
      console.log("CORE PLANK:");
      console.log(`  Hold time: ${playerScores.plank_time || "—"}`);
      console.log(`  Form flag: ${playerScores.plank_form || "—"}`);
      console.log("");
    }

    await pool.end();
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

showPlayerStats();

