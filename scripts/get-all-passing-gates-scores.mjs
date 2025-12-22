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

async function getAllPassingGatesScores() {
  try {
    // Get all players
    const playersResult = await pool.query(
      "SELECT id, first_name, last_name, team_id FROM players ORDER BY first_name, last_name"
    );

    if (playersResult.rows.length === 0) {
      console.log("No players found");
      process.exit(1);
    }

    // Get only Cycle 1 evaluation
    const evaluationsResult = await pool.query(
      "SELECT id, team_id, name, scores FROM evaluations WHERE name = 'Cycle 1' ORDER BY created_at"
    );

    // Create a map of player ID to player info
    const playersMap = new Map();
    for (const player of playersResult.rows) {
      playersMap.set(player.id, {
        id: player.id,
        firstName: player.first_name,
        lastName: player.last_name,
        teamId: player.team_id,
        scores: [],
      });
    }

    // Process each evaluation
    for (const evaluation of evaluationsResult.rows) {
      const scores =
        typeof evaluation.scores === "string"
          ? JSON.parse(evaluation.scores)
          : evaluation.scores;

      // For each player in this evaluation
      for (const [playerId, playerScores] of Object.entries(scores)) {
        if (playersMap.has(playerId)) {
          const player = playersMap.get(playerId);
          
          // Extract Passing Gates scores
          const passingGatesData = {
            evaluationId: evaluation.id,
            evaluationName: evaluation.name,
            teamId: evaluation.team_id,
            strongFoot: playerScores.passing_strong || null,
            weakFoot: playerScores.passing_weak || null,
          };

          player.scores.push(passingGatesData);
        }
      }
    }

    // Output results
    console.log("\n" + "=".repeat(100));
    console.log("ALL PLAYERS - PASSING GATES SCORES (CYCLE 1 ONLY)");
    console.log("=".repeat(100));
    console.log("");

    let totalPlayersWithCycle1 = 0;

    for (const player of playersMap.values()) {
      // Only process players with Cycle 1 scores
      const cycle1Scores = player.scores.filter(s => s.evaluationName === 'Cycle 1');
      
      if (cycle1Scores.length === 0) {
        continue; // Skip players without Cycle 1 scores
      }

      totalPlayersWithCycle1++;
      const fullName = `${player.firstName} ${player.lastName}`;
      console.log(`${fullName} (Player ID: ${player.id})`);
      console.log("-".repeat(100));

      for (const scoreData of cycle1Scores) {
        console.log(`  Evaluation: ${scoreData.evaluationName} (ID: ${scoreData.evaluationId})`);
        console.log(`  Team ID: ${scoreData.teamId}`);
        console.log(`  Strong Foot: ${scoreData.strongFoot ?? "—"}`);
        console.log(`  Weak Foot: ${scoreData.weakFoot ?? "—"}`);
        console.log("");
      }
      console.log("");
    }

    console.log("=".repeat(100));
    console.log(`SUMMARY (CYCLE 1 ONLY):`);
    console.log(`  Players with Cycle 1 Passing Gates Scores: ${totalPlayersWithCycle1}`);
    console.log("=".repeat(100));

    // Also output as CSV format
    console.log("\n\n" + "=".repeat(100));
    console.log("CSV FORMAT (CYCLE 1 ONLY):");
    console.log("=".repeat(100));
    console.log(
      "Player Name,Evaluation Name,Strong Foot,Weak Foot"
    );

    for (const player of playersMap.values()) {
      const fullName = `${player.firstName} ${player.lastName}`;

      // Only show players with Cycle 1 scores
      const cycle1Scores = player.scores.filter(s => s.evaluationName === 'Cycle 1');
      
      if (cycle1Scores.length === 0) {
        continue; // Skip players without Cycle 1 scores
      }

      for (const scoreData of cycle1Scores) {
        const row = [
          fullName,
          scoreData.evaluationName,
          scoreData.strongFoot ?? "—",
          scoreData.weakFoot ?? "—",
        ].join(",");
        console.log(row);
      }
    }

    await pool.end();
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

getAllPassingGatesScores();

