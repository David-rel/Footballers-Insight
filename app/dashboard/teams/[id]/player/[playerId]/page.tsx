"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft,
  Mail,
  Calendar,
  User,
  Footprints,
  FileText,
  CheckCircle,
  Clock,
  Users,
  Edit,
  Trash2,
  X,
} from "lucide-react";
import Button from "@/components/ui/Button";
import PlayerEvaluationPanel from "@/components/features/PlayerEvaluationPanel";

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
  selfSupervised?: boolean;
  email: string;
  emailVerified: boolean;
  onboarded: boolean;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Team {
  id: string;
  name: string;
}

export default function PlayerDetailPage() {
  const router = useRouter();
  const params = useParams();
  const teamId = params.id as string;
  const playerId = params.playerId as string;

  const [player, setPlayer] = useState<Player | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);

  // Form state for editing
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    dob: "",
    gender: "",
    dominantFoot: "",
    notes: "",
  });

  useEffect(() => {
    fetchUserRole();
  }, []);

  useEffect(() => {
    if (userRole !== null) {
      fetchPlayerData();
      fetchTeamData();
    }
  }, [teamId, playerId, userRole]);

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

  async function fetchTeamData() {
    try {
      // Players/parents cannot access teams API, so skip fetching team data for them
      if (userRole === "player" || userRole === "parent") {
        return;
      }
      
      const response = await fetch("/api/teams");
      if (response.ok) {
        const data = await response.json();
        const foundTeam = data.teams.find((t: Team) => t.id === teamId);
        if (foundTeam) {
          setTeam(foundTeam);
        }
      }
    } catch (error) {
      console.error("Failed to fetch team:", error);
    }
  }

  async function fetchPlayerData() {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/teams/${teamId}/players/${playerId}`);
      if (!response.ok) {
        if (response.status === 404) {
          setError("Player not found.");
        } else if (response.status === 403) {
          setError("You do not have permission to view this player.");
        } else {
          setError("Failed to fetch player data.");
        }
        setPlayer(null);
        return;
      }

      const data = await response.json();
      setPlayer(data.player);
      
      // Set form data for editing
      if (data.player) {
        setFormData({
          firstName: data.player.firstName || "",
          lastName: data.player.lastName || "",
          dob: data.player.dob ? data.player.dob.split("T")[0] : "",
          gender: data.player.gender || "",
          dominantFoot: data.player.dominantFoot || "",
          notes: data.player.notes || "",
        });
      }
    } catch (err) {
      console.error("Error fetching player data:", err);
      setError("An unexpected error occurred.");
      setPlayer(null);
    } finally {
      setLoading(false);
    }
  }

  function handleEditClick() {
    if (player) {
      setFormData({
        firstName: player.firstName || "",
        lastName: player.lastName || "",
        dob: player.dob ? player.dob.split("T")[0] : "",
        gender: player.gender || "",
        dominantFoot: player.dominantFoot || "",
        notes: player.notes || "",
      });
      setShowEditModal(true);
    }
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/teams/${teamId}/players/${playerId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update player");
      }

      setShowEditModal(false);
      await fetchPlayerData(); // Re-fetch data to update UI
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/teams/${teamId}/players/${playerId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete player");
      }

      // Redirect based on user role
      if (userRole === "player" || userRole === "parent") {
        router.push("/dashboard/players");
      } else {
        router.push(`/dashboard/teams/${teamId}`);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
      setDeleteConfirm(false);
    }
  }

  const canEdit = userRole === "owner" || userRole === "admin" || userRole === "coach";
  const canDelete = userRole === "owner" || userRole === "admin";

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-white/70">Loading player...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <Button 
            onClick={() => {
              if (userRole === "player" || userRole === "parent") {
                router.push("/dashboard/players");
              } else {
                router.push(`/dashboard/teams/${teamId}`);
              }
            }}
          >
            {userRole === "player" || userRole === "parent"
              ? "Back to Players"
              : "Back to Team"}
          </Button>
        </div>
      </div>
    );
  }

  if (!player) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-white/70">Player not found.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        {userRole !== "player" ? (
          <Button
            variant="ghost"
            onClick={() => router.push(`/dashboard/teams/${teamId}`)}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Team</span>
          </Button>
        ) : (
          <Button
            variant="ghost"
            onClick={() => router.push("/dashboard/players")}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Players</span>
          </Button>
        )}
        {(canEdit || canDelete) && (
          <div className="flex items-center gap-3">
            {canEdit && (
              <Button onClick={handleEditClick} className="flex items-center gap-2">
                <Edit className="w-4 h-4" />
                <span>Edit Player</span>
              </Button>
            )}
            {canDelete && (
              <Button
                onClick={() => setDeleteConfirm(true)}
                className="flex items-center gap-2 bg-red-500/20 hover:bg-red-500/30 border-red-500/30 text-red-400"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete Player</span>
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Player Header Card */}
      <div className="rounded-2xl border border-white/10 bg-black/60 p-6 mb-8">
        <div className="flex items-start gap-6">
          {player.imageUrl ? (
            <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-[#e3ca76]/30">
              <img
                src={player.imageUrl}
                alt={`${player.firstName} ${player.lastName}`}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#e3ca76]/20 to-[#a78443]/20 flex items-center justify-center border-2 border-[#e3ca76]/30">
              <User className="w-12 h-12 text-white/30" />
            </div>
          )}
          <div className="flex-1">
            <h1 className="text-4xl font-bold text-white mb-2">
              {player.firstName} {player.lastName}
            </h1>
            {team && (
              <p className="text-white/70 text-lg mb-4">
                {team.name}
              </p>
            )}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                {(() => {
                  // Check if player has completed all required profile fields
                  const hasCompleteProfile = player.onboarded && player.dob && player.gender && player.dominantFoot;
                  return hasCompleteProfile ? (
                    <>
                      <CheckCircle className="w-5 h-5 text-green-400" />
                      <span className="text-green-400 font-medium">Active</span>
                    </>
                  ) : (
                    <>
                      <Clock className="w-5 h-5 text-yellow-400" />
                      <span className="text-yellow-400 font-medium">Invitation Sent</span>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Player Information Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Contact Information */}
        <div className="rounded-2xl border border-white/10 bg-black/60 p-6">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Mail className="w-5 h-5 text-[#e3ca76]" />
            Contact Information
          </h2>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-white/70 mb-1">Email</p>
              <p className="text-white">{player.email}</p>
              {player.emailVerified && (
                <span className="inline-flex items-center gap-1 text-xs text-green-400 mt-1">
                  <CheckCircle className="w-3 h-3" />
                  Verified
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Personal Information */}
        <div className="rounded-2xl border border-white/10 bg-black/60 p-6">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <User className="w-5 h-5 text-[#e3ca76]" />
            Personal Information
          </h2>
          <div className="space-y-3">
            {player.dob && (
              <div>
                <p className="text-sm text-white/70 mb-1">Date of Birth</p>
                <p className="text-white">
                  {new Date(player.dob).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
                {player.ageGroup && (
                  <p className="text-xs text-white/50 mt-1">Birth Year: {player.ageGroup}</p>
                )}
              </div>
            )}
            {player.gender && (
              <div>
                <p className="text-sm text-white/70 mb-1">Gender</p>
                <p className="text-white capitalize">{player.gender}</p>
              </div>
            )}
            {player.dominantFoot && (
              <div>
                <p className="text-sm text-white/70 mb-1">Dominant Foot</p>
                <p className="text-white capitalize">{player.dominantFoot}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Notes Section */}
      {player.notes && (
        <div className="rounded-2xl border border-white/10 bg-black/60 p-6 mb-6">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#e3ca76]" />
            Notes
          </h2>
          <p className="text-white/90 whitespace-pre-wrap">{player.notes}</p>
        </div>
      )}

      {/* Evaluation Data */}
      <div className="mb-6">
        <PlayerEvaluationPanel teamId={teamId} playerId={playerId} />
      </div>

      {/* Additional Information */}
      <div className="rounded-2xl border border-white/10 bg-black/60 p-6">
        <h2 className="text-xl font-bold text-white mb-4">Additional Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-white/50" />
            <div>
              <p className="text-sm text-white/70">Added to Team</p>
              <p className="text-white">
                {new Date(player.createdAt).toLocaleDateString("en-US", {
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
                {new Date(player.updatedAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {showEditModal && player && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-black/95 border border-white/10 rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Edit Player</h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-white/70 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white/90 mb-2">
                    First Name *
                  </label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) =>
                      setFormData({ ...formData, firstName: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#e3ca76]/50"
                    placeholder="Enter first name"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/90 mb-2">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) =>
                      setFormData({ ...formData, lastName: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#e3ca76]/50"
                    placeholder="Enter last name"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">
                  Date of Birth
                </label>
                <input
                  type="date"
                  value={formData.dob}
                  onChange={(e) =>
                    setFormData({ ...formData, dob: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#e3ca76]/50"
                  max={new Date().toISOString().split("T")[0]}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">
                  Gender
                </label>
                <select
                  value={formData.gender}
                  onChange={(e) =>
                    setFormData({ ...formData, gender: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#e3ca76]/50"
                >
                  <option value="">Select gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">
                  Dominant Foot
                </label>
                <select
                  value={formData.dominantFoot}
                  onChange={(e) =>
                    setFormData({ ...formData, dominantFoot: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#e3ca76]/50"
                >
                  <option value="">Select dominant foot</option>
                  <option value="left">Left</option>
                  <option value="right">Right</option>
                  <option value="both">Both</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  rows={4}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#e3ca76]/50 resize-none"
                  placeholder="Any additional notes or information..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="submit"
                  disabled={!formData.firstName || !formData.lastName || saving}
                  className="flex-1"
                >
                  {saving ? "Saving..." : "Update Player"}
                </Button>
                <Button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  variant="ghost"
                  disabled={saving}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-black/95 border border-white/10 rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold text-white mb-4">
              Delete Player
            </h2>
            <p className="text-white/70 mb-6">
              Are you sure you want to delete {player?.firstName} {player?.lastName}? This will remove them from the team but will not delete their user account. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setDeleteConfirm(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleDelete}
                className="flex-1 bg-red-500/20 hover:bg-red-500/30 border-red-500/30 text-red-400"
                disabled={saving}
              >
                {saving ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

