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

async function getAllSingleLegHopScores() {
  try {
    const playersResult = await pool.query(
      "SELECT id, first_name, last_name, team_id FROM players ORDER BY first_name, last_name"
    );

    if (playersResult.rows.length === 0) {
      console.log("No players found");
      process.exit(1);
    }

    const evaluationsResult = await pool.query(
      "SELECT id, team_id, name, scores FROM evaluations WHERE name = 'Cycle 1' ORDER BY created_at"
    );

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

    for (const evaluation of evaluationsResult.rows) {
      const scores =
        typeof evaluation.scores === "string"
          ? JSON.parse(evaluation.scores)
          : evaluation.scores;

      for (const [playerId, playerScores] of Object.entries(scores)) {
        if (playersMap.has(playerId)) {
          const player = playersMap.get(playerId);
          
          const hopData = {
            evaluationId: evaluation.id,
            evaluationName: evaluation.name,
            teamId: evaluation.team_id,
            leftFoot: [
              playerScores.hop_left_1 || null,
              playerScores.hop_left_2 || null,
              playerScores.hop_left_3 || null,
            ],
            rightFoot: [
              playerScores.hop_right_1 || null,
              playerScores.hop_right_2 || null,
              playerScores.hop_right_3 || null,
            ],
          };

          const validLeft = hopData.leftFoot.filter(h => h !== null && h !== undefined);
          const validRight = hopData.rightFoot.filter(h => h !== null && h !== undefined);
          
          if (validLeft.length > 0) {
            hopData.leftAverage = validLeft.reduce((a, b) => a + b, 0) / validLeft.length;
            hopData.leftMax = Math.max(...validLeft);
          }
          if (validRight.length > 0) {
            hopData.rightAverage = validRight.reduce((a, b) => a + b, 0) / validRight.length;
            hopData.rightMax = Math.max(...validRight);
          }

          player.scores.push(hopData);
        }
      }
    }

    console.log("\n" + "=".repeat(100));
    console.log("ALL PLAYERS - SINGLE-LEG HOP SCORES (CYCLE 1 ONLY)");
    console.log("=".repeat(100));
    console.log("");

    let totalPlayersWithCycle1 = 0;

    for (const player of playersMap.values()) {
      const cycle1Scores = player.scores.filter(s => s.evaluationName === 'Cycle 1');
      
      if (cycle1Scores.length === 0) {
        continue;
      }

      totalPlayersWithCycle1++;
      const fullName = `${player.firstName} ${player.lastName}`;
      console.log(`${fullName} (Player ID: ${player.id})`);
      console.log("-".repeat(100));

      for (const scoreData of cycle1Scores) {
        console.log(`  Evaluation: ${scoreData.evaluationName} (ID: ${scoreData.evaluationId})`);
        console.log(`  Team ID: ${scoreData.teamId}`);
        console.log(`  Left Foot:`);
        for (let i = 0; i < 3; i++) {
          console.log(`    Attempt ${i + 1}: ${scoreData.leftFoot[i] ?? "—"} meters`);
        }
        if (scoreData.leftAverage !== undefined) {
          console.log(`    Average: ${scoreData.leftAverage.toFixed(2)} meters`);
        }
        if (scoreData.leftMax !== undefined) {
          console.log(`    Max: ${scoreData.leftMax.toFixed(2)} meters`);
        }
        console.log(`  Right Foot:`);
        for (let i = 0; i < 3; i++) {
          console.log(`    Attempt ${i + 1}: ${scoreData.rightFoot[i] ?? "—"} meters`);
        }
        if (scoreData.rightAverage !== undefined) {
          console.log(`    Average: ${scoreData.rightAverage.toFixed(2)} meters`);
        }
        if (scoreData.rightMax !== undefined) {
          console.log(`    Max: ${scoreData.rightMax.toFixed(2)} meters`);
        }
        console.log("");
      }
      console.log("");
    }

    console.log("=".repeat(100));
    console.log(`SUMMARY (CYCLE 1 ONLY):`);
    console.log(`  Players with Cycle 1 Single-Leg Hop Scores: ${totalPlayersWithCycle1}`);
    console.log("=".repeat(100));

    console.log("\n\n" + "=".repeat(100));
    console.log("CSV FORMAT (CYCLE 1 ONLY):");
    console.log("=".repeat(100));
    console.log(
      "Player Name,Evaluation Name,Left 1,Left 2,Left 3,Left Avg,Left Max,Right 1,Right 2,Right 3,Right Avg,Right Max"
    );

    for (const player of playersMap.values()) {
      const fullName = `${player.firstName} ${player.lastName}`;
      const cycle1Scores = player.scores.filter(s => s.evaluationName === 'Cycle 1');
      
      if (cycle1Scores.length === 0) {
        continue;
      }

      for (const scoreData of cycle1Scores) {
        const row = [
          fullName,
          scoreData.evaluationName,
          scoreData.leftFoot[0] ?? "—",
          scoreData.leftFoot[1] ?? "—",
          scoreData.leftFoot[2] ?? "—",
          scoreData.leftAverage?.toFixed(2) ?? "—",
          scoreData.leftMax?.toFixed(2) ?? "—",
          scoreData.rightFoot[0] ?? "—",
          scoreData.rightFoot[1] ?? "—",
          scoreData.rightFoot[2] ?? "—",
          scoreData.rightAverage?.toFixed(2) ?? "—",
          scoreData.rightMax?.toFixed(2) ?? "—",
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

getAllSingleLegHopScores();

