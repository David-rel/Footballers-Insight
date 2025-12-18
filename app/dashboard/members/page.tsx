"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Edit,
  Trash2,
  User,
  Shield,
  UserCog,
  Mail,
  Phone,
  Mail as MailIcon,
  Send,
} from "lucide-react";
import Button from "@/components/ui/Button";

interface Member {
  id: string;
  name: string;
  email: string;
  phoneNumber: string | null;
  imageUrl: string | null;
  role: string;
  createdAt: string;
  onboarded: boolean;
}

export default function CompanyMembersPage() {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [resendingInvite, setResendingInvite] = useState<string | null>(null);

  // Add/Edit form state
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phoneNumber: "",
    role: "admin",
  });

  useEffect(() => {
    checkAccessAndFetch();
  }, []);

  async function checkAccessAndFetch() {
    try {
      // First check user role
      const profileResponse = await fetch("/api/user/profile");
      if (profileResponse.ok) {
        const profileData = await profileResponse.json();
        const role = profileData.user.role;

        // Only owners and admins can access this page
        if (role !== "owner" && role !== "admin") {
          router.push("/dashboard");
          return;
        }

        setCurrentUserRole(role);
      }

      // Then fetch members
      const response = await fetch("/api/company/members");
      if (response.ok) {
        const data = await response.json();
        setMembers(data.members);
        setCurrentUserRole(data.currentUserRole);
      }
    } catch (error) {
      console.error("Failed to fetch members:", error);
    } finally {
      setLoading(false);
      setCheckingAccess(false);
    }
  }

  async function fetchMembers() {
    try {
      const response = await fetch("/api/company/members");
      if (response.ok) {
        const data = await response.json();
        setMembers(data.members);
        setCurrentUserRole(data.currentUserRole);
      }
    } catch (error) {
      console.error("Failed to fetch members:", error);
    }
  }

  function handleAddClick() {
    setFormData({ name: "", email: "", phoneNumber: "", role: "admin" });
    setShowAddModal(true);
  }

  function handleEditClick(member: Member) {
    setSelectedMember(member);
    setFormData({
      name: member.name,
      email: member.email,
      phoneNumber: member.phoneNumber || "",
      role: member.role,
    });
    setShowEditModal(true);
  }

  async function handleAdd() {
    try {
      const response = await fetch("/api/company/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to add member");
      }

      setShowAddModal(false);
      fetchMembers();
    } catch (error: any) {
      alert(error.message || "Failed to add member");
    }
  }

  async function handleUpdate() {
    if (!selectedMember) return;

    try {
      const response = await fetch("/api/company/members/update", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId: selectedMember.id,
          ...formData,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update member");
      }

      setShowEditModal(false);
      setSelectedMember(null);
      fetchMembers();
    } catch (error: any) {
      alert(error.message || "Failed to update member");
    }
  }

  async function handleDelete(memberId: string) {
    try {
      const response = await fetch(`/api/company/members?id=${memberId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete member");
      }

      setDeleteConfirm(null);
      fetchMembers();
    } catch (error: any) {
      alert(error.message || "Failed to delete member");
    }
  }

  async function handleResendInvitation(memberId: string) {
    setResendingInvite(memberId);
    try {
      const response = await fetch("/api/company/members/resend-invitation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to resend invitation");
      }

      alert("Invitation email sent successfully!");
    } catch (error: any) {
      alert(error.message || "Failed to resend invitation");
    } finally {
      setResendingInvite(null);
    }
  }

  function canEdit(member: Member): boolean {
    if (currentUserRole === "owner") return true;
    if (currentUserRole === "admin" && member.role !== "owner") return true;
    return false;
  }

  function canDelete(member: Member): boolean {
    if (currentUserRole === "owner") return true;
    if (currentUserRole === "admin" && member.role !== "owner") return true;
    return false;
  }

  function getRoleIcon(role: string) {
    switch (role) {
      case "owner":
        return <Shield className="w-4 h-4" />;
      case "admin":
        return <UserCog className="w-4 h-4" />;
      case "coach":
        return <User className="w-4 h-4" />;
      default:
        return <User className="w-4 h-4" />;
    }
  }

  function getRoleBadgeColor(role: string) {
    switch (role) {
      case "owner":
        return "bg-[#e3ca76]/20 text-[#e3ca76] border-[#e3ca76]/30";
      case "admin":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "coach":
        return "bg-green-500/20 text-green-400 border-green-500/30";
      default:
        return "bg-white/10 text-white/70 border-white/20";
    }
  }

  if (loading || checkingAccess) {
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
          <h1 className="text-3xl font-bold text-white">Company Members</h1>
          <p className="text-white/70 mt-1">
            Manage owners, admins, and coaches
          </p>
        </div>
        <Button onClick={handleAddClick} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          <span>Add Member</span>
        </Button>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-white/5 border-b border-white/10">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-white/90">
                  Member
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-white/90">
                  Contact
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-white/90">
                  Role
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-white/90">
                  Joined
                </th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-white/90">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {members.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-12 text-center text-white/70"
                  >
                    No members found
                  </td>
                </tr>
              ) : (
                members.map((member) => (
                  <tr
                    key={member.id}
                    className="hover:bg-white/5 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {member.imageUrl ? (
                          <img
                            src={member.imageUrl}
                            alt={member.name}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#e3ca76] to-[#a78443] flex items-center justify-center">
                            <User className="w-5 h-5 text-black" />
                          </div>
                        )}
                        <div>
                          <p className="text-white font-medium">
                            {member.name}
                          </p>
                          <p className="text-white/60 text-sm">
                            {member.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-white/70 text-sm">
                          <Mail className="w-4 h-4" />
                          {member.email}
                        </div>
                        {member.phoneNumber && (
                          <div className="flex items-center gap-2 text-white/70 text-sm">
                            <Phone className="w-4 h-4" />
                            {member.phoneNumber}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${getRoleBadgeColor(
                          member.role
                        )}`}
                      >
                        {getRoleIcon(member.role)}
                        {member.role.charAt(0).toUpperCase() +
                          member.role.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-white/70 text-sm">
                      {new Date(member.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {!member.onboarded && member.role !== "owner" && (
                          <button
                            onClick={() => handleResendInvitation(member.id)}
                            disabled={resendingInvite === member.id}
                            className="p-2 rounded-lg bg-white/5 hover:bg-blue-500/20 border border-white/10 hover:border-blue-500/30 transition-colors disabled:opacity-50"
                            title="Resend invitation"
                          >
                            <Send className="w-4 h-4 text-white/70 hover:text-blue-400" />
                          </button>
                        )}
                        {canEdit(member) ? (
                          <button
                            onClick={() => handleEditClick(member)}
                            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4 text-white/70" />
                          </button>
                        ) : (
                          <div className="p-2 rounded-lg bg-white/5 border border-white/10 opacity-50 cursor-not-allowed">
                            <Edit className="w-4 h-4 text-white/30" />
                          </div>
                        )}
                        {canDelete(member) ? (
                          <button
                            onClick={() => setDeleteConfirm(member.id)}
                            className="p-2 rounded-lg bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-500/30 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4 text-white/70 hover:text-red-400" />
                          </button>
                        ) : (
                          <div className="p-2 rounded-lg bg-white/5 border border-white/10 opacity-50 cursor-not-allowed">
                            <Trash2 className="w-4 h-4 text-white/30" />
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-black/95 border border-white/10 rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold text-white mb-4">Add Member</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">
                  Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#e3ca76]/50"
                  placeholder="Enter name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#e3ca76]/50"
                  placeholder="Enter email"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={formData.phoneNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, phoneNumber: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#e3ca76]/50"
                  placeholder="Enter phone number"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">
                  Role *
                </label>
                <select
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({ ...formData, role: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#e3ca76]/50"
                >
                  <option value="admin">Admin</option>
                  <option value="coach">Coach</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                onClick={() => setShowAddModal(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button onClick={handleAdd} className="flex-1">
                Add Member
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedMember && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-black/95 border border-white/10 rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold text-white mb-4">Edit Member</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">
                  Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#e3ca76]/50"
                  disabled={
                    selectedMember.role === "owner" &&
                    currentUserRole === "admin"
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#e3ca76]/50"
                  disabled={
                    selectedMember.role === "owner" &&
                    currentUserRole === "admin"
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={formData.phoneNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, phoneNumber: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#e3ca76]/50"
                  disabled={
                    selectedMember.role === "owner" &&
                    currentUserRole === "admin"
                  }
                />
              </div>
              {selectedMember.role !== "owner" && (
                <div>
                  <label className="block text-sm font-medium text-white/90 mb-2">
                    Role *
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) =>
                      setFormData({ ...formData, role: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#e3ca76]/50"
                  >
                    <option value="admin">Admin</option>
                    <option value="coach">Coach</option>
                  </select>
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedMember(null);
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button onClick={handleUpdate} className="flex-1">
                Update Member
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-black/95 border border-white/10 rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold text-white mb-4">
              Delete Member
            </h2>
            <p className="text-white/70 mb-6">
              Are you sure you want to remove this member? This action cannot be
              undone.
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setDeleteConfirm(null)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 bg-red-500/20 hover:bg-red-500/30 border-red-500/30 text-red-400"
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
