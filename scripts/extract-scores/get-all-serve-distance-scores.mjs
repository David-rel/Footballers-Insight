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

async function getAllServeDistanceScores() {
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
          
          // Extract serve distance scores
          const serveDistanceData = {
            evaluationId: evaluation.id,
            evaluationName: evaluation.name,
            teamId: evaluation.team_id,
            strongFoot: {
              attempt1: playerScores.serve_strong_1 || null,
              attempt2: playerScores.serve_strong_2 || null,
              attempt3: playerScores.serve_strong_3 || null,
              attempt4: playerScores.serve_strong_4 || null,
            },
            weakFoot: {
              attempt1: playerScores.serve_weak_1 || null,
              attempt2: playerScores.serve_weak_2 || null,
              attempt3: playerScores.serve_weak_3 || null,
              attempt4: playerScores.serve_weak_4 || null,
            },
          };

          // Calculate averages and max
          const strongAttempts = [
            serveDistanceData.strongFoot.attempt1,
            serveDistanceData.strongFoot.attempt2,
            serveDistanceData.strongFoot.attempt3,
            serveDistanceData.strongFoot.attempt4,
          ].filter((v) => v !== null && v !== undefined);

          const weakAttempts = [
            serveDistanceData.weakFoot.attempt1,
            serveDistanceData.weakFoot.attempt2,
            serveDistanceData.weakFoot.attempt3,
            serveDistanceData.weakFoot.attempt4,
          ].filter((v) => v !== null && v !== undefined);

          if (strongAttempts.length > 0) {
            serveDistanceData.strongFoot.avg =
              strongAttempts.reduce((a, b) => a + b, 0) / strongAttempts.length;
            serveDistanceData.strongFoot.max = Math.max(...strongAttempts);
          }

          if (weakAttempts.length > 0) {
            serveDistanceData.weakFoot.avg =
              weakAttempts.reduce((a, b) => a + b, 0) / weakAttempts.length;
            serveDistanceData.weakFoot.max = Math.max(...weakAttempts);
          }

          player.scores.push(serveDistanceData);
        }
      }
    }

    // Output results
    console.log("\n" + "=".repeat(100));
    console.log("ALL PLAYERS - SERVE DISTANCE SCORES (CYCLE 1 ONLY)");
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
        console.log(`  Strong Foot:`);
        console.log(`    Attempt 1: ${scoreData.strongFoot.attempt1 ?? "—"}`);
        console.log(`    Attempt 2: ${scoreData.strongFoot.attempt2 ?? "—"}`);
        console.log(`    Attempt 3: ${scoreData.strongFoot.attempt3 ?? "—"}`);
        console.log(`    Attempt 4: ${scoreData.strongFoot.attempt4 ?? "—"}`);
        if (scoreData.strongFoot.avg !== undefined) {
          console.log(`    Average: ${scoreData.strongFoot.avg.toFixed(2)}`);
        }
        if (scoreData.strongFoot.max !== undefined) {
          console.log(`    Max: ${scoreData.strongFoot.max.toFixed(2)}`);
        }
        console.log(`  Weak Foot:`);
        console.log(`    Attempt 1: ${scoreData.weakFoot.attempt1 ?? "—"}`);
        console.log(`    Attempt 2: ${scoreData.weakFoot.attempt2 ?? "—"}`);
        console.log(`    Attempt 3: ${scoreData.weakFoot.attempt3 ?? "—"}`);
        console.log(`    Attempt 4: ${scoreData.weakFoot.attempt4 ?? "—"}`);
        if (scoreData.weakFoot.avg !== undefined) {
          console.log(`    Average: ${scoreData.weakFoot.avg.toFixed(2)}`);
        }
        if (scoreData.weakFoot.max !== undefined) {
          console.log(`    Max: ${scoreData.weakFoot.max.toFixed(2)}`);
        }
        console.log("");
      }
      console.log("");
    }

    console.log("=".repeat(100));
    console.log(`SUMMARY (CYCLE 1 ONLY):`);
    console.log(`  Players with Cycle 1 Serve Distance Scores: ${totalPlayersWithCycle1}`);
    console.log("=".repeat(100));

    // Also output as CSV format
    console.log("\n\n" + "=".repeat(100));
    console.log("CSV FORMAT (CYCLE 1 ONLY):");
    console.log("=".repeat(100));
    console.log(
      "Player Name,Evaluation Name,Strong Attempt 1,Strong Attempt 2,Strong Attempt 3,Strong Attempt 4,Strong Avg,Strong Max,Weak Attempt 1,Weak Attempt 2,Weak Attempt 3,Weak Attempt 4,Weak Avg,Weak Max"
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
          scoreData.strongFoot.attempt1 ?? "—",
          scoreData.strongFoot.attempt2 ?? "—",
          scoreData.strongFoot.attempt3 ?? "—",
          scoreData.strongFoot.attempt4 ?? "—",
          scoreData.strongFoot.avg?.toFixed(2) ?? "—",
          scoreData.strongFoot.max?.toFixed(2) ?? "—",
          scoreData.weakFoot.attempt1 ?? "—",
          scoreData.weakFoot.attempt2 ?? "—",
          scoreData.weakFoot.attempt3 ?? "—",
          scoreData.weakFoot.attempt4 ?? "—",
          scoreData.weakFoot.avg?.toFixed(2) ?? "—",
          scoreData.weakFoot.max?.toFixed(2) ?? "—",
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

getAllServeDistanceScores();

