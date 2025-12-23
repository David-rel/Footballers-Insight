#!/usr/bin/env node

/**
 * Seed Cycle 2 evaluation scores based on Cycle 1 (improvements + variety).
 *
 * Assumes:
 * - "Cycle 1" evaluation exists with scores in evaluations.scores (playerId -> raw score fields)
 * - "Cycle 2" evaluation exists and has one_v_one_rounds = 5 and skill_moves_count = 5
 */

import { config as loadEnv } from "dotenv";
import { Pool } from "pg";

loadEnv({ path: ".env.local" });
loadEnv();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("❌ DATABASE_URL is not set. Export it before running this script.");
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: connectionString.includes("sslmode=require")
    ? { rejectUnauthorized: false }
    : undefined,
});

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6d2b79f5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function hashToSeed(str) {
  // simple deterministic hash
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function roundMaybeInt(v, decimals = 2) {
  if (!Number.isFinite(v)) return v;
  if (Number.isInteger(v)) return v;
  const p = 10 ** decimals;
  return Math.round(v * p) / p;
}

function improvedHigherBetter(base, improvePct, noisePct, rand) {
  // base * (1 + improvePct) with noise
  const noise = (rand() * 2 - 1) * noisePct;
  return base * (1 + improvePct + noise);
}

function improvedLowerBetter(base, improvePct, noisePct, rand) {
  // base * (1 - improvePct) with noise
  const noise = (rand() * 2 - 1) * noisePct;
  return base * (1 - improvePct + noise);
}

function pickProfile(playerId) {
  const rand = mulberry32(hashToSeed(`cycle2:${playerId}`));

  // 0..1 “traits” to create variety
  const strength = rand();
  const technique = rand();
  const speed = rand();
  const engine = rand();
  const balance = rand();
  const mindset = rand();

  // Add a little “specialness” by letting a couple traits be very high
  // (and a couple be lower), but keep everything in-range.
  const boost = () => clamp(rand() * 0.35, 0, 0.35);
  return {
    strength: clamp(strength + boost(), 0, 1),
    technique: clamp(technique + boost(), 0, 1),
    speed: clamp(speed + boost(), 0, 1),
    engine: clamp(engine + boost(), 0, 1),
    balance: clamp(balance + boost(), 0, 1),
    mindset: clamp(mindset + boost(), 0, 1),
    rand,
  };
}

function buildCycle2ScoresFromCycle1(cycle1Scores, rounds, skillMoves, profile) {
  const { rand } = profile;
  const out = {};

  // Improvements (percent) per area, driven by traits
  const improvePower = 0.03 + 0.10 * profile.strength; // +3%..+13%
  const improveServe = 0.02 + 0.10 * (0.6 * profile.strength + 0.4 * profile.technique);
  const improveTechnique = 0.03 + 0.12 * profile.technique;
  const improveSpeed = 0.015 + 0.09 * profile.speed; // times go down
  const improveReaction = 0.01 + 0.08 * (0.7 * profile.speed + 0.3 * profile.mindset);
  const improveEngine = 0.02 + 0.10 * profile.engine;
  const improveBalance = 0.01 + 0.10 * profile.balance;
  const improveDecision = 0.02 + 0.10 * profile.mindset;

  const noise = 0.02; // 2% general noise

  // --- Shot power (strong/weak x4) ---
  for (let i = 1; i <= 4; i++) {
    const sKey = `power_strong_${i}`;
    const wKey = `power_weak_${i}`;
    const s = cycle1Scores?.[sKey];
    const w = cycle1Scores?.[wKey];
    if (typeof s === "number") {
      out[sKey] = Math.round(
        clamp(improvedHigherBetter(s, improvePower, noise, rand), 20, 90)
      );
    }
    if (typeof w === "number") {
      // weak foot can improve a bit more if technique is high
      const extra = 0.02 * profile.technique;
      out[wKey] = Math.round(
        clamp(improvedHigherBetter(w, improvePower + extra, noise, rand), 10, 80)
      );
    }
  }

  // --- Serve distance (strong/weak x4) ---
  for (let i = 1; i <= 4; i++) {
    const sKey = `serve_strong_${i}`;
    const wKey = `serve_weak_${i}`;
    const s = cycle1Scores?.[sKey];
    const w = cycle1Scores?.[wKey];
    if (typeof s === "number") {
      out[sKey] = Math.round(
        clamp(improvedHigherBetter(s, improveServe, noise, rand), 8, 80)
      );
    }
    if (typeof w === "number") {
      const extra = 0.03 * profile.technique;
      out[wKey] = Math.round(
        clamp(improvedHigherBetter(w, improveServe + extra, noise, rand), 6, 70)
      );
    }
  }

  // --- Figure 8 loops ---
  for (const k of ["figure8_strong", "figure8_weak", "figure8_both"]) {
    const v = cycle1Scores?.[k];
    if (typeof v === "number") {
      const imp = improveTechnique + (k === "figure8_weak" ? 0.02 * profile.balance : 0);
      out[k] = Math.round(clamp(improvedHigherBetter(v, imp, noise, rand), 0, 40));
    }
  }

  // --- Passing gates ---
  for (const k of ["passing_strong", "passing_weak"]) {
    const v = cycle1Scores?.[k];
    if (typeof v === "number") {
      const extra = k === "passing_weak" ? 0.03 * profile.technique : 0;
      out[k] = Math.round(
        clamp(improvedHigherBetter(v, improveTechnique + extra, noise, rand), 0, 40)
      );
    }
  }

  // --- 1v1 rounds (Cycle 2 uses 5) ---
  for (let i = 1; i <= rounds; i++) {
    const k = `onevone_round_${i}`;
    const base = cycle1Scores?.[k];
    const b = typeof base === "number" ? base : 2;

    // Improvement mostly shows as “winning” an extra point in some rounds
    const chanceUp = clamp(0.10 + 0.35 * improveDecision, 0.05, 0.55);
    const chanceDown = clamp(0.03 + 0.10 * (1 - profile.mindset), 0.02, 0.18);
    let v = b;
    if (rand() < chanceUp) v += 1;
    if (rand() < chanceDown) v -= 1;
    out[k] = Math.round(clamp(v, 0, 4));
  }

  // --- Juggling (4 tries) ---
  for (let i = 1; i <= 4; i++) {
    const k = `juggling_${i}`;
    const base = cycle1Scores?.[k];
    const b = typeof base === "number" ? base : 8;
    const imp = 0.04 + 0.14 * profile.technique;
    out[k] = Math.round(clamp(improvedHigherBetter(b, imp, 0.04, rand), 0, 80));
  }

  // --- Skill moves (Cycle 2 uses 5) ---
  for (let i = 1; i <= skillMoves; i++) {
    const k = `skillmove_${i}`;
    const base = cycle1Scores?.[k];
    const b = typeof base === "number" ? base : 3;
    // Ratings are discrete. Better technique/mindset => more likely to jump +1.
    const pUp = clamp(0.12 + 0.25 * profile.technique + 0.12 * profile.mindset, 0.1, 0.7);
    const pDown = clamp(0.05 + 0.10 * (1 - profile.technique), 0.03, 0.25);
    let v = b;
    if (rand() < pUp) v += 1;
    if (rand() < pDown) v -= 1;
    out[k] = Math.round(clamp(v, 1, 5));
  }

  // --- Agility (3 runs, seconds, lower is better) ---
  for (let i = 1; i <= 3; i++) {
    const k = `agility_${i}`;
    const base = cycle1Scores?.[k];
    const b = typeof base === "number" ? base : 6.1;
    const v = improvedLowerBetter(b, improveSpeed, 0.015, rand);
    out[k] = roundMaybeInt(clamp(v, 4.6, 8.5), 2);
  }

  // --- Reaction sprint (3 trials: cue and total, lower is better) ---
  for (let i = 1; i <= 3; i++) {
    const cueK = `reaction_cue_${i}`;
    const totK = `reaction_total_${i}`;
    const cueBase = cycle1Scores?.[cueK];
    const totBase = cycle1Scores?.[totK];
    const cueB = typeof cueBase === "number" ? cueBase : 0.26;
    const totB = typeof totBase === "number" ? totBase : 1.45;

    const cue = improvedLowerBetter(cueB, improveReaction, 0.02, rand);
    const tot = improvedLowerBetter(totB, improveReaction, 0.015, rand);

    out[cueK] = roundMaybeInt(clamp(cue, 0.16, 0.45), 2);
    out[totK] = roundMaybeInt(clamp(tot, 0.95, 2.2), 2);
  }

  // --- Single-leg hop (3 tries each, higher is better) ---
  for (let i = 1; i <= 3; i++) {
    const lk = `hop_left_${i}`;
    const rk = `hop_right_${i}`;
    const lb = cycle1Scores?.[lk];
    const rb = cycle1Scores?.[rk];
    const l0 = typeof lb === "number" ? lb : 5.0;
    const r0 = typeof rb === "number" ? rb : 5.2;
    const imp = 0.02 + 0.10 * (0.7 * profile.strength + 0.3 * profile.balance);
    out[lk] = roundMaybeInt(clamp(improvedHigherBetter(l0, imp, 0.02, rand), 2.5, 10), 2);
    out[rk] = roundMaybeInt(clamp(improvedHigherBetter(r0, imp, 0.02, rand), 2.5, 10), 2);
  }

  // --- Double-leg jumps (counts, higher is better) ---
  for (const k of ["jumps_10s", "jumps_20s", "jumps_30s"]) {
    const v = cycle1Scores?.[k];
    if (typeof v === "number") {
      const imp = improveEngine + 0.04 * profile.strength;
      out[k] = Math.round(clamp(improvedHigherBetter(v, imp, 0.03, rand), 0, 80));
    }
  }

  // --- Ankle dorsiflexion (cm-ish, higher is better slightly) ---
  for (const k of ["ankle_left", "ankle_right"]) {
    const v = cycle1Scores?.[k];
    if (typeof v === "number") {
      // balance/mobility tends to improve here
      const imp = 0.01 + 0.08 * profile.balance;
      out[k] = roundMaybeInt(clamp(improvedHigherBetter(v, imp, 0.02, rand), 0, 12), 2);
    }
  }

  // --- Core plank ---
  if (typeof cycle1Scores?.plank_time === "number") {
    const v = cycle1Scores.plank_time;
    const imp = 0.04 + 0.12 * profile.engine;
    out.plank_time = Math.round(clamp(improvedHigherBetter(v, imp, 0.02, rand), 5, 240));
  }
  if (typeof cycle1Scores?.plank_form === "number") {
    const v = cycle1Scores.plank_form;
    // more likely to be 1 as engine/balance improves
    const pGood = clamp(0.45 + 0.35 * profile.engine + 0.15 * profile.balance, 0.2, 0.95);
    out.plank_form = rand() < pGood ? 1 : v;
  }

  return out;
}

async function seedCycle2Data() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    console.log("🔍 Finding Cycle 1 + Cycle 2 evaluations...");

    const cycle1 = await client.query(
      "SELECT id, team_id, scores FROM evaluations WHERE name = $1 LIMIT 1",
      ["Cycle 1"]
    );
    const cycle2 = await client.query(
      "SELECT id, team_id, one_v_one_rounds, skill_moves_count FROM evaluations WHERE name = $1 LIMIT 1",
      ["Cycle 2"]
    );

    if (cycle1.rows.length === 0) {
      console.error("❌ Cycle 1 evaluation not found.");
      await client.query("ROLLBACK");
      process.exit(1);
    }
    if (cycle2.rows.length === 0) {
      console.error("❌ Cycle 2 evaluation not found. Please create it first.");
      await client.query("ROLLBACK");
      process.exit(1);
    }

    const cycle1Row = cycle1.rows[0];
    const cycle2Row = cycle2.rows[0];

    if (cycle1Row.team_id !== cycle2Row.team_id) {
      console.error("❌ Cycle 1 and Cycle 2 are not for the same team.");
      await client.query("ROLLBACK");
      process.exit(1);
    }

    const teamId = cycle2Row.team_id;
    const rounds = Number(cycle2Row.one_v_one_rounds || 5);
    const skillMoves = Number(cycle2Row.skill_moves_count || 5);

    console.log(`✅ Team: ${teamId}`);
    console.log(`✅ Cycle 2 rounds: 1v1=${rounds}, skill moves=${skillMoves}`);

    let cycle1ScoresAll = cycle1Row.scores || {};
    if (typeof cycle1ScoresAll === "string") {
      cycle1ScoresAll = JSON.parse(cycle1ScoresAll);
    }

    // Fallback: if Cycle 1 evaluation has no scores map, derive players and just make data up.
    const playerIdsFromCycle1 = Object.keys(cycle1ScoresAll || {}).filter(Boolean);
    let playerIds = playerIdsFromCycle1;

    if (!playerIds.length) {
      console.log("⚠️  Cycle 1 has no scores map. Falling back to all players on the team...");
      const players = await client.query("SELECT id FROM players WHERE team_id = $1", [teamId]);
      playerIds = players.rows.map((r) => r.id);
    }

    console.log(`👥 Building Cycle 2 scores for ${playerIds.length} players...`);

    const cycle2ScoresAll = {};

    for (const playerId of playerIds) {
      const base = cycle1ScoresAll?.[playerId] || {};
      const profile = pickProfile(playerId);
      const scores = buildCycle2ScoresFromCycle1(base, rounds, skillMoves, profile);
      cycle2ScoresAll[playerId] = scores;
    }

    await client.query("UPDATE evaluations SET scores = $1::jsonb WHERE id = $2", [
      JSON.stringify(cycle2ScoresAll),
      cycle2Row.id,
    ]);

    await client.query("COMMIT");
    console.log("\n✅ Successfully seeded Cycle 2 evaluation data!");
    console.log(`📊 Updated ${Object.keys(cycle2ScoresAll).length} players`);
    console.log("💡 Next: run your compute-all route for Cycle 2 to generate the summary tables.");
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

seedCycle2Data().catch((error) => {
  console.error("❌ Unexpected error during seed:");
  console.error(error);
  process.exit(1);
});


