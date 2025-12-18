"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";

interface AdminInvite {
  email: string;
  name: string;
}

export default function OnboardingPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [checkingRole, setCheckingRole] = useState(true);

  // Step 1: Company Info (Owner only)
  const [companyName, setCompanyName] = useState("");
  const [companyUrl, setCompanyUrl] = useState("");
  const [companyLogo, setCompanyLogo] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>("");

  // Step 2: User Info (Both)
  const [phoneNumber, setPhoneNumber] = useState("");
  const [userImage, setUserImage] = useState<File | null>(null);
  const [userImagePreview, setUserImagePreview] = useState<string>("");

  // Admin onboarding: Password change
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Step 3: Admin Invites (Owner only)
  const [adminInvites, setAdminInvites] = useState<AdminInvite[]>([
    { email: "", name: "" },
  ]);

  useEffect(() => {
    if (status === "loading") return;
    if (!session) {
      router.push("/login");
      return;
    }

    // Check user role
    async function checkRole() {
      try {
        const response = await fetch("/api/auth/check-verification");
        if (response.ok) {
          const data = await response.json();
          setUserRole(data.role);
        }
      } catch (error) {
        console.error("Failed to check role:", error);
      } finally {
        setCheckingRole(false);
      }
    }

    checkRole();
  }, [session, status, router]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCompanyLogo(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUserImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUserImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setUserImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const addAdminInvite = () => {
    setAdminInvites([...adminInvites, { email: "", name: "" }]);
  };

  const removeAdminInvite = (index: number) => {
    setAdminInvites(adminInvites.filter((_, i) => i !== index));
  };

  const updateAdminInvite = (index: number, field: keyof AdminInvite, value: string) => {
    const updated = [...adminInvites];
    updated[index][field] = value;
    setAdminInvites(updated);
  };

  const handleNext = () => {
    if (userRole === "admin" || userRole === "coach") {
      // Admin/Coach flow: password is step 1, profile is step 2
      if (currentStep === 1) {
        if (!newPassword || newPassword.length < 8) {
          alert("Password must be at least 8 characters long");
          return;
        }
        if (newPassword !== confirmPassword) {
          alert("Passwords do not match");
          return;
        }
        setCurrentStep(2);
      }
    } else {
      // Owner flow: company info is step 1, profile is step 2, invites is step 3
      if (currentStep === 1) {
        if (!companyName.trim()) {
          alert("Please enter a company name");
          return;
        }
        setCurrentStep(2);
      } else if (currentStep === 2) {
        setCurrentStep(3);
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    if (!session?.user?.email) {
      alert("Session expired. Please log in again.");
      router.push("/login");
      return;
    }

    setLoading(true);

    try {
      if (userRole === "admin" || userRole === "coach") {
        // Admin/Coach onboarding: simpler flow
        const formData = new FormData();
        formData.append("newPassword", newPassword);
        if (phoneNumber) formData.append("phoneNumber", phoneNumber);
        if (userImage) formData.append("userImage", userImage);

        const response = await fetch("/api/onboarding/admin-complete", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to complete onboarding");
        }
      } else {
        // Owner onboarding: full flow
        const formData = new FormData();
        formData.append("companyName", companyName);
        if (companyUrl) formData.append("companyUrl", companyUrl);
        if (companyLogo) formData.append("companyLogo", companyLogo);
        if (phoneNumber) formData.append("phoneNumber", phoneNumber);
        if (userImage) formData.append("userImage", userImage);

        // Filter out empty admin invites
        const validInvites = adminInvites.filter(
          (invite) => invite.email.trim() && invite.name.trim()
        );
        formData.append("adminInvites", JSON.stringify(validInvites));

        const response = await fetch("/api/onboarding/complete", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to complete onboarding");
        }
      }

      // Redirect to dashboard
      router.push("/dashboard");
    } catch (error: any) {
      console.error("Onboarding error:", error);
      alert(error.message || "Failed to complete onboarding. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading" || checkingRole) {
    return (
      <div className="relative mx-auto flex min-h-[80vh] max-w-6xl flex-col gap-10 px-6 py-14">
        <p className="text-white/70">Loading...</p>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const isAdminOrCoach = userRole === "admin" || userRole === "coach";
  const totalSteps = isAdminOrCoach ? 2 : 3;

  return (
    <div className="relative mx-auto flex min-h-[80vh] max-w-6xl flex-col gap-10 px-6 py-14">
      <div className="rounded-2xl border border-white/10 bg-black/60 p-8 text-white shadow-[0_20px_70px_rgba(0,0,0,0.4)]">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Complete Your Profile</h1>
          <p className="text-white/70">Step {currentStep} of {totalSteps}</p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex gap-2">
            {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => (
              <div
                key={step}
                className={`flex-1 h-2 rounded-full ${
                  step <= currentStep ? "bg-[#e3ca76]" : "bg-white/10"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Admin/Coach Onboarding: Step 1 - Password */}
        {isAdminOrCoach && currentStep === 1 && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-white/90 mb-2">
                New Password <span className="text-red-400">*</span>
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#e3ca76]/50"
                placeholder="Enter new password (min 8 characters)"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white/90 mb-2">
                Confirm Password <span className="text-red-400">*</span>
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#e3ca76]/50"
                placeholder="Confirm new password"
                required
              />
            </div>
          </div>
        )}

        {/* Admin/Coach Onboarding: Step 2 - Profile Info */}
        {isAdminOrCoach && currentStep === 2 && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-white/90 mb-2">
                Phone Number (Optional)
              </label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#e3ca76]/50"
                placeholder="+1 (555) 123-4567"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white/90 mb-2">
                Profile Image (Optional)
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleUserImageChange}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#e3ca76]/50"
              />
              {userImagePreview && (
                <div className="mt-4">
                  <img
                    src={userImagePreview}
                    alt="Profile preview"
                    className="w-32 h-32 object-cover rounded-full"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Owner Onboarding: Step 1 - Company Info */}
        {!isAdminOrCoach && currentStep === 1 && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-white/90 mb-2">
                Company Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#e3ca76]/50"
                placeholder="Enter company name"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white/90 mb-2">
                Website URL (Optional)
              </label>
              <input
                type="url"
                value={companyUrl}
                onChange={(e) => setCompanyUrl(e.target.value)}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#e3ca76]/50"
                placeholder="https://example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white/90 mb-2">
                Company Logo (Optional)
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoChange}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#e3ca76]/50"
              />
              {logoPreview && (
                <div className="mt-4">
                  <img
                    src={logoPreview}
                    alt="Logo preview"
                    className="max-w-[200px] max-h-[200px] object-contain rounded-lg"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Owner Onboarding: Step 2 - User Info */}
        {!isAdminOrCoach && currentStep === 2 && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-white/90 mb-2">
                Phone Number (Optional)
              </label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#e3ca76]/50"
                placeholder="+1 (555) 123-4567"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white/90 mb-2">
                Profile Image (Optional)
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleUserImageChange}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#e3ca76]/50"
              />
              {userImagePreview && (
                <div className="mt-4">
                  <img
                    src={userImagePreview}
                    alt="Profile preview"
                    className="w-32 h-32 object-cover rounded-full"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Owner Onboarding: Step 3 - Admin Invites */}
        {!isAdminOrCoach && currentStep === 3 && (
          <div className="space-y-6">
            <p className="text-white/70 mb-4">
              Invite team members as admins. They will receive an email with login credentials.
            </p>

            {adminInvites.map((invite, index) => (
              <div key={index} className="p-4 bg-white/5 rounded-lg border border-white/10">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-white font-medium">Admin {index + 1}</h3>
                  {adminInvites.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeAdminInvite(index)}
                      className="text-red-400 hover:text-red-300 text-sm"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-white/90 mb-2">
                      Name
                    </label>
                    <input
                      type="text"
                      value={invite.name}
                      onChange={(e) =>
                        updateAdminInvite(index, "name", e.target.value)
                      }
                      className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#e3ca76]/50"
                      placeholder="Enter name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-white/90 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      value={invite.email}
                      onChange={(e) =>
                        updateAdminInvite(index, "email", e.target.value)
                      }
                      className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#e3ca76]/50"
                      placeholder="Enter email"
                    />
                  </div>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={addAdminInvite}
              className="text-[#e3ca76] hover:text-[#a78443] text-sm font-medium"
            >
              + Add Another Admin
            </button>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="mt-8 flex gap-4">
          {currentStep > 1 && (
            <Button type="button" variant="outline" onClick={handleBack}>
              Back
            </Button>
          )}
          <div className="flex-1" />
          {currentStep < totalSteps ? (
            <Button type="button" onClick={handleNext}>
              Next
            </Button>
          ) : (
            <Button type="button" onClick={handleSubmit} disabled={loading}>
              {loading ? "Completing..." : "Complete Onboarding"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

