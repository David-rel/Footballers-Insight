"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Info, X } from "lucide-react";

type Scores = Record<string, number>;

type PlayerCluster = {
  ps?: number;
  tc?: number;
  ms?: number;
  dc?: number;
  vector?: number[];
};

type LatestEvaluationResponse = {
  playerEvaluation: null | {
    id: string;
    playerId: string;
    teamId: string;
    evaluationId: string;
    name: string;
    createdAt: string;
  };
  testScores: Scores | null;
  overallScores: Scores | null;
  playerDna: Scores | null;
  playerCluster: PlayerCluster | null;
};

type EvaluationListItem = {
  id: string;
  name: string;
  createdAt: string;
};

const CLUSTER_DIMENSIONS = [
  { label: "Power / Strength", key: "ps" },
  { label: "Technique / Control", key: "tc" },
  { label: "Mobility / Stability", key: "ms" },
  { label: "Decision / Cognition", key: "dc" },
] as const satisfies ReadonlyArray<{
  label: string;
  key: "ps" | "tc" | "ms" | "dc";
}>;

function titleCaseFromKey(key: string) {
  let s = key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bAvg\b/g, "Average")
    .replace(/\bMax\b/g, "Top")
    .replace(/\bPct\b/g, "%");

  // Make common “stats” terms friendlier for players
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
  // toFixed then trim trailing zeros
  return String(Number(v.toFixed(3)));
}

function formatSignedDelta(v: number) {
  if (!Number.isFinite(v)) return "—";
  const s = formatNumberMax3(v);
  return v > 0 ? `+${s}` : s;
}

function avg(nums: number[]) {
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function best(nums: number[], higherIsBetter = true) {
  if (!nums.length) return null;
  return higherIsBetter ? Math.max(...nums) : Math.min(...nums);
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function Tooltip({
  text,
  children,
}: {
  text: string;
  children: React.ReactNode;
}) {
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

  return HELP[key] || "A stat from your latest check-in.";
}

function PercentBar({
  label,
  value01,
  hint,
}: {
  label: string;
  value01: number | null;
  hint?: string;
}) {
  const pct = value01 === null ? null : Math.round(clamp01(value01) * 100);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <div className="text-sm text-white/80">
          <span>{label}</span>{" "}
          {hint ? <span className="text-white/40">({hint})</span> : null}
        </div>
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

function KvTable({ data, keys }: { data: Scores | null; keys: string[] }) {
  if (!data) return <div className="text-sm text-white/50">No data.</div>;
  const rows = keys
    .filter((k) => isFiniteNumber(data[k]))
    .map((k) => ({ k, v: data[k] }));

  if (!rows.length)
    return <div className="text-sm text-white/50">No data.</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
      {rows.map(({ k, v }) => (
        <div
          key={k}
          className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2"
        >
          <div className="text-sm text-white/70 inline-flex items-center gap-1">
            <span>{titleCaseFromKey(k)}</span>
            <Tooltip text={helpTextForKey(k)}>
              <Info className="w-3.5 h-3.5 text-white/40" />
            </Tooltip>
          </div>
          <div className="text-sm font-semibold text-white">
            {formatNumberMax3(v)}
          </div>
        </div>
      ))}
    </div>
  );
}

type CategoryDef = {
  id: string;
  name: string;
  testKeys: string[];
  overallKeys: string[];
  testHigherIsBetter?: boolean;
};

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
    testHigherIsBetter: false, // time
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
      "single_leg_hop_asymmetry_pct",
      "single_leg_hop_left_avg",
      "single_leg_hop_right_avg",
      "single_leg_hop_left_consistency_range",
      "single_leg_hop_right_consistency_range",
    ],
    testHigherIsBetter: true,
  },
  {
    id: "juggling",
    name: "Juggling",
    testKeys: ["juggling_1", "juggling_2", "juggling_3", "juggling_4"],
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
      "skill_moves_avg_rating",
      "skill_moves_best_rating",
      "skill_moves_worst_rating",
      "skill_moves_total_rating",
      "skill_moves_consistency_range",
      "skill_moves_count",
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
    testHigherIsBetter: false, // time
  },
  {
    id: "shotpower",
    name: "Shot Power",
    testKeys: [
      "power_strong_1",
      "power_strong_2",
      "power_strong_3",
      "power_strong_4",
      "power_weak_1",
      "power_weak_2",
      "power_weak_3",
      "power_weak_4",
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
    id: "serve",
    name: "Serve Distance",
    testKeys: [
      "serve_strong_1",
      "serve_strong_2",
      "serve_strong_3",
      "serve_strong_4",
      "serve_weak_1",
      "serve_weak_2",
      "serve_weak_3",
      "serve_weak_4",
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

export default function PlayerEvaluationPanel({
  teamId,
  playerId,
}: {
  teamId: string;
  playerId: string;
}) {
  const [data, setData] = useState<LatestEvaluationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openRaw, setOpenRaw] = useState<Record<string, boolean>>({});

  const [compareOpen, setCompareOpen] = useState(false);
  const [evalList, setEvalList] = useState<EvaluationListItem[] | null>(null);
  const [evalListLoading, setEvalListLoading] = useState(false);
  const [evalListError, setEvalListError] = useState<string | null>(null);
  const [selectedPastId, setSelectedPastId] = useState<string>("");
  const [pastData, setPastData] = useState<LatestEvaluationResponse | null>(
    null
  );
  const [pastLoading, setPastLoading] = useState(false);
  const [pastError, setPastError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function run() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(
          `/api/teams/${teamId}/players/${playerId}/latest-evaluation`
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error || "Failed to load evaluation data");
        }
        const json = (await res.json()) as LatestEvaluationResponse;
        if (mounted) setData(json);
      } catch (e: any) {
        if (mounted) setError(e.message || "Failed to load evaluation data");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    run();
    return () => {
      mounted = false;
    };
  }, [teamId, playerId]);

  async function loadEvalList() {
    try {
      setEvalListLoading(true);
      setEvalListError(null);
      const res = await fetch(
        `/api/teams/${teamId}/players/${playerId}/evaluations`
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Failed to load past check-ins");
      }
      const json = (await res.json()) as { evaluations: EvaluationListItem[] };
      setEvalList(json.evaluations || []);
    } catch (e: any) {
      setEvalListError(e.message || "Failed to load past check-ins");
      setEvalList([]);
    } finally {
      setEvalListLoading(false);
    }
  }

  async function loadPastEvaluation(playerEvaluationId: string) {
    try {
      setPastLoading(true);
      setPastError(null);
      const res = await fetch(
        `/api/teams/${teamId}/players/${playerId}/evaluations/${playerEvaluationId}`
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Failed to load that check-in");
      }
      const json = (await res.json()) as LatestEvaluationResponse;
      setPastData(json);
    } catch (e: any) {
      setPastError(e.message || "Failed to load that check-in");
      setPastData(null);
    } finally {
      setPastLoading(false);
    }
  }

  const clusterBars = useMemo(() => {
    const c = data?.playerCluster ?? null;
    if (!c) return [];
    const entries: Array<[string, number]> = [];
    if (isFiniteNumber(c.ps)) entries.push(["Power / Strength", c.ps]);
    if (isFiniteNumber(c.tc)) entries.push(["Technique / Control", c.tc]);
    if (isFiniteNumber(c.ms)) entries.push(["Mobility / Stability", c.ms]);
    if (isFiniteNumber(c.dc)) entries.push(["Decision / Cognition", c.dc]);
    return entries;
  }, [data?.playerCluster]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/60 p-6">
        <div className="text-white/70">Loading your results…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6">
        <div className="text-red-300 font-semibold mb-1">
          Couldn’t load your results
        </div>
        <div className="text-red-200/80 text-sm">{error}</div>
      </div>
    );
  }

  if (!data?.playerEvaluation) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/60 p-6">
        <div className="text-white font-semibold mb-1">Your Results</div>
        <div className="text-white/60 text-sm">
          No results found for you yet.
        </div>
      </div>
    );
  }

  const latestEval = data.playerEvaluation;
  const latestEvalId = latestEval.id;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-white/10 bg-black/60 p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <div className="text-white font-bold text-xl">Your Results</div>
            <div className="text-white/60 text-sm">
              {latestEval.name} •{" "}
              {new Date(latestEval.createdAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={async () => {
                setCompareOpen(true);
                // Load list on open (once)
                if (evalList === null) await loadEvalList();
              }}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 hover:text-white hover:bg-white/10"
            >
              Compare past check-ins
            </button>
            <div className="text-xs text-white/40">Latest check-in</div>
          </div>
        </div>
      </div>

      {/* 4D Cluster */}
      <div className="rounded-2xl border border-white/10 bg-black/60 p-6">
        <div className="text-white font-bold text-lg mb-1">
          Your Player Style
        </div>
        <div className="text-white/60 text-sm mb-4">
          These bars compare you to the rest of your team (0–100%). Higher means
          you’re ahead of more teammates in that area.
        </div>
        {clusterBars.length ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {clusterBars.map(([label, v]) => (
              <PercentBar
                key={label}
                label={label}
                value01={v}
                hint="percent"
              />
            ))}
          </div>
        ) : (
          <div className="text-white/50 text-sm">No style data yet.</div>
        )}
      </div>

      {/* Categories */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {CATEGORIES.map((cat) => {
          const tests = data.testScores ?? null;
          const overalls = data.overallScores ?? null;

          const testVals = cat.testKeys
            .map((k) => tests?.[k])
            .filter(isFiniteNumber);
          const testAvg = avg(testVals);
          const testBest = best(testVals, cat.testHigherIsBetter ?? true);
          const bestLabel =
            cat.testHigherIsBetter === false ? "Fastest" : "Best";

          const rawOpen = !!openRaw[cat.id];

          return (
            <div
              key={cat.id}
              className="rounded-2xl border border-white/10 bg-black/60 p-6"
            >
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <div className="text-white font-bold text-lg">{cat.name}</div>
                  <div className="text-white/60 text-sm">
                    {testVals.length ? (
                      <>
                        Average:{" "}
                        <span className="text-white font-semibold">
                          {testAvg === null ? "—" : formatNumberMax3(testAvg)}
                        </span>{" "}
                        • {bestLabel}:{" "}
                        <span className="text-white font-semibold">
                          {testBest === null ? "—" : formatNumberMax3(testBest)}
                        </span>
                      </>
                    ) : (
                      "No test numbers yet"
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setOpenRaw((s) => ({ ...s, [cat.id]: !s[cat.id] }))
                  }
                  className="inline-flex items-center gap-2 text-sm text-white/70 hover:text-white"
                >
                  <span>{rawOpen ? "Hide tries" : "Show tries"}</span>
                  {rawOpen ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>
              </div>

              {/* Overall computed highlights */}
              <div className="mb-4">
                <div className="text-sm font-semibold text-white/90 mb-2">
                  Summary
                </div>
                <KvTable data={overalls} keys={cat.overallKeys} />
              </div>

              {rawOpen ? (
                <div>
                  <div className="text-sm font-semibold text-white/90 mb-2">
                    Your tries (each attempt)
                  </div>
                  <KvTable data={tests} keys={cat.testKeys} />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Compare modal */}
      {compareOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-black/95 p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <div className="text-white font-bold text-xl">
                  Compare past check-ins
                </div>
                <div className="text-white/60 text-sm">
                  Pick an older check-in and we’ll compare it to your latest
                  one.
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCompareOpen(false);
                  setSelectedPastId("");
                  setPastData(null);
                  setPastError(null);
                }}
                className="text-white/70 hover:text-white"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-4 mb-6">
              <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
                <div className="text-sm text-white/70">Past check-in</div>
                <select
                  value={selectedPastId}
                  onChange={async (e) => {
                    const id = e.target.value;
                    setSelectedPastId(id);
                    if (id) await loadPastEvaluation(id);
                  }}
                  className="w-full md:w-[420px] px-3 py-2 rounded-lg bg-black/60 border border-white/10 text-white focus:outline-none focus:border-[#e3ca76]/50"
                >
                  <option value="">Select…</option>
                  {evalList
                    ?.filter((ev) => ev.id !== latestEvalId)
                    .map((ev) => (
                      <option key={ev.id} value={ev.id}>
                        {ev.name} •{" "}
                        {new Date(ev.createdAt).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </option>
                    ))}
                </select>

                <div className="text-sm text-white/60">
                  Latest:{" "}
                  <span className="text-white/90 font-semibold">
                    {latestEval.name}
                  </span>
                </div>

                <div className="ml-auto">
                  <button
                    type="button"
                    onClick={loadEvalList}
                    disabled={evalListLoading}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-50"
                  >
                    {evalListLoading ? "Refreshing…" : "Refresh list"}
                  </button>
                </div>
              </div>

              {evalListError ? (
                <div className="text-sm text-red-300 mt-3">{evalListError}</div>
              ) : null}
            </div>

            {!selectedPastId ? (
              <div className="text-white/60 text-sm">
                Choose a past check-in to start.
              </div>
            ) : pastLoading ? (
              <div className="text-white/70 text-sm">
                Loading that check-in…
              </div>
            ) : pastError ? (
              <div className="text-red-300 text-sm">{pastError}</div>
            ) : !pastData?.playerEvaluation ? (
              <div className="text-white/60 text-sm">
                Couldn’t load that check-in.
              </div>
            ) : (
              <div className="space-y-6">
                {/* Style compare */}
                <div className="rounded-2xl border border-white/10 bg-black/60 p-6">
                  <div className="text-white font-bold text-lg mb-1">
                    Your Player Style
                  </div>
                  <div className="text-white/60 text-sm mb-4">
                    Compared to your team. This shows what changed from that
                    past check-in to now.
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {CLUSTER_DIMENSIONS.map(({ label, key }) => {
                      const past = pastData!.playerCluster?.[key];
                      const latest = data.playerCluster?.[key];
                      const pastPct =
                        typeof past === "number"
                          ? Math.round(past * 100)
                          : null;
                      const latestPct =
                        typeof latest === "number"
                          ? Math.round(latest * 100)
                          : null;
                      const delta =
                        pastPct === null || latestPct === null
                          ? null
                          : latestPct - pastPct;

                      return (
                        <div
                          key={label}
                          className="rounded-xl border border-white/10 bg-white/5 p-4"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-white/90 font-semibold">
                              {label}
                            </div>
                            <div className="text-sm text-white/70">
                              Change:{" "}
                              <span
                                className={
                                  delta === null
                                    ? "text-white/70"
                                    : delta > 0
                                    ? "text-green-300"
                                    : delta < 0
                                    ? "text-red-300"
                                    : "text-white/70"
                                }
                              >
                                {delta === null
                                  ? "—"
                                  : `${delta > 0 ? "+" : ""}${delta}%`}
                              </span>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <PercentBar
                              label="Past"
                              value01={typeof past === "number" ? past : null}
                              hint={pastData!.playerEvaluation!.name}
                            />
                            <PercentBar
                              label="Latest"
                              value01={
                                typeof latest === "number" ? latest : null
                              }
                              hint={latestEval.name}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Category compare */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  {CATEGORIES.map((cat) => {
                    const pastOver = pastData!.overallScores ?? null;
                    const latestOver = data.overallScores ?? null;

                    const rows = cat.overallKeys
                      .map((k) => {
                        const a = pastOver?.[k];
                        const b = latestOver?.[k];
                        if (typeof a !== "number" && typeof b !== "number")
                          return null;
                        return {
                          k,
                          a: typeof a === "number" ? a : null,
                          b: typeof b === "number" ? b : null,
                        };
                      })
                      .filter(Boolean) as Array<{
                      k: string;
                      a: number | null;
                      b: number | null;
                    }>;

                    return (
                      <div
                        key={cat.id}
                        className="rounded-2xl border border-white/10 bg-black/60 p-6"
                      >
                        <div className="text-white font-bold text-lg mb-1">
                          {cat.name}
                        </div>
                        <div className="text-white/60 text-sm mb-4">
                          Past → Latest (and the change)
                        </div>

                        <div className="mb-6">
                          <div className="text-sm font-semibold text-white/90 mb-2">
                            Summary
                          </div>
                          {rows.length ? (
                            <div className="space-y-2">
                              {rows.map(({ k, a, b }) => {
                                const delta =
                                  a === null || b === null ? null : b - a;
                                return (
                                  <div
                                    key={k}
                                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-2"
                                  >
                                    <div className="flex items-center justify-between gap-3">
                                      <div className="text-sm text-white/80 inline-flex items-center gap-1">
                                        <span>{titleCaseFromKey(k)}</span>
                                        <Tooltip text={helpTextForKey(k)}>
                                          <Info className="w-3.5 h-3.5 text-white/40" />
                                        </Tooltip>
                                      </div>
                                      <div className="text-sm text-white/70">
                                        <span className="text-white/80">
                                          {a === null
                                            ? "—"
                                            : formatNumberMax3(a)}
                                        </span>{" "}
                                        →{" "}
                                        <span className="text-white font-semibold">
                                          {b === null
                                            ? "—"
                                            : formatNumberMax3(b)}
                                        </span>{" "}
                                        <span className="text-white/50">
                                          (
                                          {delta === null
                                            ? "—"
                                            : formatSignedDelta(delta)}
                                          )
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="text-sm text-white/50">
                              No summary data.
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
