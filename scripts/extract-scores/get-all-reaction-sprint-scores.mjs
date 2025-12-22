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

async function getAllReactionSprintScores() {
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
          
          const reactionData = {
            evaluationId: evaluation.id,
            evaluationName: evaluation.name,
            teamId: evaluation.team_id,
            trials: [
              {
                cue: playerScores.reaction_cue_1 || null,
                total: playerScores.reaction_total_1 || null,
              },
              {
                cue: playerScores.reaction_cue_2 || null,
                total: playerScores.reaction_total_2 || null,
              },
              {
                cue: playerScores.reaction_cue_3 || null,
                total: playerScores.reaction_total_3 || null,
              },
            ],
          };

          const validCues = reactionData.trials.map(t => t.cue).filter(c => c !== null && c !== undefined);
          const validTotals = reactionData.trials.map(t => t.total).filter(t => t !== null && t !== undefined);
          
          if (validCues.length > 0) {
            reactionData.cueAverage = validCues.reduce((a, b) => a + b, 0) / validCues.length;
            reactionData.cueBest = Math.min(...validCues);
          }
          if (validTotals.length > 0) {
            reactionData.totalAverage = validTotals.reduce((a, b) => a + b, 0) / validTotals.length;
            reactionData.totalBest = Math.min(...validTotals);
          }

          player.scores.push(reactionData);
        }
      }
    }

    console.log("\n" + "=".repeat(100));
    console.log("ALL PLAYERS - REACTION SPRINT SCORES (CYCLE 1 ONLY)");
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
        for (let i = 0; i < 3; i++) {
          console.log(`  Trial ${i + 1}:`);
          console.log(`    Cue Time: ${scoreData.trials[i].cue ?? "—"} seconds`);
          console.log(`    Total Time: ${scoreData.trials[i].total ?? "—"} seconds`);
        }
        if (scoreData.cueAverage !== undefined) {
          console.log(`  Cue Average: ${scoreData.cueAverage.toFixed(2)} seconds`);
        }
        if (scoreData.cueBest !== undefined) {
          console.log(`  Cue Best: ${scoreData.cueBest.toFixed(2)} seconds`);
        }
        if (scoreData.totalAverage !== undefined) {
          console.log(`  Total Average: ${scoreData.totalAverage.toFixed(2)} seconds`);
        }
        if (scoreData.totalBest !== undefined) {
          console.log(`  Total Best: ${scoreData.totalBest.toFixed(2)} seconds`);
        }
        console.log("");
      }
      console.log("");
    }

    console.log("=".repeat(100));
    console.log(`SUMMARY (CYCLE 1 ONLY):`);
    console.log(`  Players with Cycle 1 Reaction Sprint Scores: ${totalPlayersWithCycle1}`);
    console.log("=".repeat(100));

    console.log("\n\n" + "=".repeat(100));
    console.log("CSV FORMAT (CYCLE 1 ONLY):");
    console.log("=".repeat(100));
    console.log(
      "Player Name,Evaluation Name,Cue 1,Cue 2,Cue 3,Cue Avg,Cue Best,Total 1,Total 2,Total 3,Total Avg,Total Best"
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
          scoreData.trials[0].cue ?? "—",
          scoreData.trials[1].cue ?? "—",
          scoreData.trials[2].cue ?? "—",
          scoreData.cueAverage?.toFixed(2) ?? "—",
          scoreData.cueBest?.toFixed(2) ?? "—",
          scoreData.trials[0].total ?? "—",
          scoreData.trials[1].total ?? "—",
          scoreData.trials[2].total ?? "—",
          scoreData.totalAverage?.toFixed(2) ?? "—",
          scoreData.totalBest?.toFixed(2) ?? "—",
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

getAllReactionSprintScores();

