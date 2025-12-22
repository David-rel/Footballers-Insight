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

async function getAllJugglingScores() {
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
          
          const jugglingData = {
            evaluationId: evaluation.id,
            evaluationName: evaluation.name,
            teamId: evaluation.team_id,
            attempts: [
              playerScores.juggling_1 || null,
              playerScores.juggling_2 || null,
              playerScores.juggling_3 || null,
              playerScores.juggling_4 || null,
            ],
          };

          const validAttempts = jugglingData.attempts.filter(a => a !== null && a !== undefined);
          if (validAttempts.length > 0) {
            jugglingData.average = validAttempts.reduce((a, b) => a + b, 0) / validAttempts.length;
            jugglingData.max = Math.max(...validAttempts);
            jugglingData.total = validAttempts.reduce((a, b) => a + b, 0);
          }

          player.scores.push(jugglingData);
        }
      }
    }

    console.log("\n" + "=".repeat(100));
    console.log("ALL PLAYERS - JUGGLING SCORES (CYCLE 1 ONLY)");
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
        for (let i = 0; i < 4; i++) {
          console.log(`  Attempt ${i + 1}: ${scoreData.attempts[i] ?? "—"}`);
        }
        if (scoreData.average !== undefined) {
          console.log(`  Average: ${scoreData.average.toFixed(2)}`);
        }
        if (scoreData.max !== undefined) {
          console.log(`  Max: ${scoreData.max}`);
        }
        if (scoreData.total !== undefined) {
          console.log(`  Total: ${scoreData.total}`);
        }
        console.log("");
      }
      console.log("");
    }

    console.log("=".repeat(100));
    console.log(`SUMMARY (CYCLE 1 ONLY):`);
    console.log(`  Players with Cycle 1 Juggling Scores: ${totalPlayersWithCycle1}`);
    console.log("=".repeat(100));

    console.log("\n\n" + "=".repeat(100));
    console.log("CSV FORMAT (CYCLE 1 ONLY):");
    console.log("=".repeat(100));
    console.log(
      "Player Name,Evaluation Name,Attempt 1,Attempt 2,Attempt 3,Attempt 4,Average,Max,Total"
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
          scoreData.attempts[0] ?? "—",
          scoreData.attempts[1] ?? "—",
          scoreData.attempts[2] ?? "—",
          scoreData.attempts[3] ?? "—",
          scoreData.average?.toFixed(2) ?? "—",
          scoreData.max ?? "—",
          scoreData.total ?? "—",
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

getAllJugglingScores();

