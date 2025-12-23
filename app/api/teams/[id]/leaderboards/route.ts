import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type TestDef = {
  id: string;
  name: string;
  higherIsBetter: boolean;
  // key in overall_scores JSON (optional if derived)
  key?: string;
  // derived metric from overall JSON
  derive?: (scores: Record<string, any>) => number | null;
  format?: (v: number) => string;
};

function toFiniteNumber(v: any): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim().length) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function formatMax3(v: number) {
  if (!Number.isFinite(v)) return "—";
  if (Number.isInteger(v)) return String(v);
  return String(Number(v.toFixed(3)));
}

function rankPlayers(
  rows: Array<{ playerId: string; playerName: string; value: number }>,
  higherIsBetter: boolean
) {
  const sorted = [...rows].sort((a, b) => {
    if (higherIsBetter) return b.value - a.value;
    return a.value - b.value;
  });

  const ranked: Array<{
    rank: number;
    playerId: string;
    playerName: string;
    value: number;
  }> = [];

  let rank = 0;
  let lastValue: number | null = null;
  for (let i = 0; i < sorted.length; i++) {
    const v = sorted[i].value;
    if (lastValue === null || v !== lastValue) {
      rank = i + 1;
      lastValue = v;
    }
    ranked.push({ rank, ...sorted[i] });
  }

  const rankByPlayerId = new Map<string, number>();
  for (const r of ranked) rankByPlayerId.set(r.playerId, r.rank);

  return { ranked, rankByPlayerId };
}

const TESTS: TestDef[] = [
  {
    id: "onevone",
    name: "1v1",
    higherIsBetter: true,
    key: "one_v_one_avg_score",
  },
  {
    id: "agility",
    name: "Agility (5-10-5)",
    higherIsBetter: false,
    key: "agility_5_10_5_best_time",
    format: (v) => `${formatMax3(v)}s`,
  },
  {
    id: "ankle",
    name: "Ankle Mobility",
    higherIsBetter: true,
    key: "ankle_dorsiflex_avg_cm",
    format: (v) => `${formatMax3(v)}cm`,
  },
  {
    id: "jumps",
    name: "Double Leg Jumps",
    higherIsBetter: true,
    key: "double_leg_jumps_total_reps",
  },
  {
    id: "core",
    name: "Core Plank",
    higherIsBetter: true,
    key: "core_plank_hold_sec_if_good_form",
    format: (v) => `${formatMax3(v)}s`,
  },
  {
    id: "hop",
    name: "Single Leg Hop",
    higherIsBetter: true,
    derive: (s) => {
      const l = toFiniteNumber(s?.single_leg_hop_left);
      const r = toFiniteNumber(s?.single_leg_hop_right);
      if (l === null && r === null) return null;
      if (l === null) return r;
      if (r === null) return l;
      return Math.max(l, r);
    },
    format: (v) => formatMax3(v),
  },
  {
    id: "juggling",
    name: "Juggling",
    higherIsBetter: true,
    key: "juggle_best",
  },
  {
    id: "skillmoves",
    name: "Skill Moves",
    higherIsBetter: true,
    key: "skill_moves_avg_rating",
  },
  {
    id: "figure8",
    name: "Figure 8",
    higherIsBetter: true,
    key: "figure8_loops_both",
  },
  {
    id: "passing",
    name: "Passing Gates",
    higherIsBetter: true,
    key: "passing_gates_total_hits",
  },
  {
    id: "reaction",
    name: "Reaction Sprint (5m)",
    higherIsBetter: false,
    key: "reaction_5m_total_time_best",
    format: (v) => `${formatMax3(v)}s`,
  },
  {
    id: "shotpower",
    name: "Shot Power",
    higherIsBetter: true,
    key: "shot_power_strong_avg",
  },
  {
    id: "serve",
    name: "Serve Distance",
    higherIsBetter: true,
    key: "serve_distance_strong_avg",
  },
];

function getMetricValue(
  def: TestDef,
  scores: Record<string, any>
): number | null {
  if (def.derive) return def.derive(scores);
  if (def.key) return toFiniteNumber(scores?.[def.key]);
  return null;
}

function formatValue(def: TestDef, v: number) {
  return def.format ? def.format(v) : formatMax3(v);
}

function pctChange(oldV: number, newV: number, higherIsBetter: boolean) {
  // positive means improved
  if (!Number.isFinite(oldV) || !Number.isFinite(newV)) return null;
  if (oldV === 0) return null;
  return higherIsBetter
    ? (newV - oldV) / Math.abs(oldV)
    : (oldV - newV) / Math.abs(oldV);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session || !session.user?.email || !session.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id: teamId } = await params;

    // Get user's role and company_id
    const userResult = await pool.query(
      "SELECT role, company_id FROM users WHERE id = $1",
      [session.user.id]
    );
    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userRole: string = userResult.rows[0].role;

    // Players/parents cannot access team leaderboards
    if (userRole === "player" || userRole === "parent") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    let companyId: string | null = userResult.rows[0].company_id;
    if (userRole === "owner" && !companyId) {
      const companyResult = await pool.query(
        "SELECT id FROM companies WHERE owner_id = $1",
        [session.user.id]
      );
      if (companyResult.rows.length > 0) companyId = companyResult.rows[0].id;
    }
    if (!companyId) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const teamResult = await pool.query(
      "SELECT id, company_id, coach_id FROM teams WHERE id = $1",
      [teamId]
    );
    if (teamResult.rows.length === 0) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }
    const team = teamResult.rows[0];

    if (userRole === "coach" && team.coach_id !== session.user.id) {
      return NextResponse.json(
        { error: "Unauthorized to view this team" },
        { status: 403 }
      );
    }
    if (userRole !== "coach" && team.company_id !== companyId) {
      return NextResponse.json(
        { error: "Unauthorized to view this team" },
        { status: 403 }
      );
    }

    // Latest + previous evaluation IDs (used for improvement)
    const evals = await pool.query(
      "SELECT id, name, created_at FROM evaluations WHERE team_id = $1 ORDER BY created_at DESC NULLS LAST LIMIT 2",
      [teamId]
    );

    const latestEval = evals.rows[0] ?? null;
    const previousEval = evals.rows[1] ?? null;

    if (!latestEval) {
      return NextResponse.json(
        {
          latestEvaluation: null,
          previousEvaluation: null,
          clusterLeaders: [],
          testLeaders: [],
          movers: { mostImproved: [], biggestDrop: [] },
        },
        { status: 200 }
      );
    }

    // Player names
    const playersRes = await pool.query(
      "SELECT id, first_name, last_name FROM players WHERE team_id = $1",
      [teamId]
    );
    const nameByPlayerId = new Map<string, string>();
    for (const r of playersRes.rows) {
      const name =
        `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim() || "Player";
      nameByPlayerId.set(r.id, name);
    }

    // Latest evaluation: overall + cluster per player
    const latestRows = await pool.query(
      `SELECT
        pe.player_id,
        os.scores as overall_scores,
        pc.cluster as player_cluster
      FROM player_evaluations pe
      LEFT JOIN overall_scores os ON os.player_evaluation_id = pe.id
      LEFT JOIN player_cluster pc ON pc.player_evaluation_id = pe.id
      WHERE pe.team_id = $1 AND pe.evaluation_id = $2`,
      [teamId, latestEval.id]
    );

    const latestByPlayer = new Map<
      string,
      { overall: Record<string, any>; cluster: Record<string, any> }
    >();
    for (const r of latestRows.rows) {
      const overall =
        typeof r.overall_scores === "string"
          ? JSON.parse(r.overall_scores)
          : r.overall_scores ?? {};
      const cluster =
        typeof r.player_cluster === "string"
          ? JSON.parse(r.player_cluster)
          : r.player_cluster ?? {};
      latestByPlayer.set(r.player_id, { overall, cluster });
    }

    // Cluster leaders (4 main bars)
    const dims: Array<{ key: "ps" | "tc" | "ms" | "dc"; name: string }> = [
      { key: "ps", name: "Power / Strength" },
      { key: "tc", name: "Technique / Control" },
      { key: "ms", name: "Mobility / Stability" },
      { key: "dc", name: "Decision / Cognition" },
    ];

    const clusterRankings = dims.map((d) => {
      const rows: Array<{
        playerId: string;
        playerName: string;
        value: number;
      }> = [];
      for (const [playerId, row] of latestByPlayer.entries()) {
        const v = toFiniteNumber(row.cluster?.[d.key]);
        if (v === null) continue;
        rows.push({
          playerId,
          playerName: nameByPlayerId.get(playerId) ?? "Player",
          value: v,
        });
      }
      const { ranked } = rankPlayers(rows, true);
      const top = ranked[0] ?? null;
      return {
        id: d.key,
        name: d.name,
        top: top
          ? {
              playerId: top.playerId,
              playerName: top.playerName,
              percent: Math.round(top.value * 100),
            }
          : null,
        rankings: ranked.map((r) => ({
          rank: r.rank,
          playerId: r.playerId,
          playerName: r.playerName,
          percent: Math.round(r.value * 100),
          value: r.value,
        })),
      };
    });

    // Test leaders (13)
    const testRankings = TESTS.map((t) => {
      const rows: Array<{
        playerId: string;
        playerName: string;
        value: number;
      }> = [];
      for (const [playerId, row] of latestByPlayer.entries()) {
        const v = getMetricValue(t, row.overall);
        if (v === null) continue;
        rows.push({
          playerId,
          playerName: nameByPlayerId.get(playerId) ?? "Player",
          value: v,
        });
      }
      const { ranked, rankByPlayerId } = rankPlayers(rows, t.higherIsBetter);
      const top = ranked[0] ?? null;
      return {
        id: t.id,
        name: t.name,
        higherIsBetter: t.higherIsBetter,
        top: top
          ? {
              playerId: top.playerId,
              playerName: top.playerName,
              value: top.value,
              valueLabel: t.format
                ? t.format(top.value)
                : formatMax3(top.value),
            }
          : null,
        rankings: ranked.map((r) => ({
          rank: r.rank,
          playerId: r.playerId,
          playerName: r.playerName,
          value: r.value,
          valueLabel: t.format ? t.format(r.value) : formatMax3(r.value),
        })),
        rankByPlayerId,
      };
    });

    // Movers: compare latest vs previous evaluation (if exists)
    const mostImproved: Array<any> = [];
    const biggestDrop: Array<any> = [];

    if (previousEval) {
      const prevRows = await pool.query(
        `SELECT
          pe.player_id,
          os.scores as overall_scores
        FROM player_evaluations pe
        LEFT JOIN overall_scores os ON os.player_evaluation_id = pe.id
        WHERE pe.team_id = $1 AND pe.evaluation_id = $2`,
        [teamId, previousEval.id]
      );

      const prevByPlayer = new Map<string, Record<string, any>>();
      for (const r of prevRows.rows) {
        const overall =
          typeof r.overall_scores === "string"
            ? JSON.parse(r.overall_scores)
            : r.overall_scores ?? {};
        prevByPlayer.set(r.player_id, overall);
      }

      // Build previous rankings per test (for rank movement)
      const prevRankByTestId = new Map<string, Map<string, number>>();
      for (const t of TESTS) {
        const rows: Array<{
          playerId: string;
          playerName: string;
          value: number;
        }> = [];
        for (const [playerId, prev] of prevByPlayer.entries()) {
          const v = getMetricValue(t, prev);
          if (v === null) continue;
          rows.push({
            playerId,
            playerName: nameByPlayerId.get(playerId) ?? "Player",
            value: v,
          });
        }
        const { rankByPlayerId } = rankPlayers(rows, t.higherIsBetter);
        prevRankByTestId.set(t.id, rankByPlayerId);
      }

      const latestRankByTestId = new Map<string, Map<string, number>>();
      for (const t of TESTS) {
        const entry = testRankings.find((x) => x.id === t.id);
        if (!entry) continue;
        // rebuild a rankByPlayer map from rankings (since we don't want to return Map to client)
        const m = new Map<string, number>();
        for (const r of entry.rankings) m.set(r.playerId, r.rank);
        latestRankByTestId.set(t.id, m);
      }

      const scores: Array<{
        playerId: string;
        score: number; // normalized [-1..1], + means improved
        scorePct: number;
        changes: Array<any>;
        improved: Array<any>;
        declined: Array<any>;
      }> = [];

      for (const [playerId, latest] of latestByPlayer.entries()) {
        const prev = prevByPlayer.get(playerId);
        if (!prev) continue;

        const changes: Array<{
          testId: string;
          name: string;
          pct: number;
          oldRank: number | null;
          newRank: number | null;
          rankChange: number | null; // + means moved up
          oldValue: number;
          newValue: number;
          oldValueLabel: string;
          newValueLabel: string;
          deltaValue: number; // + means improved
          deltaValueLabel: string;
          contrib: number; // normalized [-1..1], + means improved
        }> = [];
        for (const t of TESTS) {
          const a = getMetricValue(t, prev);
          const b = getMetricValue(t, latest.overall);
          if (a === null || b === null) continue;
          const pct = pctChange(a, b, t.higherIsBetter);
          if (pct === null) continue;
          // clamp to avoid insane spikes
          const clamped = clamp(pct, -1, 1);
          const prevRanks = prevRankByTestId.get(t.id);
          const latestRanks = latestRankByTestId.get(t.id);
          const oldRank = prevRanks?.get(playerId) ?? null;
          const newRank = latestRanks?.get(playerId) ?? null;
          const rankChange =
            oldRank === null || newRank === null ? null : oldRank - newRank; // + is good
          const latestEntry = testRankings.find((x) => x.id === t.id);
          const n = latestEntry?.rankings?.length ?? 0;
          const rankContrib =
            rankChange !== null && n > 1
              ? clamp(rankChange / (n - 1), -1, 1)
              : null;
          const contrib = rankContrib ?? clamped;
          const deltaValue = t.higherIsBetter ? b - a : a - b; // + is good
          changes.push({
            testId: t.id,
            name: t.name,
            pct: clamped,
            oldRank,
            newRank,
            rankChange,
            oldValue: a,
            newValue: b,
            oldValueLabel: formatValue(t, a),
            newValueLabel: formatValue(t, b),
            deltaValue,
            deltaValueLabel: formatValue(t, Math.abs(deltaValue)),
            contrib,
          });
        }

        if (changes.length === 0) continue;
        const meaningful = changes.filter(
          (c) =>
            (c.rankChange !== null && c.rankChange !== 0) ||
            Math.abs(c.contrib) >= 0.05
        );
        const considered = meaningful.length ? meaningful : changes;
        const score =
          considered.reduce((s, c) => s + c.contrib, 0) / considered.length;
        const scorePct = Math.round(score * 100);

        const improved = [...changes]
          .filter((c) => c.contrib > 0)
          .sort((a, b) => b.contrib - a.contrib)
          .slice(0, 3);
        const declined = [...changes]
          .filter((c) => c.contrib < 0)
          .sort((a, b) => a.contrib - b.contrib)
          .slice(0, 3);

        scores.push({
          playerId,
          score,
          changes,
          improved,
          declined,
          scorePct,
        });
      }

      scores.sort((a, b) => b.score - a.score);
      const top = scores.slice(0, 5);
      const bottom = [...scores]
        .filter((s) => s.score < 0)
        .sort((a, b) => a.score - b.score)
        .slice(0, 5);

      for (const row of top) {
        mostImproved.push({
          playerId: row.playerId,
          playerName: nameByPlayerId.get(row.playerId) ?? "Player",
          scorePct: row.scorePct,
          improved: row.improved,
          declined: row.declined,
        });
      }
      for (const row of bottom) {
        biggestDrop.push({
          playerId: row.playerId,
          playerName: nameByPlayerId.get(row.playerId) ?? "Player",
          scorePct: row.scorePct,
          improved: row.improved,
          declined: row.declined,
        });
      }
    }

    return NextResponse.json(
      {
        latestEvaluation: {
          id: latestEval.id,
          name: latestEval.name,
          createdAt: latestEval.created_at,
        },
        previousEvaluation: previousEval
          ? {
              id: previousEval.id,
              name: previousEval.name,
              createdAt: previousEval.created_at,
            }
          : null,
        clusterRankings,
        testRankings: testRankings.map((t) => ({
          id: t.id,
          name: t.name,
          higherIsBetter: t.higherIsBetter,
          top: t.top,
          rankings: t.rankings,
        })),
        movers: { mostImproved, biggestDrop },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Get team leaderboards error:", error);
    return NextResponse.json(
      { error: "Failed to get team leaderboards", details: error.message },
      { status: 500 }
    );
  }
}
