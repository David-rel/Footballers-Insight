"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft,
  Upload,
  X,
} from "lucide-react";
import Button from "@/components/ui/Button";

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

export default function EditTeamPage() {
  const router = useRouter();
  const params = useParams();
  const teamId = params.id as string;

  const [team, setTeam] = useState<Team | null>(null);
  const [curriculums, setCurriculums] = useState<Curriculum[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);

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
  }, [teamId]);

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

        // Players and coaches cannot edit teams
        if (currentUserRole === "player" || currentUserRole === "coach") {
          router.push(`/dashboard/teams/${teamId}`);
          return;
        }
      }

      // Fetch team data
      const teamsRes = await fetch("/api/teams");
      if (teamsRes.ok) {
        const teamsData = await teamsRes.json();
        const foundTeam = teamsData.teams.find((t: Team) => t.id === teamId);
        if (foundTeam) {
          setTeam(foundTeam);
          setFormData({
            name: foundTeam.name,
            description: foundTeam.description || "",
            imageUrl: foundTeam.imageUrl || "",
            image: null,
            imagePreview: foundTeam.imageUrl || null,
            curriculumId: foundTeam.curriculumId || "",
            coachId: foundTeam.coachId || "",
          });
        } else {
          // Team not found or not accessible
          router.push("/dashboard/teams");
          return;
        }
      }

      // Fetch curriculums and coaches
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
        // Filter coaches, admins, and owners (admins and owners can also be coaches)
        const coachMembers = coachesData.members.filter(
          (member: any) => ["coach", "admin", "owner"].includes(member.role)
        );
        setCoaches(
          coachMembers.map((member: any) => ({
            id: member.id,
            name: member.name,
            email: member.email,
          }))
        );
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
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

  async function handleSubmit() {
    try {
      setSaving(true);

      const submitFormData = new FormData();
      submitFormData.append("name", formData.name);
      if (formData.description) {
        submitFormData.append("description", formData.description);
      }
      if (formData.image) {
        submitFormData.append("image", formData.image);
      }
      if (formData.imageUrl && !formData.image) {
        submitFormData.append("imageUrl", formData.imageUrl);
      }
      if (formData.curriculumId) {
        submitFormData.append("curriculumId", formData.curriculumId);
      }
      if (formData.coachId) {
        submitFormData.append("coachId", formData.coachId);
      }

      const response = await fetch(`/api/teams/${teamId}`, {
        method: "PUT",
        body: submitFormData,
      });

      if (response.ok) {
        router.push(`/dashboard/teams/${teamId}`);
      } else {
        const error = await response.json();
        alert(error.error || "Failed to update team");
      }
    } catch (error) {
      console.error("Failed to update team:", error);
      alert("Failed to update team");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-white/70">Loading...</p>
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
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.push(`/dashboard/teams/${teamId}`)}
          className="flex items-center gap-2 text-white/70 hover:text-white mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Team</span>
        </button>

        <h1 className="text-3xl font-bold text-white mb-2">Edit Team</h1>
        <p className="text-white/70">Update team information and settings</p>
      </div>

      {/* Form */}
      <div className="rounded-2xl border border-white/10 bg-black/60 p-6">
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
                    {formData.image ? formData.image.name : "Upload New Image"}
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
                <div className="w-full h-48 rounded-lg overflow-hidden border border-white/10 relative">
                  <img
                    src={formData.imagePreview}
                    alt="Preview"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                  <button
                    onClick={() => {
                      setFormData({
                        ...formData,
                        image: null,
                        imagePreview: team.imageUrl || null,
                        imageUrl: "",
                      });
                    }}
                    className="absolute top-2 right-2 p-2 bg-black/80 hover:bg-black/90 rounded-lg text-white/70 hover:text-white transition-colors"
                    title="Remove image"
                  >
                    <X className="w-4 h-4" />
                  </button>
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
              onClick={handleSubmit}
              disabled={!formData.name || saving}
              className="flex-1"
            >
              {saving ? "Saving..." : "Save Changes"}
            </Button>
            <Button
              onClick={() => router.push(`/dashboard/teams/${teamId}`)}
              variant="ghost"
              disabled={saving}
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

