"use client";

import { useEffect, useMemo, useState } from "react";

type Role = "owner" | "admin" | "coach" | "parent" | "player";

type TeamOption = {
  id: string;
  name: string;
  description?: string | null;
  playerCount?: number;
  coach?: { id: string; name?: string | null; email?: string | null } | null;
};

type LeaderboardsSummary = {
  latestEvaluation: { id: string; name: string; createdAt: string } | null;
  previousEvaluation: { id: string; name: string; createdAt: string } | null;
  allPlayerChanges?: Array<{
    playerId: string;
    playerName: string;
    scorePct: number;
  }>;
};

type ClusterRanking = {
  id: string;
  name: string;
  top: { playerId: string; playerName: string; percent: number } | null;
  rankings: Array<{
    rank: number;
    playerId: string;
    playerName: string;
    percent: number;
    value?: number;
  }>;
};

type TestRanking = {
  id: string;
  name: string;
  higherIsBetter: boolean;
  top: {
    playerId: string;
    playerName: string;
    value: number;
    valueLabel: string;
  } | null;
  rankings: Array<{
    rank: number;
    playerId: string;
    playerName: string;
    value: number;
    valueLabel: string;
  }>;
};

type TeamLeaderboardsFull = {
  latestEvaluation: { id: string; name: string; createdAt: string } | null;
  previousEvaluation: { id: string; name: string; createdAt: string } | null;
  clusterRankings: ClusterRanking[];
  testRankings: TestRanking[];
  allPlayerChanges?: Array<{
    playerId: string;
    playerName: string;
    scorePct: number;
  }>;
};

type TeamRow = {
  team: TeamOption;
  loading: boolean;
  error: string | null;
  leaderboards: LeaderboardsSummary | null;
};

type TeamAiCacheResponse = {
  report: any;
  cached: boolean;
  stale?: boolean;
  createdAt?: string | null;
  message?: string;
};

type PlayerAiCacheResponse = {
  report: any;
  cached: boolean;
  stale?: boolean;
  createdAt?: string | null;
  message?: string;
};

function toArr(v: any): string[] {
  if (Array.isArray(v)) return v.filter((x) => typeof x === "string");
  if (typeof v === "string" && v.trim()) return [v.trim()];
  return [];
}

function avgNumber(values: number[]) {
  if (!values.length) return null;
  return values.reduce((s, x) => s + x, 0) / values.length;
}

function normKey(s: string) {
  return s.trim().toLowerCase();
}

function inferCohortFromTeamName(
  name: string
): { year: string; gender: "boys" | "girls" } | null {
  const lower = name.toLowerCase();
  const yearMatch = lower.match(/\b(20\d{2})\b/);
  if (!yearMatch) return null;
  const year = yearMatch[1];
  const gender: "boys" | "girls" | null = /\bboys?\b/.test(lower)
    ? "boys"
    : /\bgirls?\b/.test(lower)
    ? "girls"
    : null;
  if (!gender) return null;
  return { year, gender };
}

function inferCohortFromPlayers(
  players: any[]
): { year: string; gender: "boys" | "girls" } | null {
  if (!Array.isArray(players) || players.length === 0) return null;

  const yearCounts = new Map<string, number>();
  const genderCounts = new Map<"boys" | "girls", number>();

  for (const p of players) {
    const ag = String(p?.ageGroup ?? p?.age_group ?? "").trim();
    const yearMatch = ag.match(/\b(20\d{2})\b/);
    if (yearMatch)
      yearCounts.set(yearMatch[1], (yearCounts.get(yearMatch[1]) ?? 0) + 1);

    const gRaw = String(p?.gender ?? "")
      .trim()
      .toLowerCase();
    const mapped: "boys" | "girls" | null =
      gRaw === "male" || gRaw === "m" || gRaw === "boy" || gRaw === "boys"
        ? "boys"
        : gRaw === "female" ||
          gRaw === "f" ||
          gRaw === "girl" ||
          gRaw === "girls"
        ? "girls"
        : null;
    if (mapped) genderCounts.set(mapped, (genderCounts.get(mapped) ?? 0) + 1);
  }

  const bestYear =
    [...yearCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const bestGender =
    [...genderCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  if (!bestYear || !bestGender) return null;
  return { year: bestYear, gender: bestGender };
}

function overlapKeyForPlayer(p: any) {
  const first = String(p?.firstName ?? p?.first_name ?? "").trim();
  const last = String(p?.lastName ?? p?.last_name ?? "").trim();
  const dob = String(p?.dob ?? "").trim();
  const name = `${first} ${last}`.trim();
  if (!name) return null;
  return dob ? `${normKey(name)}|${dob}` : normKey(name);
}

function scoreSummary(allPlayerChanges?: Array<{ scorePct: number }>) {
  const list = Array.isArray(allPlayerChanges) ? allPlayerChanges : [];
  if (!list.length) return null;
  const avgRaw =
    list.reduce(
      (s, x) => s + (typeof x.scorePct === "number" ? x.scorePct : 0),
      0
    ) / list.length;
  const avg = Math.round(avgRaw * 10) / 10; // 1 decimal for truthfulness
  const improved = list.filter((x) => x.scorePct > 0).length;
  const declined = list.filter((x) => x.scorePct < 0).length;
  return { avg, improved, declined, total: list.length };
}

export function AiStatsCompanyAdminView() {
  const [role, setRole] = useState<Role | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(false);

  // Team AI cache modal
  const [teamAiOpen, setTeamAiOpen] = useState(false);
  const [teamAiLoading, setTeamAiLoading] = useState(false);
  const [teamAiError, setTeamAiError] = useState<string | null>(null);
  const [teamAiSelected, setTeamAiSelected] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [teamAiData, setTeamAiData] = useState<TeamAiCacheResponse | null>(
    null
  );

  // Player AI cache modal (reuse same idea as coach view)
  const [playerAiOpen, setPlayerAiOpen] = useState(false);
  const [playerAiLoading, setPlayerAiLoading] = useState(false);
  const [playerAiError, setPlayerAiError] = useState<string | null>(null);
  const [playerAiSelected, setPlayerAiSelected] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [playerAiData, setPlayerAiData] =
    useState<PlayerAiCacheResponse | null>(null);

  // Expand team to view roster + player AI buttons
  const [openTeams, setOpenTeams] = useState<Record<string, boolean>>({});
  const [teamPlayers, setTeamPlayers] = useState<Record<string, any[]>>({});
  const [teamPlayersLoading, setTeamPlayersLoading] = useState<
    Record<string, boolean>
  >({});

  // Compare teams (up to 5)
  const [compareTeamIds, setCompareTeamIds] = useState<string[]>([]);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);
  const [compareLeaderboards, setCompareLeaderboards] = useState<
    Record<string, TeamLeaderboardsFull>
  >({});

  const [cohortYear, setCohortYear] = useState<string>("");
  const [cohortGender, setCohortGender] = useState<"" | "boys" | "girls">("");
  const [teamCohorts, setTeamCohorts] = useState<
    Record<string, { year: string; gender: "boys" | "girls" } | null>
  >({});
  const [cohortLoading, setCohortLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const res = await fetch("/api/user/profile");
        const data = await res.json().catch(() => null);
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

  useEffect(() => {
    let mounted = true;
    async function loadTeams() {
      if (!role) return;
      if (role !== "owner" && role !== "admin") return;
      setError(null);
      setLoadingTeams(true);
      try {
        const res = await fetch("/api/teams");
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || "Failed to load teams");
        const list: TeamOption[] = Array.isArray(data?.teams) ? data.teams : [];
        if (!mounted) return;

        // Initialize rows
        const rows: TeamRow[] = list.map((t) => ({
          team: t,
          loading: true,
          error: null,
          leaderboards: null,
        }));
        setTeams(rows);

        // Load leaderboards for each team (for cross-team comparison)
        const results = await Promise.all(
          list.map(async (t) => {
            const r = await fetch(`/api/teams/${t.id}/leaderboards`);
            const j = await r.json().catch(() => null);
            if (!r.ok)
              throw new Error(j?.error || "Failed to load leaderboards");
            const allPlayerChanges = Array.isArray(j?.allPlayerChanges)
              ? j.allPlayerChanges
                  .map((x: any) => ({
                    playerId: x?.playerId,
                    playerName: x?.playerName,
                    scorePct:
                      typeof x?.scorePct === "number"
                        ? x.scorePct
                        : Number.isFinite(Number(x?.scorePct))
                        ? Number(x.scorePct)
                        : null,
                  }))
                  // Only include players with comparable data (avoid biasing Avg to 0)
                  .filter(
                    (x: any) =>
                      typeof x?.playerId === "string" &&
                      typeof x?.playerName === "string" &&
                      typeof x?.scorePct === "number" &&
                      Number.isFinite(x.scorePct)
                  )
              : [];

            const leaderboards: LeaderboardsSummary = {
              latestEvaluation: j?.latestEvaluation ?? null,
              previousEvaluation: j?.previousEvaluation ?? null,
              allPlayerChanges,
            };
            return { teamId: t.id, leaderboards };
          })
        );

        if (!mounted) return;
        setTeams((prev) =>
          prev.map((row) => {
            const found = results.find((r) => r.teamId === row.team.id);
            return found
              ? {
                  ...row,
                  loading: false,
                  error: null,
                  leaderboards: found.leaderboards,
                }
              : { ...row, loading: false };
          })
        );

        // Build cohort options from actual roster data (ageGroup + gender), per team
        setCohortLoading(true);
        try {
          const rosterResults = await Promise.all(
            list.map(async (t) => {
              try {
                const r = await fetch(`/api/teams/${t.id}/players`);
                const j = await r.json().catch(() => null);
                if (!r.ok) return { teamId: t.id, players: [] as any[] };
                return {
                  teamId: t.id,
                  players: Array.isArray(j?.players) ? j.players : [],
                };
              } catch {
                return { teamId: t.id, players: [] as any[] };
              }
            })
          );
          if (!mounted) return;

          const next: Record<
            string,
            { year: string; gender: "boys" | "girls" } | null
          > = {};
          for (const rr of rosterResults) {
            const rosterCohort = inferCohortFromPlayers(rr.players);
            const nameFallback = inferCohortFromTeamName(
              list.find((t) => t.id === rr.teamId)?.name ?? ""
            );
            next[rr.teamId] = rosterCohort ?? nameFallback;
          }
          setTeamCohorts(next);
        } finally {
          if (mounted) setCohortLoading(false);
        }
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || "Failed to load company teams");
      } finally {
        if (mounted) setLoadingTeams(false);
      }
    }
    loadTeams();
    return () => {
      mounted = false;
    };
  }, [role]);

  const sortedTeams = useMemo(() => {
    const withScore = teams.map((r) => {
      const s = scoreSummary(r.leaderboards?.allPlayerChanges);
      return { row: r, score: s?.avg ?? -9999 };
    });
    withScore.sort((a, b) => b.score - a.score);
    return withScore.map((x) => x.row);
  }, [teams]);

  const cohortOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of teams) {
      const c =
        teamCohorts[row.team.id] ?? inferCohortFromTeamName(row.team.name);
      if (!c) continue;
      const key = `${c.year}|${c.gender}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const items = [...counts.entries()]
      .map(([key, count]) => {
        const [year, gender] = key.split("|") as [string, "boys" | "girls"];
        return { year, gender, count };
      })
      .sort((a, b) =>
        a.year === b.year
          ? a.gender.localeCompare(b.gender)
          : a.year.localeCompare(b.year)
      );
    const years = [...new Set(items.map((x) => x.year))].sort();
    return { items, years };
  }, [teams, teamCohorts]);

  if (loadingProfile) {
    return (
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-white">
          Company Stats Analysis (Beta)
        </h1>
        <div className="mt-6 text-white/70 text-sm">Loading…</div>
      </div>
    );
  }

  // Hard gate: no coach/parent/player access
  if (role !== "owner" && role !== "admin") {
    return (
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-white">
          Company Stats Analysis (Beta)
        </h1>
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5 text-white/70 text-sm">
          Access denied.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold text-white">Company Stats Analysis (Beta)</h1>
      <div className="text-white/60 text-sm mt-2">
        This feature is still under review and results may be inconclusive.
      </div>

      {/* Compare panel */}
      <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-white font-semibold">Compare teams</div>
          </div>
          <div className="text-xs text-white/50">
            Selected:{" "}
            <span className="text-white/70 font-semibold">
              {compareTeamIds.length}
            </span>
            /5
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
          <div className="text-white font-semibold">Compare by age group</div>
          {cohortLoading ? (
            <div className="text-xs text-white/50 mt-2">
              Loading…
            </div>
          ) : null}

          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <select
              value={cohortYear}
              onChange={(e) => setCohortYear(e.target.value)}
              className="rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-white outline-none focus:border-[#e3ca76]/50"
            >
              <option value="" className="bg-black">
                Age group year…
              </option>
              {cohortOptions.years.map((y) => (
                <option key={y} value={y} className="bg-black">
                  {y}
                </option>
              ))}
            </select>

            <select
              value={cohortGender}
              onChange={(e) => setCohortGender(e.target.value as any)}
              className="rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-white outline-none focus:border-[#e3ca76]/50"
            >
              <option value="" className="bg-black">
                Gender…
              </option>
              <option value="boys" className="bg-black">
                Boys
              </option>
              <option value="girls" className="bg-black">
                Girls
              </option>
            </select>

            <button
              type="button"
              disabled={!cohortYear || !cohortGender}
              onClick={() => {
                setCompareError(null);
                setCompareLeaderboards({});
                const matches = teams
                  .map((t) => t.team)
                  .filter((t) => {
                    const c =
                      teamCohorts[t.id] ?? inferCohortFromTeamName(t.name);
                    return (
                      !!c && c.year === cohortYear && c.gender === cohortGender
                    );
                  })
                  .map((t) => t.id);

                if (!matches.length) {
                  setCompareError(
                    "No teams matched that cohort. Make sure players have age groups and gender set."
                  );
                  return;
                }
                if (matches.length > 5) {
                  setCompareError(
                    `That cohort has ${matches.length} teams. Select up to 5 (we’ll take the first 5).`
                  );
                }
                setCompareTeamIds(matches.slice(0, 5));
              }}
              className="text-sm font-semibold px-4 py-2 rounded-lg bg-[#e3ca76] text-black hover:brightness-95 disabled:opacity-50"
            >
              Compare this cohort
            </button>
          </div>

          {cohortOptions.items.length ? (
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              {cohortOptions.items.slice(0, 12).map((c) => (
                <button
                  key={`${c.year}-${c.gender}`}
                  type="button"
                  onClick={() => {
                    setCohortYear(c.year);
                    setCohortGender(c.gender);
                    setCompareError(null);
                    setCompareLeaderboards({});
                    const matches = teams
                      .map((t) => t.team)
                      .filter((t) => {
                        const cc = inferCohortFromTeamName(t.name);
                        return (
                          !!cc && cc.year === c.year && cc.gender === c.gender
                        );
                      })
                      .map((t) => t.id);
                    if (matches.length > 5) {
                      setCompareError(
                        `That cohort has ${matches.length} teams. Select up to 5 (we’ll take the first 5).`
                      );
                    }
                    setCompareTeamIds(matches.slice(0, 5));
                  }}
                  className="text-xs font-semibold px-3 py-2 rounded-full bg-white/10 hover:bg-white/15 border border-white/10 text-white"
                >
                  {c.year} {c.gender === "boys" ? "Boys" : "Girls"}{" "}
                  <span className="text-white/50">({c.count})</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex items-center gap-2 flex-wrap">
          {compareTeamIds.length ? (
            compareTeamIds.map((id) => {
              const name =
                teams.find((t) => t.team.id === id)?.team.name ?? "Team";
              return (
                <button
                  key={`chip-${id}`}
                  type="button"
                  onClick={() =>
                    setCompareTeamIds((prev) => prev.filter((x) => x !== id))
                  }
                  className="text-xs font-semibold px-3 py-2 rounded-full bg-white/10 hover:bg-white/15 border border-white/10 text-white"
                >
                  {name} <span className="text-white/50">×</span>
                </button>
              );
            })
          ) : (
            <div className="text-white/60 text-sm">
              Select teams below to enable comparison.
            </div>
          )}

          <div className="flex-1" />

          <button
            type="button"
            disabled={compareTeamIds.length < 2 || compareLoading}
            onClick={async () => {
              setCompareError(null);
              setCompareLoading(true);
              try {
                const results = await Promise.all(
                  compareTeamIds.map(async (teamId) => {
                    const r = await fetch(`/api/teams/${teamId}/leaderboards`);
                    const j = await r.json().catch(() => null);
                    if (!r.ok)
                      throw new Error(
                        j?.error || "Failed to load leaderboards"
                      );
                    return { teamId, data: j as TeamLeaderboardsFull };
                  })
                );
                const map: Record<string, TeamLeaderboardsFull> = {};
                for (const r of results) map[r.teamId] = r.data;
                setCompareLeaderboards(map);
              } catch (e: any) {
                setCompareError(e?.message || "Failed to compare teams");
              } finally {
                setCompareLoading(false);
              }
            }}
            className="text-sm font-semibold px-4 py-2 rounded-lg bg-[#e3ca76] text-black hover:brightness-95 disabled:opacity-50"
          >
            {compareLoading ? "Comparing…" : "Compare"}
          </button>

          <button
            type="button"
            onClick={() => {
              setCompareTeamIds([]);
              setCompareLeaderboards({});
              setCompareError(null);
            }}
            className="text-sm font-semibold px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 border border-white/10 text-white"
          >
            Clear
          </button>
        </div>

        {compareError ? (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            {compareError}
          </div>
        ) : null}

        {compareTeamIds.length >= 2 && Object.keys(compareLeaderboards).length
          ? (() => {
              const selectedTeams = compareTeamIds
                .map((id) => ({
                  id,
                  name: teams.find((t) => t.team.id === id)?.team.name ?? id,
                  lb: compareLeaderboards[id],
                }))
                .filter((x) => !!x.lb);

              // Build aggregate metrics per team
              const clusterRows = ["ps", "tc", "ms", "dc"].map((cid) => ({
                id: cid,
                name:
                  cid === "ps"
                    ? "Power / Strength"
                    : cid === "tc"
                    ? "Technique / Control"
                    : cid === "ms"
                    ? "Mobility / Stability"
                    : "Decision / Cognition",
                values: selectedTeams.map((t) => {
                  const c = t.lb?.clusterRankings?.find((x) => x.id === cid);
                  const vals = (c?.rankings ?? [])
                    .map((r) =>
                      typeof r.value === "number" ? r.value : r.percent / 100
                    )
                    .filter((n) => Number.isFinite(n));
                  return avgNumber(vals);
                }),
              }));

              // Use tests from first team as the row set (up to 13)
              const baseTests = selectedTeams[0]?.lb?.testRankings ?? [];
              const testRows = baseTests.map((bt) => ({
                id: bt.id,
                name: bt.name,
                higherIsBetter: bt.higherIsBetter,
                values: selectedTeams.map((t) => {
                  const tr = t.lb?.testRankings?.find((x) => x.id === bt.id);
                  const vals = (tr?.rankings ?? [])
                    .map((r) => r.value)
                    .filter((n) => typeof n === "number" && Number.isFinite(n));
                  return avgNumber(vals);
                }),
              }));

              // Player overlap (by name+dob key)
              const playersByTeam: Record<string, any[]> = {};
              for (const t of selectedTeams) {
                playersByTeam[t.id] = teamPlayers[t.id] ?? [];
              }
              const overlapMap = new Map<
                string,
                Array<{ teamId: string; playerName: string }>
              >();
              for (const t of selectedTeams) {
                for (const p of playersByTeam[t.id] ?? []) {
                  const key = overlapKeyForPlayer(p);
                  if (!key) continue;
                  const name =
                    (p?.fullName as string) ||
                    `${p?.firstName ?? ""} ${p?.lastName ?? ""}`.trim() ||
                    "Player";
                  const arr = overlapMap.get(key) ?? [];
                  arr.push({ teamId: t.id, playerName: name });
                  overlapMap.set(key, arr);
                }
              }
              const overlaps = [...overlapMap.entries()]
                .map(([k, v]) => ({ key: k, entries: v }))
                .filter((x) => x.entries.length >= 2);

              // Ensure we have players loaded for selected teams (best-effort)
              // Note: fetch is async and handled by the "View players" button too;
              // here we just warn if missing.

              const renderTable = (
                title: string,
                rows: Array<{
                  id: string;
                  name: string;
                  values: Array<number | null>;
                  higherIsBetter?: boolean;
                }>,
                format: (v: number | null) => string,
                decideBest: (
                  row: any,
                  values: Array<number | null>
                ) => number | null
              ) => (
                <div className="mt-6">
                  <div className="text-white font-semibold">{title}</div>
                  <div className="mt-3 overflow-x-auto">
                    <table className="min-w-[900px] w-full">
                      <thead className="bg-white/5 border-b border-white/10">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-white/80">
                            Metric
                          </th>
                          {selectedTeams.map((t) => (
                            <th
                              key={`th-${t.id}`}
                              className="px-3 py-2 text-right text-xs font-semibold text-white/80"
                            >
                              {t.name}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/10">
                        {rows.map((r) => {
                          const bestIdx = decideBest(r, r.values);
                          return (
                            <tr key={r.id} className="hover:bg-white/5">
                              <td className="px-3 py-2 text-white/90 text-sm">
                                {r.name}
                              </td>
                              {r.values.map((v, idx) => (
                                <td
                                  key={`${r.id}-${idx}`}
                                  className={
                                    "px-3 py-2 text-right font-semibold text-sm " +
                                    (bestIdx === idx
                                      ? "text-[#e3ca76]"
                                      : "text-white/80")
                                  }
                                >
                                  {format(v)}
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );

              return (
                <div className="mt-4">
                  {renderTable(
                    "Cluster averages (team-wide)",
                    clusterRows,
                    (v) =>
                      v === null
                        ? "—"
                        : `${Math.round((v as number) * 1000) / 10}%`,
                    (_row, values) => {
                      let best: number | null = null;
                      let bestIdx: number | null = null;
                      values.forEach((v, i) => {
                        if (typeof v !== "number") return;
                        if (best === null || v > best) {
                          best = v;
                          bestIdx = i;
                        }
                      });
                      return bestIdx;
                    }
                  )}

                  {renderTable(
                    "Test averages (team-wide)",
                    testRows,
                    (v) =>
                      v === null
                        ? "—"
                        : String(Math.round((v as number) * 100) / 100),
                    (row, values) => {
                      // higherIsBetter -> max, else min
                      let best: number | null = null;
                      let bestIdx: number | null = null;
                      values.forEach((v, i) => {
                        if (typeof v !== "number") return;
                        if (best === null) {
                          best = v;
                          bestIdx = i;
                          return;
                        }
                        if (row.higherIsBetter ? v > best : v < best) {
                          best = v;
                          bestIdx = i;
                        }
                      });
                      return bestIdx;
                    }
                  )}

                  <div className="mt-6">
                    <div className="text-white font-semibold">
                      Player overlap
                    </div>
                    {overlaps.length === 0 ? (
                      <div className="mt-3 text-white/70 text-sm">
                        No overlaps found between selected teams.
                      </div>
                    ) : (
                      <div className="mt-3 space-y-2">
                        {overlaps.slice(0, 50).map((o) => (
                          <div
                            key={o.key}
                            className="rounded-xl border border-white/10 bg-black/20 p-3"
                          >
                            <div className="text-white/80 text-sm font-semibold">
                              {o.entries[0]?.playerName ?? "Player"}
                            </div>
                            <div className="text-white/60 text-xs mt-1">
                              Appears in:{" "}
                              {o.entries
                                .map((e) => {
                                  const name =
                                    teams.find((t) => t.team.id === e.teamId)
                                      ?.team.name ?? e.teamId;
                                  return name;
                                })
                                .join(", ")}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                </div>
              );
            })()
          : null}
      </div>

      {error ? (
        <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-white font-semibold">Teams</div>
          </div>
          <div className="text-xs text-white/50">
            {loadingTeams ? "Loading…" : `${sortedTeams.length} teams`}
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {sortedTeams.map((row) => {
            const lb = row.leaderboards;
            const sum = scoreSummary(lb?.allPlayerChanges);
            const latestLabel = lb?.latestEvaluation
              ? `${lb.latestEvaluation.name} • ${new Date(
                  lb.latestEvaluation.createdAt
                ).toLocaleDateString()}`
              : "No evaluations yet";
            const hasComparison = !!lb?.previousEvaluation && !!sum;

            return (
              <div
                key={row.team.id}
                className="rounded-xl border border-white/10 bg-black/20 p-4"
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="text-white font-semibold">
                      {row.team.name}
                    </div>
                    <div className="text-white/60 text-sm mt-1">
                      {latestLabel}
                      {row.team.playerCount != null ? (
                        <span className="text-white/40"> • </span>
                      ) : null}
                      {row.team.playerCount != null ? (
                        <span>{row.team.playerCount} players</span>
                      ) : null}
                    </div>
                    {row.loading ? (
                      <div className="text-white/50 text-xs mt-1">
                        Loading leaderboards…
                      </div>
                    ) : row.error ? (
                      <div className="text-red-200 text-xs mt-1">
                        {row.error}
                      </div>
                    ) : null}
                  </div>

                  <div className="text-right space-y-2">
                    <div className="text-sm font-semibold">
                      <span className="text-white/60">Avg: </span>
                      {hasComparison ? (
                        <span
                          className={
                            sum!.avg >= 0 ? "text-[#e3ca76]" : "text-red-300"
                          }
                        >
                          {sum!.avg >= 0 ? "+" : ""}
                          {sum!.avg.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-white/50">—</span>
                      )}
                    </div>
                    <div className="text-xs text-white/50">
                      {hasComparison
                        ? `${sum!.improved} improved • ${
                            sum!.declined
                          } declined • ${sum!.total} comparable`
                        : "Needs 2+ evals to compare"}
                    </div>

                    <div className="flex items-center justify-end gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => {
                          setCompareError(null);
                          setCompareLeaderboards({});
                          setCompareTeamIds((prev) => {
                            const has = prev.includes(row.team.id);
                            if (has)
                              return prev.filter((x) => x !== row.team.id);
                            if (prev.length >= 5) {
                              setCompareError(
                                "You can compare up to 5 teams at once."
                              );
                              return prev;
                            }
                            return [...prev, row.team.id];
                          });
                        }}
                        className={
                          "text-xs font-semibold px-3 py-2 rounded-lg border border-white/10 " +
                          (compareTeamIds.includes(row.team.id)
                            ? "bg-[#e3ca76] text-black hover:brightness-95"
                            : "bg-white/10 hover:bg-white/15 text-white")
                        }
                      >
                        {compareTeamIds.includes(row.team.id)
                          ? "Selected"
                          : "Compare"}
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          setTeamAiError(null);
                          setTeamAiData(null);
                          setTeamAiSelected({
                            id: row.team.id,
                            name: row.team.name,
                          });
                          setTeamAiOpen(true);
                          setTeamAiLoading(true);
                          try {
                            const r = await fetch(
                              `/api/ai/team-analysis?teamId=${encodeURIComponent(
                                row.team.id
                              )}`
                            );
                            const j = await r.json().catch(() => null);
                            if (!r.ok)
                              throw new Error(
                                j?.error || "Team AI not available yet"
                              );
                            setTeamAiData(j as TeamAiCacheResponse);
                          } catch (e: any) {
                            setTeamAiError(
                              e?.message || "Team AI not available yet"
                            );
                          } finally {
                            setTeamAiLoading(false);
                          }
                        }}
                        className="text-xs font-semibold px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 border border-white/10 text-white"
                      >
                        View Team AI Report
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          const open = !openTeams[row.team.id];
                          setOpenTeams((s) => ({ ...s, [row.team.id]: open }));
                          if (!open) return;
                          if (teamPlayers[row.team.id]?.length) return;
                          setTeamPlayersLoading((s) => ({
                            ...s,
                            [row.team.id]: true,
                          }));
                          try {
                            const r = await fetch(
                              `/api/teams/${row.team.id}/players`
                            );
                            const j = await r.json().catch(() => null);
                            if (!r.ok)
                              throw new Error(
                                j?.error || "Failed to load players"
                              );
                            setTeamPlayers((s) => ({
                              ...s,
                              [row.team.id]: Array.isArray(j?.players)
                                ? j.players
                                : [],
                            }));
                          } finally {
                            setTeamPlayersLoading((s) => ({
                              ...s,
                              [row.team.id]: false,
                            }));
                          }
                        }}
                        className="text-xs font-semibold px-3 py-2 rounded-lg bg-[#e3ca76] text-black hover:brightness-95"
                      >
                        {openTeams[row.team.id]
                          ? "Hide players"
                          : "View players"}
                      </button>
                    </div>
                  </div>
                </div>

                {openTeams[row.team.id] ? (
                  <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
                    <div className="text-white font-semibold">Players</div>
                    {teamPlayersLoading[row.team.id] ? (
                      <div className="text-white/70 text-sm mt-2">Loading…</div>
                    ) : (
                      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                        {(teamPlayers[row.team.id] || []).map((p: any) => {
                          const name =
                            (p?.fullName as string) ||
                            `${p?.firstName ?? ""} ${
                              p?.lastName ?? ""
                            }`.trim() ||
                            "Player";
                          return (
                            <div
                              key={p.id}
                              className="rounded-lg border border-white/10 bg-black/20 p-3"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="text-white/90 font-semibold">
                                    {name}
                                  </div>
                                  <div className="text-white/60 text-xs mt-1">
                                    {p?.ageGroup
                                      ? `Age group: ${p.ageGroup}`
                                      : ""}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    setPlayerAiError(null);
                                    setPlayerAiData(null);
                                    setPlayerAiSelected({ id: p.id, name });
                                    setPlayerAiOpen(true);
                                    setPlayerAiLoading(true);
                                    try {
                                      const r = await fetch(
                                        "/api/ai/player-analysis",
                                        {
                                          method: "POST",
                                          headers: {
                                            "Content-Type": "application/json",
                                          },
                                          body: JSON.stringify({
                                            player: { id: p.id },
                                          }),
                                        }
                                      );
                                      const j = await r
                                        .json()
                                        .catch(() => null);
                                      if (!r.ok)
                                        throw new Error(
                                          j?.error || "Not available yet"
                                        );
                                      setPlayerAiData(
                                        j as PlayerAiCacheResponse
                                      );
                                    } catch (e: any) {
                                      setPlayerAiError(
                                        e?.message || "Not available yet"
                                      );
                                    } finally {
                                      setPlayerAiLoading(false);
                                    }
                                  }}
                                  className="text-xs font-semibold px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 border border-white/10 text-white"
                                >
                                  View Player AI Report
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* Team AI modal */}
      {teamAiOpen && teamAiSelected ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
          <button
            type="button"
            aria-label="Close team AI"
            onClick={() => setTeamAiOpen(false)}
            className="absolute inset-0 bg-black/70"
          />
          <div className="relative w-full max-w-4xl rounded-2xl border border-white/10 bg-[#0b0f14] shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <div>
                <div className="text-white font-semibold">Team AI Analysis</div>
                <div className="text-xs text-white/50">
                  {teamAiSelected.name}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTeamAiOpen(false)}
                className="text-white/70 hover:text-white text-sm font-semibold px-3 py-2 rounded-lg bg-white/5 border border-white/10"
              >
                Close
              </button>
            </div>
            <div className="p-4 max-h-[70vh] overflow-y-auto">
              {teamAiLoading ? (
                <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-white/70 text-sm">
                  Loading team AI analysis…
                </div>
              ) : teamAiError ? (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
                  <div className="text-red-200 font-semibold">
                    Team AI analysis not available yet
                  </div>
                  <div className="text-red-200/80 text-sm mt-2">
                    This team hasn’t generated Team AI Analysis yet. Ask the
                    coach to open Team AI Analysis to generate it.
                  </div>
                </div>
              ) : teamAiData?.report ? (
                <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#e3ca76]/10 via-white/5 to-white/5 p-5">
                  {teamAiData.message ? (
                    <div className="text-xs text-white/60 mb-3">
                      {teamAiData.message}
                    </div>
                  ) : (
                    <div className="text-xs text-white/60 mb-3">
                      Showing saved team report.
                    </div>
                  )}

                  {(() => {
                    const r: any = teamAiData.report;
                    const quickSummary = r?.quickSummary ?? "";
                    const teamStrengths = toArr(r?.teamStrengths);
                    const biggestGaps = toArr(r?.biggestGaps);
                    const top3Priorities = toArr(r?.top3Priorities);
                    const coachingNotes = toArr(r?.coachingNotes);
                    const safetyNotes = toArr(r?.safetyNotes);
                    const confidence =
                      typeof r?.confidence === "number"
                        ? `${Math.round(r.confidence * 100)}%`
                        : null;

                    return (
                      <>
                        <div className="text-white font-bold text-xl">
                          {r?.teamName ?? teamAiSelected.name} —{" "}
                          {r?.evaluationName ?? "Latest check-in"}
                        </div>
                        {quickSummary ? (
                          <div className="text-white/70 text-sm mt-2">
                            {quickSummary}
                          </div>
                        ) : null}
                        {confidence ? (
                          <div className="mt-3 text-xs text-white/50">
                            Confidence:{" "}
                            <span className="text-white/70 font-semibold">
                              {confidence}
                            </span>
                          </div>
                        ) : null}

                        <div className="mt-5 grid grid-cols-1 lg:grid-cols-3 gap-4">
                          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                            <div className="text-white font-semibold">
                              Team strengths
                            </div>
                            <ul className="mt-2 text-sm text-white/70 list-disc pl-5 space-y-1">
                              {teamStrengths.slice(0, 10).map((x, i) => (
                                <li key={`ts-${i}`}>{x}</li>
                              ))}
                            </ul>
                          </div>
                          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                            <div className="text-white font-semibold">
                              Biggest gaps
                            </div>
                            <ul className="mt-2 text-sm text-white/70 list-disc pl-5 space-y-1">
                              {biggestGaps.slice(0, 10).map((x, i) => (
                                <li key={`bg-${i}`}>{x}</li>
                              ))}
                            </ul>
                          </div>
                          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                            <div className="text-white font-semibold">
                              Top 3 priorities
                            </div>
                            <ol className="mt-2 text-sm text-white/70 list-decimal pl-5 space-y-1">
                              {top3Priorities.slice(0, 3).map((x, i) => (
                                <li key={`tp-${i}`}>{x}</li>
                              ))}
                            </ol>
                          </div>
                        </div>

                        {Array.isArray(r?.playerSpotlights) &&
                        r.playerSpotlights.length ? (
                          <div className="mt-5 rounded-xl border border-white/10 bg-black/20 p-4">
                            <div className="text-white font-semibold">
                              Player spotlights
                            </div>
                            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                              {r.playerSpotlights
                                .slice(0, 12)
                                .map((p: any, idx: number) => (
                                  <div
                                    key={`${p?.playerName ?? "player"}-${idx}`}
                                    className="rounded-lg border border-white/10 bg-white/5 p-3"
                                  >
                                    <div className="text-white font-semibold">
                                      {p?.playerName ?? "Player"}
                                    </div>
                                    <div className="mt-2 text-sm text-white/80 font-semibold">
                                      Positives
                                    </div>
                                    <ul className="mt-1 text-sm text-white/70 list-disc pl-5 space-y-1">
                                      {toArr(p?.positives)
                                        .slice(0, 4)
                                        .map((x, i) => (
                                          <li key={`pos-${idx}-${i}`}>{x}</li>
                                        ))}
                                    </ul>
                                    <div className="mt-3 text-sm text-white/80 font-semibold">
                                      Watch outs
                                    </div>
                                    <ul className="mt-1 text-sm text-white/70 list-disc pl-5 space-y-1">
                                      {toArr(p?.watchOuts)
                                        .slice(0, 4)
                                        .map((x, i) => (
                                          <li key={`wo-${idx}-${i}`}>{x}</li>
                                        ))}
                                    </ul>
                                  </div>
                                ))}
                            </div>
                          </div>
                        ) : null}

                        <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
                          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                            <div className="text-white font-semibold">
                              Coaching notes
                            </div>
                            <ul className="mt-2 text-sm text-white/70 list-disc pl-5 space-y-1">
                              {coachingNotes.slice(0, 10).map((x, i) => (
                                <li key={`cn-${i}`}>{x}</li>
                              ))}
                            </ul>
                          </div>
                          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                            <div className="text-white font-semibold">
                              Safety notes
                            </div>
                            <ul className="mt-2 text-sm text-white/70 list-disc pl-5 space-y-1">
                              {safetyNotes.slice(0, 10).map((x, i) => (
                                <li key={`sn-${i}`}>{x}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {/* Player AI modal */}
      {playerAiOpen && playerAiSelected ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
          <button
            type="button"
            aria-label="Close player AI"
            onClick={() => setPlayerAiOpen(false)}
            className="absolute inset-0 bg-black/70"
          />
          <div className="relative w-full max-w-3xl rounded-2xl border border-white/10 bg-[#0b0f14] shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <div>
                <div className="text-white font-semibold">
                  Player AI Analysis
                </div>
                <div className="text-xs text-white/50">
                  {playerAiSelected.name}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPlayerAiOpen(false)}
                className="text-white/70 hover:text-white text-sm font-semibold px-3 py-2 rounded-lg bg-white/5 border border-white/10"
              >
                Close
              </button>
            </div>
            <div className="p-4 max-h-[70vh] overflow-y-auto">
              {playerAiLoading ? (
                <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-white/70 text-sm">
                  Loading player AI analysis…
                </div>
              ) : playerAiError ? (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
                  <div className="text-red-200 font-semibold">
                    Player AI analysis not available yet
                  </div>
                  <div className="text-red-200/80 text-sm mt-2">
                    This player hasn’t generated Player AI Analysis yet. Ask the
                    player/parent to open Player AI Analysis to generate it.
                  </div>
                </div>
              ) : playerAiData?.report ? (
                <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#e3ca76]/10 via-white/5 to-white/5 p-5">
                  {playerAiData.message ? (
                    <div className="text-xs text-white/60 mb-3">
                      {playerAiData.message}
                    </div>
                  ) : (
                    <div className="text-xs text-white/60 mb-3">
                      Showing saved player report.
                    </div>
                  )}

                  {(() => {
                    const r: any = playerAiData.report;
                    const playerName = r?.playerName ?? playerAiSelected.name;
                    const checkInName = r?.checkInName ?? "Check-in";
                    const quickSummary = r?.quickSummary ?? r?.summary ?? "";
                    const strengths = toArr(r?.strengths);
                    const areas = toArr(r?.areasToImprove);
                    const top3 = toArr(r?.top3Actions);
                    const next = toArr(r?.whatToDoNext);
                    const tips = toArr(r?.coachingTips);
                    const safety = toArr(r?.safetyNotes);
                    const confidence =
                      typeof r?.confidence === "number"
                        ? `${Math.round(r.confidence * 100)}%`
                        : null;

                    return (
                      <>
                        <div className="text-white font-bold text-xl">
                          {playerName} — {checkInName}
                        </div>
                        {quickSummary ? (
                          <div className="text-white/70 text-sm mt-2">
                            {quickSummary}
                          </div>
                        ) : null}
                        {confidence ? (
                          <div className="mt-3 text-xs text-white/50">
                            Confidence:{" "}
                            <span className="text-white/70 font-semibold">
                              {confidence}
                            </span>
                          </div>
                        ) : null}

                        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                            <div className="text-white font-semibold">
                              Strengths
                            </div>
                            <ul className="mt-2 text-sm text-white/70 list-disc pl-5 space-y-1">
                              {strengths.slice(0, 10).map((x, i) => (
                                <li key={`ps-${i}`}>{x}</li>
                              ))}
                            </ul>
                          </div>
                          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                            <div className="text-white font-semibold">
                              Areas to improve
                            </div>
                            <ul className="mt-2 text-sm text-white/70 list-disc pl-5 space-y-1">
                              {areas.slice(0, 10).map((x, i) => (
                                <li key={`pa-${i}`}>{x}</li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        {top3.length ? (
                          <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
                            <div className="text-white font-semibold">
                              Top 3 actions
                            </div>
                            <ol className="mt-2 text-sm text-white/70 list-decimal pl-5 space-y-1">
                              {top3.slice(0, 3).map((x, i) => (
                                <li key={`pt-${i}`}>{x}</li>
                              ))}
                            </ol>
                          </div>
                        ) : null}

                        {next.length ? (
                          <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
                            <div className="text-white font-semibold">
                              What to do next
                            </div>
                            <ul className="mt-2 text-sm text-white/70 list-disc pl-5 space-y-1">
                              {next.slice(0, 10).map((x, i) => (
                                <li key={`pn-${i}`}>{x}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}

                        {tips.length ? (
                          <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
                            <div className="text-white font-semibold">
                              Coaching tips
                            </div>
                            <ul className="mt-2 text-sm text-white/70 list-disc pl-5 space-y-1">
                              {tips.slice(0, 10).map((x, i) => (
                                <li key={`pct-${i}`}>{x}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}

                        {safety.length ? (
                          <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
                            <div className="text-white font-semibold">
                              Safety notes
                            </div>
                            <ul className="mt-2 text-sm text-white/70 list-disc pl-5 space-y-1">
                              {safety.slice(0, 10).map((x, i) => (
                                <li key={`psn-${i}`}>{x}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </>
                    );
                  })()}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
