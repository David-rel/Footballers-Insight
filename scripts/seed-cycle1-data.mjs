#!/usr/bin/env node

/**
 * Seed Cycle 1 evaluation with player data
 */

import { config as loadEnv } from "dotenv";
import { Pool } from "pg";

loadEnv({ path: ".env.local" });
loadEnv();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error(
    "❌ DATABASE_URL is not set. Export it before running this script."
  );
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: connectionString.includes("sslmode=require")
    ? { rejectUnauthorized: false }
    : undefined,
});

// Player data
const playerData = {
  "Jacob Anderson": {
    power_strong: [52, 55, 54, 56],
    power_weak: [38, 41, 40, 39],
    serve_strong: [32, 34, 33, 35],
    serve_weak: [22, 23, 21, 24],
    figure8_strong: 14,
    figure8_weak: 10,
    figure8_both: 12,
    passing_strong: 16,
    passing_weak: 11,
    onevone: [3, 2, 3, 2, 3, 2],
    juggling: [18, 22, 15, 20],
    skillmoves: [4, 3, 4, 3, 4, 3],
    agility: [5.42, 5.36, 5.31],
    reaction_cue: [0.22, 0.21, 0.20],
    reaction_total: [1.24, 1.19, 1.21],
    hop_left: [6.2, 6.5, 6.3],
    hop_right: [6.7, 6.8, 6.6],
    jumps_10s: 12,
    jumps_20s: 23,
    jumps_30s: 32,
    ankle_left: 4.0,
    ankle_right: 5.2,
    plank_time: 92,
    plank_form: "ok",
  },
  "William Brown": {
    power_strong: [46, 48, 47, 49],
    power_weak: [33, 34, 32, 35],
    serve_strong: [28, 29, 27, 30],
    serve_weak: [18, 20, 19, 20],
    figure8_strong: 12,
    figure8_weak: 9,
    figure8_both: 10,
    passing_strong: 14,
    passing_weak: 10,
    onevone: [2, 2, 2, 3, 2, 2],
    juggling: [10, 14, 12, 9],
    skillmoves: [3, 3, 3, 4, 3, 3],
    agility: [5.88, 5.79, 5.82],
    reaction_cue: [0.24, 0.23, 0.23],
    reaction_total: [1.33, 1.29, 1.31],
    hop_left: [5.6, 5.8, 5.7],
    hop_right: [5.9, 6.0, 5.8],
    jumps_10s: 11,
    jumps_20s: 21,
    jumps_30s: 29,
    ankle_left: 3.6,
    ankle_right: 4.1,
    plank_time: 78,
    plank_form: "broke_form",
  },
  "Henry Davis": {
    power_strong: [58, 60, 61, 59],
    power_weak: [44, 46, 45, 43],
    serve_strong: [36, 38, 37, 39],
    serve_weak: [26, 28, 27, 27],
    figure8_strong: 16,
    figure8_weak: 12,
    figure8_both: 14,
    passing_strong: 18,
    passing_weak: 13,
    onevone: [3, 3, 2, 3, 3, 2],
    juggling: [26, 30, 24, 28],
    skillmoves: [4, 4, 4, 4, 3, 4],
    agility: [5.18, 5.22, 5.14],
    reaction_cue: [0.20, 0.21, 0.19],
    reaction_total: [1.16, 1.18, 1.15],
    hop_left: [6.8, 7.0, 6.9],
    hop_right: [7.2, 7.1, 7.0],
    jumps_10s: 13,
    jumps_20s: 25,
    jumps_30s: 35,
    ankle_left: 5.4,
    ankle_right: 5.7,
    plank_time: 118,
    plank_form: "ok",
  },
  "Player Four": {
    power_strong: [40, 42, 41, 43],
    power_weak: [28, 30, 29, 31],
    serve_strong: [22, 24, 23, 25],
    serve_weak: [14, 15, 13, 16],
    figure8_strong: 8,
    figure8_weak: 6,
    figure8_both: 7,
    passing_strong: 10,
    passing_weak: 7,
    onevone: [1, 2, 1, 2, 1, 2],
    juggling: [4, 6, 3, 5],
    skillmoves: [2, 2, 2, 3, 2, 2],
    agility: [6.92, 6.78, 6.85],
    reaction_cue: [0.28, 0.27, 0.27],
    reaction_total: [1.62, 1.58, 1.6],
    hop_left: [4.1, 4.3, 4.2],
    hop_right: [4.4, 4.5, 4.3],
    jumps_10s: 8,
    jumps_20s: 15,
    jumps_30s: 20,
    ankle_left: 2.1,
    ankle_right: 2.8,
    plank_time: 46,
    plank_form: "broke_form",
  },
  "Benjamin Garcia": {
    power_strong: [50, 51, 49, 52],
    power_weak: [36, 35, 37, 34],
    serve_strong: [30, 31, 32, 31],
    serve_weak: [20, 21, 19, 22],
    figure8_strong: 13,
    figure8_weak: 9,
    figure8_both: 11,
    passing_strong: 15,
    passing_weak: 10,
    onevone: [2, 3, 2, 2, 3, 2],
    juggling: [16, 14, 18, 15],
    skillmoves: [3, 4, 3, 3, 4, 3],
    agility: [5.66, 5.59, 5.61],
    reaction_cue: [0.23, 0.22, 0.23],
    reaction_total: [1.27, 1.25, 1.29],
    hop_left: [6.0, 6.1, 5.9],
    hop_right: [6.2, 6.4, 6.3],
    jumps_10s: 12,
    jumps_20s: 22,
    jumps_30s: 30,
    ankle_left: 4.6,
    ankle_right: 4.2,
    plank_time: 88,
    plank_form: "ok",
  },
  "Michael Hernandez": {
    power_strong: [63, 65, 64, 66],
    power_weak: [49, 50, 48, 51],
    serve_strong: [41, 42, 40, 43],
    serve_weak: [30, 31, 29, 32],
    figure8_strong: 17,
    figure8_weak: 13,
    figure8_both: 15,
    passing_strong: 19,
    passing_weak: 14,
    onevone: [3, 3, 3, 2, 3, 3],
    juggling: [34, 28, 31, 36],
    skillmoves: [4, 5, 4, 4, 5, 4],
    agility: [4.98, 5.04, 4.95],
    reaction_cue: [0.19, 0.20, 0.18],
    reaction_total: [1.1, 1.12, 1.09],
    hop_left: [7.4, 7.2, 7.5],
    hop_right: [7.7, 7.8, 7.6],
    jumps_10s: 15,
    jumps_20s: 29,
    jumps_30s: 41,
    ankle_left: 5.9,
    ankle_right: 6.1,
    plank_time: 140,
    plank_form: "ok",
  },
  "Noah Johnson": {
    power_strong: [44, 45, 43, 46],
    power_weak: [31, 32, 30, 33],
    serve_strong: [26, 27, 25, 28],
    serve_weak: [16, 17, 15, 18],
    figure8_strong: 11,
    figure8_weak: 8,
    figure8_both: 9,
    passing_strong: 12,
    passing_weak: 9,
    onevone: [2, 1, 2, 2, 1, 2],
    juggling: [8, 11, 9, 10],
    skillmoves: [3, 2, 3, 3, 2, 3],
    agility: [6.14, 6.02, 6.08],
    reaction_cue: [0.26, 0.25, 0.25],
    reaction_total: [1.44, 1.39, 1.41],
    hop_left: [5.0, 5.2, 5.1],
    hop_right: [5.3, 5.4, 5.2],
    jumps_10s: 10,
    jumps_20s: 18,
    jumps_30s: 24,
    ankle_left: 3.2,
    ankle_right: 3.9,
    plank_time: 62,
    plank_form: "broke_form",
  },
  "James Jones": {
    power_strong: [54, 53, 55, 56],
    power_weak: [39, 41, 40, 42],
    serve_strong: [33, 35, 34, 36],
    serve_weak: [23, 24, 22, 25],
    figure8_strong: 15,
    figure8_weak: 11,
    figure8_both: 13,
    passing_strong: 16,
    passing_weak: 12,
    onevone: [3, 2, 2, 3, 2, 3],
    juggling: [20, 18, 23, 21],
    skillmoves: [4, 3, 4, 4, 3, 4],
    agility: [5.34, 5.29, 5.26],
    reaction_cue: [0.21, 0.22, 0.20],
    reaction_total: [1.21, 1.23, 1.18],
    hop_left: [6.5, 6.6, 6.4],
    hop_right: [6.8, 6.9, 6.7],
    jumps_10s: 13,
    jumps_20s: 24,
    jumps_30s: 33,
    ankle_left: 4.8,
    ankle_right: 4.6,
    plank_time: 104,
    plank_form: "ok",
  },
  "Ethan Lopez": {
    power_strong: [48, 50, 49, 51],
    power_weak: [34, 35, 33, 36],
    serve_strong: [29, 30, 28, 31],
    serve_weak: [19, 18, 20, 21],
    figure8_strong: 12,
    figure8_weak: 9,
    figure8_both: 10,
    passing_strong: 14,
    passing_weak: 10,
    onevone: [2, 2, 3, 2, 2, 3],
    juggling: [13, 16, 12, 15],
    skillmoves: [3, 3, 4, 3, 3, 4],
    agility: [5.73, 5.68, 5.64],
    reaction_cue: [0.23, 0.22, 0.22],
    reaction_total: [1.3, 1.27, 1.28],
    hop_left: [5.8, 5.9, 5.7],
    hop_right: [6.1, 6.0, 6.2],
    jumps_10s: 12,
    jumps_20s: 22,
    jumps_30s: 29,
    ankle_left: 4.1,
    ankle_right: 4.7,
    plank_time: 84,
    plank_form: "ok",
  },
  "Mason Martinez": {
    power_strong: [57, 58, 56, 59],
    power_weak: [42, 44, 43, 41],
    serve_strong: [37, 36, 38, 39],
    serve_weak: [26, 25, 27, 28],
    figure8_strong: 16,
    figure8_weak: 12,
    figure8_both: 14,
    passing_strong: 17,
    passing_weak: 12,
    onevone: [3, 2, 3, 3, 2, 3],
    juggling: [24, 26, 22, 25],
    skillmoves: [4, 4, 4, 4, 3, 4],
    agility: [5.22, 5.17, 5.2],
    reaction_cue: [0.21, 0.21, 0.20],
    reaction_total: [1.18, 1.2, 1.17],
    hop_left: [6.9, 6.8, 7.0],
    hop_right: [7.1, 7.2, 7.0],
    jumps_10s: 14,
    jumps_20s: 27,
    jumps_30s: 38,
    ankle_left: 5.2,
    ankle_right: 5.0,
    plank_time: 126,
    plank_form: "ok",
  },
  "Lucas Miller": {
    power_strong: [43, 44, 42, 45],
    power_weak: [29, 31, 30, 32],
    serve_strong: [25, 26, 24, 27],
    serve_weak: [16, 15, 17, 18],
    figure8_strong: 10,
    figure8_weak: 7,
    figure8_both: 9,
    passing_strong: 12,
    passing_weak: 8,
    onevone: [2, 1, 2, 1, 2, 2],
    juggling: [7, 9, 8, 6],
    skillmoves: [2, 3, 2, 3, 2, 3],
    agility: [6.28, 6.19, 6.23],
    reaction_cue: [0.27, 0.26, 0.26],
    reaction_total: [1.48, 1.45, 1.46],
    hop_left: [4.9, 5.0, 4.8],
    hop_right: [5.2, 5.1, 5.3],
    jumps_10s: 9,
    jumps_20s: 17,
    jumps_30s: 23,
    ankle_left: 3.0,
    ankle_right: 3.5,
    plank_time: 58,
    plank_form: "broke_form",
  },
  "Player One": {
    power_strong: [61, 62, 60, 63],
    power_weak: [46, 47, 45, 48],
    serve_strong: [40, 39, 41, 42],
    serve_weak: [29, 30, 28, 31],
    figure8_strong: 18,
    figure8_weak: 14,
    figure8_both: 16,
    passing_strong: 20,
    passing_weak: 15,
    onevone: [3, 3, 3, 3, 2, 3],
    juggling: [40, 36, 42, 38],
    skillmoves: [5, 4, 5, 4, 5, 4],
    agility: [4.92, 4.89, 4.86],
    reaction_cue: [0.19, 0.19, 0.18],
    reaction_total: [1.08, 1.09, 1.07],
    hop_left: [7.6, 7.4, 7.5],
    hop_right: [7.9, 8.0, 7.8],
    jumps_10s: 16,
    jumps_20s: 31,
    jumps_30s: 44,
    ankle_left: 6.0,
    ankle_right: 5.8,
    plank_time: 160,
    plank_form: "ok",
  },
  "Alexander Rodriguez": {
    power_strong: [49, 50, 48, 51],
    power_weak: [35, 36, 34, 37],
    serve_strong: [31, 30, 32, 33],
    serve_weak: [21, 20, 22, 23],
    figure8_strong: 13,
    figure8_weak: 10,
    figure8_both: 12,
    passing_strong: 15,
    passing_weak: 11,
    onevone: [2, 3, 2, 3, 2, 2],
    juggling: [17, 19, 16, 18],
    skillmoves: [3, 4, 3, 4, 3, 3],
    agility: [5.61, 5.55, 5.49],
    reaction_cue: [0.22, 0.22, 0.21],
    reaction_total: [1.26, 1.24, 1.22],
    hop_left: [6.1, 6.0, 6.2],
    hop_right: [6.4, 6.5, 6.3],
    jumps_10s: 12,
    jumps_20s: 23,
    jumps_30s: 31,
    ankle_left: 4.3,
    ankle_right: 4.9,
    plank_time: 96,
    plank_form: "ok",
  },
  "Liam Smith": {
    power_strong: [45, 46, 44, 47],
    power_weak: [32, 33, 31, 34],
    serve_strong: [27, 28, 26, 29],
    serve_weak: [17, 18, 16, 19],
    figure8_strong: 11,
    figure8_weak: 8,
    figure8_both: 10,
    passing_strong: 13,
    passing_weak: 9,
    onevone: [2, 2, 1, 2, 2, 1],
    juggling: [9, 12, 8, 11],
    skillmoves: [3, 3, 2, 3, 3, 2],
    agility: [6.05, 5.97, 6.01],
    reaction_cue: [0.25, 0.24, 0.24],
    reaction_total: [1.4, 1.37, 1.38],
    hop_left: [5.2, 5.3, 5.1],
    hop_right: [5.5, 5.6, 5.4],
    jumps_10s: 10,
    jumps_20s: 19,
    jumps_30s: 25,
    ankle_left: 3.4,
    ankle_right: 3.1,
    plank_time: 70,
    plank_form: "broke_form",
  },
  "Jackson Taylor": {
    power_strong: [56, 55, 57, 58],
    power_weak: [41, 42, 40, 43],
    serve_strong: [35, 36, 34, 37],
    serve_weak: [25, 24, 26, 27],
    figure8_strong: 15,
    figure8_weak: 11,
    figure8_both: 13,
    passing_strong: 17,
    passing_weak: 12,
    onevone: [3, 2, 3, 2, 2, 3],
    juggling: [21, 24, 20, 23],
    skillmoves: [4, 4, 4, 3, 4, 3],
    agility: [5.27, 5.23, 5.2],
    reaction_cue: [0.21, 0.20, 0.21],
    reaction_total: [1.19, 1.17, 1.18],
    hop_left: [6.7, 6.6, 6.8],
    hop_right: [7.0, 6.9, 7.1],
    jumps_10s: 14,
    jumps_20s: 26,
    jumps_30s: 36,
    ankle_left: 5.0,
    ankle_right: 5.5,
    plank_time: 112,
    plank_form: "ok",
  },
  "Logan Thomas": {
    power_strong: [42, 43, 41, 44],
    power_weak: [29, 28, 30, 31],
    serve_strong: [24, 25, 23, 26],
    serve_weak: [15, 16, 14, 17],
    figure8_strong: 9,
    figure8_weak: 7,
    figure8_both: 8,
    passing_strong: 11,
    passing_weak: 8,
    onevone: [1, 2, 1, 2, 2, 1],
    juggling: [6, 8, 5, 7],
    skillmoves: [2, 3, 2, 2, 3, 2],
    agility: [6.44, 6.33, 6.39],
    reaction_cue: [0.28, 0.27, 0.27],
    reaction_total: [1.55, 1.5, 1.52],
    hop_left: [4.6, 4.7, 4.5],
    hop_right: [4.9, 5.0, 4.8],
    jumps_10s: 9,
    jumps_20s: 16,
    jumps_30s: 21,
    ankle_left: 2.7,
    ankle_right: 3.3,
    plank_time: 52,
    plank_form: "broke_form",
  },
  "Player Three": {
    power_strong: [47, 46, 48, 49],
    power_weak: [33, 34, 32, 35],
    serve_strong: [28, 27, 29, 30],
    serve_weak: [18, 19, 17, 20],
    figure8_strong: 12,
    figure8_weak: 9,
    figure8_both: 10,
    passing_strong: 14,
    passing_weak: 10,
    onevone: [2, 2, 2, 2, 3, 2],
    juggling: [12, 15, 11, 14],
    skillmoves: [3, 3, 3, 3, 4, 3],
    agility: [5.86, 5.8, 5.77],
    reaction_cue: [0.23, 0.23, 0.22],
    reaction_total: [1.32, 1.3, 1.28],
    hop_left: [5.7, 5.6, 5.8],
    hop_right: [6.0, 5.9, 6.1],
    jumps_10s: 11,
    jumps_20s: 21,
    jumps_30s: 28,
    ankle_left: 4.0,
    ankle_right: 4.4,
    plank_time: 86,
    plank_form: "ok",
  },
  "Player Two": {
    power_strong: [39, 41, 40, 42],
    power_weak: [27, 28, 26, 29],
    serve_strong: [21, 22, 20, 23],
    serve_weak: [12, 13, 11, 14],
    figure8_strong: 8,
    figure8_weak: 6,
    figure8_both: 7,
    passing_strong: 9,
    passing_weak: 6,
    onevone: [1, 1, 2, 1, 2, 1],
    juggling: [3, 5, 2, 4],
    skillmoves: [2, 2, 2, 2, 3, 2],
    agility: [7.1, 6.98, 7.04],
    reaction_cue: [0.31, 0.30, 0.30],
    reaction_total: [1.7, 1.66, 1.68],
    hop_left: [3.9, 4.0, 3.8],
    hop_right: [4.2, 4.1, 4.3],
    jumps_10s: 7,
    jumps_20s: 13,
    jumps_30s: 17,
    ankle_left: 1.9,
    ankle_right: 2.4,
    plank_time: 38,
    plank_form: "broke_form",
  },
  "Oliver Williams": {
    power_strong: [55, 56, 54, 57],
    power_weak: [40, 42, 41, 43],
    serve_strong: [34, 35, 33, 36],
    serve_weak: [24, 25, 23, 26],
    figure8_strong: 15,
    figure8_weak: 12,
    figure8_both: 14,
    passing_strong: 17,
    passing_weak: 13,
    onevone: [3, 2, 3, 3, 2, 3],
    juggling: [22, 20, 25, 23],
    skillmoves: [4, 4, 4, 4, 3, 4],
    agility: [5.25, 5.19, 5.21],
    reaction_cue: [0.21, 0.21, 0.20],
    reaction_total: [1.17, 1.2, 1.16],
    hop_left: [6.6, 6.7, 6.5],
    hop_right: [7.0, 6.9, 7.1],
    jumps_10s: 14,
    jumps_20s: 27,
    jumps_30s: 37,
    ankle_left: 5.3,
    ankle_right: 5.1,
    plank_time: 120,
    plank_form: "ok",
  },
  "Daniel Wilson": {
    power_strong: [51, 52, 50, 53],
    power_weak: [37, 38, 36, 39],
    serve_strong: [32, 31, 33, 34],
    serve_weak: [22, 21, 23, 24],
    figure8_strong: 14,
    figure8_weak: 10,
    figure8_both: 12,
    passing_strong: 16,
    passing_weak: 11,
    onevone: [2, 3, 2, 2, 3, 2],
    juggling: [18, 16, 20, 17],
    skillmoves: [3, 4, 3, 3, 4, 3],
    agility: [5.54, 5.48, 5.5],
    reaction_cue: [0.22, 0.22, 0.22],
    reaction_total: [1.25, 1.23, 1.24],
    hop_left: [6.2, 6.3, 6.1],
    hop_right: [6.6, 6.5, 6.7],
    jumps_10s: 13,
    jumps_20s: 24,
    jumps_30s: 32,
    ankle_left: 4.4,
    ankle_right: 4.8,
    plank_time: 98,
    plank_form: "ok",
  },
};

function buildPlayerScores(playerId, data) {
  const scores = {};

  // Power (8 fields)
  for (let i = 0; i < 4; i++) {
    scores[`power_strong_${i + 1}`] = data.power_strong[i];
    scores[`power_weak_${i + 1}`] = data.power_weak[i];
  }

  // Serve Distance (8 fields)
  for (let i = 0; i < 4; i++) {
    scores[`serve_strong_${i + 1}`] = data.serve_strong[i];
    scores[`serve_weak_${i + 1}`] = data.serve_weak[i];
  }

  // Figure 8 Loops
  scores.figure8_strong = data.figure8_strong;
  scores.figure8_weak = data.figure8_weak;
  scores.figure8_both = data.figure8_both;

  // Passing Gates
  scores.passing_strong = data.passing_strong;
  scores.passing_weak = data.passing_weak;

  // 1v1 (6 rounds)
  for (let i = 0; i < 6; i++) {
    scores[`onevone_round_${i + 1}`] = data.onevone[i];
  }

  // Juggling (4 fields)
  for (let i = 0; i < 4; i++) {
    scores[`juggling_${i + 1}`] = data.juggling[i];
  }

  // Skill Moves (6 ratings)
  for (let i = 0; i < 6; i++) {
    scores[`skillmove_${i + 1}`] = data.skillmoves[i];
  }

  // Agility (3 fields)
  for (let i = 0; i < 3; i++) {
    scores[`agility_${i + 1}`] = data.agility[i];
  }

  // Reaction Sprint (6 fields - cue and total for each of 3 trials)
  for (let i = 0; i < 3; i++) {
    scores[`reaction_cue_${i + 1}`] = data.reaction_cue[i];
    scores[`reaction_total_${i + 1}`] = data.reaction_total[i];
  }

  // Single-leg Hop (6 fields)
  for (let i = 0; i < 3; i++) {
    scores[`hop_left_${i + 1}`] = data.hop_left[i];
    scores[`hop_right_${i + 1}`] = data.hop_right[i];
  }

  // Double-leg Jumps
  scores.jumps_10s = data.jumps_10s;
  scores.jumps_20s = data.jumps_20s;
  scores.jumps_30s = data.jumps_30s;

  // Ankle Dorsiflexion
  scores.ankle_left = data.ankle_left;
  scores.ankle_right = data.ankle_right;

  // Core Plank
  scores.plank_time = data.plank_time;
  scores.plank_form = data.plank_form === "ok" ? 1 : 0;

  return scores;
}

async function seedCycle1Data() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    console.log("🔍 Finding Cycle 1 evaluation...");

    // Find Cycle 1 evaluation
    const evalResult = await client.query(
      "SELECT id, team_id FROM evaluations WHERE name = $1 LIMIT 1",
      ["Cycle 1"]
    );

    if (evalResult.rows.length === 0) {
      console.error("❌ Cycle 1 evaluation not found. Please create it first.");
      await client.query("ROLLBACK");
      process.exit(1);
    }

    const evaluationId = evalResult.rows[0].id;
    const teamId = evalResult.rows[0].team_id;

    console.log(`✅ Found Cycle 1 evaluation (ID: ${evaluationId})`);

    // Get current scores
    const currentScoresResult = await client.query(
      "SELECT scores FROM evaluations WHERE id = $1",
      [evaluationId]
    );
    let allScores = currentScoresResult.rows[0].scores || {};
    if (typeof allScores === "string") {
      allScores = JSON.parse(allScores);
    }

    console.log("👥 Finding players and updating scores...");

    // Process each player
    for (const [playerName, data] of Object.entries(playerData)) {
      // Find player by name (handle both "FirstName LastName" and "Player X" formats)
      const nameParts = playerName.split(" ");
      let playerResult;

      if (nameParts.length === 2) {
        // First and last name
        playerResult = await client.query(
          `SELECT id FROM players 
           WHERE team_id = $1 
           AND first_name = $2 
           AND last_name = $3 
           LIMIT 1`,
          [teamId, nameParts[0], nameParts[1]]
        );
      } else {
        // "Player X" format - need to find by first_name only
        playerResult = await client.query(
          `SELECT id FROM players 
           WHERE team_id = $1 
           AND first_name = $2 
           LIMIT 1`,
          [teamId, playerName]
        );
      }

      if (playerResult.rows.length === 0) {
        console.log(`  ⚠️  Player "${playerName}" not found, skipping...`);
        continue;
      }

      const playerId = playerResult.rows[0].id;
      const playerScores = buildPlayerScores(playerId, data);
      allScores[playerId] = playerScores;

      console.log(`  ✅ Updated ${playerName}`);
    }

    // Update evaluation scores
    await client.query(
      "UPDATE evaluations SET scores = $1::jsonb WHERE id = $2",
      [JSON.stringify(allScores), evaluationId]
    );

    await client.query("COMMIT");
    console.log("\n✅ Successfully seeded Cycle 1 evaluation data!");
    console.log(`📊 Updated ${Object.keys(allScores).length} players`);
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

seedCycle1Data().catch((error) => {
  console.error("❌ Unexpected error during seed:");
  console.error(error);
  process.exit(1);
});
