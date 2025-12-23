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

async function getPlayerDNA() {
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
    const evaluationResult = await pool.query(
      "SELECT id, name FROM evaluations WHERE name = 'Cycle 1' LIMIT 1"
    );

    if (evaluationResult.rows.length === 0) {
      console.log("No Cycle 1 evaluation found");
      process.exit(1);
    }

    const evaluation = evaluationResult.rows[0];

    // Get player evaluation
    const playerEvalResult = await pool.query(
      `SELECT pe.id, pe.player_id, pe.evaluation_id, pe.name, pd.dna
       FROM player_evaluations pe
       LEFT JOIN player_dna pd ON pd.player_evaluation_id = pe.id
       WHERE pe.player_id = $1 AND pe.evaluation_id = $2
       LIMIT 1`,
      [player.id, evaluation.id]
    );

    if (playerEvalResult.rows.length === 0) {
      console.log(`No player evaluation found for ${fullName} in Cycle 1`);
      console.log("Player DNA may not have been computed yet. Run compute-all first.");
      process.exit(1);
    }

    const playerEval = playerEvalResult.rows[0];
    const dna = playerEval.dna || {};

    if (Object.keys(dna).length === 0) {
      console.log(`No DNA data found for ${fullName} in Cycle 1`);
      console.log("Player DNA may not have been computed yet. Run compute-all first.");
      process.exit(1);
    }

    // Output DNA data
    console.log("\n" + "=".repeat(100));
    console.log(`PLAYER DNA FOR: ${fullName.toUpperCase()} (Player ID: ${player.id})`);
    console.log(`Evaluation: Cycle 1 (ID: ${evaluation.id})`);
    console.log(`Player Evaluation ID: ${playerEval.id}`);
    console.log("=".repeat(100));
    console.log("");

    // Sort DNA keys for consistent output
    const sortedKeys = Object.keys(dna).sort();

    console.log("NORMALIZED DNA VALUES (39-dimensional vector):");
    console.log("-".repeat(100));

    // Group by test category if possible
    const testCategories = {
      shot_power: [],
      serve_distance: [],
      figure8: [],
      passing_gates: [],
      onevone: [],
      juggling: [],
      skill_moves: [],
      agility: [],
      reaction_sprint: [],
      single_leg_hop: [],
      double_leg_jumps: [],
      ankle_dorsiflexion: [],
      core_plank: [],
      other: [],
    };

    for (const key of sortedKeys) {
      let categorized = false;
      for (const [category, keys] of Object.entries(testCategories)) {
        if (key.toLowerCase().includes(category.replace('_', '')) || 
            (category === 'shot_power' && key.toLowerCase().includes('power')) ||
            (category === 'serve_distance' && key.toLowerCase().includes('serve')) ||
            (category === 'figure8' && key.toLowerCase().includes('figure8')) ||
            (category === 'passing_gates' && key.toLowerCase().includes('passing')) ||
            (category === 'onevone' && key.toLowerCase().includes('onevone')) ||
            (category === 'juggling' && key.toLowerCase().includes('juggling')) ||
            (category === 'skill_moves' && key.toLowerCase().includes('skillmove')) ||
            (category === 'agility' && key.toLowerCase().includes('agility')) ||
            (category === 'reaction_sprint' && key.toLowerCase().includes('reaction')) ||
            (category === 'single_leg_hop' && key.toLowerCase().includes('hop')) ||
            (category === 'double_leg_jumps' && key.toLowerCase().includes('jumps')) ||
            (category === 'ankle_dorsiflexion' && key.toLowerCase().includes('ankle')) ||
            (category === 'core_plank' && key.toLowerCase().includes('plank'))) {
          keys.push({ key, value: dna[key] });
          categorized = true;
          break;
        }
      }
      if (!categorized) {
        testCategories.other.push({ key, value: dna[key] });
      }
    }

    // Display categorized
    const categoryNames = {
      shot_power: "SHOT POWER",
      serve_distance: "SERVE DISTANCE",
      figure8: "FIGURE 8",
      passing_gates: "PASSING GATES",
      onevone: "1V1",
      juggling: "JUGGLING",
      skill_moves: "SKILL MOVES",
      agility: "AGILITY",
      reaction_sprint: "REACTION SPRINT",
      single_leg_hop: "SINGLE-LEG HOP",
      double_leg_jumps: "DOUBLE-LEG JUMPS",
      ankle_dorsiflexion: "ANKLE DORSIFLEXION",
      core_plank: "CORE PLANK",
      other: "OTHER",
    };

    for (const [category, items] of Object.entries(testCategories)) {
      if (items.length > 0) {
        console.log(`\n${categoryNames[category]}:`);
        for (const item of items) {
          const value = typeof item.value === 'number' ? item.value.toFixed(6) : item.value;
          console.log(`  ${item.key}: ${value}`);
        }
      }
    }

    // Also show as array format
    console.log("\n" + "=".repeat(100));
    console.log("DNA VECTOR (as array):");
    console.log("-".repeat(100));
    const dnaArray = sortedKeys.map(key => dna[key]);
    console.log(JSON.stringify(dnaArray, null, 2));

    // Show statistics
    const numericValues = Object.values(dna).filter(v => typeof v === 'number');
    if (numericValues.length > 0) {
      const min = Math.min(...numericValues);
      const max = Math.max(...numericValues);
      const avg = numericValues.reduce((a, b) => a + b, 0) / numericValues.length;
      
      console.log("\n" + "=".repeat(100));
      console.log("DNA STATISTICS:");
      console.log("-".repeat(100));
      console.log(`  Total DNA Features: ${sortedKeys.length}`);
      console.log(`  Numeric Values: ${numericValues.length}`);
      console.log(`  Min Value: ${min.toFixed(6)}`);
      console.log(`  Max Value: ${max.toFixed(6)}`);
      console.log(`  Average Value: ${avg.toFixed(6)}`);
    }

    console.log("\n" + "=".repeat(100));

    await pool.end();
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

getPlayerDNA();


