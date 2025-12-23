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

// Get player name from command line argument or default to "Edna"
const playerName = process.argv[2] || "Edna";

async function getPlayerAllScores() {
  try {
    // Get player by name (case insensitive, partial match)
    const playersResult = await pool.query(
      "SELECT id, first_name, last_name, team_id FROM players WHERE LOWER(first_name) LIKE LOWER($1) OR LOWER(last_name) LIKE LOWER($1) OR LOWER(CONCAT(first_name, ' ', last_name)) LIKE LOWER($1) ORDER BY first_name, last_name",
      [`%${playerName}%`]
    );

    if (playersResult.rows.length === 0) {
      console.log(`No players found matching "${playerName}"`);
      process.exit(1);
    }

    if (playersResult.rows.length > 1) {
      console.log(`Multiple players found matching "${playerName}":`);
      for (const player of playersResult.rows) {
        console.log(`  - ${player.first_name} ${player.last_name} (ID: ${player.id})`);
      }
      console.log("\nUsing first match...\n");
    }

    const player = playersResult.rows[0];
    const fullName = `${player.first_name} ${player.last_name}`;

    // Get Cycle 1 evaluation
    const evaluationsResult = await pool.query(
      "SELECT id, team_id, name, scores FROM evaluations WHERE name = 'Cycle 1' ORDER BY created_at"
    );

    if (evaluationsResult.rows.length === 0) {
      console.log("No Cycle 1 evaluation found");
      process.exit(1);
    }

    const evaluation = evaluationsResult.rows[0];
    const scores =
      typeof evaluation.scores === "string"
        ? JSON.parse(evaluation.scores)
        : evaluation.scores;

    const playerScores = scores[player.id] || {};

    if (Object.keys(playerScores).length === 0) {
      console.log(`No scores found for ${fullName} in Cycle 1`);
      process.exit(1);
    }

    // Output all scores
    console.log("\n" + "=".repeat(100));
    console.log(`ALL SCORES FOR: ${fullName.toUpperCase()} (Player ID: ${player.id})`);
    console.log(`Evaluation: Cycle 1 (ID: ${evaluation.id})`);
    console.log(`Team ID: ${evaluation.team_id}`);
    console.log("=".repeat(100));
    console.log("");

    // Shot Power
    console.log("SHOT POWER:");
    console.log("  Strong Foot:");
    for (let i = 1; i <= 4; i++) {
      console.log(`    Attempt ${i}: ${playerScores[`power_strong_${i}`] ?? "—"}`);
    }
    const strongPower = [1, 2, 3, 4].map(i => playerScores[`power_strong_${i}`]).filter(v => v != null);
    if (strongPower.length > 0) {
      console.log(`    Average: ${(strongPower.reduce((a, b) => a + b, 0) / strongPower.length).toFixed(2)}`);
      console.log(`    Max: ${Math.max(...strongPower)}`);
    }
    console.log("  Weak Foot:");
    for (let i = 1; i <= 4; i++) {
      console.log(`    Attempt ${i}: ${playerScores[`power_weak_${i}`] ?? "—"}`);
    }
    const weakPower = [1, 2, 3, 4].map(i => playerScores[`power_weak_${i}`]).filter(v => v != null);
    if (weakPower.length > 0) {
      console.log(`    Average: ${(weakPower.reduce((a, b) => a + b, 0) / weakPower.length).toFixed(2)}`);
      console.log(`    Max: ${Math.max(...weakPower)}`);
    }
    console.log("");

    // Serve Distance
    console.log("SERVE DISTANCE:");
    console.log("  Strong Foot:");
    for (let i = 1; i <= 4; i++) {
      console.log(`    Attempt ${i}: ${playerScores[`serve_strong_${i}`] ?? "—"}`);
    }
    const strongServe = [1, 2, 3, 4].map(i => playerScores[`serve_strong_${i}`]).filter(v => v != null);
    if (strongServe.length > 0) {
      console.log(`    Average: ${(strongServe.reduce((a, b) => a + b, 0) / strongServe.length).toFixed(2)}`);
      console.log(`    Max: ${Math.max(...strongServe)}`);
    }
    console.log("  Weak Foot:");
    for (let i = 1; i <= 4; i++) {
      console.log(`    Attempt ${i}: ${playerScores[`serve_weak_${i}`] ?? "—"}`);
    }
    const weakServe = [1, 2, 3, 4].map(i => playerScores[`serve_weak_${i}`]).filter(v => v != null);
    if (weakServe.length > 0) {
      console.log(`    Average: ${(weakServe.reduce((a, b) => a + b, 0) / weakServe.length).toFixed(2)}`);
      console.log(`    Max: ${Math.max(...weakServe)}`);
    }
    console.log("");

    // Figure 8
    console.log("FIGURE 8 LOOPS:");
    console.log(`  Strong Foot: ${playerScores.figure8_strong ?? "—"}`);
    console.log(`  Weak Foot: ${playerScores.figure8_weak ?? "—"}`);
    console.log(`  Both Feet: ${playerScores.figure8_both ?? "—"}`);
    console.log("");

    // Passing Gates
    console.log("PASSING GATES:");
    console.log(`  Strong Foot: ${playerScores.passing_strong ?? "—"}`);
    console.log(`  Weak Foot: ${playerScores.passing_weak ?? "—"}`);
    console.log("");

    // 1v1
    console.log("1V1:");
    const onevoneRounds = [];
    for (let i = 1; i <= 6; i++) {
      const round = playerScores[`onevone_round_${i}`];
      if (round != null) onevoneRounds.push(round);
      console.log(`  Round ${i}: ${round ?? "—"}`);
    }
    if (onevoneRounds.length > 0) {
      console.log(`  Average: ${(onevoneRounds.reduce((a, b) => a + b, 0) / onevoneRounds.length).toFixed(2)}`);
      console.log(`  Total: ${onevoneRounds.reduce((a, b) => a + b, 0)}`);
    }
    console.log("");

    // Juggling
    console.log("JUGGLING:");
    const jugglingAttempts = [];
    for (let i = 1; i <= 4; i++) {
      const attempt = playerScores[`juggling_${i}`];
      if (attempt != null) jugglingAttempts.push(attempt);
      console.log(`  Attempt ${i}: ${attempt ?? "—"}`);
    }
    if (jugglingAttempts.length > 0) {
      console.log(`  Average: ${(jugglingAttempts.reduce((a, b) => a + b, 0) / jugglingAttempts.length).toFixed(2)}`);
      console.log(`  Max: ${Math.max(...jugglingAttempts)}`);
      console.log(`  Total: ${jugglingAttempts.reduce((a, b) => a + b, 0)}`);
    }
    console.log("");

    // Skill Moves
    console.log("SKILL MOVES:");
    const skillMoves = [];
    for (let i = 1; i <= 6; i++) {
      const move = playerScores[`skillmove_${i}`];
      if (move != null) skillMoves.push(move);
      console.log(`  Move ${i}: ${move ?? "—"}`);
    }
    if (skillMoves.length > 0) {
      console.log(`  Average: ${(skillMoves.reduce((a, b) => a + b, 0) / skillMoves.length).toFixed(2)}`);
      console.log(`  Total: ${skillMoves.reduce((a, b) => a + b, 0)}`);
    }
    console.log("");

    // Agility
    console.log("AGILITY (5-10-5):");
    const agilityTrials = [];
    for (let i = 1; i <= 3; i++) {
      const trial = playerScores[`agility_${i}`];
      if (trial != null) agilityTrials.push(trial);
      console.log(`  Trial ${i}: ${trial ?? "—"} seconds`);
    }
    if (agilityTrials.length > 0) {
      console.log(`  Average: ${(agilityTrials.reduce((a, b) => a + b, 0) / agilityTrials.length).toFixed(2)} seconds`);
      console.log(`  Best: ${Math.min(...agilityTrials).toFixed(2)} seconds`);
    }
    console.log("");

    // Reaction Sprint
    console.log("REACTION SPRINT:");
    const reactionCues = [];
    const reactionTotals = [];
    for (let i = 1; i <= 3; i++) {
      const cue = playerScores[`reaction_cue_${i}`];
      const total = playerScores[`reaction_total_${i}`];
      if (cue != null) reactionCues.push(cue);
      if (total != null) reactionTotals.push(total);
      console.log(`  Trial ${i}:`);
      console.log(`    Cue Time: ${cue ?? "—"} seconds`);
      console.log(`    Total Time: ${total ?? "—"} seconds`);
    }
    if (reactionCues.length > 0) {
      console.log(`  Cue Average: ${(reactionCues.reduce((a, b) => a + b, 0) / reactionCues.length).toFixed(2)} seconds`);
      console.log(`  Cue Best: ${Math.min(...reactionCues).toFixed(2)} seconds`);
    }
    if (reactionTotals.length > 0) {
      console.log(`  Total Average: ${(reactionTotals.reduce((a, b) => a + b, 0) / reactionTotals.length).toFixed(2)} seconds`);
      console.log(`  Total Best: ${Math.min(...reactionTotals).toFixed(2)} seconds`);
    }
    console.log("");

    // Single-leg Hop
    console.log("SINGLE-LEG HOP:");
    console.log("  Left Foot:");
    const leftHops = [];
    for (let i = 1; i <= 3; i++) {
      const hop = playerScores[`hop_left_${i}`];
      if (hop != null) leftHops.push(hop);
      console.log(`    Attempt ${i}: ${hop ?? "—"} meters`);
    }
    if (leftHops.length > 0) {
      console.log(`    Average: ${(leftHops.reduce((a, b) => a + b, 0) / leftHops.length).toFixed(2)} meters`);
      console.log(`    Max: ${Math.max(...leftHops).toFixed(2)} meters`);
    }
    console.log("  Right Foot:");
    const rightHops = [];
    for (let i = 1; i <= 3; i++) {
      const hop = playerScores[`hop_right_${i}`];
      if (hop != null) rightHops.push(hop);
      console.log(`    Attempt ${i}: ${hop ?? "—"} meters`);
    }
    if (rightHops.length > 0) {
      console.log(`    Average: ${(rightHops.reduce((a, b) => a + b, 0) / rightHops.length).toFixed(2)} meters`);
      console.log(`    Max: ${Math.max(...rightHops).toFixed(2)} meters`);
    }
    console.log("");

    // Double-leg Jumps
    console.log("DOUBLE-LEG JUMPS:");
    console.log(`  10 seconds: ${playerScores.jumps_10s ?? "—"} jumps`);
    console.log(`  20 seconds: ${playerScores.jumps_20s ?? "—"} jumps`);
    console.log(`  30 seconds: ${playerScores.jumps_30s ?? "—"} jumps`);
    console.log("");

    // Ankle Dorsiflexion
    console.log("ANKLE DORSIFLEXION:");
    console.log(`  Left: ${playerScores.ankle_left ?? "—"} cm`);
    console.log(`  Right: ${playerScores.ankle_right ?? "—"} cm`);
    console.log("");

    // Core Plank
    console.log("CORE PLANK:");
    console.log(`  Time: ${playerScores.plank_time ?? "—"} seconds`);
    const formValue = playerScores.plank_form;
    const formText = formValue === 1 ? "OK" : formValue === 0 ? "Broke Form" : "—";
    console.log(`  Form: ${formText}`);
    console.log("");

    console.log("=".repeat(100));

    await pool.end();
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

getPlayerAllScores();


