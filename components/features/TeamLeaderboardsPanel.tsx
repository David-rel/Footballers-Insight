"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, TrendingDown, TrendingUp, Trophy } from "lucide-react";
import Button from "@/components/ui/Button";

type ClusterRanking = {
  id: string;
  name: string;
  top: { playerId: string; playerName: string; percent: number } | null;
  rankings: Array<{
    rank: number;
    playerId: string;
    playerName: string;
    percent: number;
  }>;
};

type TestRanking = {
  id: string;
  name: string;
  higherIsBetter: boolean;
  top:
    | { playerId: string; playerName: string; value: number; valueLabel: string }
    | null;
  rankings: Array<{
    rank: number;
    playerId: string;
    playerName: string;
    value: number;
    valueLabel: string;
  }>;
};

type Movers = {
  mostImproved: Array<{
    playerId: string;
    playerName: string;
    scorePct: number;
    improved?: Array<{
      testId: string;
      name: string;
      pct: number;
      oldRank: number | null;
      newRank: number | null;
      rankChange: number | null;
      oldValueLabel?: string;
      newValueLabel?: string;
      deltaValueLabel?: string;
    }>;
    declined?: Array<{
      testId: string;
      name: string;
      pct: number;
      oldRank: number | null;
      newRank: number | null;
      rankChange: number | null;
      oldValueLabel?: string;
      newValueLabel?: string;
      deltaValueLabel?: string;
    }>;
  }>;
  biggestDrop: Array<{
    playerId: string;
    playerName: string;
    scorePct: number;
    improved?: Array<{
      testId: string;
      name: string;
      pct: number;
      oldRank: number | null;
      newRank: number | null;
      rankChange: number | null;
      oldValueLabel?: string;
      newValueLabel?: string;
      deltaValueLabel?: string;
    }>;
    declined?: Array<{
      testId: string;
      name: string;
      pct: number;
      oldRank: number | null;
      newRank: number | null;
      rankChange: number | null;
      oldValueLabel?: string;
      newValueLabel?: string;
      deltaValueLabel?: string;
    }>;
  }>;
};

type TeamLeaderboardsResponse = {
  latestEvaluation: { id: string; name: string; createdAt: string } | null;
  previousEvaluation: { id: string; name: string; createdAt: string } | null;
  clusterRankings: ClusterRanking[];
  testRankings: TestRanking[];
  movers: Movers;
  allPlayerChanges?: any[];
};

export default function TeamLeaderboardsPanel({
  teamId,
  hideMovers = false,
}: {
  teamId: string;
  hideMovers?: boolean;
}) {
  const [data, setData] = useState<TeamLeaderboardsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showTests, setShowTests] = useState(false);
  const [showMovers, setShowMovers] = useState(!hideMovers);
  const [openCluster, setOpenCluster] = useState<Record<string, boolean>>({});
  const [openTests, setOpenTests] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let mounted = true;
    async function run() {
      try {
        setLoading(true);
        setError(null);
        setShowMovers(!hideMovers);
        const res = await fetch(`/api/teams/${teamId}/leaderboards`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error || "Failed to load leaderboards");
        }
        const json = (await res.json()) as TeamLeaderboardsResponse;
        if (mounted) setData(json);
      } catch (e: any) {
        if (mounted) setError(e.message || "Failed to load leaderboards");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    run();
    return () => {
      mounted = false;
    };
  }, [teamId]);

  const hasComparison = !!data?.previousEvaluation;

  const subtitle = useMemo(() => {
    if (!data?.latestEvaluation) return "";
    const latest = `${data.latestEvaluation.name} • ${new Date(
      data.latestEvaluation.createdAt
    ).toLocaleDateString()}`;
    if (!data.previousEvaluation) return latest;
    const prev = `${data.previousEvaluation.name} • ${new Date(
      data.previousEvaluation.createdAt
    ).toLocaleDateString()}`;
    return `${latest} (compared to ${prev})`;
  }, [data?.latestEvaluation, data?.previousEvaluation]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/60 p-6 mb-6">
        <div className="text-white/70">Loading leaderboards…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 mb-6">
        <div className="text-red-300 font-semibold mb-1">
          Couldn’t load leaderboards
        </div>
        <div className="text-red-200/80 text-sm">{error}</div>
      </div>
    );
  }

  if (!data?.latestEvaluation) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/60 p-6 mb-6">
        <div className="text-white font-semibold mb-1">Leaderboards</div>
        <div className="text-white/60 text-sm">No evaluations yet.</div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-black/60 p-6 mb-6">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-4">
        <div>
          <div className="text-white font-bold text-xl">Leaderboards</div>
          <div className="text-white/60 text-sm">{subtitle}</div>
          <div className="text-white/50 text-xs mt-1">
            Compared to your team. Higher is better unless it’s a time.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="border-white/10 text-white/80 hover:bg-white/10"
            onClick={() => setShowTests((v) => !v)}
          >
            {showTests ? "Hide 13 tests" : "Show 13 tests"}
          </Button>
          {!hideMovers ? (
            <Button
              variant="outline"
              className="border-white/10 text-white/80 hover:bg-white/10"
              onClick={() => setShowMovers((v) => !v)}
            >
              {showMovers ? "Hide improvements" : "Show improvements"}
            </Button>
          ) : null}
        </div>
      </div>

      {/* Main 4 */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {data.clusterRankings.map((c) => (
          <div
            key={c.id}
            className="rounded-xl border border-white/10 bg-white/5 p-4"
          >
            <div className="text-white/70 text-sm mb-1">{c.name}</div>
            <div className="flex items-center justify-between gap-3">
              <div className="text-white font-semibold truncate">
                {c.top?.playerName ?? "—"}
              </div>
              <div className="text-[#e3ca76] font-bold">
                {c.top?.percent === undefined ? "—" : `${c.top.percent}%`}
              </div>
            </div>
            <div className="mt-2 h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#e3ca76]/60 to-[#e3ca76]"
                style={{ width: `${c.top?.percent ?? 0}%` }}
              />
            </div>

            <button
              type="button"
              onClick={() =>
                setOpenCluster((s) => ({ ...s, [c.id]: !s[c.id] }))
              }
              className="mt-3 text-sm text-white/70 hover:text-white inline-flex items-center gap-2"
            >
              <span>{openCluster[c.id] ? "Hide ranking" : "Show ranking"}</span>
              {openCluster[c.id] ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>

            {openCluster[c.id] ? (
              <div className="mt-3 space-y-2">
                {c.rankings.map((r) => (
                  <div
                    key={r.playerId}
                    className="flex items-center justify-between text-sm"
                  >
                    <div className="text-white/80">
                      #{r.rank} {r.playerName}
                    </div>
                    <div className="text-white/70">{r.percent}%</div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {/* 13 tests */}
      {showTests ? (
        <div className="mt-6">
          <div className="text-white font-bold text-lg mb-3">
            13 tests (full rankings)
          </div>
          <div className="space-y-3">
            {data.testRankings.map((t) => (
              <div
                key={t.id}
                className="rounded-xl border border-white/10 bg-white/5 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-white font-semibold">{t.name}</div>
                    <div className="text-white/60 text-sm">
                      Top: {t.top?.playerName ?? "—"} •{" "}
                      <span className="text-white/80 font-semibold">
                        {t.top?.valueLabel ?? "—"}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setOpenTests((s) => ({ ...s, [t.id]: !s[t.id] }))
                    }
                    className="text-sm text-white/70 hover:text-white inline-flex items-center gap-2"
                  >
                    <span>
                      {openTests[t.id] ? "Hide ranking" : "Show ranking"}
                    </span>
                    {openTests[t.id] ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                </div>

                {openTests[t.id] ? (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-white/5 border-b border-white/10">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-white/80">
                            Rank
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-white/80">
                            Player
                          </th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-white/80">
                            Value
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/10">
                        {t.rankings.map((r) => (
                          <tr key={r.playerId} className="hover:bg-white/5">
                            <td className="px-3 py-2 text-white/70 text-sm">
                              #{r.rank}
                            </td>
                            <td className="px-3 py-2 text-white/90 text-sm">
                              <div className="flex items-center gap-2">
                                {r.rank === 1 ? (
                                  <Trophy className="w-4 h-4 text-[#e3ca76]" />
                                ) : null}
                                <span>{r.playerName}</span>
                              </div>
                            </td>
                            <td className="px-3 py-2 text-right text-white font-semibold text-sm">
                              {r.valueLabel}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Movers */}
      {!hideMovers && showMovers ? (
        <div className="mt-6">
          <div className="text-white font-bold text-lg mb-3">
            Improvements since last check-in
          </div>
          {!hasComparison ? (
            <div className="text-white/60 text-sm">
              Add at least 2 evaluations to see who improved the most.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center gap-2 text-white/90 font-semibold mb-3">
                  <TrendingUp className="w-4 h-4 text-green-300" />
                  Most improved
                </div>
                {data.movers.mostImproved.length ? (
                  <div className="space-y-2">
                    {data.movers.mostImproved.map((p, idx) => (
                      <div key={p.playerId} className="rounded-lg bg-black/30 border border-white/10 p-3">
                        <div className="flex items-center justify-between">
                          <div className="text-white/80">
                            {idx + 1}. {p.playerName}
                          </div>
                          <div className="text-green-300 font-semibold">
                            +{p.scorePct}%
                          </div>
                        </div>
                        {p.improved?.length ? (
                          <div className="mt-2 text-xs text-white/60">
                            Biggest improvements:
                            <div className="mt-1 space-y-1">
                              {p.improved.map((c) => (
                                <div key={c.testId} className="flex items-center justify-between gap-3">
                                  <div className="text-white/70">{c.name}</div>
                                  <div className="text-white/60">
                                    {c.oldRank && c.newRank
                                      ? `#${c.oldRank} → #${c.newRank} (${c.rankChange && c.rankChange > 0 ? "+" : ""}${c.rankChange ?? 0})`
                                      : "—"}
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div className="mt-2 space-y-1">
                              {p.improved.map((c) => (
                                <div key={`${c.testId}-v`} className="flex items-center justify-between gap-3">
                                  <div className="text-white/50">Values</div>
                                  <div className="text-white/60">
                                    {c.oldValueLabel && c.newValueLabel
                                      ? `${c.oldValueLabel} → ${c.newValueLabel}`
                                      : "—"}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-white/60 text-sm">No data yet.</div>
                )}
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center gap-2 text-white/90 font-semibold mb-3">
                  <TrendingDown className="w-4 h-4 text-red-300" />
                  Biggest drop
                </div>
                {data.movers.biggestDrop.length ? (
                  <div className="space-y-2">
                    {data.movers.biggestDrop.map((p, idx) => (
                      <div key={p.playerId} className="rounded-lg bg-black/30 border border-white/10 p-3">
                        <div className="flex items-center justify-between">
                          <div className="text-white/80">
                            {idx + 1}. {p.playerName}
                          </div>
                          <div className="text-red-300 font-semibold">
                            {p.scorePct}%
                          </div>
                        </div>
                        {p.declined?.length ? (
                          <div className="mt-2 text-xs text-white/60">
                            Biggest drops:
                            <div className="mt-1 space-y-1">
                              {p.declined.map((c) => (
                                <div key={c.testId} className="flex items-center justify-between gap-3">
                                  <div className="text-white/70">{c.name}</div>
                                  <div className="text-white/60">
                                    {c.oldRank && c.newRank
                                      ? `#${c.oldRank} → #${c.newRank} (${c.rankChange && c.rankChange > 0 ? "+" : ""}${c.rankChange ?? 0})`
                                      : "—"}
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div className="mt-2 space-y-1">
                              {p.declined.map((c) => (
                                <div key={`${c.testId}-v`} className="flex items-center justify-between gap-3">
                                  <div className="text-white/50">Values</div>
                                  <div className="text-white/60">
                                    {c.oldValueLabel && c.newValueLabel
                                      ? `${c.oldValueLabel} → ${c.newValueLabel}`
                                      : "—"}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-white/60 text-sm">
                    No one got worse overall in this check-in.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}


