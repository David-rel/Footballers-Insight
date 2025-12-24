"use client";

import { useEffect, useMemo, useState } from "react";
import TeamLeaderboardsPanel from "@/components/features/TeamLeaderboardsPanel";

type Role = "owner" | "admin" | "coach" | "parent" | "player";

type TeamOption = {
  id: string;
  name: string;
  description?: string | null;
  playerCount?: number;
  coach?: { id: string; name?: string | null; email?: string | null } | null;
};

type TeamPlayer = {
  id: string;
  firstName: string;
  lastName: string;
  dominantFoot?: string | null;
  ageGroup?: string | null;
  gender?: string | null;
};

type TeamLeaderboardsAllChanges = {
  latestEvaluation: { id: string; name: string; createdAt: string } | null;
  previousEvaluation: { id: string; name: string; createdAt: string } | null;
  allPlayerChanges?: Array<{
    playerId: string;
    playerName: string;
    scorePct: number;
    changes: Array<{
      testId: string;
      name: string;
      pct: number;
      oldRank: number | null;
      newRank: number | null;
      rankChange: number | null;
      oldValueLabel: string;
      newValueLabel: string;
      deltaValue: number;
      deltaValueLabel: string;
      contrib: number;
    }>;
  }>;
};

type AiTeamReport = {
  teamId: string;
  teamName: string;
  evaluationId: string;
  evaluationName: string;
  createdAt: string;
  confidence: number;
  quickSummary: string;
  teamStrengths: string[];
  biggestGaps: string[];
  top3Priorities: string[];
  playerSpotlights: Array<{
    playerName: string;
    positives: string[];
    watchOuts: string[];
  }>;
  coachingNotes: string[];
  safetyNotes: string[];
};

function isAiTeamReport(v: any): v is AiTeamReport {
  return (
    !!v &&
    typeof v === "object" &&
    typeof v.teamId === "string" &&
    typeof v.teamName === "string" &&
    typeof v.evaluationId === "string" &&
    typeof v.evaluationName === "string" &&
    typeof v.createdAt === "string" &&
    typeof v.confidence === "number" &&
    typeof v.quickSummary === "string" &&
    Array.isArray(v.teamStrengths) &&
    Array.isArray(v.biggestGaps) &&
    Array.isArray(v.top3Priorities) &&
    Array.isArray(v.playerSpotlights) &&
    Array.isArray(v.coachingNotes) &&
    (Array.isArray(v.safetyNotes) || typeof v.safetyNotes === "string")
  );
}

function titleForRole(role: Role | null) {
  if (role === "coach") return "Team AI Analysis";
  if (role === "owner" || role === "admin") return "Company AI Analysis";
  return "AI Analysis";
}

export function AiStatsCoachTeamView() {
  const [role, setRole] = useState<Role | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");

  const selectedTeam = useMemo(
    () => teams.find((t) => t.id === selectedTeamId) ?? null,
    [teams, selectedTeamId]
  );

  const [loadingRoster, setLoadingRoster] = useState(false);
  const [roster, setRoster] = useState<TeamPlayer[]>([]);
  const [loadingChanges, setLoadingChanges] = useState(false);
  const [changesData, setChangesData] =
    useState<TeamLeaderboardsAllChanges | null>(null);
  const [openPlayerChanges, setOpenPlayerChanges] = useState<
    Record<string, boolean>
  >({});

  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiAttempted, setAiAttempted] = useState(false);
  const [aiReport, setAiReport] = useState<AiTeamReport | null>(null);
  const [aiCacheInfo, setAiCacheInfo] = useState<{
    cached: boolean;
    createdAt?: string | null;
  } | null>(null);
  const [aiRetryNonce, setAiRetryNonce] = useState(0);

  // Team chat (coach)
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
      if (role === "parent" || role === "player") return;
      setError(null);
      setLoadingTeams(true);
      try {
        const res = await fetch("/api/teams");
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || "Failed to load teams");
        const list = Array.isArray(data?.teams)
          ? (data.teams as TeamOption[])
          : [];
        if (!mounted) return;
        setTeams(list);
        if (list.length === 1) setSelectedTeamId(list[0].id);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || "Failed to load teams");
      } finally {
        if (mounted) setLoadingTeams(false);
      }
    }
    loadTeams();
    return () => {
      mounted = false;
    };
  }, [role]);

  useEffect(() => {
    let mounted = true;
    async function loadRoster() {
      if (!selectedTeamId) return;
      setLoadingRoster(true);
      setError(null);
      try {
        const res = await fetch(`/api/teams/${selectedTeamId}/players`);
        const data = await res.json().catch(() => null);
        if (!res.ok)
          throw new Error(data?.error || "Failed to load team players");
        const list = Array.isArray(data?.players) ? data.players : [];
        const mapped: TeamPlayer[] = list
          .map((p: any) => ({
            id: p?.id,
            firstName: p?.firstName ?? p?.first_name ?? "",
            lastName: p?.lastName ?? p?.last_name ?? "",
            dominantFoot: p?.dominantFoot ?? p?.dominant_foot ?? null,
            ageGroup: p?.ageGroup ?? p?.age_group ?? null,
            gender: p?.gender ?? null,
          }))
          .filter((p: TeamPlayer) => !!p.id && !!p.firstName && !!p.lastName);
        if (!mounted) return;
        setRoster(mapped);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || "Failed to load roster");
        setRoster([]);
      } finally {
        if (mounted) setLoadingRoster(false);
      }
    }
    loadRoster();
    return () => {
      mounted = false;
    };
  }, [selectedTeamId]);

  useEffect(() => {
    let mounted = true;
    async function loadChanges() {
      if (!selectedTeamId) return;
      setLoadingChanges(true);
      try {
        const res = await fetch(`/api/teams/${selectedTeamId}/leaderboards`);
        const data = await res.json().catch(() => null);
        if (!res.ok)
          throw new Error(data?.error || "Failed to load team changes");
        if (!mounted) return;
        setChangesData(data as TeamLeaderboardsAllChanges);
      } catch (e) {
        if (!mounted) return;
        setChangesData(null);
      } finally {
        if (mounted) setLoadingChanges(false);
      }
    }
    loadChanges();
    return () => {
      mounted = false;
    };
  }, [selectedTeamId]);

  // Reset AI state when switching teams
  useEffect(() => {
    setAiLoading(!!selectedTeamId);
    setAiError(null);
    setAiAttempted(false);
    setAiReport(null);
    setAiCacheInfo(null);
    setAiRetryNonce(0);
    setChatOpen(false);
    setChatThreadId(null);
    setChatMessages([]);
    setChatInput("");
    setChatSending(false);
    setChatError(null);
    setChatHasMemory(false);
  }, [selectedTeamId]);

  // Generate team AI report (hide all team data until ready)
  useEffect(() => {
    let mounted = true;
    async function run() {
      if (!selectedTeamId || !selectedTeam) return;

      // Need leaderboards (for all-player changes + latest/previous eval)
      if (!changesData?.latestEvaluation) {
        setAiLoading(true);
        return;
      }

      setAiLoading(true);
      setAiError(null);
      setAiAttempted(true);
      setAiReport(null);

      const payload = {
        team: {
          id: selectedTeamId,
          name: selectedTeam.name,
          description: selectedTeam.description ?? null,
        },
        leaderboards: changesData,
        roster: roster.map((p) => ({
          id: p.id,
          name: `${p.firstName} ${p.lastName}`.trim(),
          ageGroup: p.ageGroup ?? null,
          dominantFoot: p.dominantFoot ?? null,
        })),
      };

      let data: any = null;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 45000);
        const res = await fetch("/api/ai/team-analysis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        clearTimeout(timeout);
        data = await res.json().catch(() => null);
        console.log("Team AI report API response:", data);
        if (!res.ok)
          throw new Error(data?.error || "Failed to generate report");
        if (!mounted) return;

        setAiCacheInfo({
          cached: !!data?.cached,
          createdAt:
            typeof data?.createdAt === "string" ? data.createdAt : null,
        });

        let report: any = data?.report ?? null;
        // Sometimes cached JSONB can come back as a string depending on driver/config.
        if (typeof report === "string") {
          try {
            report = JSON.parse(report);
          } catch {
            // leave as-is
          }
        }
        if (report && typeof report === "object" && "report" in report) {
          report = (report as any).report;
          if (report && typeof report === "object" && "report" in report) {
            report = (report as any).report;
          }
        }

        if (!isAiTeamReport(report)) {
          console.error("Team AI report failed shape check:", {
            report,
            keys:
              report && typeof report === "object" ? Object.keys(report) : null,
          });
          throw new Error(
            "AI returned an empty or unrecognized report format."
          );
        }
        setAiReport(report);
      } catch (e) {
        if (!mounted) return;
        console.error("Team AI report request failed:", {
          error: (e as any)?.message ?? e,
          response: data,
        });
        setAiError("Something went wrong — please try again.");
      } finally {
        if (mounted) setAiLoading(false);
      }
    }

    run();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTeamId, selectedTeam, changesData, roster, aiRetryNonce]);

  // Guard: this view is for staff. If a parent/player gets here, show nothing useful.
  if (role === "parent" || role === "player") {
    return (
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-white">AI Analysis</h1>
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5 text-white/70 text-sm">
          This page is for staff team analysis.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold text-white">
        {loadingProfile ? "AI Analysis" : titleForRole(role)}
      </h1>

      <div className="mt-6 space-y-6">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-lg font-semibold text-white">
            Choose a team to analyze
          </h2>
          <p className="text-sm text-white/60 mt-1">
            For now we’ll showcase team data (roster + basics). Team AI summary
            is next.
          </p>

          {error ? (
            <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          <div className="mt-4">
            {loadingTeams ? (
              <div className="text-white/70 text-sm">Loading teams…</div>
            ) : teams.length === 0 ? (
              <div className="text-white/70 text-sm">No teams found yet.</div>
            ) : teams.length === 1 ? (
              <div className="text-white/80 text-sm">
                Selected:{" "}
                <span className="text-white font-medium">{teams[0].name}</span>
              </div>
            ) : (
              <select
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
                className="w-full max-w-md rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-white outline-none focus:border-[#e3ca76]/50"
              >
                <option value="" className="bg-black">
                  Select a team…
                </option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id} className="bg-black">
                    {t.name}
                    {typeof t.playerCount === "number"
                      ? ` — ${t.playerCount} players`
                      : ""}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {selectedTeam ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="text-white font-bold text-lg">
                  Team overview: {selectedTeam.name}
                </div>
                <div className="text-white/60 text-sm mt-1">
                  {selectedTeam.description || " "}
                </div>
              </div>
              <div className="text-xs text-white/50">
                Players loaded:{" "}
                <span className="text-white/70 font-semibold">
                  {loadingRoster ? "…" : roster.length}
                </span>
              </div>
            </div>

            {/* Team AI report (must load before showing any team data) */}
            <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="text-white font-bold text-lg">
                    Overall team evaluation
                  </div>
                  <div className="text-white/60 text-sm mt-1">
                    Based on the latest team check-in, compared to the previous
                    one when available.
                  </div>
                </div>
                <div className="text-xs text-white/50">
                  We’ll show the full team data once this finishes.
                </div>
              </div>

              {aiLoading || (!aiReport && !aiAttempted) ? (
                <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-5">
                  <div className="text-white font-semibold text-lg">
                    Generating overall team evaluation — this can take a couple
                    minutes…
                  </div>
                  <div className="text-white/60 text-sm mt-2">
                    Please keep this tab open while we compile everything.
                  </div>
                </div>
              ) : aiError ? (
                <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-5">
                  <div className="text-red-200 font-semibold">
                    Something went wrong — please try again.
                  </div>
                  <button
                    type="button"
                    onClick={() => setAiRetryNonce((n) => n + 1)}
                    className="mt-4 text-sm font-semibold px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 border border-white/10 text-white"
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-white/10 bg-gradient-to-br from-[#e3ca76]/10 via-white/5 to-white/5 p-5">
                  {aiReport ? (
                    <>
                      <div className="text-xs text-white/60">
                        {aiCacheInfo?.cached ? (
                          <span>
                            Showing your saved report
                            {aiCacheInfo?.createdAt ? (
                              <>
                                {" "}
                                (generated{" "}
                                {new Date(
                                  aiCacheInfo.createdAt
                                ).toLocaleString()}
                                )
                              </>
                            ) : null}
                            . It will re-evaluate after the next check-in.
                          </span>
                        ) : (
                          <span>
                            It will re-evaluate after the next check-in.
                          </span>
                        )}
                      </div>

                      <div className="mt-3 text-white font-bold text-xl">
                        {aiReport.evaluationName}
                      </div>
                      <div className="text-white/70 text-sm mt-2">
                        {aiReport.quickSummary}
                      </div>
                      <div className="mt-3 text-xs text-white/50">
                        Confidence:{" "}
                        <span className="text-white/70 font-semibold">
                          {Math.round(aiReport.confidence * 100)}%
                        </span>
                      </div>

                      <div className="mt-5 grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                          <div className="text-white font-semibold">
                            Team strengths
                          </div>
                          <ul className="mt-2 text-sm text-white/70 list-disc pl-5 space-y-1">
                            {aiReport.teamStrengths.slice(0, 10).map((x, i) => (
                              <li key={`ts-${i}`}>{x}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                          <div className="text-white font-semibold">
                            Biggest gaps
                          </div>
                          <ul className="mt-2 text-sm text-white/70 list-disc pl-5 space-y-1">
                            {aiReport.biggestGaps.slice(0, 10).map((x, i) => (
                              <li key={`bg-${i}`}>{x}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                          <div className="text-white font-semibold">
                            Top 3 priorities
                          </div>
                          <ol className="mt-2 text-sm text-white/70 list-decimal pl-5 space-y-1">
                            {aiReport.top3Priorities.map((x, i) => (
                              <li key={`tp-${i}`}>{x}</li>
                            ))}
                          </ol>
                        </div>
                      </div>

                      <div className="mt-5 rounded-xl border border-white/10 bg-black/20 p-4">
                        <div className="text-white font-semibold">
                          Player spotlights
                        </div>
                        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                          {aiReport.playerSpotlights
                            .slice(0, 12)
                            .map((p, idx) => (
                              <div
                                key={`${p.playerName}-${idx}`}
                                className="rounded-lg border border-white/10 bg-white/5 p-3"
                              >
                                <div className="text-white font-semibold">
                                  {p.playerName}
                                </div>
                                <div className="mt-2 text-sm text-white/80 font-semibold">
                                  Positives
                                </div>
                                <ul className="mt-1 text-sm text-white/70 list-disc pl-5 space-y-1">
                                  {p.positives.slice(0, 4).map((x, i) => (
                                    <li key={`pos-${idx}-${i}`}>{x}</li>
                                  ))}
                                </ul>
                                <div className="mt-3 text-sm text-white/80 font-semibold">
                                  Watch outs
                                </div>
                                <ul className="mt-1 text-sm text-white/70 list-disc pl-5 space-y-1">
                                  {p.watchOuts.slice(0, 4).map((x, i) => (
                                    <li key={`wo-${idx}-${i}`}>{x}</li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                        </div>
                      </div>

                      <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                          <div className="text-white font-semibold">
                            Coaching notes
                          </div>
                          <ul className="mt-2 text-sm text-white/70 list-disc pl-5 space-y-1">
                            {aiReport.coachingNotes.slice(0, 10).map((x, i) => (
                              <li key={`cn-${i}`}>{x}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                          <div className="text-white font-semibold">
                            Safety notes
                          </div>
                          <ul className="mt-2 text-sm text-white/70 list-disc pl-5 space-y-1">
                            {(Array.isArray(aiReport.safetyNotes)
                              ? aiReport.safetyNotes
                              : [String(aiReport.safetyNotes)]
                            )
                              .slice(0, 10)
                              .map((x, i) => (
                                <li key={`sn-${i}`}>{x}</li>
                              ))}
                          </ul>
                        </div>
                      </div>
                    </>
                  ) : null}

                  {aiReport ? (
                    <div className="mt-4">
                      <button
                        type="button"
                        onClick={() => {
                          setChatError(null);
                          setChatOpen(true);
                        }}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#e3ca76] text-black font-semibold px-5 py-3 hover:brightness-95"
                      >
                        Chat with team stats
                      </button>
                      <div className="text-xs text-white/50 mt-2">
                        Ask about the whole team or a specific player (by name).
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            {chatOpen && selectedTeam ? (
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
                        Chat with team stats
                      </div>
                      <div className="text-xs text-white/50">
                        Coach chat about {selectedTeam.name}
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
                        Try: “What are our top 2 team priorities?” or “What
                        should I focus on with Michael Hernandez?”
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
                      if (!selectedTeamId) return;
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
                        // On first send, try to resume latest thread so memory persists.
                        if (!chatThreadId && chatMessages.length === 0) {
                          const resume = await fetch(
                            `/api/ai/team-chat?teamId=${encodeURIComponent(
                              selectedTeamId
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
                                  (m.role === "user" ||
                                    m.role === "assistant") &&
                                  typeof m.text === "string" &&
                                  typeof m.id === "string"
                              )
                            );
                          }
                        }

                        const context =
                          !chatThreadId && aiReport
                            ? {
                                teamReport: aiReport,
                                roster: roster.map((p) => ({
                                  id: p.id,
                                  name: `${p.firstName} ${p.lastName}`.trim(),
                                })),
                                playerChangeSummary:
                                  changesData?.allPlayerChanges?.map((c) => ({
                                    playerId: c.playerId,
                                    playerName: c.playerName,
                                    scorePct: c.scorePct,
                                  })) ?? [],
                              }
                            : undefined;

                        const res = await fetch("/api/ai/team-chat", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            teamId: selectedTeamId,
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

            {/* Only show team data after AI report is ready */}
            {aiReport ? (
              <>
                <div className="mt-6">
                  <TeamLeaderboardsPanel teamId={selectedTeamId} hideMovers />
                </div>

                <div className="mt-5">
                  <div className="text-white font-semibold">
                    Roster (all stat changes)
                  </div>
                  <div className="text-white/60 text-sm mt-1">
                    Compare latest vs previous check-in for every player.
                    Positive means improvement (for time-based tests, lower is
                    better).
                  </div>
                  {loadingRoster ? (
                    <div className="mt-3 text-white/70 text-sm">
                      Loading roster…
                    </div>
                  ) : roster.length === 0 ? (
                    <div className="mt-3 text-white/70 text-sm">
                      No players found for this team yet.
                    </div>
                  ) : (
                    <div className="mt-3 grid grid-cols-1 gap-3">
                      {roster.map((p) => {
                        const playerName =
                          `${p.firstName} ${p.lastName}`.trim();
                        const changeEntry =
                          changesData?.allPlayerChanges?.find(
                            (c) => c.playerId === p.id
                          ) ?? null;
                        const changes = changeEntry?.changes ?? [];
                        const improved = [...changes]
                          .filter((c) => c.contrib > 0)
                          .sort((a, b) => b.contrib - a.contrib)
                          .slice(0, 3);
                        const declined = [...changes]
                          .filter((c) => c.contrib < 0)
                          .sort((a, b) => a.contrib - b.contrib)
                          .slice(0, 3);
                        const open = !!openPlayerChanges[p.id];

                        return (
                          <div
                            key={p.id}
                            className="rounded-xl border border-white/10 bg-black/20 p-4"
                          >
                            <div className="flex items-start justify-between gap-4 flex-wrap">
                              <div>
                                <div className="text-white font-semibold">
                                  {playerName}
                                </div>
                                <div className="text-white/60 text-sm mt-1">
                                  {p.ageGroup ? (
                                    <span>Age group: {p.ageGroup}</span>
                                  ) : null}
                                  {p.ageGroup && p.dominantFoot ? (
                                    <span className="text-white/40"> • </span>
                                  ) : null}
                                  {p.dominantFoot ? (
                                    <span>Foot: {p.dominantFoot}</span>
                                  ) : null}
                                </div>
                              </div>

                              <div className="text-right">
                                {loadingChanges ? (
                                  <div className="text-xs text-white/50">
                                    Loading changes…
                                  </div>
                                ) : !changesData?.previousEvaluation ? (
                                  <div className="text-xs text-white/50">
                                    Needs 2+ evaluations to compare
                                  </div>
                                ) : changeEntry ? (
                                  <div className="text-sm font-semibold">
                                    <span className="text-white/60">
                                      Overall:{" "}
                                    </span>
                                    <span
                                      className={
                                        changeEntry.scorePct >= 0
                                          ? "text-[#e3ca76]"
                                          : "text-red-300"
                                      }
                                    >
                                      {changeEntry.scorePct >= 0 ? "+" : ""}
                                      {changeEntry.scorePct}%
                                    </span>
                                  </div>
                                ) : (
                                  <div className="text-xs text-white/50">
                                    No comparable stats yet
                                  </div>
                                )}
                              </div>
                            </div>

                            {changeEntry && changesData?.previousEvaluation ? (
                              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                                  <div className="text-white/80 text-sm font-semibold">
                                    Biggest improvements
                                  </div>
                                  {improved.length ? (
                                    <ul className="mt-2 text-sm text-white/70 list-disc pl-5 space-y-1">
                                      {improved.map((c) => (
                                        <li key={`${p.id}-imp-${c.testId}`}>
                                          <span className="text-white/80 font-semibold">
                                            {c.name}
                                          </span>{" "}
                                          <span className="text-[#e3ca76]">
                                            (+{Math.round(c.pct * 100)}%)
                                          </span>
                                        </li>
                                      ))}
                                    </ul>
                                  ) : (
                                    <div className="mt-2 text-sm text-white/60">
                                      —
                                    </div>
                                  )}
                                </div>

                                <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                                  <div className="text-white/80 text-sm font-semibold">
                                    Biggest drops
                                  </div>
                                  {declined.length ? (
                                    <ul className="mt-2 text-sm text-white/70 list-disc pl-5 space-y-1">
                                      {declined.map((c) => (
                                        <li key={`${p.id}-dec-${c.testId}`}>
                                          <span className="text-white/80 font-semibold">
                                            {c.name}
                                          </span>{" "}
                                          <span className="text-red-300">
                                            ({Math.round(c.pct * 100)}%)
                                          </span>
                                        </li>
                                      ))}
                                    </ul>
                                  ) : (
                                    <div className="mt-2 text-sm text-white/60">
                                      —
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : null}

                            {changeEntry && changesData?.previousEvaluation ? (
                              <div className="mt-4">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setOpenPlayerChanges((s) => ({
                                      ...s,
                                      [p.id]: !s[p.id],
                                    }))
                                  }
                                  className="text-sm text-white/70 hover:text-white inline-flex items-center gap-2"
                                >
                                  {open
                                    ? "Hide all stat changes"
                                    : "Show all stat changes"}
                                </button>

                                {open ? (
                                  <div className="mt-3 overflow-x-auto">
                                    <table className="w-full">
                                      <thead className="bg-white/5 border-b border-white/10">
                                        <tr>
                                          <th className="px-3 py-2 text-left text-xs font-semibold text-white/80">
                                            Test
                                          </th>
                                          <th className="px-3 py-2 text-left text-xs font-semibold text-white/80">
                                            Old → New
                                          </th>
                                          <th className="px-3 py-2 text-right text-xs font-semibold text-white/80">
                                            Rank
                                          </th>
                                          <th className="px-3 py-2 text-right text-xs font-semibold text-white/80">
                                            Change
                                          </th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-white/10">
                                        {changes
                                          .slice()
                                          .sort(
                                            (a, b) =>
                                              Math.abs(b.contrib) -
                                              Math.abs(a.contrib)
                                          )
                                          .map((c) => {
                                            const pctLabel = `${Math.round(
                                              c.pct * 100
                                            )}%`;
                                            const good = c.contrib >= 0;
                                            const rankLabel =
                                              c.oldRank && c.newRank
                                                ? `#${c.oldRank} → #${c.newRank}`
                                                : "—";
                                            const deltaLabel =
                                              (c.deltaValue >= 0 ? "+" : "-") +
                                              c.deltaValueLabel;
                                            return (
                                              <tr
                                                key={`${p.id}-chg-${c.testId}`}
                                              >
                                                <td className="px-3 py-2 text-white/90 text-sm">
                                                  {c.name}
                                                </td>
                                                <td className="px-3 py-2 text-white/70 text-sm">
                                                  {c.oldValueLabel} →{" "}
                                                  {c.newValueLabel}
                                                </td>
                                                <td className="px-3 py-2 text-right text-white/70 text-sm">
                                                  {rankLabel}
                                                </td>
                                                <td
                                                  className={
                                                    "px-3 py-2 text-right font-semibold text-sm " +
                                                    (good
                                                      ? "text-[#e3ca76]"
                                                      : "text-red-300")
                                                  }
                                                >
                                                  {deltaLabel} ({pctLabel})
                                                </td>
                                              </tr>
                                            );
                                          })}
                                      </tbody>
                                    </table>
                                  </div>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
