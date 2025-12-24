"use client";

import { Info } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

type Role = "owner" | "admin" | "coach" | "parent" | "player";

function aiLabelForRole(role: Role | null) {
  if (role === "coach") return "Team AI Analysis";
  if (role === "owner" || role === "admin") return "Company Stats Analysis";
  if (role === "player" || role === "parent") return "Player AI Analysis";
  return "AI Analysis";
}

type PlayerOption = {
  id: string;
  teamId: string;
  firstName: string;
  lastName: string;
  fullName?: string;
  teamName?: string;
};

type PlayerEvaluationMeta = {
  id: string;
  name: string | null;
  createdAt: string | null;
};

type PlayerEvaluationDetails = {
  playerEvaluation: {
    id: string;
    playerId: string;
    teamId: string;
    evaluationId: string | null;
    name: string | null;
    createdAt: string | null;
  };
  testScores: any | null;
  overallScores: any | null;
  playerDna: any | null;
  playerCluster: any | null;
};

function safeDateLabel(iso: string | null | undefined) {
  if (!iso) return "Unknown date";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Unknown date";
  return d.toLocaleString();
}

type Scores = Record<string, number>;

type PlayerCluster = {
  ps?: number;
  tc?: number;
  ms?: number;
  dc?: number;
  vector?: number[];
};

type AiPlayerReportV1 = {
  headline: string;
  summary: string;
  strengths: Array<{
    title: string;
    whatItMeans: string;
    evidence: string[];
  }>;
  focusAreas: Array<{
    title: string;
    whyThisMatters: string;
    howToImprove: string[];
    drills: Array<{
      name: string;
      goal: string;
      setup: string[];
      coachingCues: string[];
      dosage: string;
    }>;
    watchOutFor: string[];
  }>;
  next7DaysPlan: {
    sessions: Array<{
      dayLabel: string;
      durationMinutes: number;
      warmup: string[];
      main: string[];
      cooldown: string[];
    }>;
    note: string;
  };
  parentNotes: string[];
  confidence: {
    level: "low" | "medium" | "high";
    reason: string;
  };
};

type AiPlayerReportV2 = {
  audience: "player_parent";
  player: { id: string; name: string; teamName: string | null };
  checkIn: { id: string; name: string; createdAt?: string; date?: string };
  summary: string;
  highlights: Array<{ bullet: string }>;
  whatToDoNext: Array<{ bullet: string }>;
  confidence: number; // 0..1
};

type AiPlayerReportV3 = {
  audience: "player_parent";
  player: { id: string; name: string; teamName: string | null };
  checkIn: { id: string; name: string; createdAt?: string; date?: string };
  confidence: number; // 0..1
  report: {
    summary: string;
    strengths: Array<{ area: string; detail: string }>;
    improvements: Array<{ area: string; detail: string }>;
    nextSteps: Array<{ action: string; detail: string }>;
  };
};

type AiPlayerReportV4 = {
  playerName: string;
  teamName?: string | null;
  checkInName?: string;
  checkInId?: string;
  createdAt?: string;
  date?: string;
  summary?: string;
  quickSummary?: string;
  confidence?: number; // 0..1
  highlights?: string[];
  strengths?: string[];
  improvements?: string[];
  concerns?: string[];
  areasToImprove?: string[];
  top3Actions?: string[];
  whatToDoNext?: string[];
  coachingTips?: string[];
  practicalTrainingPlan_weekly?: Array<{ name: string; details: string[] }>;
  weeklyPlanExample?: string[];
  practicalTrainingPlan?: Array<{ name: string; details: string[] }>;
  safetyNotes?: string[] | string;
  actionPlan?: {
    shortTerm_next2weeks?: string[];
    mediumTerm_next6_8weeks?: string[];
    "mediumTerm_next6-8weeks"?: string[];
  };
};

type AiPlayerReport =
  | AiPlayerReportV1
  | AiPlayerReportV2
  | AiPlayerReportV3
  | AiPlayerReportV4;

function isAiReportV1(r: any): r is AiPlayerReportV1 {
  return !!r && typeof r === "object" && typeof r.headline === "string";
}

function isAiReportV2(r: any): r is AiPlayerReportV2 {
  return (
    !!r &&
    typeof r === "object" &&
    r.audience === "player_parent" &&
    typeof r.summary === "string" &&
    Array.isArray(r.highlights) &&
    Array.isArray(r.whatToDoNext)
  );
}

function isAiReportV3(r: any): r is AiPlayerReportV3 {
  return (
    !!r &&
    typeof r === "object" &&
    r.audience === "player_parent" &&
    r.report &&
    typeof r.report === "object" &&
    typeof r.report.summary === "string" &&
    Array.isArray(r.report.strengths) &&
    Array.isArray(r.report.improvements) &&
    Array.isArray(r.report.nextSteps)
  );
}

function isAiReportV4(r: any): r is AiPlayerReportV4 {
  return (
    !!r &&
    typeof r === "object" &&
    (typeof r.summary === "string" || typeof r.quickSummary === "string") &&
    typeof r.playerName === "string"
  );
}

type CategoryDef = {
  id: string;
  name: string;
  testKeys: string[];
  overallKeys: string[];
  testHigherIsBetter?: boolean;
};

const MAX_AI_EVALUATIONS = 3;

const CATEGORIES: CategoryDef[] = [
  {
    id: "onevone",
    name: "1v1",
    testKeys: [
      "onevone_round_1",
      "onevone_round_2",
      "onevone_round_3",
      "onevone_round_4",
      "onevone_round_5",
      "onevone_round_6",
    ],
    overallKeys: [
      "one_v_one_avg_score",
      "one_v_one_total_score",
      "one_v_one_best_round",
      "one_v_one_worst_round",
      "one_v_one_consistency_range",
      "one_v_one_rounds_played",
    ],
    testHigherIsBetter: true,
  },
  {
    id: "agility",
    name: "Agility (5-10-5)",
    testKeys: ["agility_1", "agility_2", "agility_3"],
    overallKeys: [
      "agility_5_10_5_best_time",
      "agility_5_10_5_avg_time",
      "agility_5_10_5_worst_time",
      "agility_5_10_5_consistency_range",
    ],
    testHigherIsBetter: false,
  },
  {
    id: "ankle",
    name: "Ankle Dorsiflexion",
    testKeys: ["ankle_left", "ankle_right"],
    overallKeys: [
      "ankle_dorsiflex_left_cm",
      "ankle_dorsiflex_right_cm",
      "ankle_dorsiflex_avg_cm",
      "ankle_dorsiflex_asymmetry_pct",
      "ankle_dorsiflex_left_minus_right_cm",
    ],
    testHigherIsBetter: true,
  },
  {
    id: "jumps",
    name: "Double Leg Jumps",
    testKeys: ["jumps_10s", "jumps_20s", "jumps_30s"],
    overallKeys: [
      "double_leg_jumps_total_reps",
      "double_leg_jumps_first10",
      "double_leg_jumps_last10",
      "double_leg_jumps_dropoff_pct",
    ],
    testHigherIsBetter: true,
  },
  {
    id: "core",
    name: "Core Plank",
    testKeys: ["plank_time", "plank_form"],
    overallKeys: [
      "core_plank_hold_sec",
      "core_plank_form_flag",
      "core_plank_hold_sec_if_good_form",
    ],
    testHigherIsBetter: true,
  },
  {
    id: "hop",
    name: "Single Leg Hop",
    testKeys: [
      "hop_left_1",
      "hop_left_2",
      "hop_left_3",
      "hop_right_1",
      "hop_right_2",
      "hop_right_3",
    ],
    overallKeys: [
      "single_leg_hop_left",
      "single_leg_hop_right",
      "single_leg_hop_left_avg",
      "single_leg_hop_right_avg",
      "single_leg_hop_asymmetry_pct",
      "single_leg_hop_left_consistency_range",
      "single_leg_hop_right_consistency_range",
    ],
    testHigherIsBetter: true,
  },
  {
    id: "juggling",
    name: "Juggling",
    testKeys: ["juggling_1", "juggling_2", "juggling_3"],
    overallKeys: [
      "juggle_best",
      "juggle_total",
      "juggle_avg_all",
      "juggle_best2_sum",
      "juggle_consistency_range",
    ],
    testHigherIsBetter: true,
  },
  {
    id: "skillmoves",
    name: "Skill Moves",
    testKeys: [
      "skillmove_1",
      "skillmove_2",
      "skillmove_3",
      "skillmove_4",
      "skillmove_5",
      "skillmove_6",
    ],
    overallKeys: [
      "skill_moves_count",
      "skill_moves_avg_rating",
      "skill_moves_best_rating",
      "skill_moves_worst_rating",
      "skill_moves_total_rating",
      "skill_moves_consistency_range",
    ],
    testHigherIsBetter: true,
  },
  {
    id: "figure8",
    name: "Figure 8",
    testKeys: ["figure8_both", "figure8_strong", "figure8_weak"],
    overallKeys: [
      "figure8_loops_both",
      "figure8_loops_strong",
      "figure8_loops_weak",
      "figure8_asymmetry_pct",
      "figure8_both_to_strong_ratio",
      "figure8_weak_to_strong_ratio",
    ],
    testHigherIsBetter: true,
  },
  {
    id: "passing",
    name: "Passing Gates",
    testKeys: ["passing_strong", "passing_weak"],
    overallKeys: [
      "passing_gates_total_hits",
      "passing_gates_strong_hits",
      "passing_gates_weak_hits",
      "passing_gates_asymmetry_pct",
      "passing_gates_weak_to_strong_ratio",
      "passing_gates_weak_share_pct",
    ],
    testHigherIsBetter: true,
  },
  {
    id: "reaction",
    name: "Reaction Sprint (5m)",
    testKeys: [
      "reaction_cue_1",
      "reaction_cue_2",
      "reaction_cue_3",
      "reaction_total_1",
      "reaction_total_2",
      "reaction_total_3",
    ],
    overallKeys: [
      "reaction_5m_reaction_time_avg",
      "reaction_5m_reaction_time_best",
      "reaction_5m_reaction_time_worst",
      "reaction_5m_total_time_avg",
      "reaction_5m_total_time_best",
      "reaction_5m_total_time_worst",
      "reaction_5m_reaction_consistency_range",
      "reaction_5m_total_consistency_range",
    ],
    testHigherIsBetter: false,
  },
  {
    id: "shotpower",
    name: "Shot Power",
    testKeys: [
      "power_strong_1",
      "power_strong_2",
      "power_strong_3",
      "power_weak_1",
      "power_weak_2",
      "power_weak_3",
    ],
    overallKeys: [
      "shot_power_strong_avg",
      "shot_power_strong_max",
      "shot_power_weak_avg",
      "shot_power_weak_max",
      "shot_power_asymmetry_pct",
      "shot_power_asymmetry_pct_max",
      "shot_power_weak_to_strong_ratio",
      "shot_power_weak_to_strong_ratio_max",
    ],
    testHigherIsBetter: true,
  },
  {
    id: "servedistance",
    name: "Serve Distance",
    testKeys: [
      "serve_strong_1",
      "serve_strong_2",
      "serve_strong_3",
      "serve_weak_1",
      "serve_weak_2",
      "serve_weak_3",
    ],
    overallKeys: [
      "serve_distance_strong_avg",
      "serve_distance_strong_max",
      "serve_distance_weak_avg",
      "serve_distance_weak_max",
      "serve_distance_asymmetry_pct",
      "serve_distance_asymmetry_pct_max",
      "serve_distance_weak_to_strong_ratio",
      "serve_distance_weak_to_strong_ratio_max",
    ],
    testHigherIsBetter: true,
  },
];

function titleCaseFromKey(key: string) {
  let s = key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bAvg\b/g, "Average")
    .replace(/\bMax\b/g, "Top")
    .replace(/\bPct\b/g, "%");

  s = s
    .replace(/\bAsymmetry %\b/g, "Difference %")
    .replace(/\bConsistency Range\b/g, "Spread")
    .replace(/\bWeak To Strong Ratio\b/g, "Weak vs Strong")
    .replace(/\bBoth To Strong Ratio\b/g, "Both vs Strong")
    .replace(/\bLeft Minus Right Cm\b/g, "Left - Right (cm)")
    .replace(/\bHold Sec\b/g, "Hold (sec)")
    .replace(/\bTime Avg\b/g, "Time Average")
    .replace(/\bTime Best\b/g, "Fastest Time")
    .replace(/\bTime Worst\b/g, "Slowest Time");

  return s;
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function formatNumberMax3(v: number) {
  if (!Number.isFinite(v)) return "—";
  if (Number.isInteger(v)) return String(v);
  return String(Number(v.toFixed(3)));
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function avg(nums: number[]) {
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function best(nums: number[], higherIsBetter = true) {
  if (!nums.length) return null;
  return higherIsBetter ? Math.max(...nums) : Math.min(...nums);
}

function PercentBar({
  label,
  value01,
}: {
  label: string;
  value01: number | null;
}) {
  const pct = value01 === null ? null : Math.round(clamp01(value01) * 100);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <div className="text-sm text-white/80">{label}</div>
        <div className="text-sm font-semibold text-white">
          {pct === null ? "—" : `${pct}%`}
        </div>
      </div>
      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-[#e3ca76]/60 to-[#e3ca76]"
          style={{ width: `${pct ?? 0}%` }}
        />
      </div>
    </div>
  );
}

function Tooltip({ text, children }: { text: string; children: ReactNode }) {
  if (!text) return <>{children}</>;

  return (
    <span className="group relative inline-flex items-center gap-1">
      {children}
      <span
        className={[
          "pointer-events-none absolute left-0 top-full mt-2 w-[320px] max-w-[80vw]",
          "rounded-lg border border-white/10 bg-black/90 px-3 py-2",
          "text-xs leading-snug text-white/90 shadow-xl",
          "opacity-0 translate-y-1 transition-all duration-150",
          "group-hover:opacity-100 group-hover:translate-y-0",
          "z-50",
        ].join(" ")}
        role="tooltip"
      >
        {text}
      </span>
    </span>
  );
}

function helpTextForKey(key: string): string {
  // Raw tries
  if (/^onevone_round_\d+$/.test(key)) {
    return "Your score in this 1v1 round (higher is better).";
  }
  if (/^agility_\d+$/.test(key)) {
    return "Your time for this agility run in seconds (lower is better).";
  }
  if (key === "ankle_left") return "Left ankle mobility measurement.";
  if (key === "ankle_right") return "Right ankle mobility measurement.";
  if (/^jumps_(10s|20s|30s)$/.test(key)) {
    return "How many jumps you completed in this time window (higher is better).";
  }
  if (/^hop_left_\d+$/.test(key)) {
    return "Left-leg hop distance for this try (higher is better).";
  }
  if (/^hop_right_\d+$/.test(key)) {
    return "Right-leg hop distance for this try (higher is better).";
  }
  if (/^juggling_\d+$/.test(key)) {
    return "How many juggles you got in this try (higher is better).";
  }
  if (/^skillmove_\d+$/.test(key)) {
    return "Coach rating for this skill move (higher is better).";
  }
  if (key === "figure8_both") return "Figure 8 loops using both sides/feet.";
  if (key === "figure8_strong")
    return "Figure 8 loops using your strong side/foot.";
  if (key === "figure8_weak")
    return "Figure 8 loops using your weak side/foot.";
  if (key === "passing_strong")
    return "Passing gates hits using your strong foot.";
  if (key === "passing_weak") return "Passing gates hits using your weak foot.";
  if (/^reaction_cue_\d+$/.test(key)) {
    return "Your reaction time (seconds) from the cue to first movement (lower is better).";
  }
  if (/^reaction_total_\d+$/.test(key)) {
    return "Your total sprint time (seconds) including reaction + run (lower is better).";
  }
  if (/^power_strong_\d+$/.test(key))
    return "Shot power for this try with your strong foot.";
  if (/^power_weak_\d+$/.test(key))
    return "Shot power for this try with your weak foot.";
  if (/^serve_strong_\d+$/.test(key))
    return "Serve distance for this try with your strong foot.";
  if (/^serve_weak_\d+$/.test(key))
    return "Serve distance for this try with your weak foot.";
  if (key === "plank_time")
    return "How long you held the plank in seconds (higher is better).";
  if (key === "plank_form")
    return "Plank form check (1 = good form, 0 = form broke).";

  // Summary metrics (computed)
  const HELP: Record<string, string> = {
    one_v_one_avg_score:
      "Your average 1v1 score across rounds (higher is better).",
    one_v_one_total_score:
      "Your total 1v1 score across all rounds (higher is better).",
    one_v_one_best_round: "Your highest scoring 1v1 round (higher is better).",
    one_v_one_worst_round: "Your lowest scoring 1v1 round (higher is better).",
    one_v_one_consistency_range:
      "How spread out your 1v1 scores were (smaller means more consistent).",
    one_v_one_rounds_played: "How many 1v1 rounds were recorded.",

    agility_5_10_5_best_time:
      "Your fastest agility run time in seconds (lower is better).",
    agility_5_10_5_avg_time:
      "Your average agility run time in seconds (lower is better).",
    agility_5_10_5_worst_time:
      "Your slowest agility run time in seconds (lower is better).",
    agility_5_10_5_consistency_range:
      "How spread out your agility times were (smaller means more consistent).",

    ankle_dorsiflex_left_cm: "Left ankle mobility in centimeters.",
    ankle_dorsiflex_right_cm: "Right ankle mobility in centimeters.",
    ankle_dorsiflex_avg_cm: "Average ankle mobility in centimeters.",
    ankle_dorsiflex_asymmetry_pct:
      "Difference % between left and right ankle mobility (closer to 0% is more balanced).",
    ankle_dorsiflex_left_minus_right_cm:
      "Left minus right ankle mobility in centimeters (closer to 0 is more balanced).",

    double_leg_jumps_total_reps:
      "Total jumps you completed in the test (higher is better).",
    double_leg_jumps_first10:
      "Jumps completed in the first 10 seconds (higher is better).",
    double_leg_jumps_last10:
      "Jumps completed in the last 10 seconds (higher is better).",
    double_leg_jumps_dropoff_pct:
      "How much your jump rate dropped from early to late (lower means less drop-off).",

    core_plank_hold_sec:
      "How long you held the plank in seconds (higher is better).",
    core_plank_form_flag: "Form check (1 = good form, 0 = form broke).",
    core_plank_hold_sec_if_good_form:
      "Plank hold time counting only time held with good form (higher is better).",

    single_leg_hop_left: "Your best left-leg hop distance (higher is better).",
    single_leg_hop_right:
      "Your best right-leg hop distance (higher is better).",
    single_leg_hop_left_avg:
      "Average left-leg hop distance across tries (higher is better).",
    single_leg_hop_right_avg:
      "Average right-leg hop distance across tries (higher is better).",
    single_leg_hop_asymmetry_pct:
      "Difference % between left and right hop distance (closer to 0% is more balanced).",
    single_leg_hop_left_consistency_range:
      "How spread out your left-leg hop tries were (smaller means more consistent).",
    single_leg_hop_right_consistency_range:
      "How spread out your right-leg hop tries were (smaller means more consistent).",

    juggle_best: "Your best juggling score (higher is better).",
    juggle_total: "Total juggles across all tries (higher is better).",
    juggle_avg_all: "Average juggles per try (higher is better).",
    juggle_best2_sum: "Sum of your best two juggling tries (higher is better).",
    juggle_consistency_range:
      "How spread out your juggling tries were (smaller means more consistent).",

    skill_moves_count: "How many skill moves were rated.",
    skill_moves_avg_rating: "Average skill move rating (higher is better).",
    skill_moves_best_rating: "Highest skill move rating (higher is better).",
    skill_moves_worst_rating: "Lowest skill move rating (higher is better).",
    skill_moves_total_rating:
      "Total skill move rating points (higher is better).",
    skill_moves_consistency_range:
      "How spread out your skill move ratings were (smaller means more consistent).",

    figure8_loops_both:
      "Figure 8 loops using both sides/feet (higher is better).",
    figure8_loops_strong:
      "Figure 8 loops using strong side/foot (higher is better).",
    figure8_loops_weak:
      "Figure 8 loops using weak side/foot (higher is better).",
    figure8_asymmetry_pct:
      "Difference % between weak and strong Figure 8 (closer to 0% is more balanced).",
    figure8_both_to_strong_ratio:
      "Both vs strong Figure 8 ratio (closer to 1 is more balanced).",
    figure8_weak_to_strong_ratio:
      "Weak vs strong Figure 8 ratio (closer to 1 is more balanced).",

    passing_gates_total_hits: "Total passing gates hits (higher is better).",
    passing_gates_strong_hits:
      "Passing gates hits with your strong foot (higher is better).",
    passing_gates_weak_hits:
      "Passing gates hits with your weak foot (higher is better).",
    passing_gates_asymmetry_pct:
      "Difference % between weak and strong passing (closer to 0% is more balanced).",
    passing_gates_weak_to_strong_ratio:
      "Weak vs strong passing ratio (closer to 1 is more balanced).",
    passing_gates_weak_share_pct:
      "What % of your passing hits came from your weak foot.",

    reaction_5m_reaction_time_avg:
      "Average reaction time in seconds (lower is better).",
    reaction_5m_reaction_time_best:
      "Fastest reaction time in seconds (lower is better).",
    reaction_5m_reaction_time_worst:
      "Slowest reaction time in seconds (lower is better).",
    reaction_5m_total_time_avg:
      "Average total time in seconds (reaction + sprint) (lower is better).",
    reaction_5m_total_time_best:
      "Fastest total time in seconds (reaction + sprint) (lower is better).",
    reaction_5m_total_time_worst:
      "Slowest total time in seconds (reaction + sprint) (lower is better).",
    reaction_5m_reaction_consistency_range:
      "How spread out your reaction times were (smaller means more consistent).",
    reaction_5m_total_consistency_range:
      "How spread out your total times were (smaller means more consistent).",

    shot_power_strong_avg:
      "Average shot power with your strong foot (higher is better).",
    shot_power_strong_max:
      "Top shot power with your strong foot (higher is better).",
    shot_power_weak_avg:
      "Average shot power with your weak foot (higher is better).",
    shot_power_weak_max:
      "Top shot power with your weak foot (higher is better).",
    shot_power_asymmetry_pct:
      "Difference % between weak and strong shot power (closer to 0% is more balanced).",
    shot_power_asymmetry_pct_max:
      "Difference % using your top shots (closer to 0% is more balanced).",
    shot_power_weak_to_strong_ratio:
      "Weak vs strong shot power ratio (closer to 1 is more balanced).",
    shot_power_weak_to_strong_ratio_max:
      "Weak vs strong ratio using your top shots (closer to 1 is more balanced).",

    serve_distance_strong_avg:
      "Average serve distance with your strong foot (higher is better).",
    serve_distance_strong_max:
      "Top serve distance with your strong foot (higher is better).",
    serve_distance_weak_avg:
      "Average serve distance with your weak foot (higher is better).",
    serve_distance_weak_max:
      "Top serve distance with your weak foot (higher is better).",
    serve_distance_asymmetry_pct:
      "Difference % between weak and strong serve distance (closer to 0% is more balanced).",
    serve_distance_asymmetry_pct_max:
      "Difference % using your top serves (closer to 0% is more balanced).",
    serve_distance_weak_to_strong_ratio:
      "Weak vs strong serve distance ratio (closer to 1 is more balanced).",
    serve_distance_weak_to_strong_ratio_max:
      "Weak vs strong ratio using your top serves (closer to 1 is more balanced).",
  };

  return HELP[key] || "A stat from this check-in.";
}

function MetricLabel({ k }: { k: string }) {
  const label = titleCaseFromKey(k);
  const help = helpTextForKey(k);
  return (
    <span className="inline-flex items-center gap-1">
      <span>{label}</span>
      <Tooltip text={help}>
        <Info className="w-3.5 h-3.5 text-white/40" />
      </Tooltip>
    </span>
  );
}

function KvGrid({ data, keys }: { data: Scores | null; keys: string[] }) {
  if (!data) return <div className="text-sm text-white/50">No data yet.</div>;
  const rows = keys
    .filter((k) => isFiniteNumber(data[k]))
    .map((k) => ({ k, v: data[k] }));
  if (!rows.length)
    return <div className="text-sm text-white/50">No data yet.</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
      {rows.map(({ k, v }) => (
        <div
          key={k}
          className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2"
        >
          <div className="text-sm text-white/70">
            <MetricLabel k={k} />
          </div>
          <div className="text-sm font-semibold text-white">
            {formatNumberMax3(v)}
          </div>
        </div>
      ))}
    </div>
  );
}

function flattenNumeric(value: unknown, prefix = ""): Record<string, number> {
  const out: Record<string, number> = {};

  const visit = (v: unknown, p: string) => {
    if (typeof v === "number" && Number.isFinite(v)) {
      out[p || "value"] = v;
      return;
    }
    if (!v || typeof v !== "object") return;

    if (Array.isArray(v)) {
      // Ignore arrays for now (too noisy / unclear semantics for diffs).
      return;
    }

    for (const [k, child] of Object.entries(v as Record<string, unknown>)) {
      const next = p ? `${p}.${k}` : k;
      visit(child, next);
    }
  };

  visit(value, prefix);
  return out;
}

function computeNumericDiff(
  older: unknown,
  newer: unknown
): Array<{ key: string; oldVal: number; newVal: number; delta: number }> {
  const a = flattenNumeric(older);
  const b = flattenNumeric(newer);
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);

  const diffs: Array<{
    key: string;
    oldVal: number;
    newVal: number;
    delta: number;
  }> = [];

  for (const key of keys) {
    const oldVal = a[key];
    const newVal = b[key];
    if (typeof oldVal !== "number" || typeof newVal !== "number") continue;
    const delta = newVal - oldVal;
    if (!Number.isFinite(delta)) continue;
    diffs.push({ key, oldVal, newVal, delta });
  }

  diffs.sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));
  return diffs;
}

export function AiStatsPlayerParentView() {
  const [role, setRole] = useState<Role | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Player/parent flows
  const [players, setPlayers] = useState<PlayerOption[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>("");
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");

  const [loadingEvals, setLoadingEvals] = useState(false);
  const [evalMetas, setEvalMetas] = useState<PlayerEvaluationMeta[]>([]);
  const [totalEvalCount, setTotalEvalCount] = useState(0);
  const [evalDetails, setEvalDetails] = useState<PlayerEvaluationDetails[]>([]);
  const [activeEvaluationId, setActiveEvaluationId] = useState<string>("");
  const [openTries, setOpenTries] = useState<Record<string, boolean>>({});
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiReport, setAiReport] = useState<AiPlayerReport | null>(null);
  const [aiRetryNonce, setAiRetryNonce] = useState(0);
  const [aiAttempted, setAiAttempted] = useState(false);
  const [aiCacheInfo, setAiCacheInfo] = useState<{
    cached: boolean;
    createdAt?: string | null;
  } | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatThreadId, setChatThreadId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<
    Array<{
      id: string;
      role: "user" | "assistant";
      text: string;
      createdAt?: string;
    }>
  >([]);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [chatHasMemory, setChatHasMemory] = useState(false);
  const lastAiKeyRef = useRef<string>("");
  const [error, setError] = useState<string | null>(null);

  // Clear stale AI errors immediately when switching players, so we don't flash
  // "couldn't generate" before the new request starts.
  useEffect(() => {
    setAiError(null);
    setAiReport(null);
    setAiAttempted(false);
    setAiCacheInfo(null);
    setAiLoading(!!selectedPlayerId);
    lastAiKeyRef.current = "";
    setChatOpen(false);
    setChatThreadId(null);
    setChatMessages([]);
    setChatInput("");
    setChatSending(false);
    setChatError(null);
  }, [selectedPlayerId, selectedTeamId]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const res = await fetch("/api/user/profile");
        if (!res.ok) return;
        const data = await res.json();
        if (mounted) setRole((data?.user?.role as Role) ?? null);
      } finally {
        if (mounted) setLoadingProfile(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  // Load players for player/parent (and also for dev convenience if other roles want to use it later)
  useEffect(() => {
    let mounted = true;
    async function loadPlayers() {
      if (!role) return;
      setError(null);
      setLoadingPlayers(true);
      try {
        const res = await fetch("/api/players");
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(data?.error || "Failed to load players");
        }

        const raw = (data?.players ?? []) as any[];
        const next: PlayerOption[] = raw
          .filter((p) => p?.id && p?.teamId)
          .map((p) => ({
            id: String(p.id),
            teamId: String(p.teamId),
            firstName: String(p.firstName ?? ""),
            lastName: String(p.lastName ?? ""),
            fullName: p.fullName ? String(p.fullName) : undefined,
            teamName: p.teamName ? String(p.teamName) : undefined,
          }));

        if (!mounted) return;
        setPlayers(next);

        // If only one player, auto-select + skip picker
        if (next.length === 1) {
          setSelectedPlayerId(next[0].id);
          setSelectedTeamId(next[0].teamId);
        } else {
          // Reset selection if current selection no longer valid
          if (
            selectedPlayerId &&
            !next.some((p) => p.id === selectedPlayerId)
          ) {
            setSelectedPlayerId("");
            setSelectedTeamId("");
          }
        }
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || "Failed to load players");
        setPlayers([]);
      } finally {
        if (mounted) setLoadingPlayers(false);
      }
    }

    loadPlayers();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  // When selected player changes, derive teamId
  useEffect(() => {
    if (!selectedPlayerId) return;
    const p = players.find((x) => x.id === selectedPlayerId);
    if (p) setSelectedTeamId(p.teamId);
  }, [selectedPlayerId, players]);

  // Load evaluations for selected player (meta list + detail blobs)
  useEffect(() => {
    let mounted = true;
    async function loadEvaluations() {
      setError(null);
      setEvalMetas([]);
      setTotalEvalCount(0);
      setEvalDetails([]);
      setActiveEvaluationId("");

      if (!role) return;
      if (role !== "parent" && role !== "player") return;
      if (!selectedPlayerId || !selectedTeamId) return;

      setLoadingEvals(true);
      try {
        const metaRes = await fetch(
          `/api/teams/${encodeURIComponent(
            selectedTeamId
          )}/players/${encodeURIComponent(selectedPlayerId)}/evaluations`
        );
        const metaData = await metaRes.json().catch(() => null);
        if (!metaRes.ok) {
          throw new Error(metaData?.error || "Failed to load evaluations");
        }

        const allMetas = (metaData?.evaluations ??
          []) as PlayerEvaluationMeta[];
        const aiMetas = allMetas.slice(0, MAX_AI_EVALUATIONS);
        if (!mounted) return;
        setTotalEvalCount(allMetas.length);
        setEvalMetas(allMetas);

        // Only fetch details for the most recent evaluations (AI inputs).
        // Other evaluations are fetched on-demand when clicked.
        const metasToFetch = aiMetas;
        const detailResults = await Promise.all(
          metasToFetch.map(async (m) => {
            const res = await fetch(
              `/api/teams/${encodeURIComponent(
                selectedTeamId
              )}/players/${encodeURIComponent(
                selectedPlayerId
              )}/evaluations/${encodeURIComponent(m.id)}`
            );
            const data = await res.json().catch(() => null);
            if (!res.ok) {
              throw new Error(
                data?.error || "Failed to load evaluation details"
              );
            }
            return data as PlayerEvaluationDetails;
          })
        );

        if (!mounted) return;
        setEvalDetails(detailResults);

        // Default active evaluation: newest (first in meta list)
        const newest = allMetas[0]?.id || "";
        setActiveEvaluationId((prev) => prev || newest);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || "Failed to load evaluations");
      } finally {
        if (mounted) setLoadingEvals(false);
      }
    }

    loadEvaluations();
    return () => {
      mounted = false;
    };
  }, [role, selectedPlayerId, selectedTeamId]);

  const selectedPlayer = players.find((p) => p.id === selectedPlayerId) ?? null;

  // Build chronological diffs (older -> newer)
  const chronological = [...evalDetails].sort((a, b) => {
    const ad = a?.playerEvaluation?.createdAt
      ? new Date(a.playerEvaluation.createdAt).getTime()
      : 0;
    const bd = b?.playerEvaluation?.createdAt
      ? new Date(b.playerEvaluation.createdAt).getTime()
      : 0;
    return ad - bd;
  });

  const baseline = chronological[0] ?? null;

  const activeMeta = evalMetas.find((m) => m.id === activeEvaluationId) ?? null;
  const activeDetail =
    evalDetails.find((d) => d.playerEvaluation?.id === activeEvaluationId) ??
    null;

  // If user clicks an evaluation we haven't loaded details for yet, fetch it on-demand.
  useEffect(() => {
    let mounted = true;
    async function ensureActiveLoaded() {
      if (!role) return;
      if (role !== "parent" && role !== "player") return;
      if (!selectedTeamId || !selectedPlayerId) return;
      if (!activeEvaluationId) return;

      const already = evalDetails.some(
        (d) => d.playerEvaluation?.id === activeEvaluationId
      );
      if (already) return;

      try {
        setLoadingEvals(true);
        const res = await fetch(
          `/api/teams/${encodeURIComponent(
            selectedTeamId
          )}/players/${encodeURIComponent(
            selectedPlayerId
          )}/evaluations/${encodeURIComponent(activeEvaluationId)}`
        );
        const data = await res.json().catch(() => null);
        if (!res.ok)
          throw new Error(data?.error || "Failed to load evaluation");
        if (!mounted) return;
        setEvalDetails((prev) => [...prev, data as PlayerEvaluationDetails]);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || "Failed to load evaluation");
      } finally {
        if (mounted) setLoadingEvals(false);
      }
    }
    ensureActiveLoaded();
    return () => {
      mounted = false;
    };
  }, [activeEvaluationId, evalDetails, role, selectedPlayerId, selectedTeamId]);

  const clusterBars: Array<[string, number]> = (() => {
    const c = (activeDetail?.playerCluster ?? null) as PlayerCluster | null;
    if (!c) return [];

    const normalize = (v: unknown) => {
      if (!isFiniteNumber(v)) return null;
      // If already 0–1, keep. If 0–100, convert.
      if (v > 1) return clamp01(v / 100);
      return clamp01(v);
    };

    const out: Array<[string, number]> = [];
    const ps = normalize(c.ps);
    const tc = normalize(c.tc);
    const ms = normalize(c.ms);
    const dc = normalize(c.dc);
    if (ps !== null) out.push(["Power / Strength", ps]);
    if (tc !== null) out.push(["Technique / Control", tc]);
    if (ms !== null) out.push(["Mobility / Stability", ms]);
    if (dc !== null) out.push(["Decision / Cognition", dc]);
    return out;
  })();

  const activeOverall = (activeDetail?.overallScores ?? null) as Scores | null;
  const activeTests = (activeDetail?.testScores ?? null) as Scores | null;

  // Find previous evaluation (chronological, immediately older than active)
  const prevDetail = (() => {
    if (!activeDetail) return null;
    const idx = chronological.findIndex(
      (d) => d.playerEvaluation.id === activeDetail.playerEvaluation.id
    );
    if (idx <= 0) return null;
    return chronological[idx - 1];
  })();

  function splitTopChanges(
    older: unknown,
    newer: unknown,
    take = 5
  ): {
    up: ReturnType<typeof computeNumericDiff>;
    down: ReturnType<typeof computeNumericDiff>;
  } {
    const diffs = computeNumericDiff(older, newer);
    const up = diffs.filter((d) => d.delta > 0).slice(0, take);
    const down = diffs
      .filter((d) => d.delta < 0)
      .slice(0, take)
      .sort((a, b) => a.delta - b.delta);
    return { up, down };
  }

  const changesVsPrev =
    activeDetail && prevDetail
      ? splitTopChanges(prevDetail.overallScores, activeDetail.overallScores, 6)
      : null;
  const changesVsBase =
    activeDetail && baseline
      ? splitTopChanges(baseline.overallScores, activeDetail.overallScores, 6)
      : null;

  const dnaInsights = (() => {
    const dna = (activeDetail?.playerDna ?? null) as Record<
      string,
      unknown
    > | null;
    if (!dna) return null;
    const entries = Object.entries(dna)
      .filter(([, v]) => isFiniteNumber(v))
      .map(([k, v]) => ({ k, v: v as number }))
      .sort((a, b) => b.v - a.v);
    if (!entries.length) return null;
    return {
      top: entries.slice(0, 6),
      bottom: entries.slice(-6).reverse(),
    };
  })();

  function buildAiPayload() {
    if (!selectedPlayer) return null;
    const aiMetas = evalMetas.slice(0, MAX_AI_EVALUATIONS);
    if (!aiMetas.length) return null;

    // Require that we have details loaded for each AI meta (we fetch them on load).
    const aiDetails = aiMetas
      .map(
        (m) => evalDetails.find((d) => d.playerEvaluation?.id === m.id) ?? null
      )
      .filter(Boolean) as PlayerEvaluationDetails[];

    if (aiDetails.length !== aiMetas.length) return null;

    const currentAiMeta = aiMetas[0];
    const currentAiDetail = aiDetails[0];
    const prevAiDetail = aiDetails[1] ?? null;
    const baseAiDetail = aiDetails[aiDetails.length - 1] ?? null;

    const playerName =
      selectedPlayer.fullName ||
      `${selectedPlayer.firstName} ${selectedPlayer.lastName}`;

    const normScores = (x: any): Scores | null => {
      if (!x || typeof x !== "object" || Array.isArray(x)) return null;
      return x as Scores;
    };

    const normalizeEval = (d: PlayerEvaluationDetails | null) => {
      if (!d?.playerEvaluation) return null;
      const allOverall = normScores(d.overallScores);
      const allTests = normScores(d.testScores);

      return {
        id: d.playerEvaluation.id,
        name: d.playerEvaluation.name ?? "Check-in",
        createdAt: d.playerEvaluation.createdAt,
        categories: CATEGORIES.map((cat) => ({
          id: cat.id,
          name: cat.name,
          higherIsBetter: cat.testHigherIsBetter ?? true,
          summary: cat.overallKeys
            .filter((k) => isFiniteNumber(allOverall?.[k]))
            .map((k) => ({
              key: k,
              label: titleCaseFromKey(k),
              help: helpTextForKey(k),
              value: allOverall?.[k] ?? null,
            })),
          attempts: cat.testKeys
            .filter((k) => isFiniteNumber(allTests?.[k]))
            .map((k) => ({
              key: k,
              label: titleCaseFromKey(k),
              help: helpTextForKey(k),
              value: allTests?.[k] ?? null,
            })),
        })),
        cluster: (d.playerCluster ?? null) as any,
        dna: d.playerDna ?? null,
      };
    };

    const currentClean = normalizeEval(currentAiDetail);
    const prevClean = normalizeEval(prevAiDetail);
    const baseClean = normalizeEval(baseAiDetail);

    const toProgressItems = (older: unknown, newer: unknown, limit = 12) =>
      computeNumericDiff(older, newer)
        .slice(0, limit)
        .map((d) => ({
          key: d.key,
          label: titleCaseFromKey(d.key),
          help: helpTextForKey(d.key),
          old: d.oldVal,
          new: d.newVal,
          delta: d.delta,
        }));

    const progress = {
      vsPrevious:
        currentAiDetail && prevAiDetail
          ? toProgressItems(
              prevAiDetail.overallScores,
              currentAiDetail.overallScores
            )
          : [],
      vsBaseline:
        currentAiDetail && baseAiDetail
          ? toProgressItems(
              baseAiDetail.overallScores,
              currentAiDetail.overallScores
            )
          : [],
    };

    return {
      audience: "player_parent",
      player: {
        id: selectedPlayer.id,
        name: playerName,
        teamName: selectedPlayer.teamName ?? null,
      },
      selectedCheckIn: {
        id: currentAiMeta.id,
        name: currentAiMeta.name ?? "Check-in",
        createdAt: currentAiMeta.createdAt,
      },
      evaluationHistory: aiMetas.map((m) => ({
        id: m.id,
        name: m.name ?? "Check-in",
        createdAt: m.createdAt,
      })),
      current: currentClean,
      previous: prevClean,
      baseline: baseClean,
      progress,
      interpretationNotes: [
        "Some metrics are times (lower is better), e.g. agility and reaction sprint times.",
        "Asymmetry % and spreads are usually better when smaller (closer to 0 / tighter).",
      ],
    };
  }

  useEffect(() => {
    let mounted = true;
    async function run() {
      if (!role) return;
      if (role !== "parent" && role !== "player") return;
      if (!selectedPlayerId || !selectedTeamId) return;

      // Keep UI in loading until we either have a report or a real AI request fails.
      setAiLoading(true);

      const aiMetas = evalMetas.slice(0, MAX_AI_EVALUATIONS);
      if (!aiMetas.length) {
        setAiError("No check-ins found yet for this player.");
        setAiReport(null);
        setAiAttempted(false);
        setAiLoading(false);
        return;
      }

      // Wait until we have details for the AI metas (we prefetch these on load).
      const aiReady = aiMetas.every((m) =>
        evalDetails.some((d) => d.playerEvaluation?.id === m.id)
      );
      if (!aiReady) {
        // If we never reach ready due to a data mismatch, surface an error after a short delay.
        // (Prevents sitting on “Generating…” forever.)
        console.log("AI waiting for evaluation details...", {
          aiMetas: aiMetas.map((m) => m.id),
          evalDetailsLoaded: evalDetails.map((d) => d.playerEvaluation?.id),
        });
        return;
      }

      const payload = buildAiPayload();
      if (!payload) {
        // Not an AI failure; we're still waiting on inputs.
        setAiError(null);
        setAiReport(null);
        setAiAttempted(false);
        setAiLoading(true);
        return;
      }

      // Prevent duplicate calls for the same player + same AI inputs unless retry is clicked.
      const aiKey = `${selectedPlayerId}:${aiMetas
        .map((m) => m.id)
        .join(",")}:${aiRetryNonce}`;
      if (lastAiKeyRef.current === aiKey && (aiLoading || aiReport)) return;
      lastAiKeyRef.current = aiKey;

      setAiError(null);
      setAiReport(null);
      setAiCacheInfo(null);

      try {
        console.log("Starting AI report request...", { aiKey });
        setAiAttempted(true);
        setAiLoading(true);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 45000);
        const res = await fetch("/api/ai/player-analysis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        clearTimeout(timeout);
        const data = await res.json().catch(() => null);
        console.log("AI report API response:", data);
        if (!res.ok)
          throw new Error(data?.error || "Failed to generate report");
        if (!mounted) return;
        setAiCacheInfo({
          cached: !!data?.cached,
          createdAt:
            typeof data?.createdAt === "string" ? data.createdAt : null,
        });
        const raw: any = data?.report ?? null;
        const candidates: any[] = [raw];
        if (raw && typeof raw === "object" && "report" in raw) {
          candidates.push((raw as any).report);
        }

        const picked =
          candidates.find((c) => isAiReportV1(c)) ??
          candidates.find((c) => isAiReportV2(c)) ??
          candidates.find((c) => isAiReportV3(c)) ??
          candidates.find((c) => isAiReportV4(c)) ??
          null;

        if (!picked) {
          throw new Error("AI returned an empty report");
        }
        setAiReport(picked as AiPlayerReport);
      } catch (e: any) {
        if (!mounted) return;
        setAiError("Something went wrong. Please try again.");
      } finally {
        if (mounted) setAiLoading(false);
      }
    }

    run();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    role,
    selectedPlayerId,
    selectedTeamId,
    evalMetas,
    evalDetails,
    aiRetryNonce,
  ]);

  return (
    <div className="max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold text-white">
        {loadingProfile ? "AI Analysis" : aiLabelForRole(role)}
      </h1>

      {(role === "parent" || role === "player") && (
        <div className="mt-6 space-y-6">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="text-lg font-semibold text-white">
              Choose a player to analyze
            </h2>
            <p className="text-sm text-white/60 mt-1">
              We’ll use their evaluation history to show progress between
              evaluations.
            </p>

            {error && (
              <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
                {error}
              </div>
            )}

            <div className="mt-4">
              {loadingPlayers ? (
                <div className="text-white/70 text-sm">Loading players…</div>
              ) : players.length === 0 ? (
                <div className="text-white/70 text-sm">
                  No players found for your account yet.
                </div>
              ) : players.length === 1 ? (
                <div className="text-white/80 text-sm">
                  Selected:{" "}
                  <span className="text-white font-medium">
                    {players[0].fullName ||
                      `${players[0].firstName} ${players[0].lastName}`}
                  </span>
                  {players[0].teamName ? (
                    <span className="text-white/50">
                      {" "}
                      • {players[0].teamName}
                    </span>
                  ) : null}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <label className="text-xs text-white/60">Player</label>
                  <select
                    value={selectedPlayerId}
                    onChange={(e) => setSelectedPlayerId(e.target.value)}
                    className="w-full max-w-md rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-white outline-none focus:border-[#e3ca76]/50"
                  >
                    <option value="" className="bg-black">
                      Select a player…
                    </option>
                    {players.map((p) => (
                      <option key={p.id} value={p.id} className="bg-black">
                        {(p.fullName || `${p.firstName} ${p.lastName}`) +
                          (p.teamName ? ` — ${p.teamName}` : "")}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* AI report should be directly under the player picker */}
          {selectedPlayer ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="text-white font-bold text-lg">
                    Overall player evaluation
                  </div>
                  <div className="text-white/60 text-sm mt-1">
                    Generated from the most recent{" "}
                    {Math.min(
                      MAX_AI_EVALUATIONS,
                      totalEvalCount || MAX_AI_EVALUATIONS
                    )}{" "}
                    check-ins.
                  </div>
                </div>
                <div className="text-xs text-white/50">
                  We’ll show the rest once this finishes.
                </div>
              </div>

              {aiLoading || (!aiReport && !aiAttempted) ? (
                <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-5">
                  <div className="text-white font-semibold text-lg">
                    Generating overall player evaluation — this can take a
                    couple minutes…
                  </div>
                  <div className="text-white/60 text-sm mt-2">
                    Please keep this tab open while we compile everything.
                  </div>
                </div>
              ) : aiError ? (
                <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-5">
                  <div className="text-red-200 font-semibold">
                    Couldn’t generate the overall player evaluation
                  </div>
                  <div className="text-red-200/80 text-sm mt-2">
                    Something went wrong. Please try again.
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setAiError(null);
                      setAiReport(null);
                      setAiAttempted(false);
                      setAiLoading(true);
                      setAiRetryNonce((n) => n + 1);
                    }}
                    className="mt-4 text-sm font-semibold px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 border border-white/10 text-white"
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-white/10 bg-gradient-to-br from-[#e3ca76]/10 via-white/5 to-white/5 p-5">
                  <div className="text-xs text-white/60">
                    {aiCacheInfo?.cached ? (
                      <span>
                        Showing your saved report
                        {aiCacheInfo?.createdAt ? (
                          <>
                            {" "}
                            (generated{" "}
                            {new Date(aiCacheInfo.createdAt).toLocaleString()})
                          </>
                        ) : null}
                        . It will re-evaluate after the next check-in.
                      </span>
                    ) : (
                      <span>It will re-evaluate after the next check-in.</span>
                    )}
                  </div>

                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setChatError(null);
                        setChatOpen(true);
                      }}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#e3ca76] text-black font-semibold px-5 py-3 hover:brightness-95"
                    >
                      Chat with your stats
                    </button>
                    <div className="text-xs text-white/50 mt-2">
                      Ask questions about what your numbers mean and what to
                      focus on next.
                    </div>
                  </div>

                  {isAiReportV1(aiReport) ? (
                    <>
                      <div className="text-white font-bold text-xl">
                        {aiReport.headline}
                      </div>
                      <div className="text-white/70 text-sm mt-2">
                        {aiReport.summary}
                      </div>
                      <div className="mt-3 text-xs text-white/50">
                        Confidence:{" "}
                        <span className="text-white/70 font-semibold">
                          {aiReport.confidence.level}
                        </span>{" "}
                        — {aiReport.confidence.reason}
                      </div>

                      {aiReport.strengths?.length ? (
                        <div className="mt-5">
                          <div className="text-white font-semibold">
                            What they’re doing well
                          </div>
                          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                            {aiReport.strengths.map((s, idx) => (
                              <div
                                key={`${s.title}-${idx}`}
                                className="rounded-lg border border-white/10 bg-white/5 p-3"
                              >
                                <div className="text-white font-semibold">
                                  {s.title}
                                </div>
                                <div className="text-white/70 text-sm mt-1">
                                  {s.whatItMeans}
                                </div>
                                {s.evidence?.length ? (
                                  <ul className="mt-2 text-sm text-white/70 list-disc pl-5 space-y-1">
                                    {s.evidence.slice(0, 4).map((e, i) => (
                                      <li key={`${idx}-e-${i}`}>{e}</li>
                                    ))}
                                  </ul>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {aiReport.focusAreas?.length ? (
                        <div className="mt-5">
                          <div className="text-white font-semibold">
                            What to work on next
                          </div>
                          <div className="mt-3 space-y-3">
                            {aiReport.focusAreas.map((f, idx) => (
                              <div
                                key={`${f.title}-${idx}`}
                                className="rounded-lg border border-white/10 bg-white/5 p-4"
                              >
                                <div className="text-white font-semibold text-base">
                                  {idx + 1}. {f.title}
                                </div>
                                <div className="text-white/70 text-sm mt-2">
                                  {f.whyThisMatters}
                                </div>
                                {f.howToImprove?.length ? (
                                  <>
                                    <div className="text-white/80 text-sm font-semibold mt-3">
                                      How to improve
                                    </div>
                                    <ul className="mt-1 text-sm text-white/70 list-disc pl-5 space-y-1">
                                      {f.howToImprove
                                        .slice(0, 6)
                                        .map((t, i) => (
                                          <li key={`${idx}-hti-${i}`}>{t}</li>
                                        ))}
                                    </ul>
                                  </>
                                ) : null}
                                {f.drills?.length ? (
                                  <>
                                    <div className="text-white/80 text-sm font-semibold mt-3">
                                      Drills
                                    </div>
                                    <div className="mt-2 grid grid-cols-1 lg:grid-cols-2 gap-3">
                                      {f.drills.map((d, di) => (
                                        <div
                                          key={`${idx}-dr-${di}`}
                                          className="rounded-lg border border-white/10 bg-black/20 p-3"
                                        >
                                          <div className="text-white font-semibold">
                                            {d.name}
                                          </div>
                                          <div className="text-white/70 text-sm mt-1">
                                            {d.goal}
                                          </div>
                                          <div className="mt-2 text-sm text-white/80">
                                            <span className="text-white/60">
                                              Dosage:
                                            </span>{" "}
                                            <span className="font-semibold text-white">
                                              {d.dosage}
                                            </span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </>
                  ) : isAiReportV2(aiReport) ? (
                    <>
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                          <div className="text-white font-bold text-xl">
                            {aiReport.player.name}
                          </div>
                          <div className="text-white/70 text-sm mt-1">
                            {aiReport.checkIn.name} •{" "}
                            {aiReport.checkIn.createdAt
                              ? new Date(
                                  aiReport.checkIn.createdAt
                                ).toLocaleDateString("en-US", {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                })
                              : aiReport.checkIn.date || "—"}
                            {aiReport.player.teamName
                              ? ` • ${aiReport.player.teamName}`
                              : ""}
                          </div>
                        </div>
                        <div className="text-xs text-white/50">
                          Confidence:{" "}
                          <span className="text-white/70 font-semibold">
                            {Math.round(aiReport.confidence * 100)}%
                          </span>
                        </div>
                      </div>

                      <div className="text-white/70 text-sm mt-3">
                        {aiReport.summary}
                      </div>

                      <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
                        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                          <div className="text-white font-semibold">
                            Highlights
                          </div>
                          <ul className="mt-2 text-sm text-white/70 list-disc pl-5 space-y-1">
                            {aiReport.highlights.slice(0, 8).map((h, i) => (
                              <li key={`hi-${i}`}>{h.bullet}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                          <div className="text-white font-semibold">
                            What to do next
                          </div>
                          <ul className="mt-2 text-sm text-white/70 list-disc pl-5 space-y-1">
                            {aiReport.whatToDoNext.slice(0, 10).map((w, i) => (
                              <li key={`nx-${i}`}>{w.bullet}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </>
                  ) : isAiReportV3(aiReport) ? (
                    <>
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                          <div className="text-white font-bold text-xl">
                            {aiReport.player.name}
                          </div>
                          <div className="text-white/70 text-sm mt-1">
                            {aiReport.checkIn.name} •{" "}
                            {aiReport.checkIn.createdAt
                              ? new Date(
                                  aiReport.checkIn.createdAt
                                ).toLocaleDateString("en-US", {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                })
                              : aiReport.checkIn.date || "—"}
                            {aiReport.player.teamName
                              ? ` • ${aiReport.player.teamName}`
                              : ""}
                          </div>
                        </div>
                        <div className="text-xs text-white/50">
                          Confidence:{" "}
                          <span className="text-white/70 font-semibold">
                            {Math.round(aiReport.confidence * 100)}%
                          </span>
                        </div>
                      </div>

                      <div className="text-white/70 text-sm mt-3">
                        {aiReport.report.summary}
                      </div>

                      <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
                        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                          <div className="text-white font-semibold">
                            Strengths
                          </div>
                          <ul className="mt-2 text-sm text-white/70 list-disc pl-5 space-y-1">
                            {aiReport.report.strengths
                              .slice(0, 6)
                              .map((s, i) => (
                                <li key={`s-${i}`}>
                                  <span className="text-white/80 font-semibold">
                                    {s.area}:
                                  </span>{" "}
                                  {s.detail}
                                </li>
                              ))}
                          </ul>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                          <div className="text-white font-semibold">
                            Improvements
                          </div>
                          <ul className="mt-2 text-sm text-white/70 list-disc pl-5 space-y-1">
                            {aiReport.report.improvements
                              .slice(0, 6)
                              .map((s, i) => (
                                <li key={`i-${i}`}>
                                  <span className="text-white/80 font-semibold">
                                    {s.area}:
                                  </span>{" "}
                                  {s.detail}
                                </li>
                              ))}
                          </ul>
                        </div>
                      </div>

                      <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-4">
                        <div className="text-white font-semibold">
                          Next steps
                        </div>
                        <ul className="mt-2 text-sm text-white/70 list-disc pl-5 space-y-1">
                          {aiReport.report.nextSteps.slice(0, 8).map((n, i) => (
                            <li key={`n-${i}`}>
                              <span className="text-white/80 font-semibold">
                                {n.action}:
                              </span>{" "}
                              {n.detail}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </>
                  ) : isAiReportV4(aiReport) ? (
                    <>
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                          <div className="text-white font-bold text-xl">
                            {aiReport.playerName}
                          </div>
                          <div className="text-white/70 text-sm mt-1">
                            {(aiReport.checkInName || "Check-in") + " • "}
                            {aiReport.createdAt
                              ? new Date(aiReport.createdAt).toLocaleDateString(
                                  "en-US",
                                  {
                                    year: "numeric",
                                    month: "short",
                                    day: "numeric",
                                  }
                                )
                              : aiReport.date || "—"}
                            {aiReport.teamName ? ` • ${aiReport.teamName}` : ""}
                          </div>
                        </div>
                        {typeof aiReport.confidence === "number" ? (
                          <div className="text-xs text-white/50">
                            Confidence:{" "}
                            <span className="text-white/70 font-semibold">
                              {Math.round(aiReport.confidence * 100)}%
                            </span>
                          </div>
                        ) : null}
                      </div>

                      <div className="text-white/70 text-sm mt-3">
                        {aiReport.quickSummary || aiReport.summary}
                      </div>

                      {Array.isArray(aiReport.top3Actions) &&
                      aiReport.top3Actions.length ? (
                        <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
                          <div className="text-white font-semibold">
                            Top 3 actions
                          </div>
                          <ul className="mt-2 text-sm text-white/70 list-disc pl-5 space-y-1">
                            {aiReport.top3Actions.slice(0, 3).map((x, i) => (
                              <li key={`t3-${i}`}>{x}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
                        {Array.isArray(aiReport.strengths) &&
                        aiReport.strengths.length ? (
                          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                            <div className="text-white font-semibold">
                              Strengths
                            </div>
                            <ul className="mt-2 text-sm text-white/70 list-disc pl-5 space-y-1">
                              {aiReport.strengths.slice(0, 10).map((x, i) => (
                                <li key={`st-${i}`}>{x}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}

                        {Array.isArray(aiReport.areasToImprove) &&
                        aiReport.areasToImprove.length ? (
                          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                            <div className="text-white font-semibold">
                              Areas to improve
                            </div>
                            <ul className="mt-2 text-sm text-white/70 list-disc pl-5 space-y-1">
                              {aiReport.areasToImprove
                                .slice(0, 10)
                                .map((x, i) => (
                                  <li key={`ati-${i}`}>{x}</li>
                                ))}
                            </ul>
                          </div>
                        ) : null}
                      </div>

                      {/* Training plans / activities intentionally hidden */}

                      {Array.isArray(aiReport.coachingTips) &&
                      aiReport.coachingTips.length ? (
                        <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-4">
                          <div className="text-white font-semibold">
                            Coaching tips
                          </div>
                          <ul className="mt-2 text-sm text-white/70 list-disc pl-5 space-y-1">
                            {aiReport.coachingTips.slice(0, 8).map((x, i) => (
                              <li key={`ct-${i}`}>{x}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      {Array.isArray(aiReport.whatToDoNext) &&
                      aiReport.whatToDoNext.length ? (
                        <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-4">
                          <div className="text-white font-semibold">
                            What to do next
                          </div>
                          <ul className="mt-2 text-sm text-white/70 list-disc pl-5 space-y-1">
                            {aiReport.whatToDoNext.slice(0, 8).map((x, i) => (
                              <li key={`w2-${i}`}>{x}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      {aiReport.safetyNotes ? (
                        <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-4">
                          <div className="text-white font-semibold">
                            Safety notes
                          </div>
                          {Array.isArray(aiReport.safetyNotes) ? (
                            <ul className="mt-2 text-sm text-white/70 list-disc pl-5 space-y-1">
                              {aiReport.safetyNotes.slice(0, 8).map((x, i) => (
                                <li key={`sn-${i}`}>{x}</li>
                              ))}
                            </ul>
                          ) : (
                            <div className="mt-2 text-sm text-white/70">
                              {aiReport.safetyNotes}
                            </div>
                          )}
                        </div>
                      ) : null}
                    </>
                  ) : null}
                </div>
              )}
            </div>
          ) : null}

          {chatOpen && selectedPlayer ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
              <button
                type="button"
                aria-label="Close chat"
                onClick={() => setChatOpen(false)}
                className="absolute inset-0 bg-black/70"
              />
              <div className="relative w-full max-w-2xl rounded-2xl border border-white/10 bg-[#0b0f14] shadow-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                  <div>
                    <div className="text-white font-semibold">
                      Chat with your stats
                    </div>
                    <div className="text-xs text-white/50">
                      Coach chat about{" "}
                      {selectedPlayer.fullName ||
                        `${selectedPlayer.firstName} ${selectedPlayer.lastName}`}
                    </div>
                    <div className="text-[11px] text-white/50 mt-1">
                      Memory:{" "}
                      <span className="text-white/70 font-semibold">
                        {chatThreadId && chatHasMemory ? "On" : "Off"}
                      </span>{" "}
                      {chatThreadId
                        ? "— continuing this chat thread"
                        : "— new chat thread"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setChatThreadId(null);
                        setChatMessages([]);
                        setChatHasMemory(false);
                        setChatError(null);
                      }}
                      className="text-white/70 hover:text-white text-sm font-semibold px-3 py-2 rounded-lg bg-white/5 border border-white/10"
                    >
                      Reset
                    </button>
                    <button
                      type="button"
                      onClick={() => setChatOpen(false)}
                      className="text-white/70 hover:text-white text-sm font-semibold px-3 py-2 rounded-lg bg-white/5 border border-white/10"
                    >
                      Close
                    </button>
                  </div>
                </div>

                <div className="h-[60vh] overflow-y-auto px-4 py-4 space-y-3">
                  {chatMessages.length === 0 ? (
                    <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-white/70 text-sm">
                      Ask anything about your report—e.g. “What’s the biggest
                      thing holding me back?” or “How do I improve my weak
                      foot?”
                    </div>
                  ) : null}

                  {chatMessages.map((m) => (
                    <div
                      key={m.id}
                      className={
                        m.role === "user"
                          ? "flex justify-end"
                          : "flex justify-start"
                      }
                    >
                      <div
                        className={
                          m.role === "user"
                            ? "max-w-[85%] rounded-2xl rounded-br-md bg-[#e3ca76] text-black px-4 py-2 text-sm"
                            : "max-w-[85%] rounded-2xl rounded-bl-md bg-white/10 text-white px-4 py-2 text-sm"
                        }
                      >
                        <div className="whitespace-pre-wrap">{m.text}</div>
                        {m.createdAt ? (
                          <div className="mt-1 text-[10px] opacity-70">
                            {new Date(m.createdAt).toLocaleTimeString()}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}

                  {chatSending ? (
                    <div className="flex justify-start">
                      <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-white/10 text-white px-4 py-2 text-sm">
                        Typing…
                      </div>
                    </div>
                  ) : null}

                  {chatError ? (
                    <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
                      Something went wrong — please try again.
                    </div>
                  ) : null}
                </div>

                <form
                  className="border-t border-white/10 p-3 flex gap-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!selectedPlayerId) return;
                    const text = chatInput.trim();
                    if (!text || chatSending) return;

                    setChatError(null);
                    setChatInput("");
                    const nowIso = new Date().toISOString();
                    setChatMessages((prev) => [
                      ...prev,
                      {
                        id: `u-${nowIso}`,
                        role: "user",
                        text,
                        createdAt: nowIso,
                      },
                    ]);
                    setChatSending(true);

                    try {
                      // On open / first send, attempt to resume latest thread for this player+user
                      // so the user can verify memory persists.
                      if (!chatThreadId && chatMessages.length === 1) {
                        const resume = await fetch(
                          `/api/ai/player-chat?playerId=${encodeURIComponent(
                            selectedPlayerId
                          )}`
                        );
                        const resumeData = await resume
                          .json()
                          .catch(() => null);
                        if (
                          resume.ok &&
                          typeof resumeData?.threadId === "string" &&
                          Array.isArray(resumeData?.messages) &&
                          resumeData.messages.length
                        ) {
                          setChatThreadId(resumeData.threadId);
                          setChatHasMemory(!!resumeData?.hasMemory);
                          setChatMessages(
                            resumeData.messages.filter(
                              (m: any) =>
                                m &&
                                (m.role === "user" || m.role === "assistant") &&
                                typeof m.text === "string" &&
                                typeof m.id === "string"
                            )
                          );
                        }
                      }

                      const context =
                        !chatThreadId && aiReport
                          ? {
                              // Keep context SMALL so the chat stays fast + doesn't blow token limits.
                              // The full evaluation blobs are huge; the AI report already summarizes them.
                              aiReport,
                            }
                          : undefined;

                      const res = await fetch("/api/ai/player-chat", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          playerId: selectedPlayerId,
                          threadId: chatThreadId,
                          message: text,
                          context,
                        }),
                      });
                      const data = await res.json().catch(() => null);
                      if (!res.ok)
                        throw new Error(data?.error || "Failed to chat");

                      if (typeof data?.threadId === "string") {
                        setChatThreadId(data.threadId);
                      }
                      if (typeof data?.hasMemory === "boolean") {
                        setChatHasMemory(data.hasMemory);
                      } else if (typeof data?.threadId === "string") {
                        // Once we have a thread id, memory is effectively on for subsequent messages.
                        setChatHasMemory(true);
                      }

                      if (Array.isArray(data?.messages)) {
                        setChatMessages(
                          data.messages.filter(
                            (m: any) =>
                              m &&
                              (m.role === "user" || m.role === "assistant") &&
                              typeof m.text === "string" &&
                              typeof m.id === "string"
                          )
                        );
                      } else if (typeof data?.assistant === "string") {
                        const aIso = new Date().toISOString();
                        setChatMessages((prev) => [
                          ...prev,
                          {
                            id: `a-${aIso}`,
                            role: "assistant",
                            text: data.assistant,
                            createdAt: aIso,
                          },
                        ]);
                      } else {
                        throw new Error("Missing assistant response");
                      }
                    } catch {
                      setChatError("Something went wrong");
                    } finally {
                      setChatSending(false);
                    }
                  }}
                >
                  <input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Message your AI coach…"
                    className="flex-1 rounded-xl bg-black/40 border border-white/10 px-3 py-3 text-white outline-none focus:border-[#e3ca76]/50"
                  />
                  <button
                    type="submit"
                    disabled={chatSending || !chatInput.trim()}
                    className="rounded-xl bg-white/10 hover:bg-white/15 disabled:opacity-50 disabled:hover:bg-white/10 border border-white/10 text-white font-semibold px-4"
                  >
                    Send
                  </button>
                </form>
              </div>
            </div>
          ) : null}

          {/* Do not display any evaluation data until the AI report is ready */}
          {selectedPlayer && aiReport && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    {selectedPlayer.fullName ||
                      `${selectedPlayer.firstName} ${selectedPlayer.lastName}`}
                  </h2>
                  <p className="text-sm text-white/60 mt-1">
                    {selectedPlayer.teamName ? (
                      <span>{selectedPlayer.teamName}</span>
                    ) : (
                      <span>Team ID: {selectedTeamId}</span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="text-xs text-white/50">
                    Pick a check-in to see results and progress over time.
                  </div>
                  <div className="text-xs text-white/50">
                    Showing latest{" "}
                    {Math.min(
                      MAX_AI_EVALUATIONS,
                      totalEvalCount || MAX_AI_EVALUATIONS
                    )}{" "}
                    of {totalEvalCount || MAX_AI_EVALUATIONS}
                  </div>
                </div>
              </div>

              <div className="mt-4">
                {loadingEvals ? (
                  <div className="text-white/70 text-sm">
                    Loading evaluations…
                  </div>
                ) : chronological.length === 0 ? (
                  <div className="text-white/70 text-sm">
                    No evaluations found for this player yet.
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Evaluation timeline */}
                    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                      <h3 className="text-sm font-semibold text-white">
                        All check-ins ({totalEvalCount || evalMetas.length})
                      </h3>
                      <p className="text-xs text-white/50 mt-1">
                        Tap a check-in to view it.
                      </p>

                      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                        {evalMetas.map((m) => {
                          const active = m.id === activeEvaluationId;
                          return (
                            <button
                              type="button"
                              key={m.id}
                              onClick={() => setActiveEvaluationId(m.id)}
                              className={[
                                "text-left rounded-lg border px-3 py-2 transition-colors",
                                active
                                  ? "border-[#e3ca76]/40 bg-[#e3ca76]/10"
                                  : "border-white/10 bg-white/5 hover:bg-white/10",
                              ].join(" ")}
                            >
                              <div className="text-sm text-white font-semibold">
                                {m.name || "Check-in"}
                              </div>
                              <div className="text-xs text-white/60">
                                {safeDateLabel(m.createdAt)}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Selected check-in */}
                    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                      <h3 className="text-sm font-semibold text-white">
                        Selected check-in
                      </h3>
                      <p className="text-xs text-white/50 mt-1">
                        {activeMeta
                          ? `${activeMeta.name || "Check-in"} • ${safeDateLabel(
                              activeMeta.createdAt
                            )}`
                          : "Choose a check-in above."}
                      </p>

                      {!activeDetail ? (
                        <div className="mt-3 text-sm text-white/70">
                          Loading this check-in…
                        </div>
                      ) : (
                        <div className="mt-4 space-y-6">
                          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                            <div className="text-white font-semibold">
                              Player Style (vs teammates)
                            </div>
                            <div className="text-white/60 text-sm mt-1">
                              Higher % means this player is ahead of more
                              teammates in that area.
                            </div>
                            {clusterBars.length ? (
                              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                {clusterBars.map(([label, v]) => (
                                  <PercentBar
                                    key={label}
                                    label={label}
                                    value01={v}
                                  />
                                ))}
                              </div>
                            ) : (
                              <div className="mt-3 text-sm text-white/60">
                                No player style data yet.
                              </div>
                            )}
                          </div>

                          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                            <div className="text-white font-semibold">
                              Progress
                            </div>
                            <div className="text-white/60 text-sm mt-1">
                              Biggest changes are computed from your overall
                              summary stats.
                            </div>

                            <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                              <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                                <div className="text-sm font-semibold text-white">
                                  Since previous check-in
                                </div>
                                {!changesVsPrev ? (
                                  <div className="mt-2 text-sm text-white/60">
                                    No previous check-in to compare.
                                  </div>
                                ) : (
                                  <div className="mt-3 grid grid-cols-1 gap-3">
                                    <div>
                                      <div className="text-xs font-semibold text-emerald-300">
                                        Improved
                                      </div>
                                      <div className="mt-1 space-y-1">
                                        {changesVsPrev.up.length ? (
                                          changesVsPrev.up.map((d) => (
                                            <div
                                              key={`pup-${d.key}`}
                                              className="flex items-center justify-between text-sm text-white/80"
                                            >
                                              <span className="truncate mr-3">
                                                <MetricLabel k={d.key} />
                                              </span>
                                              <span className="text-emerald-300 font-semibold">
                                                +{formatNumberMax3(d.delta)}
                                              </span>
                                            </div>
                                          ))
                                        ) : (
                                          <div className="text-sm text-white/60">
                                            —
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-xs font-semibold text-red-300">
                                        Dropped
                                      </div>
                                      <div className="mt-1 space-y-1">
                                        {changesVsPrev.down.length ? (
                                          changesVsPrev.down.map((d) => (
                                            <div
                                              key={`pdown-${d.key}`}
                                              className="flex items-center justify-between text-sm text-white/80"
                                            >
                                              <span className="truncate mr-3">
                                                <MetricLabel k={d.key} />
                                              </span>
                                              <span className="text-red-300 font-semibold">
                                                {formatNumberMax3(d.delta)}
                                              </span>
                                            </div>
                                          ))
                                        ) : (
                                          <div className="text-sm text-white/60">
                                            —
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>

                              <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                                <div className="text-sm font-semibold text-white">
                                  Since first check-in (baseline)
                                </div>
                                {!changesVsBase ? (
                                  <div className="mt-2 text-sm text-white/60">
                                    —
                                  </div>
                                ) : (
                                  <div className="mt-3 grid grid-cols-1 gap-3">
                                    <div>
                                      <div className="text-xs font-semibold text-emerald-300">
                                        Improved
                                      </div>
                                      <div className="mt-1 space-y-1">
                                        {changesVsBase.up.length ? (
                                          changesVsBase.up.map((d) => (
                                            <div
                                              key={`bup-${d.key}`}
                                              className="flex items-center justify-between text-sm text-white/80"
                                            >
                                              <span className="truncate mr-3">
                                                <MetricLabel k={d.key} />
                                              </span>
                                              <span className="text-emerald-300 font-semibold">
                                                +{formatNumberMax3(d.delta)}
                                              </span>
                                            </div>
                                          ))
                                        ) : (
                                          <div className="text-sm text-white/60">
                                            —
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-xs font-semibold text-red-300">
                                        Dropped
                                      </div>
                                      <div className="mt-1 space-y-1">
                                        {changesVsBase.down.length ? (
                                          changesVsBase.down.map((d) => (
                                            <div
                                              key={`bdown-${d.key}`}
                                              className="flex items-center justify-between text-sm text-white/80"
                                            >
                                              <span className="truncate mr-3">
                                                <MetricLabel k={d.key} />
                                              </span>
                                              <span className="text-red-300 font-semibold">
                                                {formatNumberMax3(d.delta)}
                                              </span>
                                            </div>
                                          ))
                                        ) : (
                                          <div className="text-sm text-white/60">
                                            —
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                            <div className="text-white font-semibold">
                              Skills breakdown
                            </div>
                            <div className="text-white/60 text-sm mt-1">
                              Each card shows the summary for that skill area,
                              plus (optional) the raw attempts.
                            </div>

                            <div className="mt-4 grid grid-cols-1 xl:grid-cols-2 gap-4">
                              {CATEGORIES.map((cat) => {
                                const tests = activeTests;
                                const overalls = activeOverall;
                                const testVals = cat.testKeys
                                  .map((k) => tests?.[k])
                                  .filter(isFiniteNumber);
                                const testAvg = avg(testVals);
                                const testBest = best(
                                  testVals,
                                  cat.testHigherIsBetter ?? true
                                );
                                const bestLabel =
                                  cat.testHigherIsBetter === false
                                    ? "Fastest"
                                    : "Best";
                                const triesOpen = !!openTries[cat.id];

                                return (
                                  <div
                                    key={cat.id}
                                    className="rounded-2xl border border-white/10 bg-black/20 p-5"
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div>
                                        <div className="text-white font-bold text-lg">
                                          {cat.name}
                                        </div>
                                        <div className="text-white/60 text-sm mt-1">
                                          {testVals.length ? (
                                            <>
                                              Average:{" "}
                                              <span className="text-white font-semibold">
                                                {testAvg === null
                                                  ? "—"
                                                  : formatNumberMax3(testAvg)}
                                              </span>{" "}
                                              • {bestLabel}:{" "}
                                              <span className="text-white font-semibold">
                                                {testBest === null
                                                  ? "—"
                                                  : formatNumberMax3(testBest)}
                                              </span>
                                            </>
                                          ) : (
                                            "No attempt data yet"
                                          )}
                                        </div>
                                      </div>

                                      <button
                                        type="button"
                                        onClick={() =>
                                          setOpenTries((s) => ({
                                            ...s,
                                            [cat.id]: !s[cat.id],
                                          }))
                                        }
                                        className="text-sm text-white/70 hover:text-white"
                                      >
                                        {triesOpen
                                          ? "Hide attempts"
                                          : "Show attempts"}
                                      </button>
                                    </div>

                                    <div className="mt-4">
                                      <div className="text-sm font-semibold text-white/90 mb-2">
                                        Summary
                                      </div>
                                      <KvGrid
                                        data={overalls}
                                        keys={cat.overallKeys}
                                      />
                                    </div>

                                    {triesOpen ? (
                                      <div className="mt-4">
                                        <div className="text-sm font-semibold text-white/90 mb-2">
                                          Attempts
                                        </div>
                                        <KvGrid
                                          data={tests}
                                          keys={cat.testKeys}
                                        />
                                      </div>
                                    ) : null}
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                            <button
                              type="button"
                              onClick={() => setShowAdvanced((s) => !s)}
                              className="w-full flex items-center justify-between text-left"
                            >
                              <div>
                                <div className="text-white font-semibold">
                                  Advanced (optional)
                                </div>
                                <div className="text-white/60 text-sm mt-1">
                                  Extra computed signals like Player DNA.
                                </div>
                              </div>
                              <div className="text-white/60 text-sm">
                                {showAdvanced ? "Hide" : "Show"}
                              </div>
                            </button>

                            {showAdvanced ? (
                              <div className="mt-4 space-y-4">
                                <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                                  <div className="text-white font-semibold">
                                    Player DNA (signals)
                                  </div>
                                  <div className="text-white/60 text-sm mt-1">
                                    These are normalized features used by the
                                    model. They’re not always “higher is better”
                                    — treat as supporting context.
                                  </div>

                                  {!dnaInsights ? (
                                    <div className="mt-3 text-sm text-white/60">
                                      No DNA data yet.
                                    </div>
                                  ) : (
                                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                      <div>
                                        <div className="text-xs font-semibold text-white/70">
                                          Strongest signals
                                        </div>
                                        <div className="mt-2 space-y-1">
                                          {dnaInsights.top.map((d) => (
                                            <div
                                              key={`dna-top-${d.k}`}
                                              className="flex items-center justify-between text-sm text-white/80"
                                            >
                                              <span className="truncate mr-3">
                                                <MetricLabel k={d.k} />
                                              </span>
                                              <span className="text-white font-semibold">
                                                {formatNumberMax3(d.v)}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                      <div>
                                        <div className="text-xs font-semibold text-white/70">
                                          Weakest signals
                                        </div>
                                        <div className="mt-2 space-y-1">
                                          {dnaInsights.bottom.map((d) => (
                                            <div
                                              key={`dna-bot-${d.k}`}
                                              className="flex items-center justify-between text-sm text-white/80"
                                            >
                                              <span className="truncate mr-3">
                                                <MetricLabel k={d.k} />
                                              </span>
                                              <span className="text-white font-semibold">
                                                {formatNumberMax3(d.v)}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {role && role !== "parent" && role !== "player" && (
        <p className="text-white/70 mt-2">
          Coming soon — next we’ll build out the coach/team and admin/company AI
          analysis.
        </p>
      )}
    </div>
  );
}
