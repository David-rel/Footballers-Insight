import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function meanOfFour(values: Array<number | null>): number | null {
  if (values.length !== 4) return null;
  if (values.some((v) => v === null)) return null;
  const sum = values[0]! + values[1]! + values[2]! + values[3]!;
  return sum / 4;
}

function sumTop2OfFour(values: Array<number | null>): number | null {
  if (values.length !== 4) return null;
  if (values.some((v) => v === null)) return null;
  const sorted = (values as number[]).slice().sort((a, b) => b - a);
  return sorted[0] + sorted[1];
}

function sumOfAll(values: Array<number | null>): number | null {
  if (values.length === 0) return null;
  if (values.some((v) => v === null)) return null;
  return (values as number[]).reduce((acc, v) => acc + v, 0);
}

function avgOfAll(values: Array<number | null>): number | null {
  const sum = sumOfAll(values);
  if (sum === null) return null;
  return sum / values.length;
}

function minOfAll(values: Array<number | null>): number | null {
  if (values.length === 0) return null;
  if (values.some((v) => v === null)) return null;
  return Math.min(...(values as number[]));
}

function maxOfAll(values: Array<number | null>): number | null {
  if (values.length === 0) return null;
  if (values.some((v) => v === null)) return null;
  return Math.max(...(values as number[]));
}

function maxOf(values: Array<number | null>): number | null {
  const nums = values.filter((v): v is number => typeof v === "number");
  if (nums.length === 0) return null;
  return Math.max(...nums);
}

function safeRatio(
  numerator: number | null,
  denominator: number | null
): number | null {
  if (numerator === null || denominator === null) return null;
  if (denominator === 0) return null;
  return numerator / denominator;
}

function safeAsymmetryPct(
  strong: number | null,
  weak: number | null
): number | null {
  if (strong === null || weak === null) return null;
  if (strong === 0) return null;
  return ((strong - weak) / strong) * 100;
}

function minMaxNormalize(
  value: number | null,
  min: number | null,
  max: number | null
): number | null {
  if (value === null || min === null || max === null) return null;
  if (max === min) return value === min ? 1 : 0;
  return (value - min) / (max - min);
}

function minMaxNormalizeLowerBetter(
  value: number | null,
  min: number | null,
  max: number | null
): number | null {
  if (value === null || min === null || max === null) return null;
  if (max === min) return 1;
  return 1 - (value - min) / (max - min);
}

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function fmt(n: number | null, decimals = 2): string {
  if (n === null) return "—";
  return n.toFixed(decimals);
}

function fmtPct(n: number | null, decimals = 1): string {
  if (n === null) return "—";
  return `${n.toFixed(decimals)}%`;
}

function padLeft(s: string, width: number): string {
  if (s.length >= width) return s;
  return " ".repeat(width - s.length) + s;
}

function padRight(s: string, width: number): string {
  if (s.length >= width) return s;
  return s + " ".repeat(width - s.length);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const client = await pool.connect();
  let clientReleased = false;
  try {
    const session = await auth();

    if (!session || !session.user?.email || !session.user?.id) {
      clientReleased = true;
      client.release();
      return new NextResponse("error Not authenticated\n", {
        status: 401,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }

    const { id } = await params;
    const teamId = id;

    // Get user's role and company_id
    const userResult = await client.query(
      "SELECT role, company_id FROM users WHERE id = $1",
      [session.user.id]
    );

    if (userResult.rows.length === 0) {
      clientReleased = true;
      client.release();
      return new NextResponse("error User not found\n", {
        status: 404,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }

    const userRole: string = userResult.rows[0].role;

    // Players/parents cannot compute test data
    if (userRole === "player" || userRole === "parent") {
      clientReleased = true;
      client.release();
      return new NextResponse("error Access denied\n", {
        status: 403,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }

    let companyId: string | null = userResult.rows[0].company_id;

    // If owner, get company from companies table
    if (userRole === "owner" && !companyId) {
      const companyResult = await client.query(
        "SELECT id FROM companies WHERE owner_id = $1",
        [session.user.id]
      );
      if (companyResult.rows.length > 0) {
        companyId = companyResult.rows[0].id;
      }
    }

    if (!companyId) {
      clientReleased = true;
      client.release();
      return new NextResponse("error Company not found\n", {
        status: 404,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }

    // Normalization scope: TEAM ONLY (your latest decision)
    // We keep the type union so legacy "company" blocks remain type-valid, but we always set it to "team".
    let normalizationScope: "team" | "company" = "team";

    // Verify team exists and belongs to user's company
    const teamResult = await client.query(
      "SELECT id, company_id, coach_id FROM teams WHERE id = $1",
      [teamId]
    );

    if (teamResult.rows.length === 0) {
      clientReleased = true;
      client.release();
      return new NextResponse("error Team not found\n", {
        status: 404,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }

    const team = teamResult.rows[0];

    // Coaches can only compute for their own teams
    if (userRole === "coach" && team.coach_id !== session.user.id) {
      clientReleased = true;
      client.release();
      return new NextResponse("error Unauthorized to compute for this team\n", {
        status: 403,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }

    // Owners/admins can only compute for teams in their company
    if (userRole !== "coach" && team.company_id !== companyId) {
      clientReleased = true;
      client.release();
      return new NextResponse("error Unauthorized to compute for this team\n", {
        status: 403,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }

    const evaluationsResult = await client.query(
      "SELECT id, team_id, created_by, name, created_at, one_v_one_rounds, skill_moves_count, scores FROM evaluations WHERE team_id = $1 ORDER BY created_at DESC",
      [teamId]
    );

    // Compute ONLY the most recent evaluation, but keep all evaluations in-memory
    // for team-wide min/max (normalization context).
    const evaluationsToCompute = evaluationsResult.rows.slice(0, 1);

    const playersResult = await client.query(
      "SELECT id, first_name, last_name, dob FROM players WHERE team_id = $1",
      [teamId]
    );

    const playersById = new Map<
      string,
      { birthYear: number | null; name: string }
    >();
    for (const row of playersResult.rows) {
      const birthYear = row.dob ? new Date(row.dob).getUTCFullYear() : null;
      const name =
        `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim() ||
        "Unknown Player";
      playersById.set(row.id, { birthYear, name });
    }

    console.log(
      "[compute-all] team:",
      teamId,
      "evaluationsTotal:",
      evaluationsResult.rows.length,
      "evaluationsToCompute:",
      evaluationsToCompute.length,
      "normalizationScope:",
      normalizationScope
    );

    // Company-wide cohort min/max disabled (team-only normalization).
    const globalCohortStats = null;

    // (company-wide normalization removed)

    const coachIds = Array.from(
      new Set(
        evaluationsResult.rows
          .map((r: any) => r.created_by)
          .filter((v: any) => typeof v === "string" && v.length > 0)
      )
    );
    const coachNameById = new Map<string, string>();
    if (coachIds.length > 0) {
      const coachesResult = await client.query(
        "SELECT id, name FROM users WHERE id = ANY($1::uuid[])",
        [coachIds]
      );
      for (const row of coachesResult.rows) {
        coachNameById.set(row.id, row.name ?? "Unknown Coach");
      }
    }

    let playerEvaluationsUpserted = 0;

    type MinMax = { min: number | null; max: number | null };
    type TeamCohortStatsRow = {
      shot_power_strong_avg: MinMax;
      shot_power_weak_avg: MinMax;
      shot_power_strong_max: MinMax;
      shot_power_weak_max: MinMax;

      serve_distance_strong_avg: MinMax;
      serve_distance_weak_avg: MinMax;
      serve_distance_strong_max: MinMax;
      serve_distance_weak_max: MinMax;

      figure8_loops_strong: MinMax;
      figure8_loops_weak: MinMax;
      figure8_loops_both: MinMax;

      passing_gates_strong_hits: MinMax;
      passing_gates_weak_hits: MinMax;
      passing_gates_total_hits: MinMax;

      one_v_one_rounds_played: MinMax;

      juggle_best: MinMax;
      juggle_best2_sum: MinMax;
      juggle_avg_all: MinMax;

      skill_moves_count: MinMax;

      agility_5_10_5_best_time: MinMax;
      agility_5_10_5_avg_time: MinMax;

      reaction_5m_reaction_time_avg: MinMax;
      reaction_5m_total_time_avg: MinMax;

      single_leg_hop_left: MinMax;
      single_leg_hop_right: MinMax;

      double_leg_jumps_first10: MinMax;
      double_leg_jumps_total_reps: MinMax;
      double_leg_jumps_last10: MinMax;

      ankle_dorsiflex_left_cm: MinMax;
      ankle_dorsiflex_right_cm: MinMax;
      ankle_dorsiflex_avg_cm: MinMax;

      core_plank_hold_sec: MinMax;
    };

    function emptyTeamCohortStatsRow(): TeamCohortStatsRow {
      return {
        shot_power_strong_avg: { min: null, max: null },
        shot_power_weak_avg: { min: null, max: null },
        shot_power_strong_max: { min: null, max: null },
        shot_power_weak_max: { min: null, max: null },

        serve_distance_strong_avg: { min: null, max: null },
        serve_distance_weak_avg: { min: null, max: null },
        serve_distance_strong_max: { min: null, max: null },
        serve_distance_weak_max: { min: null, max: null },

        figure8_loops_strong: { min: null, max: null },
        figure8_loops_weak: { min: null, max: null },
        figure8_loops_both: { min: null, max: null },

        passing_gates_strong_hits: { min: null, max: null },
        passing_gates_weak_hits: { min: null, max: null },
        passing_gates_total_hits: { min: null, max: null },

        one_v_one_rounds_played: { min: null, max: null },

        juggle_best: { min: null, max: null },
        juggle_best2_sum: { min: null, max: null },
        juggle_avg_all: { min: null, max: null },

        skill_moves_count: { min: null, max: null },

        agility_5_10_5_best_time: { min: null, max: null },
        agility_5_10_5_avg_time: { min: null, max: null },

        reaction_5m_reaction_time_avg: { min: null, max: null },
        reaction_5m_total_time_avg: { min: null, max: null },

        single_leg_hop_left: { min: null, max: null },
        single_leg_hop_right: { min: null, max: null },

        double_leg_jumps_first10: { min: null, max: null },
        double_leg_jumps_total_reps: { min: null, max: null },
        double_leg_jumps_last10: { min: null, max: null },

        ankle_dorsiflex_left_cm: { min: null, max: null },
        ankle_dorsiflex_right_cm: { min: null, max: null },
        ankle_dorsiflex_avg_cm: { min: null, max: null },

        core_plank_hold_sec: { min: null, max: null },
      };
    }

    function bumpMinMax(
      stats: TeamCohortStatsRow,
      key: keyof TeamCohortStatsRow,
      value: number | null
    ) {
      if (value === null) return;
      stats[key].min =
        stats[key].min === null ? value : Math.min(stats[key].min, value);
      stats[key].max =
        stats[key].max === null ? value : Math.max(stats[key].max, value);
    }

    // Team-wide cohort min/max (birth-year) across ALL team evaluations (Oct + Dec, etc.)
    const teamWideCohortStats = new Map<number, TeamCohortStatsRow>();
    for (const ev of evaluationsResult.rows) {
      const oneVOneRounds: number =
        typeof ev.one_v_one_rounds === "number" &&
        Number.isFinite(ev.one_v_one_rounds)
          ? ev.one_v_one_rounds
          : 0;
      const skillMovesCount: number =
        typeof (ev as any).skill_moves_count === "number" &&
        Number.isFinite((ev as any).skill_moves_count)
          ? (ev as any).skill_moves_count
          : 0;

      const scores =
        typeof ev.scores === "string" ? JSON.parse(ev.scores) : ev.scores ?? {};

      for (const [playerId, playerScores] of Object.entries(
        scores as Record<string, any>
      )) {
        const birthYear = playersById.get(playerId)?.birthYear ?? null;
        if (!birthYear) continue;

        if (!teamWideCohortStats.has(birthYear)) {
          teamWideCohortStats.set(birthYear, emptyTeamCohortStatsRow());
        }
        const stats = teamWideCohortStats.get(birthYear)!;

        const strongAttempts: Array<number | null> = [1, 2, 3, 4].map((i) =>
          toFiniteNumber((playerScores as any)?.[`power_strong_${i}`])
        );
        const weakAttempts: Array<number | null> = [1, 2, 3, 4].map((i) =>
          toFiniteNumber((playerScores as any)?.[`power_weak_${i}`])
        );
        bumpMinMax(stats, "shot_power_strong_avg", meanOfFour(strongAttempts));
        bumpMinMax(stats, "shot_power_weak_avg", meanOfFour(weakAttempts));
        bumpMinMax(stats, "shot_power_strong_max", maxOf(strongAttempts));
        bumpMinMax(stats, "shot_power_weak_max", maxOf(weakAttempts));

        const serveStrongAttempts: Array<number | null> = [1, 2, 3, 4].map(
          (i) => toFiniteNumber((playerScores as any)?.[`serve_strong_${i}`])
        );
        const serveWeakAttempts: Array<number | null> = [1, 2, 3, 4].map((i) =>
          toFiniteNumber((playerScores as any)?.[`serve_weak_${i}`])
        );
        bumpMinMax(
          stats,
          "serve_distance_strong_avg",
          meanOfFour(serveStrongAttempts)
        );
        bumpMinMax(
          stats,
          "serve_distance_weak_avg",
          meanOfFour(serveWeakAttempts)
        );
        bumpMinMax(
          stats,
          "serve_distance_strong_max",
          maxOf(serveStrongAttempts)
        );
        bumpMinMax(stats, "serve_distance_weak_max", maxOf(serveWeakAttempts));

        bumpMinMax(
          stats,
          "figure8_loops_strong",
          toFiniteNumber((playerScores as any)?.figure8_strong)
        );
        bumpMinMax(
          stats,
          "figure8_loops_weak",
          toFiniteNumber((playerScores as any)?.figure8_weak)
        );
        bumpMinMax(
          stats,
          "figure8_loops_both",
          toFiniteNumber((playerScores as any)?.figure8_both)
        );

        const passing_gates_strong_hits = toFiniteNumber(
          (playerScores as any)?.passing_strong
        );
        const passing_gates_weak_hits = toFiniteNumber(
          (playerScores as any)?.passing_weak
        );
        const passing_gates_total_hits =
          passing_gates_strong_hits === null || passing_gates_weak_hits === null
            ? null
            : passing_gates_strong_hits + passing_gates_weak_hits;
        bumpMinMax(
          stats,
          "passing_gates_strong_hits",
          passing_gates_strong_hits
        );
        bumpMinMax(stats, "passing_gates_weak_hits", passing_gates_weak_hits);
        bumpMinMax(stats, "passing_gates_total_hits", passing_gates_total_hits);

        bumpMinMax(
          stats,
          "one_v_one_rounds_played",
          oneVOneRounds > 0 ? oneVOneRounds : null
        );

        const jugglingAttempts: Array<number | null> = [1, 2, 3, 4].map((i) =>
          toFiniteNumber((playerScores as any)?.[`juggling_${i}`])
        );
        bumpMinMax(stats, "juggle_best", maxOfAll(jugglingAttempts));
        bumpMinMax(stats, "juggle_best2_sum", sumTop2OfFour(jugglingAttempts));
        bumpMinMax(stats, "juggle_avg_all", meanOfFour(jugglingAttempts));

        bumpMinMax(
          stats,
          "skill_moves_count",
          skillMovesCount > 0 ? skillMovesCount : null
        );

        const agilityTrials: Array<number | null> = [1, 2, 3].map((i) =>
          toFiniteNumber((playerScores as any)?.[`agility_${i}`])
        );
        bumpMinMax(stats, "agility_5_10_5_best_time", minOfAll(agilityTrials));
        bumpMinMax(stats, "agility_5_10_5_avg_time", avgOfAll(agilityTrials));

        const reactionTimes: Array<number | null> = [1, 2, 3].map((i) =>
          toFiniteNumber((playerScores as any)?.[`reaction_cue_${i}`])
        );
        const totalTimes: Array<number | null> = [1, 2, 3].map((i) =>
          toFiniteNumber((playerScores as any)?.[`reaction_total_${i}`])
        );
        bumpMinMax(
          stats,
          "reaction_5m_reaction_time_avg",
          avgOfAll(reactionTimes)
        );
        bumpMinMax(stats, "reaction_5m_total_time_avg", avgOfAll(totalTimes));

        const hopLeftTrials: Array<number | null> = [1, 2, 3].map((i) =>
          toFiniteNumber((playerScores as any)?.[`hop_left_${i}`])
        );
        const hopRightTrials: Array<number | null> = [1, 2, 3].map((i) =>
          toFiniteNumber((playerScores as any)?.[`hop_right_${i}`])
        );
        bumpMinMax(stats, "single_leg_hop_left", maxOfAll(hopLeftTrials));
        bumpMinMax(stats, "single_leg_hop_right", maxOfAll(hopRightTrials));

        const C10 = toFiniteNumber((playerScores as any)?.jumps_10s);
        const C20 = toFiniteNumber((playerScores as any)?.jumps_20s);
        const C30 = toFiniteNumber((playerScores as any)?.jumps_30s);
        bumpMinMax(stats, "double_leg_jumps_first10", C10);
        bumpMinMax(stats, "double_leg_jumps_total_reps", C30);
        bumpMinMax(
          stats,
          "double_leg_jumps_last10",
          C30 === null || C20 === null ? null : C30 - C20
        );

        const ankle_left_in = toFiniteNumber((playerScores as any)?.ankle_left);
        const ankle_right_in = toFiniteNumber(
          (playerScores as any)?.ankle_right
        );
        const ankle_dorsiflex_left_cm =
          ankle_left_in === null ? null : ankle_left_in * 2.54;
        const ankle_dorsiflex_right_cm =
          ankle_right_in === null ? null : ankle_right_in * 2.54;
        const ankle_dorsiflex_avg_cm =
          ankle_dorsiflex_left_cm === null || ankle_dorsiflex_right_cm === null
            ? null
            : (ankle_dorsiflex_left_cm + ankle_dorsiflex_right_cm) / 2;
        bumpMinMax(stats, "ankle_dorsiflex_left_cm", ankle_dorsiflex_left_cm);
        bumpMinMax(stats, "ankle_dorsiflex_right_cm", ankle_dorsiflex_right_cm);
        bumpMinMax(stats, "ankle_dorsiflex_avg_cm", ankle_dorsiflex_avg_cm);

        bumpMinMax(
          stats,
          "core_plank_hold_sec",
          toFiniteNumber((playerScores as any)?.plank_time)
        );
      }
    }
    try {
      await client.query("BEGIN");

      // Compute metrics for each evaluation (and persist to DB)
      for (const ev of evaluationsToCompute) {
        const evaluationId: string = ev.id;
        const evaluationName: string = ev.name ?? "Evaluation";
        const evaluationCreatedAt: Date | null = ev.created_at
          ? new Date(ev.created_at)
          : null;
        const coachId: string | null =
          typeof (ev as any).created_by === "string"
            ? (ev as any).created_by
            : null;
        const coachName: string =
          (coachId && coachNameById.get(coachId)) || "Unknown Coach";
        const oneVOneRounds: number =
          typeof ev.one_v_one_rounds === "number" &&
          Number.isFinite(ev.one_v_one_rounds)
            ? ev.one_v_one_rounds
            : 0;
        const skillMovesCount: number =
          typeof (ev as any).skill_moves_count === "number" &&
          Number.isFinite((ev as any).skill_moves_count)
            ? (ev as any).skill_moves_count
            : 0;
        const scores =
          typeof ev.scores === "string"
            ? JSON.parse(ev.scores)
            : ev.scores ?? {};

        const computedByPlayer: Record<string, any> = {};

        for (const [playerId, playerScores] of Object.entries(
          scores as Record<string, any>
        )) {
          const strongAttempts: Array<number | null> = [1, 2, 3, 4].map((i) =>
            toFiniteNumber(playerScores?.[`power_strong_${i}`])
          );
          const weakAttempts: Array<number | null> = [1, 2, 3, 4].map((i) =>
            toFiniteNumber(playerScores?.[`power_weak_${i}`])
          );

          const shot_power_strong_avg = meanOfFour(strongAttempts);
          const shot_power_weak_avg = meanOfFour(weakAttempts);
          const shot_power_strong_max = maxOf(strongAttempts);
          const shot_power_weak_max = maxOf(weakAttempts);

          const serveStrongAttempts: Array<number | null> = [1, 2, 3, 4].map(
            (i) => toFiniteNumber(playerScores?.[`serve_strong_${i}`])
          );
          const serveWeakAttempts: Array<number | null> = [1, 2, 3, 4].map(
            (i) => toFiniteNumber(playerScores?.[`serve_weak_${i}`])
          );

          const serve_distance_strong_avg = meanOfFour(serveStrongAttempts);
          const serve_distance_weak_avg = meanOfFour(serveWeakAttempts);
          const serve_distance_strong_max = maxOf(serveStrongAttempts);
          const serve_distance_weak_max = maxOf(serveWeakAttempts);

          const figure8_loops_strong = toFiniteNumber(
            playerScores?.figure8_strong
          );
          const figure8_loops_weak = toFiniteNumber(playerScores?.figure8_weak);
          const figure8_loops_both = toFiniteNumber(playerScores?.figure8_both);

          const passing_gates_strong_hits = toFiniteNumber(
            playerScores?.passing_strong
          );
          const passing_gates_weak_hits = toFiniteNumber(
            playerScores?.passing_weak
          );
          const passing_gates_total_hits =
            passing_gates_strong_hits === null ||
            passing_gates_weak_hits === null
              ? null
              : passing_gates_strong_hits + passing_gates_weak_hits;

          const one_v_one_rounds_played =
            oneVOneRounds > 0 ? oneVOneRounds : null;
          const oneVOneRoundScores: Array<number | null> =
            oneVOneRounds > 0
              ? Array.from({ length: oneVOneRounds }, (_, idx) =>
                  toFiniteNumber(playerScores?.[`onevone_round_${idx + 1}`])
                )
              : [];
          const one_v_one_total_score = sumOfAll(oneVOneRoundScores);
          const one_v_one_avg_score = avgOfAll(oneVOneRoundScores);
          const one_v_one_best_round = maxOfAll(oneVOneRoundScores);
          const one_v_one_worst_round = minOfAll(oneVOneRoundScores);
          const one_v_one_consistency_range =
            one_v_one_best_round === null || one_v_one_worst_round === null
              ? null
              : one_v_one_best_round - one_v_one_worst_round;

          const jugglingAttempts: Array<number | null> = [1, 2, 3, 4].map((i) =>
            toFiniteNumber(playerScores?.[`juggling_${i}`])
          );
          const juggle_best = maxOfAll(jugglingAttempts);
          const juggle_best2_sum = sumTop2OfFour(jugglingAttempts);
          const juggle_avg_all = meanOfFour(jugglingAttempts);
          const juggle_total = sumOfAll(jugglingAttempts);
          const juggle_consistency_range = (() => {
            const maxV = maxOfAll(jugglingAttempts);
            const minV = minOfAll(jugglingAttempts);
            if (maxV === null || minV === null) return null;
            return maxV - minV;
          })();

          const skill_moves_count =
            skillMovesCount > 0 ? skillMovesCount : null;
          const skillMoveRatings: Array<number | null> =
            skillMovesCount > 0
              ? Array.from({ length: skillMovesCount }, (_, idx) =>
                  toFiniteNumber(playerScores?.[`skillmove_${idx + 1}`])
                )
              : [];
          const skill_moves_total_rating = sumOfAll(skillMoveRatings);
          const skill_moves_avg_rating = avgOfAll(skillMoveRatings);
          const skill_moves_best_rating = maxOfAll(skillMoveRatings);
          const skill_moves_worst_rating = minOfAll(skillMoveRatings);
          const skill_moves_consistency_range =
            skill_moves_best_rating === null ||
            skill_moves_worst_rating === null
              ? null
              : skill_moves_best_rating - skill_moves_worst_rating;

          const agilityTrials: Array<number | null> = [1, 2, 3].map((i) =>
            toFiniteNumber(playerScores?.[`agility_${i}`])
          );
          const agility_5_10_5_best_time = minOfAll(agilityTrials);
          const agility_5_10_5_avg_time = avgOfAll(agilityTrials);
          const agility_5_10_5_worst_time = maxOfAll(agilityTrials);
          const agility_5_10_5_consistency_range =
            agility_5_10_5_best_time === null ||
            agility_5_10_5_worst_time === null
              ? null
              : agility_5_10_5_worst_time - agility_5_10_5_best_time;

          const reactionTimes: Array<number | null> = [1, 2, 3].map((i) =>
            toFiniteNumber(playerScores?.[`reaction_cue_${i}`])
          );
          const totalTimes: Array<number | null> = [1, 2, 3].map((i) =>
            toFiniteNumber(playerScores?.[`reaction_total_${i}`])
          );
          const reaction_5m_reaction_time_avg = avgOfAll(reactionTimes);
          const reaction_5m_total_time_avg = avgOfAll(totalTimes);

          const reaction_5m_reaction_time_best = minOfAll(reactionTimes);
          const reaction_5m_total_time_best = minOfAll(totalTimes);
          const reaction_5m_reaction_time_worst = maxOfAll(reactionTimes);
          const reaction_5m_total_time_worst = maxOfAll(totalTimes);
          const reaction_5m_reaction_consistency_range =
            reaction_5m_reaction_time_best === null ||
            reaction_5m_reaction_time_worst === null
              ? null
              : reaction_5m_reaction_time_worst -
                reaction_5m_reaction_time_best;
          const reaction_5m_total_consistency_range =
            reaction_5m_total_time_best === null ||
            reaction_5m_total_time_worst === null
              ? null
              : reaction_5m_total_time_worst - reaction_5m_total_time_best;

          const hopLeftTrials: Array<number | null> = [1, 2, 3].map((i) =>
            toFiniteNumber(playerScores?.[`hop_left_${i}`])
          );
          const hopRightTrials: Array<number | null> = [1, 2, 3].map((i) =>
            toFiniteNumber(playerScores?.[`hop_right_${i}`])
          );

          const single_leg_hop_left = maxOfAll(hopLeftTrials);
          const single_leg_hop_right = maxOfAll(hopRightTrials);
          const hopMax = (() => {
            if (single_leg_hop_left === null || single_leg_hop_right === null)
              return null;
            return Math.max(single_leg_hop_left, single_leg_hop_right);
          })();
          const single_leg_hop_asymmetry_pct =
            hopMax === null || hopMax === 0
              ? null
              : (Math.abs(single_leg_hop_left! - single_leg_hop_right!) /
                  hopMax) *
                100;

          const single_leg_hop_left_avg = avgOfAll(hopLeftTrials);
          const single_leg_hop_right_avg = avgOfAll(hopRightTrials);
          const single_leg_hop_left_consistency_range = (() => {
            const maxV = maxOfAll(hopLeftTrials);
            const minV = minOfAll(hopLeftTrials);
            if (maxV === null || minV === null) return null;
            return maxV - minV;
          })();
          const single_leg_hop_right_consistency_range = (() => {
            const maxV = maxOfAll(hopRightTrials);
            const minV = minOfAll(hopRightTrials);
            if (maxV === null || minV === null) return null;
            return maxV - minV;
          })();

          const C10 = toFiniteNumber(playerScores?.jumps_10s);
          const C20 = toFiniteNumber(playerScores?.jumps_20s);
          const C30 = toFiniteNumber(playerScores?.jumps_30s);
          const double_leg_jumps_first10 = C10;
          const double_leg_jumps_total_reps = C30;
          const double_leg_jumps_last10 =
            C30 === null || C20 === null ? null : C30 - C20;
          const double_leg_jumps_dropoff_pct =
            double_leg_jumps_first10 === null ||
            double_leg_jumps_last10 === null ||
            double_leg_jumps_first10 === 0
              ? null
              : ((double_leg_jumps_first10 - double_leg_jumps_last10) /
                  double_leg_jumps_first10) *
                100;

          const double_leg_jumps_mid10 =
            C20 === null || C10 === null ? null : C20 - C10;
          const double_leg_jumps_first20 = C20;
          const double_leg_jumps_last20 =
            C30 === null || C10 === null ? null : C30 - C10;

          const ankle_left_in = toFiniteNumber(playerScores?.ankle_left);
          const ankle_right_in = toFiniteNumber(playerScores?.ankle_right);
          const ankle_dorsiflex_left_cm =
            ankle_left_in === null ? null : ankle_left_in * 2.54;
          const ankle_dorsiflex_right_cm =
            ankle_right_in === null ? null : ankle_right_in * 2.54;
          const ankle_dorsiflex_avg_cm =
            ankle_dorsiflex_left_cm === null ||
            ankle_dorsiflex_right_cm === null
              ? null
              : (ankle_dorsiflex_left_cm + ankle_dorsiflex_right_cm) / 2;
          const ankleMax = (() => {
            if (
              ankle_dorsiflex_left_cm === null ||
              ankle_dorsiflex_right_cm === null
            )
              return null;
            return Math.max(ankle_dorsiflex_left_cm, ankle_dorsiflex_right_cm);
          })();
          const ankle_dorsiflex_asymmetry_pct =
            ankleMax === null || ankleMax === 0
              ? null
              : (Math.abs(
                  ankle_dorsiflex_left_cm! - ankle_dorsiflex_right_cm!
                ) /
                  ankleMax) *
                100;
          const ankle_dorsiflex_left_minus_right_cm =
            ankle_dorsiflex_left_cm === null ||
            ankle_dorsiflex_right_cm === null
              ? null
              : ankle_dorsiflex_left_cm - ankle_dorsiflex_right_cm;

          const core_plank_hold_sec = toFiniteNumber(playerScores?.plank_time);
          const core_plank_form_flag = toFiniteNumber(playerScores?.plank_form);
          const core_plank_hold_sec_if_good_form =
            core_plank_hold_sec === null || core_plank_form_flag === null
              ? null
              : core_plank_form_flag === 1
              ? core_plank_hold_sec
              : 0;

          computedByPlayer[playerId] = {
            birthYear: playersById.get(playerId)?.birthYear ?? null,
            inputs: {
              power: { strong: strongAttempts, weak: weakAttempts },
              serve: { strong: serveStrongAttempts, weak: serveWeakAttempts },
              figure8: {
                strong: figure8_loops_strong,
                weak: figure8_loops_weak,
                both: figure8_loops_both,
              },
              passing: {
                strong: passing_gates_strong_hits,
                weak: passing_gates_weak_hits,
              },
              onevone: { rounds: oneVOneRounds, scores: oneVOneRoundScores },
              juggling: { attempts: jugglingAttempts },
              skillmoves: { count: skillMovesCount, ratings: skillMoveRatings },
              agility: { trials: agilityTrials },
              reaction5m: { reactionTimes, totalTimes },
              hop: { left: hopLeftTrials, right: hopRightTrials },
              plank: {
                holdSec: core_plank_hold_sec,
                formFlag: core_plank_form_flag,
              },
            },
            raw: {
              shot_power_strong_avg,
              shot_power_weak_avg,
              shot_power_strong_max,
              shot_power_weak_max,
              shot_power_weak_to_strong_ratio: safeRatio(
                shot_power_weak_avg,
                shot_power_strong_avg
              ),
              shot_power_asymmetry_pct: safeAsymmetryPct(
                shot_power_strong_avg,
                shot_power_weak_avg
              ),
              shot_power_weak_to_strong_ratio_max: safeRatio(
                shot_power_weak_max,
                shot_power_strong_max
              ),
              shot_power_asymmetry_pct_max: safeAsymmetryPct(
                shot_power_strong_max,
                shot_power_weak_max
              ),

              serve_distance_strong_avg,
              serve_distance_weak_avg,
              serve_distance_strong_max,
              serve_distance_weak_max,
              serve_distance_weak_to_strong_ratio: safeRatio(
                serve_distance_weak_avg,
                serve_distance_strong_avg
              ),
              serve_distance_asymmetry_pct: safeAsymmetryPct(
                serve_distance_strong_avg,
                serve_distance_weak_avg
              ),
              serve_distance_weak_to_strong_ratio_max: safeRatio(
                serve_distance_weak_max,
                serve_distance_strong_max
              ),
              serve_distance_asymmetry_pct_max: safeAsymmetryPct(
                serve_distance_strong_max,
                serve_distance_weak_max
              ),

              figure8_loops_strong,
              figure8_loops_weak,
              figure8_loops_both,
              figure8_weak_to_strong_ratio: safeRatio(
                figure8_loops_weak,
                figure8_loops_strong
              ),
              figure8_both_to_strong_ratio: safeRatio(
                figure8_loops_both,
                figure8_loops_strong
              ),
              figure8_asymmetry_pct: safeAsymmetryPct(
                figure8_loops_strong,
                figure8_loops_weak
              ),

              passing_gates_strong_hits,
              passing_gates_weak_hits,
              passing_gates_total_hits,
              passing_gates_weak_to_strong_ratio: safeRatio(
                passing_gates_weak_hits,
                passing_gates_strong_hits
              ),
              passing_gates_asymmetry_pct: safeAsymmetryPct(
                passing_gates_strong_hits,
                passing_gates_weak_hits
              ),
              passing_gates_weak_share_pct:
                safeRatio(passing_gates_weak_hits, passing_gates_total_hits) ===
                null
                  ? null
                  : safeRatio(
                      passing_gates_weak_hits,
                      passing_gates_total_hits
                    )! * 100,

              one_v_one_rounds_played,
              one_v_one_avg_score,
              one_v_one_total_score,
              one_v_one_best_round,
              one_v_one_worst_round,
              one_v_one_consistency_range,

              juggle_best,
              juggle_best2_sum,
              juggle_avg_all,
              juggle_total,
              juggle_consistency_range,

              skill_moves_count,
              skill_moves_avg_rating,
              skill_moves_total_rating,
              skill_moves_best_rating,
              skill_moves_worst_rating,
              skill_moves_consistency_range,

              agility_5_10_5_best_time,
              agility_5_10_5_avg_time,
              agility_5_10_5_worst_time,
              agility_5_10_5_consistency_range,

              reaction_5m_reaction_time_avg,
              reaction_5m_total_time_avg,
              reaction_5m_reaction_time_best,
              reaction_5m_total_time_best,
              reaction_5m_reaction_time_worst,
              reaction_5m_total_time_worst,
              reaction_5m_reaction_consistency_range,
              reaction_5m_total_consistency_range,

              single_leg_hop_left,
              single_leg_hop_right,
              single_leg_hop_asymmetry_pct,
              single_leg_hop_left_avg,
              single_leg_hop_right_avg,
              single_leg_hop_left_consistency_range,
              single_leg_hop_right_consistency_range,

              double_leg_jumps_first10,
              double_leg_jumps_total_reps,
              double_leg_jumps_last10,
              double_leg_jumps_dropoff_pct,
              double_leg_jumps_mid10,
              double_leg_jumps_first20,
              double_leg_jumps_last20,

              ankle_dorsiflex_left_cm,
              ankle_dorsiflex_right_cm,
              ankle_dorsiflex_avg_cm,
              ankle_dorsiflex_asymmetry_pct,
              ankle_dorsiflex_left_minus_right_cm,

              core_plank_hold_sec,
              core_plank_form_flag,
              core_plank_hold_sec_if_good_form,
            },
            norm: {
              shot_power_strong_avg_norm: null,
              shot_power_weak_avg_norm: null,
              shot_power_strong_max_norm: null,
              shot_power_weak_max_norm: null,

              serve_distance_strong_avg_norm: null,
              serve_distance_weak_avg_norm: null,
              serve_distance_strong_max_norm: null,
              serve_distance_weak_max_norm: null,

              figure8_loops_strong_norm: null,
              figure8_loops_weak_norm: null,
              figure8_loops_both_norm: null,

              passing_gates_strong_hits_norm: null,
              passing_gates_weak_hits_norm: null,
              passing_gates_total_hits_norm: null,

              one_v_one_avg_score_norm:
                one_v_one_avg_score === null
                  ? null
                  : (one_v_one_avg_score - 1) / 2,
              one_v_one_rounds_played_norm: null,

              juggle_best_norm: null,
              juggle_best2_sum_norm: null,
              juggle_avg_all_norm: null,

              skill_moves_avg_rating_norm:
                skill_moves_avg_rating === null
                  ? null
                  : (skill_moves_avg_rating - 1) / 4,
              skill_moves_count_norm: null,

              agility_5_10_5_best_time_norm: null,
              agility_5_10_5_avg_time_norm: null,

              reaction_5m_reaction_time_avg_norm: null,
              reaction_5m_total_time_avg_norm: null,

              single_leg_hop_left_norm: null,
              single_leg_hop_right_norm: null,
              single_leg_hop_asymmetry_pct_norm:
                single_leg_hop_asymmetry_pct === null
                  ? null
                  : clamp01(1 - single_leg_hop_asymmetry_pct / 30),

              double_leg_jumps_first10_norm: null,
              double_leg_jumps_total_reps_norm: null,
              double_leg_jumps_last10_norm: null,
              double_leg_jumps_dropoff_pct_norm:
                double_leg_jumps_dropoff_pct === null
                  ? null
                  : clamp01(1 - double_leg_jumps_dropoff_pct / 60),

              ankle_dorsiflex_left_cm_norm: null,
              ankle_dorsiflex_right_cm_norm: null,
              ankle_dorsiflex_avg_cm_norm: null,
              ankle_dorsiflex_asymmetry_pct_norm:
                ankle_dorsiflex_asymmetry_pct === null
                  ? null
                  : clamp01(1 - ankle_dorsiflex_asymmetry_pct / 30),

              core_plank_hold_sec_norm: null,
              core_plank_form_flag_norm:
                core_plank_form_flag === null ? null : core_plank_form_flag,
            },
          };
        }

        // Cohort min/max by birth year (TEAM-WIDE across all team evaluations)
        const cohortStats = teamWideCohortStats;

        for (const row of Object.values(computedByPlayer) as any[]) {
          const by: number | null = row.birthYear;
          if (!by) continue;
          const stats = cohortStats.get(by);
          if (!stats) continue;
          row.norm.shot_power_strong_avg_norm = minMaxNormalize(
            row.raw.shot_power_strong_avg,
            stats.shot_power_strong_avg.min,
            stats.shot_power_strong_avg.max
          );
          row.norm.shot_power_weak_avg_norm = minMaxNormalize(
            row.raw.shot_power_weak_avg,
            stats.shot_power_weak_avg.min,
            stats.shot_power_weak_avg.max
          );
          row.norm.shot_power_strong_max_norm = minMaxNormalize(
            row.raw.shot_power_strong_max,
            stats.shot_power_strong_max.min,
            stats.shot_power_strong_max.max
          );
          row.norm.shot_power_weak_max_norm = minMaxNormalize(
            row.raw.shot_power_weak_max,
            stats.shot_power_weak_max.min,
            stats.shot_power_weak_max.max
          );

          row.norm.serve_distance_strong_avg_norm = minMaxNormalize(
            row.raw.serve_distance_strong_avg,
            stats.serve_distance_strong_avg.min,
            stats.serve_distance_strong_avg.max
          );
          row.norm.serve_distance_weak_avg_norm = minMaxNormalize(
            row.raw.serve_distance_weak_avg,
            stats.serve_distance_weak_avg.min,
            stats.serve_distance_weak_avg.max
          );
          row.norm.serve_distance_strong_max_norm = minMaxNormalize(
            row.raw.serve_distance_strong_max,
            stats.serve_distance_strong_max.min,
            stats.serve_distance_strong_max.max
          );
          row.norm.serve_distance_weak_max_norm = minMaxNormalize(
            row.raw.serve_distance_weak_max,
            stats.serve_distance_weak_max.min,
            stats.serve_distance_weak_max.max
          );

          row.norm.figure8_loops_strong_norm = minMaxNormalize(
            row.raw.figure8_loops_strong,
            stats.figure8_loops_strong.min,
            stats.figure8_loops_strong.max
          );
          row.norm.figure8_loops_weak_norm = minMaxNormalize(
            row.raw.figure8_loops_weak,
            stats.figure8_loops_weak.min,
            stats.figure8_loops_weak.max
          );
          row.norm.figure8_loops_both_norm = minMaxNormalize(
            row.raw.figure8_loops_both,
            stats.figure8_loops_both.min,
            stats.figure8_loops_both.max
          );

          row.norm.passing_gates_strong_hits_norm = minMaxNormalize(
            row.raw.passing_gates_strong_hits,
            stats.passing_gates_strong_hits.min,
            stats.passing_gates_strong_hits.max
          );
          row.norm.passing_gates_weak_hits_norm = minMaxNormalize(
            row.raw.passing_gates_weak_hits,
            stats.passing_gates_weak_hits.min,
            stats.passing_gates_weak_hits.max
          );
          row.norm.passing_gates_total_hits_norm = minMaxNormalize(
            row.raw.passing_gates_total_hits,
            stats.passing_gates_total_hits.min,
            stats.passing_gates_total_hits.max
          );

          row.norm.one_v_one_rounds_played_norm = minMaxNormalize(
            row.raw.one_v_one_rounds_played,
            stats.one_v_one_rounds_played.min,
            stats.one_v_one_rounds_played.max
          );

          row.norm.juggle_best_norm = minMaxNormalize(
            row.raw.juggle_best,
            stats.juggle_best.min,
            stats.juggle_best.max
          );
          row.norm.juggle_best2_sum_norm = minMaxNormalize(
            row.raw.juggle_best2_sum,
            stats.juggle_best2_sum.min,
            stats.juggle_best2_sum.max
          );
          row.norm.juggle_avg_all_norm = minMaxNormalize(
            row.raw.juggle_avg_all,
            stats.juggle_avg_all.min,
            stats.juggle_avg_all.max
          );

          row.norm.skill_moves_count_norm = minMaxNormalize(
            row.raw.skill_moves_count,
            stats.skill_moves_count.min,
            stats.skill_moves_count.max
          );

          row.norm.agility_5_10_5_best_time_norm = minMaxNormalizeLowerBetter(
            row.raw.agility_5_10_5_best_time,
            stats.agility_5_10_5_best_time.min,
            stats.agility_5_10_5_best_time.max
          );
          row.norm.agility_5_10_5_avg_time_norm = minMaxNormalizeLowerBetter(
            row.raw.agility_5_10_5_avg_time,
            stats.agility_5_10_5_avg_time.min,
            stats.agility_5_10_5_avg_time.max
          );

          row.norm.reaction_5m_reaction_time_avg_norm =
            minMaxNormalizeLowerBetter(
              row.raw.reaction_5m_reaction_time_avg,
              stats.reaction_5m_reaction_time_avg.min,
              stats.reaction_5m_reaction_time_avg.max
            );
          row.norm.reaction_5m_total_time_avg_norm = minMaxNormalizeLowerBetter(
            row.raw.reaction_5m_total_time_avg,
            stats.reaction_5m_total_time_avg.min,
            stats.reaction_5m_total_time_avg.max
          );

          row.norm.single_leg_hop_left_norm = minMaxNormalize(
            row.raw.single_leg_hop_left,
            stats.single_leg_hop_left.min,
            stats.single_leg_hop_left.max
          );
          row.norm.single_leg_hop_right_norm = minMaxNormalize(
            row.raw.single_leg_hop_right,
            stats.single_leg_hop_right.min,
            stats.single_leg_hop_right.max
          );

          row.norm.double_leg_jumps_first10_norm = minMaxNormalize(
            row.raw.double_leg_jumps_first10,
            stats.double_leg_jumps_first10.min,
            stats.double_leg_jumps_first10.max
          );
          row.norm.double_leg_jumps_total_reps_norm = minMaxNormalize(
            row.raw.double_leg_jumps_total_reps,
            stats.double_leg_jumps_total_reps.min,
            stats.double_leg_jumps_total_reps.max
          );
          row.norm.double_leg_jumps_last10_norm = minMaxNormalize(
            row.raw.double_leg_jumps_last10,
            stats.double_leg_jumps_last10.min,
            stats.double_leg_jumps_last10.max
          );

          row.norm.ankle_dorsiflex_left_cm_norm = minMaxNormalize(
            row.raw.ankle_dorsiflex_left_cm,
            stats.ankle_dorsiflex_left_cm.min,
            stats.ankle_dorsiflex_left_cm.max
          );
          row.norm.ankle_dorsiflex_right_cm_norm = minMaxNormalize(
            row.raw.ankle_dorsiflex_right_cm,
            stats.ankle_dorsiflex_right_cm.min,
            stats.ankle_dorsiflex_right_cm.max
          );
          row.norm.ankle_dorsiflex_avg_cm_norm = minMaxNormalize(
            row.raw.ankle_dorsiflex_avg_cm,
            stats.ankle_dorsiflex_avg_cm.min,
            stats.ankle_dorsiflex_avg_cm.max
          );

          row.norm.core_plank_hold_sec_norm = minMaxNormalize(
            row.raw.core_plank_hold_sec,
            stats.core_plank_hold_sec.min,
            stats.core_plank_hold_sec.max
          );
        }

        console.log("[compute-all][shot-power] evaluation:", evaluationId);
        console.log(
          "[compute-all][shot-power] cohortStats:",
          Object.fromEntries(cohortStats)
        );
        console.log(
          "[compute-all][shot-power] computedByPlayer:",
          computedByPlayer
        );

        console.log("[compute-all][serve-distance] evaluation:", evaluationId);
        console.log(
          "[compute-all][serve-distance] cohortStats:",
          Object.fromEntries(cohortStats)
        );
        console.log(
          "[compute-all][serve-distance] computedByPlayer:",
          computedByPlayer
        );
        console.log("[compute-all][figure8] evaluation:", evaluationId);
        console.log(
          "[compute-all][figure8] cohortStats:",
          Object.fromEntries(cohortStats)
        );
        console.log(
          "[compute-all][figure8] computedByPlayer:",
          computedByPlayer
        );
        console.log("[compute-all][passing-gates] evaluation:", evaluationId);
        console.log(
          "[compute-all][passing-gates] cohortStats:",
          Object.fromEntries(cohortStats)
        );
        console.log(
          "[compute-all][passing-gates] computedByPlayer:",
          computedByPlayer
        );
        console.log("[compute-all][one-v-one] evaluation:", evaluationId);
        console.log(
          "[compute-all][one-v-one] cohortStats:",
          Object.fromEntries(cohortStats)
        );
        console.log(
          "[compute-all][one-v-one] computedByPlayer:",
          computedByPlayer
        );
        console.log("[compute-all][juggling] evaluation:", evaluationId);
        console.log(
          "[compute-all][juggling] cohortStats:",
          Object.fromEntries(cohortStats)
        );
        console.log(
          "[compute-all][juggling] computedByPlayer:",
          computedByPlayer
        );
        console.log("[compute-all][skill-moves] evaluation:", evaluationId);
        console.log(
          "[compute-all][skill-moves] cohortStats:",
          Object.fromEntries(cohortStats)
        );
        console.log(
          "[compute-all][skill-moves] computedByPlayer:",
          computedByPlayer
        );
        console.log("[compute-all][agility-5-10-5] evaluation:", evaluationId);
        console.log(
          "[compute-all][agility-5-10-5] cohortStats:",
          Object.fromEntries(cohortStats)
        );
        console.log(
          "[compute-all][agility-5-10-5] computedByPlayer:",
          computedByPlayer
        );
        console.log("[compute-all][reaction-5m] evaluation:", evaluationId);
        console.log(
          "[compute-all][reaction-5m] cohortStats:",
          Object.fromEntries(cohortStats)
        );
        console.log(
          "[compute-all][reaction-5m] computedByPlayer:",
          computedByPlayer
        );
        console.log("[compute-all][single-leg-hop] evaluation:", evaluationId);
        console.log(
          "[compute-all][single-leg-hop] cohortStats:",
          Object.fromEntries(cohortStats)
        );
        console.log(
          "[compute-all][single-leg-hop] computedByPlayer:",
          computedByPlayer
        );
        console.log(
          "[compute-all][double-leg-jumps] evaluation:",
          evaluationId
        );
        console.log(
          "[compute-all][double-leg-jumps] cohortStats:",
          Object.fromEntries(cohortStats)
        );
        console.log(
          "[compute-all][double-leg-jumps] computedByPlayer:",
          computedByPlayer
        );
        console.log(
          "[compute-all][ankle-dorsiflexion] evaluation:",
          evaluationId
        );
        console.log(
          "[compute-all][ankle-dorsiflexion] cohortStats:",
          Object.fromEntries(cohortStats)
        );
        console.log(
          "[compute-all][ankle-dorsiflexion] computedByPlayer:",
          computedByPlayer
        );
        console.log("[compute-all][core-plank] evaluation:", evaluationId);
        console.log(
          "[compute-all][core-plank] cohortStats:",
          Object.fromEntries(cohortStats)
        );
        console.log(
          "[compute-all][core-plank] computedByPlayer:",
          computedByPlayer
        );

        // Calculate Power Strength (PS) for each player
        console.log("[compute-all][PS] evaluation:", evaluationId);
        console.log(
          "[compute-all][PS] Starting Power Strength calculations..."
        );

        const psResults: Record<string, any> = {};

        for (const [playerId, row] of Object.entries(computedByPlayer)) {
          const playerName =
            playersById.get(playerId)?.name ?? "Unknown Player";
          const norm = (row as any).norm;

          console.log(`[compute-all][PS] Player: ${playerName} (${playerId})`);

          // PS definition (matches your hand math):
          // numerator   = Σ(featureValue * testWeight)
          // denominator = Σ(testWeight counted once per feature) = Σ(featureCount * testWeight)

          // Test 1: Shot Power (weight = 3)
          const test1Values = [
            norm.shot_power_strong_avg_norm,
            norm.shot_power_weak_avg_norm,
            norm.shot_power_strong_max_norm,
            norm.shot_power_weak_max_norm,
          ].filter((v): v is number => v !== null && typeof v === "number");
          const test1Sum = test1Values.reduce((sum, v) => sum + v, 0);
          const test1Weight = 3;
          const test1WeightedContribution = test1Sum * test1Weight;
          const test1DenominatorWeight = test1Values.length * test1Weight;
          console.log(
            `[compute-all][PS] Test 1 (Shot Power): values=${JSON.stringify(
              test1Values
            )}, sum=${test1Sum.toFixed(
              6
            )}, weight=${test1Weight}, contribution=${test1WeightedContribution.toFixed(
              6
            )}, denomWeight=${test1DenominatorWeight}`
          );

          // Test 2: Serve Distance (weight = 3)
          const test2Values = [
            norm.serve_distance_strong_avg_norm,
            norm.serve_distance_weak_avg_norm,
            norm.serve_distance_strong_max_norm,
            norm.serve_distance_weak_max_norm,
          ].filter((v): v is number => v !== null && typeof v === "number");
          const test2Sum = test2Values.reduce((sum, v) => sum + v, 0);
          const test2Weight = 3;
          const test2WeightedContribution = test2Sum * test2Weight;
          const test2DenominatorWeight = test2Values.length * test2Weight;
          console.log(
            `[compute-all][PS] Test 2 (Serve Distance): values=${JSON.stringify(
              test2Values
            )}, sum=${test2Sum.toFixed(
              6
            )}, weight=${test2Weight}, contribution=${test2WeightedContribution.toFixed(
              6
            )}, denomWeight=${test2DenominatorWeight}`
          );

          // Test 5: 1v1 Competitive Score (weight = 1)
          const test5Values = [
            norm.one_v_one_avg_score_norm,
            norm.one_v_one_rounds_played_norm,
          ].filter((v): v is number => v !== null && typeof v === "number");
          const test5Sum = test5Values.reduce((sum, v) => sum + v, 0);
          const test5Weight = 1;
          const test5WeightedContribution = test5Sum * test5Weight;
          const test5DenominatorWeight = test5Values.length * test5Weight;
          console.log(
            `[compute-all][PS] Test 5 (1v1 Competitive Score): values=${JSON.stringify(
              test5Values
            )}, sum=${test5Sum.toFixed(
              6
            )}, weight=${test5Weight}, contribution=${test5WeightedContribution.toFixed(
              6
            )}, denomWeight=${test5DenominatorWeight}`
          );

          // Test 8: 5-10-5 Pro Agility (weight = 2)
          const test8Values = [
            norm.agility_5_10_5_best_time_norm,
            norm.agility_5_10_5_avg_time_norm,
          ].filter((v): v is number => v !== null && typeof v === "number");
          const test8Sum = test8Values.reduce((sum, v) => sum + v, 0);
          const test8Weight = 2;
          const test8WeightedContribution = test8Sum * test8Weight;
          const test8DenominatorWeight = test8Values.length * test8Weight;
          console.log(
            `[compute-all][PS] Test 8 (5-10-5 Pro Agility): values=${JSON.stringify(
              test8Values
            )}, sum=${test8Sum.toFixed(
              6
            )}, weight=${test8Weight}, contribution=${test8WeightedContribution.toFixed(
              6
            )}, denomWeight=${test8DenominatorWeight}`
          );

          // Test 9: Reaction Test 5m Start (weight = 1)
          const test9Values = [
            norm.reaction_5m_reaction_time_avg_norm,
            norm.reaction_5m_total_time_avg_norm,
          ].filter((v): v is number => v !== null && typeof v === "number");
          const test9Sum = test9Values.reduce((sum, v) => sum + v, 0);
          const test9Weight = 1;
          const test9WeightedContribution = test9Sum * test9Weight;
          const test9DenominatorWeight = test9Values.length * test9Weight;
          console.log(
            `[compute-all][PS] Test 9 (Reaction Test 5m Start): values=${JSON.stringify(
              test9Values
            )}, sum=${test9Sum.toFixed(
              6
            )}, weight=${test9Weight}, contribution=${test9WeightedContribution.toFixed(
              6
            )}, denomWeight=${test9DenominatorWeight}`
          );

          // Test 10: Single Leg Hop L/R (weight = 2)
          const test10Values = [
            norm.single_leg_hop_left_norm,
            norm.single_leg_hop_right_norm,
            norm.single_leg_hop_asymmetry_pct_norm,
          ].filter((v): v is number => v !== null && typeof v === "number");
          const test10Sum = test10Values.reduce((sum, v) => sum + v, 0);
          const test10Weight = 2;
          const test10WeightedContribution = test10Sum * test10Weight;
          const test10DenominatorWeight = test10Values.length * test10Weight;
          console.log(
            `[compute-all][PS] Test 10 (Single Leg Hop L/R): values=${JSON.stringify(
              test10Values
            )}, sum=${test10Sum.toFixed(
              6
            )}, weight=${test10Weight}, contribution=${test10WeightedContribution.toFixed(
              6
            )}, denomWeight=${test10DenominatorWeight}`
          );

          // Test 11: Double Leg Jump Endure (weight = 3)
          const test11Values = [
            norm.double_leg_jumps_total_reps_norm,
            norm.double_leg_jumps_first10_norm,
            norm.double_leg_jumps_last10_norm,
            norm.double_leg_jumps_dropoff_pct_norm,
          ].filter((v): v is number => v !== null && typeof v === "number");
          const test11Sum = test11Values.reduce((sum, v) => sum + v, 0);
          const test11Weight = 3;
          const test11WeightedContribution = test11Sum * test11Weight;
          const test11DenominatorWeight = test11Values.length * test11Weight;
          console.log(
            `[compute-all][PS] Test 11 (Double Leg Jump Endure): values=${JSON.stringify(
              test11Values
            )}, sum=${test11Sum.toFixed(
              6
            )}, weight=${test11Weight}, contribution=${test11WeightedContribution.toFixed(
              6
            )}, denomWeight=${test11DenominatorWeight}`
          );

          // Test 13: Core Endurance Plank (weight = 2)
          const test13Values = [
            norm.core_plank_hold_sec_norm,
            norm.core_plank_form_flag_norm,
          ].filter((v): v is number => v !== null && typeof v === "number");
          const test13Sum = test13Values.reduce((sum, v) => sum + v, 0);
          const test13Weight = 2;
          const test13WeightedContribution = test13Sum * test13Weight;
          const test13DenominatorWeight = test13Values.length * test13Weight;
          console.log(
            `[compute-all][PS] Test 13 (Core Endurance Plank): values=${JSON.stringify(
              test13Values
            )}, sum=${test13Sum.toFixed(
              6
            )}, weight=${test13Weight}, contribution=${test13WeightedContribution.toFixed(
              6
            )}, denomWeight=${test13DenominatorWeight}`
          );

          // Calculate total weighted contributions and total weights (feature-weighted denominator)
          const totalWeightedContributions =
            test1WeightedContribution +
            test2WeightedContribution +
            test5WeightedContribution +
            test8WeightedContribution +
            test9WeightedContribution +
            test10WeightedContribution +
            test11WeightedContribution +
            test13WeightedContribution;

          const totalWeights =
            test1DenominatorWeight +
            test2DenominatorWeight +
            test5DenominatorWeight +
            test8DenominatorWeight +
            test9DenominatorWeight +
            test10DenominatorWeight +
            test11DenominatorWeight +
            test13DenominatorWeight;

          // Calculate PS score (0-1)
          const psScore =
            totalWeights > 0 ? totalWeightedContributions / totalWeights : null;

          console.log(
            `[compute-all][PS] ${playerName}: totalWeightedContributions=${totalWeightedContributions.toFixed(
              6
            )}, totalWeights=${totalWeights}, PS=${
              psScore !== null ? psScore.toFixed(4) : "null"
            }`
          );

          psResults[playerId] = {
            playerName,
            psScore,
            testContributions: {
              test1: {
                sum: test1Sum,
                featureCount: test1Values.length,
                weight: test1Weight,
                contribution: test1WeightedContribution,
                denomWeight: test1DenominatorWeight,
              },
              test2: {
                sum: test2Sum,
                featureCount: test2Values.length,
                weight: test2Weight,
                contribution: test2WeightedContribution,
                denomWeight: test2DenominatorWeight,
              },
              test5: {
                sum: test5Sum,
                featureCount: test5Values.length,
                weight: test5Weight,
                contribution: test5WeightedContribution,
                denomWeight: test5DenominatorWeight,
              },
              test8: {
                sum: test8Sum,
                featureCount: test8Values.length,
                weight: test8Weight,
                contribution: test8WeightedContribution,
                denomWeight: test8DenominatorWeight,
              },
              test9: {
                sum: test9Sum,
                featureCount: test9Values.length,
                weight: test9Weight,
                contribution: test9WeightedContribution,
                denomWeight: test9DenominatorWeight,
              },
              test10: {
                sum: test10Sum,
                featureCount: test10Values.length,
                weight: test10Weight,
                contribution: test10WeightedContribution,
                denomWeight: test10DenominatorWeight,
              },
              test11: {
                sum: test11Sum,
                featureCount: test11Values.length,
                weight: test11Weight,
                contribution: test11WeightedContribution,
                denomWeight: test11DenominatorWeight,
              },
              test13: {
                sum: test13Sum,
                featureCount: test13Values.length,
                weight: test13Weight,
                contribution: test13WeightedContribution,
                denomWeight: test13DenominatorWeight,
              },
            },
            totalWeightedContributions,
            totalWeights,
          };
        }

        console.log("[compute-all][PS] All PS calculations complete:");
        console.log("[compute-all][PS] Results:", psResults);

        // Calculate Technique / Control (TC) for each player (2nd index of 4D cluster vector)
        console.log("[compute-all][TC] evaluation:", evaluationId);
        console.log(
          "[compute-all][TC] Starting Technique / Control calculations..."
        );

        const tcResults: Record<string, any> = {};

        for (const [playerId, row] of Object.entries(computedByPlayer)) {
          const playerName =
            playersById.get(playerId)?.name ?? "Unknown Player";
          const norm = (row as any).norm;

          console.log(`[compute-all][TC] Player: ${playerName} (${playerId})`);

          // TC definition (same style as PS):
          // numerator   = Σ(featureValue * testWeight)
          // denominator = Σ(featureCount * testWeight)

          // Test 1: Shot Power (weight = 1)
          const tcTest1Values = [
            norm.shot_power_strong_avg_norm,
            norm.shot_power_weak_avg_norm,
            norm.shot_power_strong_max_norm,
            norm.shot_power_weak_max_norm,
          ].filter((v): v is number => v !== null && typeof v === "number");
          const tcTest1Sum = tcTest1Values.reduce((sum, v) => sum + v, 0);
          const tcTest1Weight = 1;
          const tcTest1Contribution = tcTest1Sum * tcTest1Weight;
          const tcTest1DenomWeight = tcTest1Values.length * tcTest1Weight;
          console.log(
            `[compute-all][TC] Test 1 (Shot Power): values=${JSON.stringify(
              tcTest1Values
            )}, sum=${tcTest1Sum.toFixed(
              6
            )}, weight=${tcTest1Weight}, contribution=${tcTest1Contribution.toFixed(
              6
            )}, denomWeight=${tcTest1DenomWeight}`
          );

          // Test 2: Serve Distance (weight = 1)
          const tcTest2Values = [
            norm.serve_distance_strong_avg_norm,
            norm.serve_distance_weak_avg_norm,
            norm.serve_distance_strong_max_norm,
            norm.serve_distance_weak_max_norm,
          ].filter((v): v is number => v !== null && typeof v === "number");
          const tcTest2Sum = tcTest2Values.reduce((sum, v) => sum + v, 0);
          const tcTest2Weight = 1;
          const tcTest2Contribution = tcTest2Sum * tcTest2Weight;
          const tcTest2DenomWeight = tcTest2Values.length * tcTest2Weight;
          console.log(
            `[compute-all][TC] Test 2 (Serve Distance): values=${JSON.stringify(
              tcTest2Values
            )}, sum=${tcTest2Sum.toFixed(
              6
            )}, weight=${tcTest2Weight}, contribution=${tcTest2Contribution.toFixed(
              6
            )}, denomWeight=${tcTest2DenomWeight}`
          );

          // Test 3: Figure 8 Dribble (weight = 3)
          const tcTest3Values = [
            norm.figure8_loops_strong_norm,
            norm.figure8_loops_weak_norm,
            norm.figure8_loops_both_norm,
          ].filter((v): v is number => v !== null && typeof v === "number");
          const tcTest3Sum = tcTest3Values.reduce((sum, v) => sum + v, 0);
          const tcTest3Weight = 3;
          const tcTest3Contribution = tcTest3Sum * tcTest3Weight;
          const tcTest3DenomWeight = tcTest3Values.length * tcTest3Weight;
          console.log(
            `[compute-all][TC] Test 3 (Figure 8 Dribble): values=${JSON.stringify(
              tcTest3Values
            )}, sum=${tcTest3Sum.toFixed(
              6
            )}, weight=${tcTest3Weight}, contribution=${tcTest3Contribution.toFixed(
              6
            )}, denomWeight=${tcTest3DenomWeight}`
          );

          // Test 4: Passing Gates (weight = 3)
          const tcTest4Values = [
            norm.passing_gates_strong_hits_norm,
            norm.passing_gates_weak_hits_norm,
            norm.passing_gates_total_hits_norm,
          ].filter((v): v is number => v !== null && typeof v === "number");
          const tcTest4Sum = tcTest4Values.reduce((sum, v) => sum + v, 0);
          const tcTest4Weight = 3;
          const tcTest4Contribution = tcTest4Sum * tcTest4Weight;
          const tcTest4DenomWeight = tcTest4Values.length * tcTest4Weight;
          console.log(
            `[compute-all][TC] Test 4 (Passing Gates): values=${JSON.stringify(
              tcTest4Values
            )}, sum=${tcTest4Sum.toFixed(
              6
            )}, weight=${tcTest4Weight}, contribution=${tcTest4Contribution.toFixed(
              6
            )}, denomWeight=${tcTest4DenomWeight}`
          );

          // Test 5: 1v1 Competitive Score (weight = 2)
          const tcTest5Values = [
            norm.one_v_one_avg_score_norm,
            norm.one_v_one_rounds_played_norm,
          ].filter((v): v is number => v !== null && typeof v === "number");
          const tcTest5Sum = tcTest5Values.reduce((sum, v) => sum + v, 0);
          const tcTest5Weight = 2;
          const tcTest5Contribution = tcTest5Sum * tcTest5Weight;
          const tcTest5DenomWeight = tcTest5Values.length * tcTest5Weight;
          console.log(
            `[compute-all][TC] Test 5 (1v1 Competitive Score): values=${JSON.stringify(
              tcTest5Values
            )}, sum=${tcTest5Sum.toFixed(
              6
            )}, weight=${tcTest5Weight}, contribution=${tcTest5Contribution.toFixed(
              6
            )}, denomWeight=${tcTest5DenomWeight}`
          );

          // Test 6: Juggling Control (weight = 3)
          const tcTest6Values = [
            norm.juggle_best_norm,
            norm.juggle_best2_sum_norm,
            norm.juggle_avg_all_norm,
          ].filter((v): v is number => v !== null && typeof v === "number");
          const tcTest6Sum = tcTest6Values.reduce((sum, v) => sum + v, 0);
          const tcTest6Weight = 3;
          const tcTest6Contribution = tcTest6Sum * tcTest6Weight;
          const tcTest6DenomWeight = tcTest6Values.length * tcTest6Weight;
          console.log(
            `[compute-all][TC] Test 6 (Juggling Control): values=${JSON.stringify(
              tcTest6Values
            )}, sum=${tcTest6Sum.toFixed(
              6
            )}, weight=${tcTest6Weight}, contribution=${tcTest6Contribution.toFixed(
              6
            )}, denomWeight=${tcTest6DenomWeight}`
          );

          // Test 7: Skill Moves Rating (weight = 3)
          const tcTest7Values = [
            norm.skill_moves_avg_rating_norm,
            norm.skill_moves_count_norm,
          ].filter((v): v is number => v !== null && typeof v === "number");
          const tcTest7Sum = tcTest7Values.reduce((sum, v) => sum + v, 0);
          const tcTest7Weight = 3;
          const tcTest7Contribution = tcTest7Sum * tcTest7Weight;
          const tcTest7DenomWeight = tcTest7Values.length * tcTest7Weight;
          console.log(
            `[compute-all][TC] Test 7 (Skill Moves Rating): values=${JSON.stringify(
              tcTest7Values
            )}, sum=${tcTest7Sum.toFixed(
              6
            )}, weight=${tcTest7Weight}, contribution=${tcTest7Contribution.toFixed(
              6
            )}, denomWeight=${tcTest7DenomWeight}`
          );

          // Test 12: Ankle Dorsiflexion (weight = 1)
          const tcTest12Values = [
            norm.ankle_dorsiflex_left_cm_norm,
            norm.ankle_dorsiflex_right_cm_norm,
            norm.ankle_dorsiflex_avg_cm_norm,
            norm.ankle_dorsiflex_asymmetry_pct_norm,
          ].filter((v): v is number => v !== null && typeof v === "number");
          const tcTest12Sum = tcTest12Values.reduce((sum, v) => sum + v, 0);
          const tcTest12Weight = 1;
          const tcTest12Contribution = tcTest12Sum * tcTest12Weight;
          const tcTest12DenomWeight = tcTest12Values.length * tcTest12Weight;
          console.log(
            `[compute-all][TC] Test 12 (Ankle Dorsiflexion): values=${JSON.stringify(
              tcTest12Values
            )}, sum=${tcTest12Sum.toFixed(
              6
            )}, weight=${tcTest12Weight}, contribution=${tcTest12Contribution.toFixed(
              6
            )}, denomWeight=${tcTest12DenomWeight}`
          );

          const tcTotalWeightedContributions =
            tcTest1Contribution +
            tcTest2Contribution +
            tcTest3Contribution +
            tcTest4Contribution +
            tcTest5Contribution +
            tcTest6Contribution +
            tcTest7Contribution +
            tcTest12Contribution;

          const tcTotalWeights =
            tcTest1DenomWeight +
            tcTest2DenomWeight +
            tcTest3DenomWeight +
            tcTest4DenomWeight +
            tcTest5DenomWeight +
            tcTest6DenomWeight +
            tcTest7DenomWeight +
            tcTest12DenomWeight;

          const tcScore =
            tcTotalWeights > 0
              ? tcTotalWeightedContributions / tcTotalWeights
              : null;

          console.log(
            `[compute-all][TC] ${playerName}: totalWeightedContributions=${tcTotalWeightedContributions.toFixed(
              6
            )}, totalWeights=${tcTotalWeights}, TC=${
              tcScore !== null ? tcScore.toFixed(4) : "null"
            }`
          );

          tcResults[playerId] = {
            playerName,
            tcScore,
            testContributions: {
              test1: {
                sum: tcTest1Sum,
                featureCount: tcTest1Values.length,
                weight: tcTest1Weight,
                contribution: tcTest1Contribution,
                denomWeight: tcTest1DenomWeight,
              },
              test2: {
                sum: tcTest2Sum,
                featureCount: tcTest2Values.length,
                weight: tcTest2Weight,
                contribution: tcTest2Contribution,
                denomWeight: tcTest2DenomWeight,
              },
              test3: {
                sum: tcTest3Sum,
                featureCount: tcTest3Values.length,
                weight: tcTest3Weight,
                contribution: tcTest3Contribution,
                denomWeight: tcTest3DenomWeight,
              },
              test4: {
                sum: tcTest4Sum,
                featureCount: tcTest4Values.length,
                weight: tcTest4Weight,
                contribution: tcTest4Contribution,
                denomWeight: tcTest4DenomWeight,
              },
              test5: {
                sum: tcTest5Sum,
                featureCount: tcTest5Values.length,
                weight: tcTest5Weight,
                contribution: tcTest5Contribution,
                denomWeight: tcTest5DenomWeight,
              },
              test6: {
                sum: tcTest6Sum,
                featureCount: tcTest6Values.length,
                weight: tcTest6Weight,
                contribution: tcTest6Contribution,
                denomWeight: tcTest6DenomWeight,
              },
              test7: {
                sum: tcTest7Sum,
                featureCount: tcTest7Values.length,
                weight: tcTest7Weight,
                contribution: tcTest7Contribution,
                denomWeight: tcTest7DenomWeight,
              },
              test12: {
                sum: tcTest12Sum,
                featureCount: tcTest12Values.length,
                weight: tcTest12Weight,
                contribution: tcTest12Contribution,
                denomWeight: tcTest12DenomWeight,
              },
            },
            totalWeightedContributions: tcTotalWeightedContributions,
            totalWeights: tcTotalWeights,
          };
        }

        console.log("[compute-all][TC] All TC calculations complete:");
        console.log("[compute-all][TC] Results:", tcResults);

        // Calculate Mobility / Stability (MS) for each player (3rd index of 4D cluster vector)
        console.log("[compute-all][MS] evaluation:", evaluationId);
        console.log(
          "[compute-all][MS] Starting Mobility / Stability calculations..."
        );

        const msResults: Record<string, any> = {};

        for (const [playerId, row] of Object.entries(computedByPlayer)) {
          const playerName =
            playersById.get(playerId)?.name ?? "Unknown Player";
          const norm = (row as any).norm;

          console.log(`[compute-all][MS] Player: ${playerName} (${playerId})`);

          // MS definition (same style as PS/TC):
          // numerator   = Σ(featureValue * testWeight)
          // denominator = Σ(featureCount * testWeight)

          // Test 2: Serve Distance (weight = 2)
          const msTest2Values = [
            norm.serve_distance_strong_avg_norm,
            norm.serve_distance_weak_avg_norm,
            norm.serve_distance_strong_max_norm,
            norm.serve_distance_weak_max_norm,
          ].filter((v): v is number => v !== null && typeof v === "number");
          const msTest2Sum = msTest2Values.reduce((sum, v) => sum + v, 0);
          const msTest2Weight = 2;
          const msTest2Contribution = msTest2Sum * msTest2Weight;
          const msTest2DenomWeight = msTest2Values.length * msTest2Weight;
          console.log(
            `[compute-all][MS] Test 2 (Serve Distance): values=${JSON.stringify(
              msTest2Values
            )}, sum=${msTest2Sum.toFixed(
              6
            )}, weight=${msTest2Weight}, contribution=${msTest2Contribution.toFixed(
              6
            )}, denomWeight=${msTest2DenomWeight}`
          );

          // Test 3: Figure 8 Dribble (weight = 2)
          const msTest3Values = [
            norm.figure8_loops_strong_norm,
            norm.figure8_loops_weak_norm,
            norm.figure8_loops_both_norm,
          ].filter((v): v is number => v !== null && typeof v === "number");
          const msTest3Sum = msTest3Values.reduce((sum, v) => sum + v, 0);
          const msTest3Weight = 2;
          const msTest3Contribution = msTest3Sum * msTest3Weight;
          const msTest3DenomWeight = msTest3Values.length * msTest3Weight;
          console.log(
            `[compute-all][MS] Test 3 (Figure 8 Dribble): values=${JSON.stringify(
              msTest3Values
            )}, sum=${msTest3Sum.toFixed(
              6
            )}, weight=${msTest3Weight}, contribution=${msTest3Contribution.toFixed(
              6
            )}, denomWeight=${msTest3DenomWeight}`
          );

          // Test 4: Passing Gates (weight = 1)
          const msTest4Values = [
            norm.passing_gates_strong_hits_norm,
            norm.passing_gates_weak_hits_norm,
            norm.passing_gates_total_hits_norm,
          ].filter((v): v is number => v !== null && typeof v === "number");
          const msTest4Sum = msTest4Values.reduce((sum, v) => sum + v, 0);
          const msTest4Weight = 1;
          const msTest4Contribution = msTest4Sum * msTest4Weight;
          const msTest4DenomWeight = msTest4Values.length * msTest4Weight;
          console.log(
            `[compute-all][MS] Test 4 (Passing Gates): values=${JSON.stringify(
              msTest4Values
            )}, sum=${msTest4Sum.toFixed(
              6
            )}, weight=${msTest4Weight}, contribution=${msTest4Contribution.toFixed(
              6
            )}, denomWeight=${msTest4DenomWeight}`
          );

          // Test 5: 1v1 Competitive Score (weight = 2)
          const msTest5Values = [
            norm.one_v_one_avg_score_norm,
            norm.one_v_one_rounds_played_norm,
          ].filter((v): v is number => v !== null && typeof v === "number");
          const msTest5Sum = msTest5Values.reduce((sum, v) => sum + v, 0);
          const msTest5Weight = 2;
          const msTest5Contribution = msTest5Sum * msTest5Weight;
          const msTest5DenomWeight = msTest5Values.length * msTest5Weight;
          console.log(
            `[compute-all][MS] Test 5 (1v1 Competitive Score): values=${JSON.stringify(
              msTest5Values
            )}, sum=${msTest5Sum.toFixed(
              6
            )}, weight=${msTest5Weight}, contribution=${msTest5Contribution.toFixed(
              6
            )}, denomWeight=${msTest5DenomWeight}`
          );

          // Test 6: Juggling Control (weight = 1)
          const msTest6Values = [
            norm.juggle_best_norm,
            norm.juggle_best2_sum_norm,
            norm.juggle_avg_all_norm,
          ].filter((v): v is number => v !== null && typeof v === "number");
          const msTest6Sum = msTest6Values.reduce((sum, v) => sum + v, 0);
          const msTest6Weight = 1;
          const msTest6Contribution = msTest6Sum * msTest6Weight;
          const msTest6DenomWeight = msTest6Values.length * msTest6Weight;
          console.log(
            `[compute-all][MS] Test 6 (Juggling Control): values=${JSON.stringify(
              msTest6Values
            )}, sum=${msTest6Sum.toFixed(
              6
            )}, weight=${msTest6Weight}, contribution=${msTest6Contribution.toFixed(
              6
            )}, denomWeight=${msTest6DenomWeight}`
          );

          // Test 7: Skill Moves Rating (weight = 1)
          const msTest7Values = [
            norm.skill_moves_avg_rating_norm,
            norm.skill_moves_count_norm,
          ].filter((v): v is number => v !== null && typeof v === "number");
          const msTest7Sum = msTest7Values.reduce((sum, v) => sum + v, 0);
          const msTest7Weight = 1;
          const msTest7Contribution = msTest7Sum * msTest7Weight;
          const msTest7DenomWeight = msTest7Values.length * msTest7Weight;
          console.log(
            `[compute-all][MS] Test 7 (Skill Moves Rating): values=${JSON.stringify(
              msTest7Values
            )}, sum=${msTest7Sum.toFixed(
              6
            )}, weight=${msTest7Weight}, contribution=${msTest7Contribution.toFixed(
              6
            )}, denomWeight=${msTest7DenomWeight}`
          );

          // Test 8: 5-10-5 Pro Agility (weight = 3)
          const msTest8Values = [
            norm.agility_5_10_5_best_time_norm,
            norm.agility_5_10_5_avg_time_norm,
          ].filter((v): v is number => v !== null && typeof v === "number");
          const msTest8Sum = msTest8Values.reduce((sum, v) => sum + v, 0);
          const msTest8Weight = 3;
          const msTest8Contribution = msTest8Sum * msTest8Weight;
          const msTest8DenomWeight = msTest8Values.length * msTest8Weight;
          console.log(
            `[compute-all][MS] Test 8 (5-10-5 Pro Agility): values=${JSON.stringify(
              msTest8Values
            )}, sum=${msTest8Sum.toFixed(
              6
            )}, weight=${msTest8Weight}, contribution=${msTest8Contribution.toFixed(
              6
            )}, denomWeight=${msTest8DenomWeight}`
          );

          // Test 9: Reaction Test 5m Start (weight = 2)
          const msTest9Values = [
            norm.reaction_5m_reaction_time_avg_norm,
            norm.reaction_5m_total_time_avg_norm,
          ].filter((v): v is number => v !== null && typeof v === "number");
          const msTest9Sum = msTest9Values.reduce((sum, v) => sum + v, 0);
          const msTest9Weight = 2;
          const msTest9Contribution = msTest9Sum * msTest9Weight;
          const msTest9DenomWeight = msTest9Values.length * msTest9Weight;
          console.log(
            `[compute-all][MS] Test 9 (Reaction Test 5m Start): values=${JSON.stringify(
              msTest9Values
            )}, sum=${msTest9Sum.toFixed(
              6
            )}, weight=${msTest9Weight}, contribution=${msTest9Contribution.toFixed(
              6
            )}, denomWeight=${msTest9DenomWeight}`
          );

          // Test 10: Single Leg Hop L/R (weight = 3)
          const msTest10Values = [
            norm.single_leg_hop_left_norm,
            norm.single_leg_hop_right_norm,
            norm.single_leg_hop_asymmetry_pct_norm,
          ].filter((v): v is number => v !== null && typeof v === "number");
          const msTest10Sum = msTest10Values.reduce((sum, v) => sum + v, 0);
          const msTest10Weight = 3;
          const msTest10Contribution = msTest10Sum * msTest10Weight;
          const msTest10DenomWeight = msTest10Values.length * msTest10Weight;
          console.log(
            `[compute-all][MS] Test 10 (Single Leg Hop L/R): values=${JSON.stringify(
              msTest10Values
            )}, sum=${msTest10Sum.toFixed(
              6
            )}, weight=${msTest10Weight}, contribution=${msTest10Contribution.toFixed(
              6
            )}, denomWeight=${msTest10DenomWeight}`
          );

          // Test 11: Double Leg Jump Endure (weight = 2)
          const msTest11Values = [
            norm.double_leg_jumps_total_reps_norm,
            norm.double_leg_jumps_first10_norm,
            norm.double_leg_jumps_last10_norm,
            norm.double_leg_jumps_dropoff_pct_norm,
          ].filter((v): v is number => v !== null && typeof v === "number");
          const msTest11Sum = msTest11Values.reduce((sum, v) => sum + v, 0);
          const msTest11Weight = 2;
          const msTest11Contribution = msTest11Sum * msTest11Weight;
          const msTest11DenomWeight = msTest11Values.length * msTest11Weight;
          console.log(
            `[compute-all][MS] Test 11 (Double Leg Jump Endure): values=${JSON.stringify(
              msTest11Values
            )}, sum=${msTest11Sum.toFixed(
              6
            )}, weight=${msTest11Weight}, contribution=${msTest11Contribution.toFixed(
              6
            )}, denomWeight=${msTest11DenomWeight}`
          );

          // Test 12: Ankle Dorsiflexion (weight = 3)
          const msTest12Values = [
            norm.ankle_dorsiflex_left_cm_norm,
            norm.ankle_dorsiflex_right_cm_norm,
            norm.ankle_dorsiflex_avg_cm_norm,
            norm.ankle_dorsiflex_asymmetry_pct_norm,
          ].filter((v): v is number => v !== null && typeof v === "number");
          const msTest12Sum = msTest12Values.reduce((sum, v) => sum + v, 0);
          const msTest12Weight = 3;
          const msTest12Contribution = msTest12Sum * msTest12Weight;
          const msTest12DenomWeight = msTest12Values.length * msTest12Weight;
          console.log(
            `[compute-all][MS] Test 12 (Ankle Dorsiflexion): values=${JSON.stringify(
              msTest12Values
            )}, sum=${msTest12Sum.toFixed(
              6
            )}, weight=${msTest12Weight}, contribution=${msTest12Contribution.toFixed(
              6
            )}, denomWeight=${msTest12DenomWeight}`
          );

          // Test 13: Core Endurance Plank (weight = 3)
          const msTest13Values = [
            norm.core_plank_hold_sec_norm,
            norm.core_plank_form_flag_norm,
          ].filter((v): v is number => v !== null && typeof v === "number");
          const msTest13Sum = msTest13Values.reduce((sum, v) => sum + v, 0);
          const msTest13Weight = 3;
          const msTest13Contribution = msTest13Sum * msTest13Weight;
          const msTest13DenomWeight = msTest13Values.length * msTest13Weight;
          console.log(
            `[compute-all][MS] Test 13 (Core Endurance Plank): values=${JSON.stringify(
              msTest13Values
            )}, sum=${msTest13Sum.toFixed(
              6
            )}, weight=${msTest13Weight}, contribution=${msTest13Contribution.toFixed(
              6
            )}, denomWeight=${msTest13DenomWeight}`
          );

          const msTotalWeightedContributions =
            msTest2Contribution +
            msTest3Contribution +
            msTest4Contribution +
            msTest5Contribution +
            msTest6Contribution +
            msTest7Contribution +
            msTest8Contribution +
            msTest9Contribution +
            msTest10Contribution +
            msTest11Contribution +
            msTest12Contribution +
            msTest13Contribution;

          const msTotalWeights =
            msTest2DenomWeight +
            msTest3DenomWeight +
            msTest4DenomWeight +
            msTest5DenomWeight +
            msTest6DenomWeight +
            msTest7DenomWeight +
            msTest8DenomWeight +
            msTest9DenomWeight +
            msTest10DenomWeight +
            msTest11DenomWeight +
            msTest12DenomWeight +
            msTest13DenomWeight;

          const msScore =
            msTotalWeights > 0
              ? msTotalWeightedContributions / msTotalWeights
              : null;

          console.log(
            `[compute-all][MS] ${playerName}: totalWeightedContributions=${msTotalWeightedContributions.toFixed(
              6
            )}, totalWeights=${msTotalWeights}, MS=${
              msScore !== null ? msScore.toFixed(4) : "null"
            }`
          );

          msResults[playerId] = {
            playerName,
            msScore,
            testContributions: {
              test2: {
                sum: msTest2Sum,
                featureCount: msTest2Values.length,
                weight: msTest2Weight,
                contribution: msTest2Contribution,
                denomWeight: msTest2DenomWeight,
              },
              test3: {
                sum: msTest3Sum,
                featureCount: msTest3Values.length,
                weight: msTest3Weight,
                contribution: msTest3Contribution,
                denomWeight: msTest3DenomWeight,
              },
              test4: {
                sum: msTest4Sum,
                featureCount: msTest4Values.length,
                weight: msTest4Weight,
                contribution: msTest4Contribution,
                denomWeight: msTest4DenomWeight,
              },
              test5: {
                sum: msTest5Sum,
                featureCount: msTest5Values.length,
                weight: msTest5Weight,
                contribution: msTest5Contribution,
                denomWeight: msTest5DenomWeight,
              },
              test6: {
                sum: msTest6Sum,
                featureCount: msTest6Values.length,
                weight: msTest6Weight,
                contribution: msTest6Contribution,
                denomWeight: msTest6DenomWeight,
              },
              test7: {
                sum: msTest7Sum,
                featureCount: msTest7Values.length,
                weight: msTest7Weight,
                contribution: msTest7Contribution,
                denomWeight: msTest7DenomWeight,
              },
              test8: {
                sum: msTest8Sum,
                featureCount: msTest8Values.length,
                weight: msTest8Weight,
                contribution: msTest8Contribution,
                denomWeight: msTest8DenomWeight,
              },
              test9: {
                sum: msTest9Sum,
                featureCount: msTest9Values.length,
                weight: msTest9Weight,
                contribution: msTest9Contribution,
                denomWeight: msTest9DenomWeight,
              },
              test10: {
                sum: msTest10Sum,
                featureCount: msTest10Values.length,
                weight: msTest10Weight,
                contribution: msTest10Contribution,
                denomWeight: msTest10DenomWeight,
              },
              test11: {
                sum: msTest11Sum,
                featureCount: msTest11Values.length,
                weight: msTest11Weight,
                contribution: msTest11Contribution,
                denomWeight: msTest11DenomWeight,
              },
              test12: {
                sum: msTest12Sum,
                featureCount: msTest12Values.length,
                weight: msTest12Weight,
                contribution: msTest12Contribution,
                denomWeight: msTest12DenomWeight,
              },
              test13: {
                sum: msTest13Sum,
                featureCount: msTest13Values.length,
                weight: msTest13Weight,
                contribution: msTest13Contribution,
                denomWeight: msTest13DenomWeight,
              },
            },
            totalWeightedContributions: msTotalWeightedContributions,
            totalWeights: msTotalWeights,
          };
        }

        console.log("[compute-all][MS] All MS calculations complete:");
        console.log("[compute-all][MS] Results:", msResults);

        // Calculate Decision / Cognition (DC) for each player (4th index of 4D cluster vector)
        console.log("[compute-all][DC] evaluation:", evaluationId);
        console.log(
          "[compute-all][DC] Starting Decision / Cognition calculations..."
        );

        const dcResults: Record<string, any> = {};

        for (const [playerId, row] of Object.entries(computedByPlayer)) {
          const playerName =
            playersById.get(playerId)?.name ?? "Unknown Player";
          const norm = (row as any).norm;

          console.log(`[compute-all][DC] Player: ${playerName} (${playerId})`);

          // DC definition (same style as PS/TC/MS):
          // numerator   = Σ(featureValue * testWeight)
          // denominator = Σ(featureCount * testWeight)

          // Test 1: Shot Power (weight = 1)
          const dcTest1Values = [
            norm.shot_power_strong_avg_norm,
            norm.shot_power_weak_avg_norm,
            norm.shot_power_strong_max_norm,
            norm.shot_power_weak_max_norm,
          ].filter((v): v is number => v !== null && typeof v === "number");
          const dcTest1Sum = dcTest1Values.reduce((sum, v) => sum + v, 0);
          const dcTest1Weight = 1;
          const dcTest1Contribution = dcTest1Sum * dcTest1Weight;
          const dcTest1DenomWeight = dcTest1Values.length * dcTest1Weight;
          console.log(
            `[compute-all][DC] Test 1 (Shot Power): values=${JSON.stringify(
              dcTest1Values
            )}, sum=${dcTest1Sum.toFixed(
              6
            )}, weight=${dcTest1Weight}, contribution=${dcTest1Contribution.toFixed(
              6
            )}, denomWeight=${dcTest1DenomWeight}`
          );

          // Test 3: Figure 8 Dribble (weight = 1)
          const dcTest3Values = [
            norm.figure8_loops_strong_norm,
            norm.figure8_loops_weak_norm,
            norm.figure8_loops_both_norm,
          ].filter((v): v is number => v !== null && typeof v === "number");
          const dcTest3Sum = dcTest3Values.reduce((sum, v) => sum + v, 0);
          const dcTest3Weight = 1;
          const dcTest3Contribution = dcTest3Sum * dcTest3Weight;
          const dcTest3DenomWeight = dcTest3Values.length * dcTest3Weight;
          console.log(
            `[compute-all][DC] Test 3 (Figure 8 Dribble): values=${JSON.stringify(
              dcTest3Values
            )}, sum=${dcTest3Sum.toFixed(
              6
            )}, weight=${dcTest3Weight}, contribution=${dcTest3Contribution.toFixed(
              6
            )}, denomWeight=${dcTest3DenomWeight}`
          );

          // Test 4: Passing Gates (weight = 2)
          const dcTest4Values = [
            norm.passing_gates_strong_hits_norm,
            norm.passing_gates_weak_hits_norm,
            norm.passing_gates_total_hits_norm,
          ].filter((v): v is number => v !== null && typeof v === "number");
          const dcTest4Sum = dcTest4Values.reduce((sum, v) => sum + v, 0);
          const dcTest4Weight = 2;
          const dcTest4Contribution = dcTest4Sum * dcTest4Weight;
          const dcTest4DenomWeight = dcTest4Values.length * dcTest4Weight;
          console.log(
            `[compute-all][DC] Test 4 (Passing Gates): values=${JSON.stringify(
              dcTest4Values
            )}, sum=${dcTest4Sum.toFixed(
              6
            )}, weight=${dcTest4Weight}, contribution=${dcTest4Contribution.toFixed(
              6
            )}, denomWeight=${dcTest4DenomWeight}`
          );

          // Test 5: 1v1 Competitive Score (weight = 3)
          const dcTest5Values = [
            norm.one_v_one_avg_score_norm,
            norm.one_v_one_rounds_played_norm,
          ].filter((v): v is number => v !== null && typeof v === "number");
          const dcTest5Sum = dcTest5Values.reduce((sum, v) => sum + v, 0);
          const dcTest5Weight = 3;
          const dcTest5Contribution = dcTest5Sum * dcTest5Weight;
          const dcTest5DenomWeight = dcTest5Values.length * dcTest5Weight;
          console.log(
            `[compute-all][DC] Test 5 (1v1 Competitive Score): values=${JSON.stringify(
              dcTest5Values
            )}, sum=${dcTest5Sum.toFixed(
              6
            )}, weight=${dcTest5Weight}, contribution=${dcTest5Contribution.toFixed(
              6
            )}, denomWeight=${dcTest5DenomWeight}`
          );

          // Test 7: Skill Moves Rating (weight = 2)
          const dcTest7Values = [
            norm.skill_moves_avg_rating_norm,
            norm.skill_moves_count_norm,
          ].filter((v): v is number => v !== null && typeof v === "number");
          const dcTest7Sum = dcTest7Values.reduce((sum, v) => sum + v, 0);
          const dcTest7Weight = 2;
          const dcTest7Contribution = dcTest7Sum * dcTest7Weight;
          const dcTest7DenomWeight = dcTest7Values.length * dcTest7Weight;
          console.log(
            `[compute-all][DC] Test 7 (Skill Moves Rating): values=${JSON.stringify(
              dcTest7Values
            )}, sum=${dcTest7Sum.toFixed(
              6
            )}, weight=${dcTest7Weight}, contribution=${dcTest7Contribution.toFixed(
              6
            )}, denomWeight=${dcTest7DenomWeight}`
          );

          // Test 8: 5-10-5 Pro Agility (weight = 1)
          const dcTest8Values = [
            norm.agility_5_10_5_best_time_norm,
            norm.agility_5_10_5_avg_time_norm,
          ].filter((v): v is number => v !== null && typeof v === "number");
          const dcTest8Sum = dcTest8Values.reduce((sum, v) => sum + v, 0);
          const dcTest8Weight = 1;
          const dcTest8Contribution = dcTest8Sum * dcTest8Weight;
          const dcTest8DenomWeight = dcTest8Values.length * dcTest8Weight;
          console.log(
            `[compute-all][DC] Test 8 (5-10-5 Pro Agility): values=${JSON.stringify(
              dcTest8Values
            )}, sum=${dcTest8Sum.toFixed(
              6
            )}, weight=${dcTest8Weight}, contribution=${dcTest8Contribution.toFixed(
              6
            )}, denomWeight=${dcTest8DenomWeight}`
          );

          // Test 9: Reaction Test 5m Start (weight = 3)
          const dcTest9Values = [
            norm.reaction_5m_reaction_time_avg_norm,
            norm.reaction_5m_total_time_avg_norm,
          ].filter((v): v is number => v !== null && typeof v === "number");
          const dcTest9Sum = dcTest9Values.reduce((sum, v) => sum + v, 0);
          const dcTest9Weight = 3;
          const dcTest9Contribution = dcTest9Sum * dcTest9Weight;
          const dcTest9DenomWeight = dcTest9Values.length * dcTest9Weight;
          console.log(
            `[compute-all][DC] Test 9 (Reaction Test 5m Start): values=${JSON.stringify(
              dcTest9Values
            )}, sum=${dcTest9Sum.toFixed(
              6
            )}, weight=${dcTest9Weight}, contribution=${dcTest9Contribution.toFixed(
              6
            )}, denomWeight=${dcTest9DenomWeight}`
          );

          const dcTotalWeightedContributions =
            dcTest1Contribution +
            dcTest3Contribution +
            dcTest4Contribution +
            dcTest5Contribution +
            dcTest7Contribution +
            dcTest8Contribution +
            dcTest9Contribution;

          const dcTotalWeights =
            dcTest1DenomWeight +
            dcTest3DenomWeight +
            dcTest4DenomWeight +
            dcTest5DenomWeight +
            dcTest7DenomWeight +
            dcTest8DenomWeight +
            dcTest9DenomWeight;

          const dcScore =
            dcTotalWeights > 0
              ? dcTotalWeightedContributions / dcTotalWeights
              : null;

          console.log(
            `[compute-all][DC] ${playerName}: totalWeightedContributions=${dcTotalWeightedContributions.toFixed(
              6
            )}, totalWeights=${dcTotalWeights}, DC=${
              dcScore !== null ? dcScore.toFixed(4) : "null"
            }`
          );

          dcResults[playerId] = {
            playerName,
            dcScore,
            testContributions: {
              test1: {
                sum: dcTest1Sum,
                featureCount: dcTest1Values.length,
                weight: dcTest1Weight,
                contribution: dcTest1Contribution,
                denomWeight: dcTest1DenomWeight,
              },
              test3: {
                sum: dcTest3Sum,
                featureCount: dcTest3Values.length,
                weight: dcTest3Weight,
                contribution: dcTest3Contribution,
                denomWeight: dcTest3DenomWeight,
              },
              test4: {
                sum: dcTest4Sum,
                featureCount: dcTest4Values.length,
                weight: dcTest4Weight,
                contribution: dcTest4Contribution,
                denomWeight: dcTest4DenomWeight,
              },
              test5: {
                sum: dcTest5Sum,
                featureCount: dcTest5Values.length,
                weight: dcTest5Weight,
                contribution: dcTest5Contribution,
                denomWeight: dcTest5DenomWeight,
              },
              test7: {
                sum: dcTest7Sum,
                featureCount: dcTest7Values.length,
                weight: dcTest7Weight,
                contribution: dcTest7Contribution,
                denomWeight: dcTest7DenomWeight,
              },
              test8: {
                sum: dcTest8Sum,
                featureCount: dcTest8Values.length,
                weight: dcTest8Weight,
                contribution: dcTest8Contribution,
                denomWeight: dcTest8DenomWeight,
              },
              test9: {
                sum: dcTest9Sum,
                featureCount: dcTest9Values.length,
                weight: dcTest9Weight,
                contribution: dcTest9Contribution,
                denomWeight: dcTest9DenomWeight,
              },
            },
            totalWeightedContributions: dcTotalWeightedContributions,
            totalWeights: dcTotalWeights,
          };
        }

        console.log("[compute-all][DC] All DC calculations complete:");
        console.log("[compute-all][DC] Results:", dcResults);

        // Persist to database (PlayerEvaluations + TestScores + OverallScores + PlayerDNA + PlayerCluster)
        for (const [playerId, row] of Object.entries(computedByPlayer)) {
          const peRes = await client.query(
            `
          INSERT INTO player_evaluations
            (player_id, team_id, evaluation_id, name, coach_id, coach_name, created_at)
          VALUES
            ($1, $2, $3, $4, $5, $6, COALESCE($7, CURRENT_TIMESTAMP))
          ON CONFLICT (player_id, evaluation_id)
          DO UPDATE SET
            team_id = EXCLUDED.team_id,
            name = EXCLUDED.name,
            coach_id = EXCLUDED.coach_id,
            coach_name = EXCLUDED.coach_name,
            created_at = EXCLUDED.created_at
          RETURNING id
          `,
            [
              playerId,
              teamId,
              evaluationId,
              evaluationName,
              coachId,
              coachName,
              evaluationCreatedAt,
            ]
          );
          const playerEvaluationId: string = peRes.rows[0].id;

          const rawUiScores = (scores as any)?.[playerId] ?? {};
          await client.query(
            `
          INSERT INTO test_scores (player_evaluation_id, scores)
          VALUES ($1, $2::jsonb)
          ON CONFLICT (player_evaluation_id)
          DO UPDATE SET scores = EXCLUDED.scores
          `,
            [playerEvaluationId, JSON.stringify(rawUiScores)]
          );

          await client.query(
            `
          INSERT INTO overall_scores (player_evaluation_id, scores)
          VALUES ($1, $2::jsonb)
          ON CONFLICT (player_evaluation_id)
          DO UPDATE SET scores = EXCLUDED.scores
          `,
            [playerEvaluationId, JSON.stringify((row as any).raw ?? {})]
          );

          await client.query(
            `
          INSERT INTO player_dna (player_evaluation_id, dna)
          VALUES ($1, $2::jsonb)
          ON CONFLICT (player_evaluation_id)
          DO UPDATE SET dna = EXCLUDED.dna
          `,
            [playerEvaluationId, JSON.stringify((row as any).norm ?? {})]
          );

          const playerCluster = {
            ps: psResults[playerId]?.psScore ?? null,
            tc: tcResults[playerId]?.tcScore ?? null,
            ms: msResults[playerId]?.msScore ?? null,
            dc: dcResults[playerId]?.dcScore ?? null,
          };
          const playerClusterWithVector = {
            ...playerCluster,
            vector: [
              playerCluster.ps,
              playerCluster.tc,
              playerCluster.ms,
              playerCluster.dc,
            ],
          };

          await client.query(
            `
          INSERT INTO player_cluster (player_evaluation_id, cluster)
          VALUES ($1, $2::jsonb)
          ON CONFLICT (player_evaluation_id)
          DO UPDATE SET cluster = EXCLUDED.cluster
          `,
            [playerEvaluationId, JSON.stringify(playerClusterWithVector)]
          );

          playerEvaluationsUpserted += 1;
        }

        // Plain text output (root-level file) - testing only (DISABLED; data is now persisted to DB)
        if (false) {
          const outLines: string[] = [];
          outLines.push(
            `--- Evaluation: ${evaluationName} @ ${evaluationCreatedAt} ---`
          );
          const playerEntries = Object.entries(computedByPlayer).sort(
            (a, b) => {
              const aName = playersById.get(a[0])?.name ?? "";
              const bName = playersById.get(b[0])?.name ?? "";
              return aName.localeCompare(bName);
            }
          );

          // POWER
          outLines.push("");
          outLines.push("POWER");
          outLines.push("MAIN (raw + normalized)");
          const headerPowerMain =
            padRight("Player", 28) +
            " " +
            padLeft("BY", 4) +
            " | " +
            "raw  SAvg  WAvg  SMax  WMax" +
            " | " +
            "norm SAvg  WAvg  SMax  WMax";
          outLines.push(headerPowerMain);
          outLines.push("-".repeat(headerPowerMain.length));

          for (const [playerId, row] of playerEntries) {
            const p = playersById.get(playerId);
            const playerLabel = `${p?.name ?? "Unknown"}`;
            const by = row.birthYear ?? "—";

            const linePowerMain =
              padRight(playerLabel, 28) +
              " " +
              padLeft(String(by), 4) +
              " | " +
              padLeft(fmt(row.raw.shot_power_strong_avg, 1), 5) +
              " " +
              padLeft(fmt(row.raw.shot_power_weak_avg, 1), 5) +
              " " +
              padLeft(fmt(row.raw.shot_power_strong_max, 0), 5) +
              " " +
              padLeft(fmt(row.raw.shot_power_weak_max, 0), 5) +
              " | " +
              padLeft(fmt(row.norm.shot_power_strong_avg_norm, 3), 5) +
              " " +
              padLeft(fmt(row.norm.shot_power_weak_avg_norm, 3), 5) +
              " " +
              padLeft(fmt(row.norm.shot_power_strong_max_norm, 3), 5) +
              " " +
              padLeft(fmt(row.norm.shot_power_weak_max_norm, 3), 5);

            outLines.push(linePowerMain);
          }

          outLines.push("");
          outLines.push("EXTRAS (not normalized)");
          const headerPowerExtras =
            padRight("Player", 28) +
            " " +
            padLeft("BY", 4) +
            " | " +
            "rAvg     aAvg      rMax     aMax";
          outLines.push(headerPowerExtras);
          outLines.push("-".repeat(headerPowerExtras.length));

          for (const [playerId, row] of playerEntries) {
            const p = playersById.get(playerId);
            const playerLabel = `${p?.name ?? "Unknown"}`;
            const by = row.birthYear ?? "—";

            const linePowerExtras =
              padRight(playerLabel, 28) +
              " " +
              padLeft(String(by), 4) +
              " | " +
              padLeft(fmt(row.raw.shot_power_weak_to_strong_ratio, 3), 7) +
              " " +
              padLeft(fmtPct(row.raw.shot_power_asymmetry_pct, 1), 8) +
              " " +
              padLeft(fmt(row.raw.shot_power_weak_to_strong_ratio_max, 3), 7) +
              " " +
              padLeft(fmtPct(row.raw.shot_power_asymmetry_pct_max, 1), 8);

            outLines.push(linePowerExtras);
          }

          // SERVE DISTANCE
          outLines.push("");
          outLines.push("SERVE DISTANCE");
          outLines.push("MAIN (raw + normalized)");
          const headerServeMain =
            padRight("Player", 28) +
            " " +
            padLeft("BY", 4) +
            " | " +
            "raw  SAvg  WAvg  SMax  WMax" +
            " | " +
            "norm SAvg  WAvg  SMax  WMax";
          outLines.push(headerServeMain);
          outLines.push("-".repeat(headerServeMain.length));

          for (const [playerId, row] of playerEntries) {
            const p = playersById.get(playerId);
            const playerLabel = `${p?.name ?? "Unknown"}`;
            const by = row.birthYear ?? "—";

            const lineServeMain =
              padRight(playerLabel, 28) +
              " " +
              padLeft(String(by), 4) +
              " | " +
              padLeft(fmt(row.raw.serve_distance_strong_avg, 1), 5) +
              " " +
              padLeft(fmt(row.raw.serve_distance_weak_avg, 1), 5) +
              " " +
              padLeft(fmt(row.raw.serve_distance_strong_max, 0), 5) +
              " " +
              padLeft(fmt(row.raw.serve_distance_weak_max, 0), 5) +
              " | " +
              padLeft(fmt(row.norm.serve_distance_strong_avg_norm, 3), 5) +
              " " +
              padLeft(fmt(row.norm.serve_distance_weak_avg_norm, 3), 5) +
              " " +
              padLeft(fmt(row.norm.serve_distance_strong_max_norm, 3), 5) +
              " " +
              padLeft(fmt(row.norm.serve_distance_weak_max_norm, 3), 5);

            outLines.push(lineServeMain);
          }

          outLines.push("");
          outLines.push("EXTRAS (not normalized)");
          const headerServeExtras =
            padRight("Player", 28) +
            " " +
            padLeft("BY", 4) +
            " | " +
            "rAvg     aAvg      rMax     aMax";
          outLines.push(headerServeExtras);
          outLines.push("-".repeat(headerServeExtras.length));

          for (const [playerId, row] of playerEntries) {
            const p = playersById.get(playerId);
            const playerLabel = `${p?.name ?? "Unknown"}`;
            const by = row.birthYear ?? "—";

            const lineServeExtras =
              padRight(playerLabel, 28) +
              " " +
              padLeft(String(by), 4) +
              " | " +
              padLeft(fmt(row.raw.serve_distance_weak_to_strong_ratio, 3), 7) +
              " " +
              padLeft(fmtPct(row.raw.serve_distance_asymmetry_pct, 1), 8) +
              " " +
              padLeft(
                fmt(row.raw.serve_distance_weak_to_strong_ratio_max, 3),
                7
              ) +
              " " +
              padLeft(fmtPct(row.raw.serve_distance_asymmetry_pct_max, 1), 8);

            outLines.push(lineServeExtras);
          }

          // FIGURE 8
          outLines.push("");
          outLines.push("FIGURE 8");
          outLines.push("MAIN (raw + normalized)");
          const headerFigure8Main =
            padRight("Player", 28) +
            " " +
            padLeft("BY", 4) +
            " | " +
            "raw  Strong Weak Both" +
            " | " +
            "norm Strong Weak Both";
          outLines.push(headerFigure8Main);
          outLines.push("-".repeat(headerFigure8Main.length));

          for (const [playerId, row] of playerEntries) {
            const p = playersById.get(playerId);
            const playerLabel = `${p?.name ?? "Unknown"}`;
            const by = row.birthYear ?? "—";

            const lineFigure8Main =
              padRight(playerLabel, 28) +
              " " +
              padLeft(String(by), 4) +
              " | " +
              padLeft(fmt(row.raw.figure8_loops_strong, 0), 6) +
              " " +
              padLeft(fmt(row.raw.figure8_loops_weak, 0), 4) +
              " " +
              padLeft(fmt(row.raw.figure8_loops_both, 0), 4) +
              " | " +
              padLeft(fmt(row.norm.figure8_loops_strong_norm, 3), 6) +
              " " +
              padLeft(fmt(row.norm.figure8_loops_weak_norm, 3), 4) +
              " " +
              padLeft(fmt(row.norm.figure8_loops_both_norm, 3), 4);

            outLines.push(lineFigure8Main);
          }

          outLines.push("");
          outLines.push("EXTRAS (not normalized)");
          const headerFigure8Extras =
            padRight("Player", 28) +
            " " +
            padLeft("BY", 4) +
            " | " +
            "W/S ratio  B/S ratio  asym%";
          outLines.push(headerFigure8Extras);
          outLines.push("-".repeat(headerFigure8Extras.length));

          for (const [playerId, row] of playerEntries) {
            const p = playersById.get(playerId);
            const playerLabel = `${p?.name ?? "Unknown"}`;
            const by = row.birthYear ?? "—";

            const lineFigure8Extras =
              padRight(playerLabel, 28) +
              " " +
              padLeft(String(by), 4) +
              " | " +
              padLeft(fmt(row.raw.figure8_weak_to_strong_ratio, 3), 9) +
              " " +
              padLeft(fmt(row.raw.figure8_both_to_strong_ratio, 3), 9) +
              " " +
              padLeft(fmtPct(row.raw.figure8_asymmetry_pct, 1), 6);

            outLines.push(lineFigure8Extras);
          }

          outLines.push("");

          // PASSING GATES
          outLines.push("PASSING GATES");
          outLines.push("MAIN (raw + normalized)");
          const headerPassingMain =
            padRight("Player", 28) +
            " " +
            padLeft("BY", 4) +
            " | " +
            "raw  Strong Weak Total" +
            " | " +
            "norm Strong Weak Total";
          outLines.push(headerPassingMain);
          outLines.push("-".repeat(headerPassingMain.length));

          for (const [playerId, row] of playerEntries) {
            const p = playersById.get(playerId);
            const playerLabel = `${p?.name ?? "Unknown"}`;
            const by = row.birthYear ?? "—";

            const linePassingMain =
              padRight(playerLabel, 28) +
              " " +
              padLeft(String(by), 4) +
              " | " +
              padLeft(fmt(row.raw.passing_gates_strong_hits, 0), 6) +
              " " +
              padLeft(fmt(row.raw.passing_gates_weak_hits, 0), 4) +
              " " +
              padLeft(fmt(row.raw.passing_gates_total_hits, 0), 5) +
              " | " +
              padLeft(fmt(row.norm.passing_gates_strong_hits_norm, 3), 6) +
              " " +
              padLeft(fmt(row.norm.passing_gates_weak_hits_norm, 3), 4) +
              " " +
              padLeft(fmt(row.norm.passing_gates_total_hits_norm, 3), 5);

            outLines.push(linePassingMain);
          }

          outLines.push("");
          outLines.push("EXTRAS (not normalized)");
          const headerPassingExtras =
            padRight("Player", 28) +
            " " +
            padLeft("BY", 4) +
            " | " +
            "W/S ratio  asym%   weak_share%";
          outLines.push(headerPassingExtras);
          outLines.push("-".repeat(headerPassingExtras.length));

          for (const [playerId, row] of playerEntries) {
            const p = playersById.get(playerId);
            const playerLabel = `${p?.name ?? "Unknown"}`;
            const by = row.birthYear ?? "—";

            const linePassingExtras =
              padRight(playerLabel, 28) +
              " " +
              padLeft(String(by), 4) +
              " | " +
              padLeft(fmt(row.raw.passing_gates_weak_to_strong_ratio, 3), 9) +
              " " +
              padLeft(fmtPct(row.raw.passing_gates_asymmetry_pct, 1), 6) +
              " " +
              padLeft(fmtPct(row.raw.passing_gates_weak_share_pct, 1), 10);

            outLines.push(linePassingExtras);
          }

          outLines.push("");

          // 1v1
          outLines.push("1v1");
          outLines.push(`rounds_in_evaluation=${oneVOneRounds}`);
          outLines.push("MAIN (raw + normalized)");
          const headerOneVOneMain =
            padRight("Player", 28) +
            " " +
            padLeft("BY", 4) +
            " | " +
            "raw  rounds  avg" +
            " | " +
            "norm rounds  avg";
          outLines.push(headerOneVOneMain);
          outLines.push("-".repeat(headerOneVOneMain.length));

          for (const [playerId, row] of playerEntries) {
            const p = playersById.get(playerId);
            const playerLabel = `${p?.name ?? "Unknown"}`;
            const by = row.birthYear ?? "—";

            const lineOneVOneMain =
              padRight(playerLabel, 28) +
              " " +
              padLeft(String(by), 4) +
              " | " +
              padLeft(fmt(row.raw.one_v_one_rounds_played, 0), 6) +
              " " +
              padLeft(fmt(row.raw.one_v_one_avg_score, 2), 5) +
              " | " +
              padLeft(fmt(row.norm.one_v_one_rounds_played_norm, 3), 6) +
              " " +
              padLeft(fmt(row.norm.one_v_one_avg_score_norm, 3), 5);

            outLines.push(lineOneVOneMain);
          }

          outLines.push("");
          outLines.push("EXTRAS (not normalized)");
          const headerOneVOneExtras =
            padRight("Player", 28) +
            " " +
            padLeft("BY", 4) +
            " | " +
            "total  best  worst  range";
          outLines.push(headerOneVOneExtras);
          outLines.push("-".repeat(headerOneVOneExtras.length));

          for (const [playerId, row] of playerEntries) {
            const p = playersById.get(playerId);
            const playerLabel = `${p?.name ?? "Unknown"}`;
            const by = row.birthYear ?? "—";

            const lineOneVOneExtras =
              padRight(playerLabel, 28) +
              " " +
              padLeft(String(by), 4) +
              " | " +
              padLeft(fmt(row.raw.one_v_one_total_score, 0), 5) +
              " " +
              padLeft(fmt(row.raw.one_v_one_best_round, 0), 4) +
              " " +
              padLeft(fmt(row.raw.one_v_one_worst_round, 0), 5) +
              " " +
              padLeft(fmt(row.raw.one_v_one_consistency_range, 0), 5);

            outLines.push(lineOneVOneExtras);
          }

          outLines.push("");

          // JUGGLING
          outLines.push("JUGGLING");
          outLines.push("MAIN (raw + normalized)");
          const headerJuggleMain =
            padRight("Player", 28) +
            " " +
            padLeft("BY", 4) +
            " | " +
            "raw  best best2 avg" +
            " | " +
            "norm best best2 avg";
          outLines.push(headerJuggleMain);
          outLines.push("-".repeat(headerJuggleMain.length));

          for (const [playerId, row] of playerEntries) {
            const p = playersById.get(playerId);
            const playerLabel = `${p?.name ?? "Unknown"}`;
            const by = row.birthYear ?? "—";

            const lineJuggleMain =
              padRight(playerLabel, 28) +
              " " +
              padLeft(String(by), 4) +
              " | " +
              padLeft(fmt(row.raw.juggle_best, 0), 4) +
              " " +
              padLeft(fmt(row.raw.juggle_best2_sum, 0), 5) +
              " " +
              padLeft(fmt(row.raw.juggle_avg_all, 2), 5) +
              " | " +
              padLeft(fmt(row.norm.juggle_best_norm, 3), 4) +
              " " +
              padLeft(fmt(row.norm.juggle_best2_sum_norm, 3), 5) +
              " " +
              padLeft(fmt(row.norm.juggle_avg_all_norm, 3), 5);

            outLines.push(lineJuggleMain);
          }

          outLines.push("");
          outLines.push("EXTRAS (not normalized)");
          const headerJuggleExtras =
            padRight("Player", 28) +
            " " +
            padLeft("BY", 4) +
            " | " +
            "total range";
          outLines.push(headerJuggleExtras);
          outLines.push("-".repeat(headerJuggleExtras.length));

          for (const [playerId, row] of playerEntries) {
            const p = playersById.get(playerId);
            const playerLabel = `${p?.name ?? "Unknown"}`;
            const by = row.birthYear ?? "—";

            const lineJuggleExtras =
              padRight(playerLabel, 28) +
              " " +
              padLeft(String(by), 4) +
              " | " +
              padLeft(fmt(row.raw.juggle_total, 0), 5) +
              " " +
              padLeft(fmt(row.raw.juggle_consistency_range, 0), 5);

            outLines.push(lineJuggleExtras);
          }

          outLines.push("");

          // SKILL MOVES
          outLines.push("SKILL MOVES");
          outLines.push(`moves_in_evaluation=${skillMovesCount}`);
          outLines.push("MAIN (raw + normalized)");
          const headerSkillMovesMain =
            padRight("Player", 28) +
            " " +
            padLeft("BY", 4) +
            " | " +
            "raw  count  avg" +
            " | " +
            "norm count  avg";
          outLines.push(headerSkillMovesMain);
          outLines.push("-".repeat(headerSkillMovesMain.length));

          for (const [playerId, row] of playerEntries) {
            const p = playersById.get(playerId);
            const playerLabel = `${p?.name ?? "Unknown"}`;
            const by = row.birthYear ?? "—";

            const lineSkillMovesMain =
              padRight(playerLabel, 28) +
              " " +
              padLeft(String(by), 4) +
              " | " +
              padLeft(fmt(row.raw.skill_moves_count, 0), 5) +
              " " +
              padLeft(fmt(row.raw.skill_moves_avg_rating, 2), 5) +
              " | " +
              padLeft(fmt(row.norm.skill_moves_count_norm, 3), 5) +
              " " +
              padLeft(fmt(row.norm.skill_moves_avg_rating_norm, 3), 5);

            outLines.push(lineSkillMovesMain);
          }

          outLines.push("");
          outLines.push("EXTRAS (not normalized)");
          const headerSkillMovesExtras =
            padRight("Player", 28) +
            " " +
            padLeft("BY", 4) +
            " | " +
            "total best worst range";
          outLines.push(headerSkillMovesExtras);
          outLines.push("-".repeat(headerSkillMovesExtras.length));

          for (const [playerId, row] of playerEntries) {
            const p = playersById.get(playerId);
            const playerLabel = `${p?.name ?? "Unknown"}`;
            const by = row.birthYear ?? "—";

            const lineSkillMovesExtras =
              padRight(playerLabel, 28) +
              " " +
              padLeft(String(by), 4) +
              " | " +
              padLeft(fmt(row.raw.skill_moves_total_rating, 0), 5) +
              " " +
              padLeft(fmt(row.raw.skill_moves_best_rating, 0), 4) +
              " " +
              padLeft(fmt(row.raw.skill_moves_worst_rating, 0), 5) +
              " " +
              padLeft(fmt(row.raw.skill_moves_consistency_range, 0), 5);

            outLines.push(lineSkillMovesExtras);
          }

          outLines.push("");

          // AGILITY 5-10-5
          outLines.push("AGILITY 5-10-5");
          outLines.push("MAIN (raw + normalized)  (lower is better)");
          const headerAgilityMain =
            padRight("Player", 28) +
            " " +
            padLeft("BY", 4) +
            " | " +
            "raw  best  avg" +
            " | " +
            "norm best  avg";
          outLines.push(headerAgilityMain);
          outLines.push("-".repeat(headerAgilityMain.length));

          for (const [playerId, row] of playerEntries) {
            const p = playersById.get(playerId);
            const playerLabel = `${p?.name ?? "Unknown"}`;
            const by = row.birthYear ?? "—";

            const lineAgilityMain =
              padRight(playerLabel, 28) +
              " " +
              padLeft(String(by), 4) +
              " | " +
              padLeft(fmt(row.raw.agility_5_10_5_best_time, 2), 5) +
              " " +
              padLeft(fmt(row.raw.agility_5_10_5_avg_time, 2), 5) +
              " | " +
              padLeft(fmt(row.norm.agility_5_10_5_best_time_norm, 3), 5) +
              " " +
              padLeft(fmt(row.norm.agility_5_10_5_avg_time_norm, 3), 5);

            outLines.push(lineAgilityMain);
          }

          outLines.push("");
          outLines.push("EXTRAS (not normalized)");
          const headerAgilityExtras =
            padRight("Player", 28) +
            " " +
            padLeft("BY", 4) +
            " | " +
            "worst range";
          outLines.push(headerAgilityExtras);
          outLines.push("-".repeat(headerAgilityExtras.length));

          for (const [playerId, row] of playerEntries) {
            const p = playersById.get(playerId);
            const playerLabel = `${p?.name ?? "Unknown"}`;
            const by = row.birthYear ?? "—";

            const lineAgilityExtras =
              padRight(playerLabel, 28) +
              " " +
              padLeft(String(by), 4) +
              " | " +
              padLeft(fmt(row.raw.agility_5_10_5_worst_time, 2), 5) +
              " " +
              padLeft(fmt(row.raw.agility_5_10_5_consistency_range, 2), 5);

            outLines.push(lineAgilityExtras);
          }

          outLines.push("");

          // REACTION 5m
          outLines.push("REACTION 5m");
          outLines.push("MAIN (raw + normalized)  (lower is better for times)");
          const headerReactionMain =
            padRight("Player", 28) +
            " " +
            padLeft("BY", 4) +
            " | " +
            "raw  RTavg  TTavg" +
            " | " +
            "norm RTavg  TTavg";
          outLines.push(headerReactionMain);
          outLines.push("-".repeat(headerReactionMain.length));

          for (const [playerId, row] of playerEntries) {
            const p = playersById.get(playerId);
            const playerLabel = `${p?.name ?? "Unknown"}`;
            const by = row.birthYear ?? "—";

            const lineReactionMain =
              padRight(playerLabel, 28) +
              " " +
              padLeft(String(by), 4) +
              " | " +
              padLeft(fmt(row.raw.reaction_5m_reaction_time_avg, 3), 5) +
              " " +
              padLeft(fmt(row.raw.reaction_5m_total_time_avg, 3), 5) +
              " | " +
              padLeft(fmt(row.norm.reaction_5m_reaction_time_avg_norm, 3), 5) +
              " " +
              padLeft(fmt(row.norm.reaction_5m_total_time_avg_norm, 3), 5);

            outLines.push(lineReactionMain);
          }

          outLines.push("");
          outLines.push("EXTRAS (not normalized)");
          const headerReactionExtras =
            padRight("Player", 28) +
            " " +
            padLeft("BY", 4) +
            " | " +
            "RTbest RTworst RTrange | TTbest TTworst TTrange";
          outLines.push(headerReactionExtras);
          outLines.push("-".repeat(headerReactionExtras.length));

          for (const [playerId, row] of playerEntries) {
            const p = playersById.get(playerId);
            const playerLabel = `${p?.name ?? "Unknown"}`;
            const by = row.birthYear ?? "—";

            const lineReactionExtras =
              padRight(playerLabel, 28) +
              " " +
              padLeft(String(by), 4) +
              " | " +
              padLeft(fmt(row.raw.reaction_5m_reaction_time_best, 3), 6) +
              " " +
              padLeft(fmt(row.raw.reaction_5m_reaction_time_worst, 3), 7) +
              " " +
              padLeft(
                fmt(row.raw.reaction_5m_reaction_consistency_range, 3),
                7
              ) +
              " | " +
              padLeft(fmt(row.raw.reaction_5m_total_time_best, 3), 6) +
              " " +
              padLeft(fmt(row.raw.reaction_5m_total_time_worst, 3), 7) +
              " " +
              padLeft(fmt(row.raw.reaction_5m_total_consistency_range, 3), 7);

            outLines.push(lineReactionExtras);
          }

          outLines.push("");

          // SINGLE-LEG HOP
          outLines.push("SINGLE-LEG HOP");
          outLines.push("MAIN (raw + normalized)");
          const headerHopMain =
            padRight("Player", 28) +
            " " +
            padLeft("BY", 4) +
            " | " +
            "raw  left  right  asym%" +
            " | " +
            "norm left  right  asym%";
          outLines.push(headerHopMain);
          outLines.push("-".repeat(headerHopMain.length));

          for (const [playerId, row] of playerEntries) {
            const p = playersById.get(playerId);
            const playerLabel = `${p?.name ?? "Unknown"}`;
            const by = row.birthYear ?? "—";

            const lineHopMain =
              padRight(playerLabel, 28) +
              " " +
              padLeft(String(by), 4) +
              " | " +
              padLeft(fmt(row.raw.single_leg_hop_left, 2), 5) +
              " " +
              padLeft(fmt(row.raw.single_leg_hop_right, 2), 5) +
              " " +
              padLeft(fmtPct(row.raw.single_leg_hop_asymmetry_pct, 1), 6) +
              " | " +
              padLeft(fmt(row.norm.single_leg_hop_left_norm, 3), 5) +
              " " +
              padLeft(fmt(row.norm.single_leg_hop_right_norm, 3), 5) +
              " " +
              padLeft(fmt(row.norm.single_leg_hop_asymmetry_pct_norm, 3), 6);

            outLines.push(lineHopMain);
          }

          outLines.push("");
          outLines.push("EXTRAS (not normalized)");
          const headerHopExtras =
            padRight("Player", 28) +
            " " +
            padLeft("BY", 4) +
            " | " +
            "Lavg  Ravg  Lrng  Rrng";
          outLines.push(headerHopExtras);
          outLines.push("-".repeat(headerHopExtras.length));

          for (const [playerId, row] of playerEntries) {
            const p = playersById.get(playerId);
            const playerLabel = `${p?.name ?? "Unknown"}`;
            const by = row.birthYear ?? "—";

            const lineHopExtras =
              padRight(playerLabel, 28) +
              " " +
              padLeft(String(by), 4) +
              " | " +
              padLeft(fmt(row.raw.single_leg_hop_left_avg, 2), 5) +
              " " +
              padLeft(fmt(row.raw.single_leg_hop_right_avg, 2), 5) +
              " " +
              padLeft(
                fmt(row.raw.single_leg_hop_left_consistency_range, 2),
                5
              ) +
              " " +
              padLeft(
                fmt(row.raw.single_leg_hop_right_consistency_range, 2),
                5
              );

            outLines.push(lineHopExtras);
          }

          outLines.push("");

          // ANKLE DORSIFLEXION
          outLines.push("ANKLE DORSIFLEXION");
          outLines.push("MAIN (raw + normalized)");
          const headerAnkleMain =
            padRight("Player", 28) +
            " " +
            padLeft("BY", 4) +
            " | " +
            "raw  Lcm   Rcm   Avg   asym%" +
            " | " +
            "norm Lcm   Rcm   Avg   asym%";
          outLines.push(headerAnkleMain);
          outLines.push("-".repeat(headerAnkleMain.length));

          for (const [playerId, row] of playerEntries) {
            const p = playersById.get(playerId);
            const playerLabel = `${p?.name ?? "Unknown"}`;
            const by = row.birthYear ?? "—";

            const lineAnkleMain =
              padRight(playerLabel, 28) +
              " " +
              padLeft(String(by), 4) +
              " | " +
              padLeft(fmt(row.raw.ankle_dorsiflex_left_cm, 2), 5) +
              " " +
              padLeft(fmt(row.raw.ankle_dorsiflex_right_cm, 2), 5) +
              " " +
              padLeft(fmt(row.raw.ankle_dorsiflex_avg_cm, 2), 5) +
              " " +
              padLeft(fmtPct(row.raw.ankle_dorsiflex_asymmetry_pct, 1), 6) +
              " | " +
              padLeft(fmt(row.norm.ankle_dorsiflex_left_cm_norm, 3), 5) +
              " " +
              padLeft(fmt(row.norm.ankle_dorsiflex_right_cm_norm, 3), 5) +
              " " +
              padLeft(fmt(row.norm.ankle_dorsiflex_avg_cm_norm, 3), 5) +
              " " +
              padLeft(fmt(row.norm.ankle_dorsiflex_asymmetry_pct_norm, 3), 6);

            outLines.push(lineAnkleMain);
          }

          outLines.push("");
          outLines.push("EXTRAS (not normalized)");
          const headerAnkleExtras =
            padRight("Player", 28) +
            " " +
            padLeft("BY", 4) +
            " | " +
            "L-R (cm)";
          outLines.push(headerAnkleExtras);
          outLines.push("-".repeat(headerAnkleExtras.length));

          for (const [playerId, row] of playerEntries) {
            const p = playersById.get(playerId);
            const playerLabel = `${p?.name ?? "Unknown"}`;
            const by = row.birthYear ?? "—";

            const lineAnkleExtras =
              padRight(playerLabel, 28) +
              " " +
              padLeft(String(by), 4) +
              " | " +
              padLeft(fmt(row.raw.ankle_dorsiflex_left_minus_right_cm, 2), 7);

            outLines.push(lineAnkleExtras);
          }

          outLines.push("");

          // CORE PLANK
          outLines.push("CORE PLANK");
          outLines.push("MAIN (raw + normalized)");
          const headerPlankMain =
            padRight("Player", 28) +
            " " +
            padLeft("BY", 4) +
            " | " +
            "raw  hold_sec  form" +
            " | " +
            "norm hold_sec  form";
          outLines.push(headerPlankMain);
          outLines.push("-".repeat(headerPlankMain.length));

          for (const [playerId, row] of playerEntries) {
            const p = playersById.get(playerId);
            const playerLabel = `${p?.name ?? "Unknown"}`;
            const by = row.birthYear ?? "—";

            const linePlankMain =
              padRight(playerLabel, 28) +
              " " +
              padLeft(String(by), 4) +
              " | " +
              padLeft(fmt(row.raw.core_plank_hold_sec, 0), 8) +
              " " +
              padLeft(fmt(row.raw.core_plank_form_flag, 0), 4) +
              " | " +
              padLeft(fmt(row.norm.core_plank_hold_sec_norm, 3), 8) +
              " " +
              padLeft(fmt(row.norm.core_plank_form_flag_norm, 0), 4);

            outLines.push(linePlankMain);
          }

          outLines.push("");
          outLines.push("EXTRAS (not normalized)");
          const headerPlankExtras =
            padRight("Player", 28) +
            " " +
            padLeft("BY", 4) +
            " | " +
            "hold_if_good_form";
          outLines.push(headerPlankExtras);
          outLines.push("-".repeat(headerPlankExtras.length));

          for (const [playerId, row] of playerEntries) {
            const p = playersById.get(playerId);
            const playerLabel = `${p?.name ?? "Unknown"}`;
            const by = row.birthYear ?? "—";

            const linePlankExtras =
              padRight(playerLabel, 28) +
              " " +
              padLeft(String(by), 4) +
              " | " +
              padLeft(fmt(row.raw.core_plank_hold_sec_if_good_form, 0), 16);

            outLines.push(linePlankExtras);
          }

          outLines.push("");

          // DOUBLE-LEG JUMPS
          outLines.push("DOUBLE-LEG JUMPS");
          outLines.push("MAIN (raw + normalized)");
          const headerJumpsMain =
            padRight("Player", 28) +
            " " +
            padLeft("BY", 4) +
            " | " +
            "raw  first10  total  last10  dropoff%" +
            " | " +
            "norm first10  total  last10  dropoff%";
          outLines.push(headerJumpsMain);
          outLines.push("-".repeat(headerJumpsMain.length));

          for (const [playerId, row] of playerEntries) {
            const p = playersById.get(playerId);
            const playerLabel = `${p?.name ?? "Unknown"}`;
            const by = row.birthYear ?? "—";

            const lineJumpsMain =
              padRight(playerLabel, 28) +
              " " +
              padLeft(String(by), 4) +
              " | " +
              padLeft(fmt(row.raw.double_leg_jumps_first10, 0), 7) +
              " " +
              padLeft(fmt(row.raw.double_leg_jumps_total_reps, 0), 5) +
              " " +
              padLeft(fmt(row.raw.double_leg_jumps_last10, 0), 6) +
              " " +
              padLeft(fmtPct(row.raw.double_leg_jumps_dropoff_pct, 1), 8) +
              " | " +
              padLeft(fmt(row.norm.double_leg_jumps_first10_norm, 3), 7) +
              " " +
              padLeft(fmt(row.norm.double_leg_jumps_total_reps_norm, 3), 5) +
              " " +
              padLeft(fmt(row.norm.double_leg_jumps_last10_norm, 3), 6) +
              " " +
              padLeft(fmt(row.norm.double_leg_jumps_dropoff_pct_norm, 3), 8);

            outLines.push(lineJumpsMain);
          }

          outLines.push("");
          outLines.push("EXTRAS (not normalized)");
          const headerJumpsExtras =
            padRight("Player", 28) +
            " " +
            padLeft("BY", 4) +
            " | " +
            "mid10  first20  last20";
          outLines.push(headerJumpsExtras);
          outLines.push("-".repeat(headerJumpsExtras.length));

          for (const [playerId, row] of playerEntries) {
            const p = playersById.get(playerId);
            const playerLabel = `${p?.name ?? "Unknown"}`;
            const by = row.birthYear ?? "—";

            const lineJumpsExtras =
              padRight(playerLabel, 28) +
              " " +
              padLeft(String(by), 4) +
              " | " +
              padLeft(fmt(row.raw.double_leg_jumps_mid10, 0), 5) +
              " " +
              padLeft(fmt(row.raw.double_leg_jumps_first20, 0), 7) +
              " " +
              padLeft(fmt(row.raw.double_leg_jumps_last20, 0), 6);

            outLines.push(lineJumpsExtras);
          }

          outLines.push("");
        }
      }

      await client.query("COMMIT");
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {}
      throw error;
    } finally {
      clientReleased = true;
      client.release();
    }

    return new NextResponse(
      `ok team=${teamId} evaluationsComputed=${evaluationsToCompute.length} playerEvaluationsUpserted=${playerEvaluationsUpserted}\n`,
      {
        status: 200,
        headers: { "content-type": "text/plain; charset=utf-8" },
      }
    );
  } catch (error: any) {
    console.error("[compute-all] error:", error);
    return new NextResponse(
      `error Failed to compute all data: ${error.message}\n`,
      {
        status: 500,
        headers: { "content-type": "text/plain; charset=utf-8" },
      }
    );
  } finally {
    if (!clientReleased) {
      client.release();
    }
  }
}
