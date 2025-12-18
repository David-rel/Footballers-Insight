"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Edit,
  Trash2,
  BookOpen,
  X,
  CheckSquare,
  Square,
} from "lucide-react";
import Button from "@/components/ui/Button";

interface Curriculum {
  id: string;
  name: string;
  description: string | null;
  tests: string[];
  createdAt: string;
  updatedAt: string;
}

const AVAILABLE_TESTS = [
  "Shot Power",
  "Serve Distance",
  "Figure 8 Dribble",
  "Passing Gates",
  "1v1 Competitive Score",
  "Juggling Control",
  "Skill Moves Rating",
  "5–10–5 Agility",
  "Reaction Sprint",
  "Single-Leg Hop",
  "Double-Leg Jump Endurance",
  "Ankle Dorsiflexion",
  "Core Endurance",
];

export default function CurriculumsPage() {
  const router = useRouter();
  const [curriculums, setCurriculums] = useState<Curriculum[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedCurriculum, setSelectedCurriculum] =
    useState<Curriculum | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    tests: [] as string[],
  });

  useEffect(() => {
    checkAccessAndFetch();
  }, []);

  async function fetchCurriculums() {
    try {
      const response = await fetch("/api/curriculums");
      if (response.ok) {
        const data = await response.json();
        setCurriculums(data.curriculums);
      } else if (response.status === 403) {
        router.push("/dashboard");
      }
    } catch (error) {
      console.error("Failed to fetch curriculums:", error);
    }
  }

  async function checkAccessAndFetch() {
    try {
      setLoading(true);
      
      // Check user role
      const profileResponse = await fetch("/api/user/profile");
      if (profileResponse.ok) {
        const profileData = await profileResponse.json();
        const role = profileData.user.role;
        setUserRole(role);

        // Coaches and players cannot access curriculums
        if (role === "coach" || role === "player") {
          router.push("/dashboard");
          return;
        }
      }

      // Fetch curriculums
      await fetchCurriculums();
    } catch (error) {
      console.error("Failed to fetch curriculums:", error);
    } finally {
      setLoading(false);
    }
  }

  function handleCreateClick() {
    setFormData({
      name: "",
      description: "",
      tests: [],
    });
    setShowCreateModal(true);
  }

  function handleEditClick(curriculum: Curriculum) {
    setSelectedCurriculum(curriculum);
    setFormData({
      name: curriculum.name,
      description: curriculum.description || "",
      tests: curriculum.tests || [],
    });
    setShowEditModal(true);
  }

  function toggleTest(testName: string) {
    setFormData((prev) => {
      const tests = prev.tests.includes(testName)
        ? prev.tests.filter((t) => t !== testName)
        : [...prev.tests, testName];
      return { ...prev, tests };
    });
  }

  async function handleSubmit(isEdit: boolean) {
    try {
      setSaving(true);

      const url = "/api/curriculums";
      const method = isEdit ? "PUT" : "POST";
      const curriculumId = isEdit ? selectedCurriculum?.id : null;

      const response = await fetch(
        isEdit ? `/api/curriculums/${curriculumId}` : url,
        {
          method,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: formData.name,
            description: formData.description || null,
            tests: formData.tests,
          }),
        }
      );

      if (response.ok) {
        await fetchCurriculums();
        setShowCreateModal(false);
        setShowEditModal(false);
        setFormData({
          name: "",
          description: "",
          tests: [],
        });
        setSelectedCurriculum(null);
      } else {
        const error = await response.json();
        alert(error.error || "Failed to save curriculum");
      }
    } catch (error) {
      console.error("Failed to save curriculum:", error);
      alert("Failed to save curriculum");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(curriculumId: string) {
    try {
      const response = await fetch(`/api/curriculums/${curriculumId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        await fetchCurriculums();
        setDeleteConfirm(null);
      } else {
        const error = await response.json();
        alert(error.error || "Failed to delete curriculum");
      }
    } catch (error) {
      console.error("Failed to delete curriculum:", error);
      alert("Failed to delete curriculum");
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
          <h1 className="text-3xl font-bold text-white">Curriculums</h1>
          <p className="text-white/70 mt-1">
            Manage test curriculums for your teams
          </p>
        </div>
        <Button onClick={handleCreateClick} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          <span>Create Curriculum</span>
        </Button>
      </div>

      {/* Curriculums Table */}
      <div className="rounded-2xl border border-white/10 bg-black/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-white/5 border-b border-white/10">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-white/90">
                  Name
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-white/90">
                  Description
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-white/90">
                  Tests
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-white/90">
                  Created
                </th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-white/90">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {curriculums.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-12 text-center text-white/70"
                  >
                    No curriculums found
                  </td>
                </tr>
              ) : (
                curriculums.map((curriculum) => (
                  <tr
                    key={curriculum.id}
                    className="hover:bg-white/5 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <BookOpen className="w-5 h-5 text-[#e3ca76]" />
                        <span className="text-white font-medium">
                          {curriculum.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-white/70 text-sm max-w-md truncate">
                        {curriculum.description || "—"}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {curriculum.tests && curriculum.tests.length > 0 ? (
                          curriculum.tests.slice(0, 3).map((test) => (
                            <span
                              key={test}
                              className="px-2 py-1 bg-[#e3ca76]/20 text-[#e3ca76] text-xs rounded-full border border-[#e3ca76]/30"
                            >
                              {test}
                            </span>
                          ))
                        ) : (
                          <span className="text-white/50 text-sm">No tests</span>
                        )}
                        {curriculum.tests && curriculum.tests.length > 3 && (
                          <span className="px-2 py-1 bg-white/10 text-white/70 text-xs rounded-full">
                            +{curriculum.tests.length - 3} more
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-white/70 text-sm">
                      {new Date(curriculum.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEditClick(curriculum)}
                          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                          title="Edit curriculum"
                        >
                          <Edit className="w-4 h-4 text-white/70 hover:text-white" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(curriculum.id)}
                          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                          title="Delete curriculum"
                        >
                          <Trash2 className="w-4 h-4 text-white/70 hover:text-red-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-black/95 border border-white/10 rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">
                Create Curriculum
              </h2>
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
                  Curriculum Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#e3ca76]/50"
                  placeholder="Enter curriculum name"
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
                  placeholder="Enter curriculum description"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">
                  Tests *
                </label>
                <div className="bg-white/5 border border-white/10 rounded-lg p-4 max-h-64 overflow-y-auto">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {AVAILABLE_TESTS.map((test) => (
                      <label
                        key={test}
                        className="flex items-center gap-2 cursor-pointer hover:bg-white/5 p-2 rounded-lg transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={formData.tests.includes(test)}
                          onChange={() => toggleTest(test)}
                          className="hidden"
                        />
                        {formData.tests.includes(test) ? (
                          <CheckSquare className="w-5 h-5 text-[#e3ca76]" />
                        ) : (
                          <Square className="w-5 h-5 text-white/30" />
                        )}
                        <span className="text-white text-sm">{test}</span>
                      </label>
                    ))}
                  </div>
                </div>
                {formData.tests.length > 0 && (
                  <p className="text-white/50 text-xs mt-2">
                    {formData.tests.length} test{formData.tests.length !== 1 ? "s" : ""} selected
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3 pt-4">
                <Button
                  onClick={() => handleSubmit(false)}
                  disabled={!formData.name || saving}
                  className="flex-1"
                >
                  {saving ? "Creating..." : "Create Curriculum"}
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
      {showEditModal && selectedCurriculum && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-black/95 border border-white/10 rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Edit Curriculum</h2>
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
                  Curriculum Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#e3ca76]/50"
                  placeholder="Enter curriculum name"
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
                  placeholder="Enter curriculum description"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">
                  Tests *
                </label>
                <div className="bg-white/5 border border-white/10 rounded-lg p-4 max-h-64 overflow-y-auto">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {AVAILABLE_TESTS.map((test) => (
                      <label
                        key={test}
                        className="flex items-center gap-2 cursor-pointer hover:bg-white/5 p-2 rounded-lg transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={formData.tests.includes(test)}
                          onChange={() => toggleTest(test)}
                          className="hidden"
                        />
                        {formData.tests.includes(test) ? (
                          <CheckSquare className="w-5 h-5 text-[#e3ca76]" />
                        ) : (
                          <Square className="w-5 h-5 text-white/30" />
                        )}
                        <span className="text-white text-sm">{test}</span>
                      </label>
                    ))}
                  </div>
                </div>
                {formData.tests.length > 0 && (
                  <p className="text-white/50 text-xs mt-2">
                    {formData.tests.length} test{formData.tests.length !== 1 ? "s" : ""} selected
                  </p>
                )}
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
              Delete Curriculum
            </h3>
            <p className="text-white/70 mb-6">
              Are you sure you want to delete this curriculum? This action
              cannot be undone.
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

