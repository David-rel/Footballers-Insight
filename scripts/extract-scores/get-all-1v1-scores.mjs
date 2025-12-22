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

async function getAll1v1Scores() {
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
          
          const onevoneData = {
            evaluationId: evaluation.id,
            evaluationName: evaluation.name,
            teamId: evaluation.team_id,
            rounds: [
              playerScores.onevone_round_1 || null,
              playerScores.onevone_round_2 || null,
              playerScores.onevone_round_3 || null,
              playerScores.onevone_round_4 || null,
              playerScores.onevone_round_5 || null,
              playerScores.onevone_round_6 || null,
            ],
          };

          const validRounds = onevoneData.rounds.filter(r => r !== null && r !== undefined);
          if (validRounds.length > 0) {
            onevoneData.average = validRounds.reduce((a, b) => a + b, 0) / validRounds.length;
            onevoneData.total = validRounds.reduce((a, b) => a + b, 0);
          }

          player.scores.push(onevoneData);
        }
      }
    }

    console.log("\n" + "=".repeat(100));
    console.log("ALL PLAYERS - 1V1 SCORES (CYCLE 1 ONLY)");
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
        for (let i = 0; i < 6; i++) {
          console.log(`  Round ${i + 1}: ${scoreData.rounds[i] ?? "—"}`);
        }
        if (scoreData.average !== undefined) {
          console.log(`  Average: ${scoreData.average.toFixed(2)}`);
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
    console.log(`  Players with Cycle 1 1v1 Scores: ${totalPlayersWithCycle1}`);
    console.log("=".repeat(100));

    console.log("\n\n" + "=".repeat(100));
    console.log("CSV FORMAT (CYCLE 1 ONLY):");
    console.log("=".repeat(100));
    console.log(
      "Player Name,Evaluation Name,Round 1,Round 2,Round 3,Round 4,Round 5,Round 6,Average,Total"
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
          scoreData.rounds[0] ?? "—",
          scoreData.rounds[1] ?? "—",
          scoreData.rounds[2] ?? "—",
          scoreData.rounds[3] ?? "—",
          scoreData.rounds[4] ?? "—",
          scoreData.rounds[5] ?? "—",
          scoreData.average?.toFixed(2) ?? "—",
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

getAll1v1Scores();

