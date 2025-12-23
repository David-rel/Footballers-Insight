"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft,
  Edit,
  Trash2,
  Users,
  BookOpen,
  User,
  Calendar,
  Image as ImageIcon,
  Plus,
  X,
  Mail,
  CheckCircle,
  Clock,
  ClipboardList,
} from "lucide-react";
import Button from "@/components/ui/Button";
import TeamLeaderboardsPanel from "@/components/features/TeamLeaderboardsPanel";

interface Curriculum {
  id: string;
  name: string;
  description: string | null;
  tests: string[];
}

interface Coach {
  id: string;
  name: string;
  email: string;
}

interface Team {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  curriculumId: string | null;
  curriculum: Curriculum | null;
  coachId: string | null;
  coach: Coach | null;
  createdAt: string;
  updatedAt: string;
}

interface Player {
  id: string;
  parentUserId: string;
  teamId: string;
  firstName: string;
  lastName: string;
  dob: string | null;
  ageGroup: string | null;
  gender: string | null;
  dominantFoot: string | null;
  notes: string | null;
  selfSupervised: boolean;
  parentName?: string;
  parentPhoneNumber?: string | null;
  email: string;
  emailVerified: boolean;
  onboarded: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Evaluation {
  id: string;
  teamId: string;
  createdBy: string;
  createdByName: string;
  name: string;
  oneVOneRounds: number;
  skillMovesCount: number;
  scores: Record<string, Record<string, string | number>>;
  createdAt: string;
  updatedAt: string;
}

export default function TeamDetailPage() {
  const router = useRouter();
  const params = useParams();
  const teamId = params.id as string;

  const [team, setTeam] = useState<Team | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [computingAllData, setComputingAllData] = useState(false);
  const [showAddPlayerModal, setShowAddPlayerModal] = useState(false);
  const [addingPlayer, setAddingPlayer] = useState(false);
  const [hoveredPlayer, setHoveredPlayer] = useState<Player | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [playerForm, setPlayerForm] = useState({
    firstName: "",
    lastName: "",
    hasParent: true,
    parentName: "",
    parentEmail: "",
    selfSupervised: false,
    selfSupervisorEmail: "",
  });

  useEffect(() => {
    fetchUserRole();
  }, [teamId]);

  useEffect(() => {
    if (!userRole) return;

    // Players/parents are not allowed on this page
    if (userRole === "player" || userRole === "parent") {
      setLoading(false);
      return;
    }

    fetchTeam();
    fetchPlayers();
    fetchEvaluations();
  }, [teamId, userRole]);

  // NOTE: We intentionally do NOT allow selecting an existing parent account here,
  // to avoid exposing other parents in the company to coaches/staff.

  async function fetchUserRole() {
    try {
      const response = await fetch("/api/user/profile");
      if (response.ok) {
        const data = await response.json();
        setUserRole(data.user.role);
      }
    } catch (error) {
      console.error("Failed to fetch user role:", error);
    }
  }

  async function fetchTeam() {
    try {
      setLoading(true);
      const response = await fetch("/api/teams");
      if (response.ok) {
        const data = await response.json();
        const foundTeam = data.teams.find((t: Team) => t.id === teamId);
        if (foundTeam) {
          setTeam(foundTeam);
        } else {
          // Team not found or not accessible
          router.push("/dashboard/teams");
        }
      }
    } catch (error) {
      console.error("Failed to fetch team:", error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchPlayers() {
    try {
      const response = await fetch(`/api/teams/${teamId}/players`);
      if (response.ok) {
        const data = await response.json();
        setPlayers(data.players);
      }
    } catch (error) {
      console.error("Failed to fetch players:", error);
    }
  }

  async function fetchEvaluations() {
    try {
      const response = await fetch(`/api/teams/${teamId}/evaluations`);
      if (response.ok) {
        const data = await response.json();
        setEvaluations(data.evaluations);
      }
    } catch (error) {
      console.error("Failed to fetch evaluations:", error);
    }
  }

  // TESTING ONLY: Computes "all data" for the team (currently only Shot Power) server-side (console logs).
  async function handleComputeAllData() {
    try {
      setComputingAllData(true);
      const res = await fetch(`/api/teams/${teamId}/evaluations/compute-all`, {
        method: "POST",
      });
      // Don't display anything in the UI - this is for server console log testing only.
      // Drain the response body without rendering anything.
      await res.text().catch(() => null);
    } catch (error) {
      console.error("Failed to compute shot power:", error);
    } finally {
      setComputingAllData(false);
    }
  }

  async function handleAddPlayer() {
    try {
      setAddingPlayer(true);

      const payload: any = {
        firstName: playerForm.firstName,
        lastName: playerForm.lastName,
        hasParent: playerForm.hasParent,
        parentName: playerForm.parentName || null,
        parentEmail: playerForm.parentEmail || null,
        selfSupervised: playerForm.selfSupervised,
        selfSupervisorEmail: playerForm.selfSupervisorEmail || null,
      };

      const response = await fetch(`/api/teams/${teamId}/players`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        await fetchPlayers();
        setShowAddPlayerModal(false);
        setPlayerForm({
          firstName: "",
          lastName: "",
          hasParent: true,
          parentName: "",
          parentEmail: "",
          selfSupervised: false,
          selfSupervisorEmail: "",
        });
      } else {
        const error = await response.json();
        alert(error.error || "Failed to add player");
      }
    } catch (error) {
      console.error("Failed to add player:", error);
      alert("Failed to add player");
    } finally {
      setAddingPlayer(false);
    }
  }

  async function handleDelete() {
    try {
      const response = await fetch(`/api/teams/${teamId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        router.push("/dashboard/teams");
      } else {
        const error = await response.json();
        alert(error.error || "Failed to delete team");
      }
    } catch (error) {
      console.error("Failed to delete team:", error);
      alert("Failed to delete team");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-white/70">Loading...</p>
      </div>
    );
  }

  if (userRole === "player" || userRole === "parent") {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="rounded-2xl border border-white/10 bg-black/60 p-8 text-center">
          <h1 className="text-2xl font-bold text-white mb-2">
            You don’t have access to this page
          </h1>
          <p className="text-white/70 mb-6">
            This team page is for coaches and staff. Go back to see your players.
          </p>
          <Button onClick={() => router.push("/dashboard/players")}>
            Back to My Players
          </Button>
        </div>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-white/70 text-lg mb-4">Team not found</p>
          <Button onClick={() => router.push("/dashboard/teams")}>
            Back to Teams
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.push("/dashboard/teams")}
          className="flex items-center gap-2 text-white/70 hover:text-white mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Teams</span>
        </button>

        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-white mb-2">{team.name}</h1>
            {team.description && (
              <p className="text-white/70 text-lg">{team.description}</p>
            )}
          </div>
          {userRole !== "coach" && (
            <div className="flex items-center gap-3">
              <Button
                onClick={() => router.push(`/dashboard/teams/${teamId}/edit`)}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Edit className="w-4 h-4" />
                <span>Edit Team</span>
              </Button>
              <Button
                onClick={() => setDeleteConfirm(true)}
                variant="outline"
                className="flex items-center gap-2 border-red-500/50 text-red-400 hover:bg-red-500/10"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete</span>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Banner Image */}
      {team.imageUrl && (
        <div className="rounded-2xl overflow-hidden mb-6 border border-white/10">
          <div className="h-64 bg-gradient-to-br from-[#e3ca76]/20 to-[#a78443]/20 relative">
            <img
              src={team.imageUrl}
              alt={team.name}
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      )}

      {/* Team Information Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Coach Card */}
        <div className="rounded-2xl border border-white/10 bg-black/60 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-lg bg-[#e3ca76]/20 flex items-center justify-center border border-[#e3ca76]/30">
              <User className="w-6 h-6 text-[#e3ca76]" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-white/70">Coach</h3>
              {team.coach ? (
                <p className="text-xl font-bold text-white">{team.coach.name}</p>
              ) : (
                <p className="text-white/50">No coach assigned</p>
              )}
            </div>
          </div>
          {team.coach && (
            <div className="text-white/70 text-sm">
              <p>{team.coach.email}</p>
            </div>
          )}
        </div>

        {/* Curriculum Card */}
        <div className="rounded-2xl border border-white/10 bg-black/60 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-lg bg-[#e3ca76]/20 flex items-center justify-center border border-[#e3ca76]/30">
              <BookOpen className="w-6 h-6 text-[#e3ca76]" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-white/70">Curriculum</h3>
              {team.curriculum ? (
                <p className="text-xl font-bold text-white">
                  {team.curriculum.name}
                </p>
              ) : (
                <p className="text-white/50">No curriculum assigned</p>
              )}
            </div>
          </div>
          {team.curriculum?.description && (
            <p className="text-white/70 text-sm mb-3">
              {team.curriculum.description}
            </p>
          )}
          {team.curriculum && team.curriculum.tests.length > 0 && (
            <div>
              <p className="text-xs text-white/50 mb-2">Tests included:</p>
              <div className="flex flex-wrap gap-2">
                {team.curriculum.tests.slice(0, 5).map((test) => (
                  <span
                    key={test}
                    className="px-2 py-1 bg-[#e3ca76]/20 text-[#e3ca76] text-xs rounded-full border border-[#e3ca76]/30"
                  >
                    {test}
                  </span>
                ))}
                {team.curriculum.tests.length > 5 && (
                  <span className="px-2 py-1 bg-white/10 text-white/70 text-xs rounded-full">
                    +{team.curriculum.tests.length - 5} more
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Leaderboards */}
      {(userRole === "coach" || userRole === "owner" || userRole === "admin") && (
        <TeamLeaderboardsPanel teamId={teamId} />
      )}

      {/* Evaluations Section */}
      {(userRole === "coach" || userRole === "owner" || userRole === "admin") && (
        <div className="rounded-2xl border border-white/10 bg-black/60 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-white">Evaluations</h2>
              <Button
                variant="outline"
                className="border-[#e3ca76]/50 text-[#e3ca76] hover:bg-[#e3ca76]/10"
                disabled={computingAllData || evaluations.length === 0}
                onClick={(e) => {
                  e.preventDefault();
                  handleComputeAllData();
                }}
              >
                {computingAllData ? "Computing..." : "Compute All Data"}
              </Button>
            </div>
            <Button
              onClick={() => router.push(`/dashboard/teams/${teamId}/evaluations/new`)}
              className="flex items-center gap-2"
            >
              <ClipboardList className="w-4 h-4" />
              <span>New Evaluation</span>
            </Button>
          </div>

          {evaluations.length === 0 ? (
            <div className="text-center py-8">
              <ClipboardList className="w-12 h-12 text-white/20 mx-auto mb-3" />
              <p className="text-white/70 text-sm mb-1">No evaluations yet</p>
              <p className="text-white/50 text-xs">
                Create an evaluation to start tracking player test scores
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {evaluations.map((evaluation) => (
                <div
                  key={evaluation.id}
                  className="flex items-center justify-between p-4 bg-white/5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                  onClick={() => router.push(`/dashboard/teams/${teamId}/evaluations/${evaluation.id}`)}
                >
                  <div className="flex-1">
                    <h3 className="text-white font-medium">{evaluation.name}</h3>
                    <p className="text-white/50 text-sm mt-1">
                      Created by {evaluation.createdByName} • {new Date(evaluation.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-white/70 text-sm">
                    {players.length} player{players.length !== 1 ? "s" : ""}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Players Section */}
      <div className="rounded-2xl border border-white/10 bg-black/60 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">Players</h2>
          {(userRole === "coach" || userRole === "owner" || userRole === "admin") && (
            <Button
              onClick={() => setShowAddPlayerModal(true)}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Add Player</span>
            </Button>
          )}
        </div>

        {players.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-16 h-16 text-white/20 mx-auto mb-4" />
            <p className="text-white/70 text-lg mb-2">No players yet</p>
            <p className="text-white/50 text-sm">
              Add players to this team to get started
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/5 border-b border-white/10">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-white/90">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-white/90">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-white/90">
                    Status
                  </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-white/90">
                      Date of Birth
                    </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-white/90">
                    Gender
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-white/90">
                    Dominant Foot
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-white/90">
                    Notes
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {players.map((player) => (
                  <tr 
                    key={player.id} 
                    className="hover:bg-white/5 transition-colors cursor-pointer"
                    onClick={(e) => {
                      // Don't navigate if clicking on interactive elements
                      const target = e.target as HTMLElement;
                      if (target.tagName === 'A' || target.closest('a, button')) {
                        return;
                      }
                      router.push(`/dashboard/teams/${teamId}/player/${player.id}`);
                    }}
                  >
                    <td className="px-4 py-3">
                      <div
                        className="inline-block"
                        onMouseEnter={(e) => {
                          const rect = (
                            e.currentTarget as HTMLDivElement
                          ).getBoundingClientRect();
                          const cardWidth = 320;
                          const padding = 12;
                          const x = Math.min(
                            Math.max(rect.left, padding),
                            Math.max(padding, window.innerWidth - cardWidth - padding)
                          );
                          setHoverPos({ x, y: rect.bottom + 8 });
                          setHoveredPlayer(player);
                        }}
                        onMouseLeave={() => {
                          setHoveredPlayer((current) =>
                            current?.id === player.id ? null : current
                          );
                        }}
                      >
                        <p className="text-white font-medium">
                          {player.firstName} {player.lastName}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-white/70 text-sm">
                        <Mail className="w-4 h-4" />
                        {player.email}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {(() => {
                          // Check if player has completed all required profile fields
                          const hasCompleteProfile = player.onboarded && player.dob && player.gender && player.dominantFoot;
                          return hasCompleteProfile ? (
                            <>
                              <CheckCircle className="w-4 h-4 text-green-400" />
                              <span className="text-green-400 text-sm">Active</span>
                            </>
                          ) : (
                            <>
                              <Clock className="w-4 h-4 text-yellow-400" />
                              <span className="text-yellow-400 text-sm">Invitation Sent</span>
                            </>
                          );
                        })()}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-white/70 text-sm">
                      {player.dob ? new Date(player.dob).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-3 text-white/70 text-sm">
                      {player.gender ? player.gender.charAt(0).toUpperCase() + player.gender.slice(1) : "—"}
                    </td>
                    <td className="px-4 py-3 text-white/70 text-sm">
                      {player.dominantFoot ? player.dominantFoot.charAt(0).toUpperCase() + player.dominantFoot.slice(1) : "—"}
                    </td>
                    <td className="px-4 py-3 text-white/70 text-sm max-w-xs">
                      <div className="truncate" title={player.notes || ""}>
                        {player.notes || "—"}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Fixed hover card (not clipped by table overflow) */}
      {hoveredPlayer && (
        <div
          className="pointer-events-none fixed z-[9999] w-[320px] rounded-xl border border-white/10 bg-black/95 p-4 text-sm text-white shadow-[0_20px_70px_rgba(0,0,0,0.6)]"
          style={{ left: hoverPos.x, top: hoverPos.y }}
        >
          <div className="mb-3">
            <p className="text-xs uppercase tracking-[0.2em] text-[#e3ca76]">
              Supervisor
            </p>
            <p className="mt-1 text-white/90">{hoveredPlayer.parentName || "—"}</p>
            <p className="text-white/70">{hoveredPlayer.email}</p>
            {hoveredPlayer.parentPhoneNumber ? (
              <p className="text-white/70">{hoveredPlayer.parentPhoneNumber}</p>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-white/50">Self-supervised</p>
              <p className="text-white/80">
                {hoveredPlayer.selfSupervised ? "Yes" : "No"}
              </p>
            </div>
            <div>
              <p className="text-xs text-white/50">Email verified</p>
              <p className="text-white/80">
                {hoveredPlayer.emailVerified ? "Yes" : "No"}
              </p>
            </div>
            <div>
              <p className="text-xs text-white/50">Supervisor onboarded</p>
              <p className="text-white/80">{hoveredPlayer.onboarded ? "Yes" : "No"}</p>
            </div>
            <div>
              <p className="text-xs text-white/50">Player profile complete</p>
              <p className="text-white/80">
                {hoveredPlayer.dob &&
                hoveredPlayer.gender &&
                hoveredPlayer.dominantFoot
                  ? "Yes"
                  : "No"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Additional Information */}
      <div className="rounded-2xl border border-white/10 bg-black/60 p-6">
        <h2 className="text-xl font-bold text-white mb-4">Team Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-white/50" />
            <div>
              <p className="text-sm text-white/70">Created</p>
              <p className="text-white">
                {new Date(team.createdAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-white/50" />
            <div>
              <p className="text-sm text-white/70">Last Updated</p>
              <p className="text-white">
                {new Date(team.updatedAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Add Player Modal */}
      {showAddPlayerModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-black/95 border border-white/10 rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Add Player</h2>
              <button
                onClick={() => setShowAddPlayerModal(false)}
                className="text-white/70 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">
                  First Name *
                </label>
                <input
                  type="text"
                  value={playerForm.firstName}
                  onChange={(e) =>
                    setPlayerForm({ ...playerForm, firstName: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#e3ca76]/50"
                  placeholder="Enter first name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">
                  Last Name *
                </label>
                <input
                  type="text"
                  value={playerForm.lastName}
                  onChange={(e) =>
                    setPlayerForm({ ...playerForm, lastName: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#e3ca76]/50"
                  placeholder="Enter last name"
                />
              </div>

              <div className="pt-2 border-t border-white/10">
                <label className="block text-sm font-medium text-white/90 mb-2">
                  Supervisor setup
                </label>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-white/80 text-sm">
                    <input
                      type="checkbox"
                      checked={playerForm.hasParent}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setPlayerForm({
                          ...playerForm,
                          hasParent: checked,
                          selfSupervised: checked ? false : playerForm.selfSupervised,
                        });
                      }}
                      className="accent-[#e3ca76]"
                    />
                    This player has a parent/guardian account
                  </label>

                  <label className="flex items-center gap-2 text-white/80 text-sm">
                    <input
                      type="checkbox"
                      checked={playerForm.selfSupervised}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setPlayerForm({
                          ...playerForm,
                          selfSupervised: checked,
                          hasParent: checked ? false : playerForm.hasParent,
                        });
                      }}
                      className="accent-[#e3ca76]"
                    />
                    Player is their own supervisor (uses their own email to log in)
                  </label>
                </div>
              </div>

              {playerForm.hasParent && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-white/90 mb-2">
                      Parent/Guardian Name *
                    </label>
                    <input
                      type="text"
                      value={playerForm.parentName}
                      onChange={(e) =>
                        setPlayerForm({
                          ...playerForm,
                          parentName: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#e3ca76]/50"
                      placeholder="Enter parent/guardian name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-white/90 mb-2">
                      Parent/Guardian Email *
                    </label>
                    <input
                      type="email"
                      value={playerForm.parentEmail}
                      onChange={(e) =>
                        setPlayerForm({
                          ...playerForm,
                          parentEmail: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#e3ca76]/50"
                      placeholder="parent@email.com"
                    />
                    <p className="text-white/50 text-xs mt-2">
                      We’ll send a login invite to this email (or link if it already
                      exists).
                    </p>
                  </div>
                </div>
              )}

              {playerForm.selfSupervised && (
                <div>
                  <label className="block text-sm font-medium text-white/90 mb-2">
                    Player Email *
                  </label>
                  <input
                    type="email"
                    value={playerForm.selfSupervisorEmail}
                    onChange={(e) =>
                      setPlayerForm({
                        ...playerForm,
                        selfSupervisorEmail: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#e3ca76]/50"
                    placeholder="player@email.com"
                  />
                  <p className="text-white/50 text-xs mt-2">
                    We’ll send a login invite to this email.
                  </p>
                </div>
              )}

              <div className="flex items-center gap-3 pt-4">
                <Button
                  onClick={handleAddPlayer}
                  disabled={
                    !playerForm.firstName ||
                    !playerForm.lastName ||
                    (!playerForm.hasParent && !playerForm.selfSupervised) ||
                    (playerForm.hasParent &&
                      (!playerForm.parentName || !playerForm.parentEmail)) ||
                    (playerForm.selfSupervised && !playerForm.selfSupervisorEmail) ||
                    addingPlayer
                  }
                  className="flex-1"
                >
                  {addingPlayer ? "Adding..." : "Add Player"}
                </Button>
                <Button
                  onClick={() => setShowAddPlayerModal(false)}
                  variant="ghost"
                  disabled={addingPlayer}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-black/95 border border-white/10 rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-white mb-4">Delete Team</h3>
            <p className="text-white/70 mb-6">
              Are you sure you want to delete "{team.name}"? This action cannot
              be undone.
            </p>
            <div className="flex items-center gap-3">
              <Button
                onClick={handleDelete}
                variant="outline"
                className="flex-1 border-red-500/50 text-red-400 hover:bg-red-500/10"
              >
                Delete
              </Button>
              <Button
                onClick={() => setDeleteConfirm(false)}
                variant="ghost"
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

