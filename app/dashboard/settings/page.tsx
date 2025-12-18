"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  User,
  Mail,
  Phone,
  Lock,
  Building2,
  Globe,
  Image as ImageIcon,
  AlertTriangle,
  Trash2,
  UserCog,
  Upload,
  X,
  Check,
} from "lucide-react";
import Button from "@/components/ui/Button";

interface ProfileData {
  user: {
    id: string;
    name: string;
    email: string;
    imageUrl: string | null;
    phoneNumber: string | null;
    role: string;
  };
  company: {
    id: string;
    name: string;
    logo: string | null;
    websiteUrl: string | null;
  } | null;
}

interface Admin {
  id: string;
  name: string;
  email: string;
  imageUrl: string | null;
}

export default function SettingsPage() {
  const router = useRouter();
  const { data: session, update } = useSession();
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Profile form state
  const [profileForm, setProfileForm] = useState({
    name: "",
    phoneNumber: "",
    image: null as File | null,
    imagePreview: null as string | null,
  });

  // Password form state
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  // Email form state
  const [emailForm, setEmailForm] = useState({
    newEmail: "",
    code: "",
    step: "request" as "request" | "verify",
  });

  // Company form state
  const [companyForm, setCompanyForm] = useState({
    name: "",
    websiteUrl: "",
    logo: null as File | null,
    logoPreview: null as string | null,
  });

  // Transfer ownership state
  const [transferForm, setTransferForm] = useState({
    newOwnerId: "",
    confirmation: "",
  });

  // Delete account state
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  // Modal states
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      const profileResponse = await fetch("/api/user/profile");

      if (profileResponse.ok) {
        const data = await profileResponse.json();
        setProfileData(data);
        setProfileForm({
          name: data.user.name,
          phoneNumber: data.user.phoneNumber || "",
          image: null,
          imagePreview: data.user.imageUrl,
        });
        if (data.company) {
          setCompanyForm({
            name: data.company.name,
            websiteUrl: data.company.websiteUrl || "",
            logo: null,
            logoPreview: data.company.logo,
          });
        }

        // Fetch admins from company members endpoint (filter for admins) - only for owners
        if (data.user.role === "owner") {
          try {
            const membersResponse = await fetch("/api/company/members");
            if (membersResponse.ok) {
              const membersData = await membersResponse.json();
              // Filter for admins only (role = 'admin')
              const adminMembers = (membersData.members || []).filter(
                (member: any) => member.role === "admin"
              );
              setAdmins(
                adminMembers.map((member: any) => ({
                  id: member.id,
                  name: member.name,
                  email: member.email,
                  imageUrl: member.imageUrl,
                }))
              );
            } else {
              setAdmins([]);
            }
          } catch (error) {
            console.error("Failed to fetch admins:", error);
            setAdmins([]);
          }
        }
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
      setError("Failed to load settings");
      setAdmins([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleProfileUpdate() {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const formData = new FormData();
      if (profileForm.name !== profileData?.user.name) {
        formData.append("name", profileForm.name);
      }
      if (profileForm.phoneNumber !== (profileData?.user.phoneNumber || "")) {
        formData.append("phoneNumber", profileForm.phoneNumber);
      }
      if (profileForm.image) {
        formData.append("image", profileForm.image);
      }

      const response = await fetch("/api/user/profile", {
        method: "PUT",
        body: formData,
      });

      if (response.ok) {
        setSuccess("Profile updated successfully");
        await fetchData();
        await update(); // Refresh session
      } else {
        const data = await response.json();
        setError(data.error || "Failed to update profile");
      }
    } catch (error) {
      setError("Failed to update profile");
    } finally {
      setSaving(false);
    }
  }

  async function handlePasswordUpdate() {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      if (passwordForm.newPassword !== passwordForm.confirmPassword) {
        setError("New passwords do not match");
        setSaving(false);
        return;
      }

      if (passwordForm.newPassword.length < 8) {
        setError("Password must be at least 8 characters");
        setSaving(false);
        return;
      }

      const response = await fetch("/api/user/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          oldPassword: passwordForm.oldPassword,
          newPassword: passwordForm.newPassword,
        }),
      });

      if (response.ok) {
        setSuccess("Password updated successfully");
        setPasswordForm({
          oldPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
      } else {
        const data = await response.json();
        setError(data.error || "Failed to update password");
      }
    } catch (error) {
      setError("Failed to update password");
    } finally {
      setSaving(false);
    }
  }

  async function handleEmailRequest() {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const response = await fetch("/api/user/email/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newEmail: emailForm.newEmail }),
      });

      if (response.ok) {
        setSuccess("Verification code sent to new email address");
        setEmailForm({ ...emailForm, step: "verify" });
      } else {
        const data = await response.json();
        setError(data.error || "Failed to request email change");
      }
    } catch (error) {
      setError("Failed to request email change");
    } finally {
      setSaving(false);
    }
  }

  async function handleEmailVerify() {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const response = await fetch("/api/user/email/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          code: emailForm.code,
          newEmail: emailForm.newEmail 
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSuccess("Email updated successfully");
        setEmailForm({ newEmail: "", code: "", step: "request" });
        await fetchData();
        await update(); // Refresh session
      } else {
        const data = await response.json();
        setError(data.error || "Failed to verify email");
      }
    } catch (error) {
      setError("Failed to verify email");
    } finally {
      setSaving(false);
    }
  }

  async function handleCompanyUpdate() {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const formData = new FormData();
      if (companyForm.name !== profileData?.company?.name) {
        formData.append("name", companyForm.name);
      }
      if (companyForm.websiteUrl !== (profileData?.company?.websiteUrl || "")) {
        formData.append("websiteUrl", companyForm.websiteUrl);
      }
      if (companyForm.logo) {
        formData.append("logo", companyForm.logo);
      }

      const response = await fetch("/api/company", {
        method: "PUT",
        body: formData,
      });

      if (response.ok) {
        setSuccess("Company updated successfully");
        await fetchData();
      } else {
        const data = await response.json();
        setError(data.error || "Failed to update company");
      }
    } catch (error) {
      setError("Failed to update company");
    } finally {
      setSaving(false);
    }
  }

  async function handleTransferOwnership() {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      if (transferForm.confirmation !== "TRANSFER OWNERSHIP") {
        setError("Please type 'TRANSFER OWNERSHIP' to confirm");
        setSaving(false);
        return;
      }

      const response = await fetch("/api/company/transfer-ownership", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newOwnerId: transferForm.newOwnerId }),
      });

      if (response.ok) {
        setSuccess("Ownership transferred successfully");
        setShowTransferModal(false);
        setTransferForm({ newOwnerId: "", confirmation: "" });
        // Sign out and redirect to login
        setTimeout(() => {
          router.push("/logout");
        }, 2000);
      } else {
        const data = await response.json();
        setError(data.error || "Failed to transfer ownership");
      }
    } catch (error) {
      setError("Failed to transfer ownership");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAccount() {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      if (deleteConfirmation !== "DELETE MY ACCOUNT") {
        setError("Please type 'DELETE MY ACCOUNT' to confirm");
        setSaving(false);
        return;
      }

      const response = await fetch("/api/user/account", {
        method: "DELETE",
      });

      if (response.ok) {
        // Redirect to logout
        router.push("/logout");
      } else {
        const data = await response.json();
        setError(data.error || "Failed to delete account");
      }
    } catch (error) {
      setError("Failed to delete account");
    } finally {
      setSaving(false);
    }
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setProfileForm({
        ...profileForm,
        image: file,
        imagePreview: URL.createObjectURL(file),
      });
    }
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setCompanyForm({
        ...companyForm,
        logo: file,
        logoPreview: URL.createObjectURL(file),
      });
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-white/70">Loading settings...</p>
      </div>
    );
  }

  if (!profileData) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-white/70">Loading settings...</p>
      </div>
    );
  }

  const isOwner = profileData.user.role === "owner";
  const canManageCompany = isOwner;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
        <p className="text-white/60">Manage your profile and company settings</p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 text-red-400">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-500/10 border border-green-500/50 rounded-lg p-4 text-green-400">
          {success}
        </div>
      )}

      {/* Profile Settings */}
      <section className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
        <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
          <User className="w-5 h-5 text-[#e3ca76]" />
          Profile Settings
        </h2>

        <div className="space-y-6">
          {/* Profile Image */}
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              Profile Image
            </label>
            <div className="flex items-center gap-4">
              <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-white/20">
                {profileForm.imagePreview ? (
                  <img
                    src={profileForm.imagePreview}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-white/10 flex items-center justify-center">
                    <User className="w-8 h-8 text-white/40" />
                  </div>
                )}
              </div>
              <label className="cursor-pointer inline-block">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
                <Button variant="outline" type="button" onClick={(e) => e.preventDefault()}>
                  <Upload className="w-4 h-4 mr-2 inline" />
                  Upload Image
                </Button>
              </label>
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              Name
            </label>
            <input
              type="text"
              value={profileForm.name}
              onChange={(e) =>
                setProfileForm({ ...profileForm, name: e.target.value })
              }
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-[#e3ca76]/50"
            />
          </div>

          {/* Phone Number */}
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2 flex items-center gap-2">
              <Phone className="w-4 h-4" />
              Phone Number
            </label>
            <input
              type="tel"
              value={profileForm.phoneNumber}
              onChange={(e) =>
                setProfileForm({ ...profileForm, phoneNumber: e.target.value })
              }
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-[#e3ca76]/50"
              placeholder="+1 (555) 123-4567"
            />
          </div>

          <Button
            onClick={handleProfileUpdate}
            disabled={saving}
            className="w-full sm:w-auto"
          >
            {saving ? "Saving..." : "Update Profile"}
          </Button>
        </div>
      </section>

      {/* Password Settings */}
      <section className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
        <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
          <Lock className="w-5 h-5 text-[#e3ca76]" />
          Change Password
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              Current Password
            </label>
            <input
              type="password"
              value={passwordForm.oldPassword}
              onChange={(e) =>
                setPasswordForm({ ...passwordForm, oldPassword: e.target.value })
              }
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-[#e3ca76]/50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              New Password
            </label>
            <input
              type="password"
              value={passwordForm.newPassword}
              onChange={(e) =>
                setPasswordForm({ ...passwordForm, newPassword: e.target.value })
              }
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-[#e3ca76]/50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              Confirm New Password
            </label>
            <input
              type="password"
              value={passwordForm.confirmPassword}
              onChange={(e) =>
                setPasswordForm({
                  ...passwordForm,
                  confirmPassword: e.target.value,
                })
              }
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-[#e3ca76]/50"
            />
          </div>

          <Button
            onClick={handlePasswordUpdate}
            disabled={saving}
            className="w-full sm:w-auto"
          >
            {saving ? "Updating..." : "Update Password"}
          </Button>
        </div>
      </section>

      {/* Email Settings */}
      <section className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
        <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
          <Mail className="w-5 h-5 text-[#e3ca76]" />
          Change Email
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              Current Email
            </label>
            <input
              type="email"
              value={profileData.user.email}
              disabled
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white/60 cursor-not-allowed"
            />
          </div>

          {emailForm.step === "request" ? (
            <>
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  New Email
                </label>
                <input
                  type="email"
                  value={emailForm.newEmail}
                  onChange={(e) =>
                    setEmailForm({ ...emailForm, newEmail: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-[#e3ca76]/50"
                  placeholder="new@example.com"
                />
              </div>
              <Button
                onClick={handleEmailRequest}
                disabled={saving || !emailForm.newEmail}
                className="w-full sm:w-auto"
              >
                {saving ? "Sending..." : "Send Verification Code"}
              </Button>
            </>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Verification Code
                </label>
                <input
                  type="text"
                  value={emailForm.code}
                  onChange={(e) =>
                    setEmailForm({ ...emailForm, code: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-[#e3ca76]/50"
                  placeholder="Enter 6-digit code"
                  maxLength={6}
                />
                <p className="text-sm text-white/50 mt-1">
                  Code sent to {emailForm.newEmail}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleEmailVerify}
                  disabled={saving || emailForm.code.length !== 6}
                  className="w-full sm:w-auto"
                >
                  {saving ? "Verifying..." : "Verify & Update Email"}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() =>
                    setEmailForm({ newEmail: "", code: "", step: "request" })
                  }
                  className="w-full sm:w-auto"
                >
                  Cancel
                </Button>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Company Settings - Only for owners */}
      {canManageCompany && profileData.company && (
        <section className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-[#e3ca76]" />
            Company Settings
          </h2>

          <div className="space-y-6">
            {/* Company Logo */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Company Logo
              </label>
              <div className="flex items-center gap-4">
                <div className="relative w-24 h-24 rounded-lg overflow-hidden border-2 border-white/20">
                  {companyForm.logoPreview ? (
                    <img
                      src={companyForm.logoPreview}
                      alt="Company Logo"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-white/10 flex items-center justify-center">
                      <Building2 className="w-8 h-8 text-white/40" />
                    </div>
                  )}
                </div>
                <label className="cursor-pointer inline-block">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoChange}
                    className="hidden"
                  />
                  <Button variant="outline" type="button" onClick={(e) => e.preventDefault()}>
                    <Upload className="w-4 h-4 mr-2 inline" />
                    Upload Logo
                  </Button>
                </label>
              </div>
            </div>

            {/* Company Name */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Company Name
              </label>
              <input
                type="text"
                value={companyForm.name}
                onChange={(e) =>
                  setCompanyForm({ ...companyForm, name: e.target.value })
                }
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-[#e3ca76]/50"
              />
            </div>

            {/* Website URL */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2 flex items-center gap-2">
                <Globe className="w-4 h-4" />
                Website URL
              </label>
              <input
                type="url"
                value={companyForm.websiteUrl}
                onChange={(e) =>
                  setCompanyForm({ ...companyForm, websiteUrl: e.target.value })
                }
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-[#e3ca76]/50"
                placeholder="https://example.com"
              />
            </div>

            <Button
              onClick={handleCompanyUpdate}
              disabled={saving}
              className="w-full sm:w-auto"
            >
              {saving ? "Saving..." : "Update Company"}
            </Button>
          </div>
        </section>
      )}

      {/* Danger Zone */}
      <section className="bg-red-500/10 backdrop-blur-sm border border-red-500/30 rounded-xl p-6">
        <h2 className="text-xl font-semibold text-red-400 mb-6 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          Danger Zone
        </h2>

        <div className="space-y-4">
          {/* Transfer Ownership - Only for owners */}
          {canManageCompany && (
            <div className="bg-white/5 border border-white/10 rounded-lg p-4">
              <h3 className="text-lg font-medium text-white mb-2 flex items-center gap-2">
                <UserCog className="w-5 h-5" />
                Transfer Ownership
              </h3>
              <p className="text-white/60 text-sm mb-4">
                Transfer ownership of your company to an admin. You will become an admin after the transfer.
              </p>
              {admins.length === 0 ? (
                <p className="text-white/50 text-sm">
                  No admins available. Add admins first before transferring ownership.
                </p>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => setShowTransferModal(true)}
                  className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                >
                  Transfer Ownership
                </Button>
              )}
            </div>
          )}

          {/* Delete Account */}
          <div className="bg-white/5 border border-white/10 rounded-lg p-4">
            <h3 className="text-lg font-medium text-white mb-2 flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              Delete Account
            </h3>
            <p className="text-white/60 text-sm mb-4">
              Permanently delete your account. This action cannot be undone.
              {isOwner && " You must transfer ownership before deleting your account."}
            </p>
            {isOwner ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteModal(true)}
                  disabled={true}
                  className="border-red-500/30 text-red-400/50 cursor-not-allowed opacity-50"
                >
                  Delete Account (Transfer Ownership First)
                </Button>
                <p className="text-white/40 text-xs mt-2">
                  Transfer ownership above to enable account deletion
                </p>
              </>
            ) : (
              <Button
                variant="outline"
                onClick={() => setShowDeleteModal(true)}
                className="border-red-500/50 text-red-400 hover:bg-red-500/10"
              >
                Delete Account
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* Transfer Ownership Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1a1a] border border-white/20 rounded-xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-white">Transfer Ownership</h3>
              <button
                onClick={() => setShowTransferModal(false)}
                className="text-white/60 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-white/60 text-sm mb-4">
              Select an admin to transfer ownership to. You will become an admin after this action.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Select Admin
                </label>
                <select
                  value={transferForm.newOwnerId}
                  onChange={(e) =>
                    setTransferForm({ ...transferForm, newOwnerId: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#e3ca76]/50"
                >
                  <option value="">Select an admin...</option>
                  {admins.map((admin) => (
                    <option key={admin.id} value={admin.id}>
                      {admin.name} ({admin.email})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Type "TRANSFER OWNERSHIP" to confirm
                </label>
                <input
                  type="text"
                  value={transferForm.confirmation}
                  onChange={(e) =>
                    setTransferForm({ ...transferForm, confirmation: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-[#e3ca76]/50"
                  placeholder="TRANSFER OWNERSHIP"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleTransferOwnership}
                  disabled={saving || transferForm.confirmation !== "TRANSFER OWNERSHIP" || !transferForm.newOwnerId}
                  className="flex-1 bg-red-500/20 hover:bg-red-500/30 border-red-500/50"
                >
                  {saving ? "Transferring..." : "Transfer Ownership"}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowTransferModal(false);
                    setTransferForm({ newOwnerId: "", confirmation: "" });
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1a1a] border border-red-500/50 rounded-xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-red-400">Delete Account</h3>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="text-white/60 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-white/60 text-sm mb-4">
              This action cannot be undone. All your data will be permanently deleted. You must transfer ownership before deleting your account.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Type "DELETE MY ACCOUNT" to confirm
                </label>
                <input
                  type="text"
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-[#e3ca76]/50"
                  placeholder="DELETE MY ACCOUNT"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleDeleteAccount}
                  disabled={saving || deleteConfirmation !== "DELETE MY ACCOUNT"}
                  className="flex-1 bg-red-500/20 hover:bg-red-500/30 border-red-500/50"
                >
                  {saving ? "Deleting..." : "Delete Account"}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setShowDeleteModal(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

