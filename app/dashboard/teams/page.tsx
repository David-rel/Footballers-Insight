"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Edit,
  Trash2,
  Users,
  BookOpen,
  User,
  X,
  Image as ImageIcon,
  Upload,
} from "lucide-react";
import Button from "@/components/ui/Button";

interface Curriculum {
  id: string;
  name: string;
  description: string | null;
  tests: any[];
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

export default function TeamsPage() {
  const router = useRouter();
  const [teams, setTeams] = useState<Team[]>([]);
  const [curriculums, setCurriculums] = useState<Curriculum[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    imageUrl: "",
    image: null as File | null,
    imagePreview: null as string | null,
    curriculumId: "",
    coachId: "",
  });

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      
      // First get user role
      const profileRes = await fetch("/api/user/profile");
      let currentUserRole: string | null = null;
      if (profileRes.ok) {
        const profileData = await profileRes.json();
        currentUserRole = profileData.user.role;
        setUserRole(currentUserRole);
        
        // Players cannot access teams page
        if (currentUserRole === "player") {
          router.push("/dashboard");
          return;
        }
      }
      
      // Fetch teams (coaches will only get their teams from API)
      const teamsRes = await fetch("/api/teams");
      if (teamsRes.ok) {
        const teamsData = await teamsRes.json();
        setTeams(teamsData.teams);
      }

      // Only fetch curriculums and coaches if user is not a coach
      if (currentUserRole !== "coach") {
        const [curriculumsRes, coachesRes] = await Promise.all([
          fetch("/api/curriculums"),
          fetch("/api/company/members"),
        ]);

        if (curriculumsRes.ok) {
          const curriculumsData = await curriculumsRes.json();
          setCurriculums(curriculumsData.curriculums);
        }

        if (coachesRes.ok) {
          const coachesData = await coachesRes.json();
          // Filter only coaches
          const coachMembers = coachesData.members.filter(
            (member: any) => member.role === "coach"
          );
          setCoaches(
            coachMembers.map((member: any) => ({
              id: member.id,
              name: member.name,
              email: member.email,
            }))
          );
        }
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  }

  function handleCreateClick() {
    setFormData({
      name: "",
      description: "",
      imageUrl: "",
      image: null,
      imagePreview: null,
      curriculumId: "",
      coachId: "",
    });
    setShowCreateModal(true);
  }

  function handleEditClick(team: Team) {
    setSelectedTeam(team);
    setFormData({
      name: team.name,
      description: team.description || "",
      imageUrl: team.imageUrl || "",
      image: null,
      imagePreview: team.imageUrl || null,
      curriculumId: team.curriculumId || "",
      coachId: team.coachId || "",
    });
    setShowEditModal(true);
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setFormData({
        ...formData,
        image: file,
        imagePreview: URL.createObjectURL(file),
      });
    }
  }

  async function handleSubmit(isEdit: boolean) {
    try {
      setSaving(true);

      const url = isEdit ? `/api/teams/${selectedTeam?.id}` : "/api/teams";
      const method = isEdit ? "PUT" : "POST";

      const submitFormData = new FormData();
      submitFormData.append("name", formData.name);
      if (formData.description) {
        submitFormData.append("description", formData.description);
      }
      if (formData.image) {
        submitFormData.append("image", formData.image);
      }
      if (formData.curriculumId) {
        submitFormData.append("curriculumId", formData.curriculumId);
      }
      if (formData.coachId) {
        submitFormData.append("coachId", formData.coachId);
      }

      const response = await fetch(url, {
        method,
        body: submitFormData,
      });

      if (response.ok) {
        await fetchData();
        setShowCreateModal(false);
        setShowEditModal(false);
        setFormData({
          name: "",
          description: "",
          imageUrl: "",
          image: null,
          imagePreview: null,
          curriculumId: "",
          coachId: "",
        });
        setSelectedTeam(null);
      } else {
        const error = await response.json();
        alert(error.error || "Failed to save team");
      }
    } catch (error) {
      console.error("Failed to save team:", error);
      alert("Failed to save team");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(teamId: string) {
    try {
      const response = await fetch(`/api/teams/${teamId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        await fetchData();
        setDeleteConfirm(null);
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

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Teams</h1>
          <p className="text-white/70 mt-1">
            {userRole === "coach" 
              ? "View your assigned teams" 
              : "Manage your teams and their configurations"}
          </p>
        </div>
        {userRole !== "coach" && (
          <Button onClick={handleCreateClick} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            <span>Create Team</span>
          </Button>
        )}
      </div>

      {/* Teams Grid */}
      {teams.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-black/60 p-12 text-center">
          <Users className="w-16 h-16 text-white/20 mx-auto mb-4" />
          <p className="text-white/70 text-lg mb-2">No teams yet</p>
          <p className="text-white/50 text-sm mb-6">
            {userRole === "coach" 
              ? "No teams assigned to you yet" 
              : "Create your first team to get started"}
          </p>
          {userRole !== "coach" && (
            <Button onClick={handleCreateClick} className="flex items-center gap-2 mx-auto">
              <Plus className="w-4 h-4" />
              <span>Create Team</span>
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teams.map((team) => (
            <div
              key={team.id}
              onClick={() => router.push(`/dashboard/teams/${team.id}`)}
              className="rounded-2xl border border-white/10 bg-black/60 overflow-hidden hover:border-white/20 transition-colors cursor-pointer"
            >
              {/* Team Banner Image */}
              {team.imageUrl ? (
                <div className="h-32 bg-gradient-to-br from-[#e3ca76]/20 to-[#a78443]/20 relative">
                  <img
                    src={team.imageUrl}
                    alt={team.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="h-32 bg-gradient-to-br from-[#e3ca76]/20 to-[#a78443]/20 flex items-center justify-center">
                  <Users className="w-12 h-12 text-white/30" />
                </div>
              )}

              {/* Team Content */}
              <div className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-xl font-bold text-white">{team.name}</h3>
                  {userRole !== "coach" && (
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleEditClick(team)}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                        title="Edit team"
                      >
                        <Edit className="w-4 h-4 text-white/70 hover:text-white" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(team.id)}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                        title="Delete team"
                      >
                        <Trash2 className="w-4 h-4 text-white/70 hover:text-red-400" />
                      </button>
                    </div>
                  )}
                </div>

                {team.description && (
                  <p className="text-white/70 text-sm mb-4 line-clamp-2">
                    {team.description}
                  </p>
                )}

                <div className="space-y-2">
                  {team.coach && (
                    <div className="flex items-center gap-2 text-white/70 text-sm">
                      <User className="w-4 h-4" />
                      <span className="truncate">{team.coach.name}</span>
                    </div>
                  )}

                  {team.curriculum && (
                    <div className="flex items-center gap-2 text-white/70 text-sm">
                      <BookOpen className="w-4 h-4" />
                      <span className="truncate">{team.curriculum.name}</span>
                    </div>
                  )}

                  <div className="text-white/50 text-xs pt-2 border-t border-white/10">
                    Created {new Date(team.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-black/95 border border-white/10 rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Create Team</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-white/70 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">
                  Team Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#e3ca76]/50"
                  placeholder="Enter team name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  rows={3}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#e3ca76]/50 resize-none"
                  placeholder="Enter team description"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">
                  Banner Image
                </label>
                <div className="space-y-3">
                  {/* File Upload */}
                  <div>
                    <label className="flex items-center justify-center w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg cursor-pointer hover:bg-white/10 transition-colors">
                      <Upload className="w-5 h-5 mr-2 text-white/70" />
                      <span className="text-white/70 text-sm">
                        {formData.image ? formData.image.name : "Upload Image"}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                  
                  {/* Preview */}
                  {formData.imagePreview && (
                    <div className="w-full h-48 rounded-lg overflow-hidden border border-white/10">
                      <img
                        src={formData.imagePreview}
                        alt="Preview"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">
                  Curriculum
                </label>
                <select
                  value={formData.curriculumId}
                  onChange={(e) =>
                    setFormData({ ...formData, curriculumId: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#e3ca76]/50"
                >
                  <option value="">Select a curriculum</option>
                  {curriculums.map((curriculum) => (
                    <option key={curriculum.id} value={curriculum.id}>
                      {curriculum.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">
                  Coach
                </label>
                <select
                  value={formData.coachId}
                  onChange={(e) =>
                    setFormData({ ...formData, coachId: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#e3ca76]/50"
                >
                  <option value="">Select a coach</option>
                  {coaches.map((coach) => (
                    <option key={coach.id} value={coach.id}>
                      {coach.name} ({coach.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-3 pt-4">
                <Button
                  onClick={() => handleSubmit(false)}
                  disabled={!formData.name || saving}
                  className="flex-1"
                >
                  {saving ? "Creating..." : "Create Team"}
                </Button>
                <Button
                  onClick={() => setShowCreateModal(false)}
                  variant="ghost"
                  disabled={saving}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedTeam && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-black/95 border border-white/10 rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Edit Team</h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-white/70 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">
                  Team Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#e3ca76]/50"
                  placeholder="Enter team name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  rows={3}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#e3ca76]/50 resize-none"
                  placeholder="Enter team description"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">
                  Banner Image
                </label>
                <div className="space-y-3">
                  {/* File Upload */}
                  <div>
                    <label className="flex items-center justify-center w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg cursor-pointer hover:bg-white/10 transition-colors">
                      <Upload className="w-5 h-5 mr-2 text-white/70" />
                      <span className="text-white/70 text-sm">
                        {formData.image ? formData.image.name : "Upload Image"}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                  
                  {/* Preview */}
                  {formData.imagePreview && (
                    <div className="w-full h-48 rounded-lg overflow-hidden border border-white/10">
                      <img
                        src={formData.imagePreview}
                        alt="Preview"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">
                  Curriculum
                </label>
                <select
                  value={formData.curriculumId}
                  onChange={(e) =>
                    setFormData({ ...formData, curriculumId: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#e3ca76]/50"
                >
                  <option value="">Select a curriculum</option>
                  {curriculums.map((curriculum) => (
                    <option key={curriculum.id} value={curriculum.id}>
                      {curriculum.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">
                  Coach
                </label>
                <select
                  value={formData.coachId}
                  onChange={(e) =>
                    setFormData({ ...formData, coachId: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#e3ca76]/50"
                >
                  <option value="">Select a coach</option>
                  {coaches.map((coach) => (
                    <option key={coach.id} value={coach.id}>
                      {coach.name} ({coach.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-3 pt-4">
                <Button
                  onClick={() => handleSubmit(true)}
                  disabled={!formData.name || saving}
                  className="flex-1"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
                <Button
                  onClick={() => setShowEditModal(false)}
                  variant="ghost"
                  disabled={saving}
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
            <h3 className="text-xl font-bold text-white mb-4">
              Delete Team
            </h3>
            <p className="text-white/70 mb-6">
              Are you sure you want to delete this team? This action cannot be
              undone.
            </p>
            <div className="flex items-center gap-3">
              <Button
                onClick={() => handleDelete(deleteConfirm)}
                variant="outline"
                className="flex-1 border-red-500/50 text-red-400 hover:bg-red-500/10"
              >
                Delete
              </Button>
              <Button
                onClick={() => setDeleteConfirm(null)}
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

