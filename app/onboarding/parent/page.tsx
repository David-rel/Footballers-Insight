"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Button from "@/components/ui/Button";
import SectionHeader from "@/components/ui/SectionHeader";

export default function ParentOnboardingPage() {
  const router = useRouter();
  const { data: session, status, update } = useSession();

  const [name, setName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [userImage, setUserImage] = useState<File | null>(null);
  const [userImagePreview, setUserImagePreview] = useState<string>("");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "loading") return;
    if (!session) {
      router.push("/login");
      return;
    }

    // Only parents should be here
    if ((session.user as any)?.role !== "parent") {
      router.push("/dashboard");
      return;
    }

    // If already onboarded, go to dashboard (dashboard layout will route to player onboarding if needed)
    if ((session.user as any)?.onboarded) {
      router.push("/dashboard");
      return;
    }

    // Prefill name if available
    if (session.user?.name) {
      setName(session.user.name);
    }
  }, [session, status, router]);

  function handleUserImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUserImage(file);
    const reader = new FileReader();
    reader.onloadend = () => setUserImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (!newPassword || newPassword.length < 8) {
      setError("Password must be at least 8 characters long");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("newPassword", newPassword);
      if (name.trim()) formData.append("name", name.trim());
      if (phoneNumber.trim()) formData.append("phoneNumber", phoneNumber.trim());
      if (userImage) formData.append("userImage", userImage);

      const res = await fetch("/api/onboarding/parent-complete", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to complete onboarding");
        setLoading(false);
        return;
      }

      // refresh session so dashboard layout sees onboarded=true
      await update();
      setTimeout(() => {
        window.location.href = "/dashboard";
      }, 300);
    } catch (err) {
      setError("An error occurred. Please try again.");
      setLoading(false);
    }
  }

  if (status === "loading" || !session) {
    return (
      <div className="relative mx-auto flex min-h-[80vh] max-w-5xl flex-col gap-10 px-6 py-14">
        <p className="text-white/70">Loading...</p>
      </div>
    );
  }

  return (
    <div className="relative mx-auto flex min-h-[80vh] max-w-5xl flex-col gap-10 px-6 py-14">
      <SectionHeader
        eyebrow="Welcome"
        title="Complete your parent profile"
        subtitle="Set your password and finish your profile. Then you’ll be guided to complete any player profiles you supervise."
        align="left"
      />

      <div className="grid gap-8 rounded-3xl border border-white/10 bg-black/60 p-8 shadow-[0_25px_80px_rgba(0,0,0,0.45)] md:grid-cols-[1.2fr_1fr]">
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/50 p-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div>
            <label className="text-sm text-white/70">New Password *</label>
            <input
              required
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:border-[#e3ca76]/60 focus:outline-none"
              placeholder="Enter your new password"
              minLength={8}
            />
            <p className="mt-1 text-xs text-white/50">
              Password must be at least 8 characters long
            </p>
          </div>

          <div>
            <label className="text-sm text-white/70">Confirm Password *</label>
            <input
              required
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:border-[#e3ca76]/60 focus:outline-none"
              placeholder="Confirm your new password"
              minLength={8}
            />
          </div>

          <div className="pt-4 border-t border-white/10">
            <h3 className="text-lg font-semibold text-white mb-4">
              Profile (optional)
            </h3>
          </div>

          <div>
            <label className="text-sm text-white/70">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:border-[#e3ca76]/60 focus:outline-none"
              placeholder="Your name"
            />
          </div>

          <div>
            <label className="text-sm text-white/70">Phone Number</label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:border-[#e3ca76]/60 focus:outline-none"
              placeholder="+1 (555) 123-4567"
            />
          </div>

          <div>
            <label className="text-sm text-white/70">Profile Image</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleUserImageChange}
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-[#e3ca76]/60 focus:outline-none"
            />
            {userImagePreview && (
              <div className="mt-4">
                <img
                  src={userImagePreview}
                  alt="Profile preview"
                  className="w-24 h-24 object-cover rounded-full border border-white/10"
                />
              </div>
            )}
          </div>

          <Button type="submit" full disabled={loading}>
            {loading ? "Completing..." : "Complete profile"}
          </Button>
        </form>

        <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6 text-white/80">
          <p className="text-xs uppercase tracking-[0.2em] text-[#e3ca76]">
            What happens next?
          </p>
          <p className="text-sm text-white/70">
            After you finish, we’ll automatically guide you to complete each
            player profile you supervise (date of birth, gender, and dominant
            foot).
          </p>
          <ul className="space-y-2 text-sm text-white/70">
            <li>• One login for multiple players</li>
            <li>• Self-supervised players can use their own email</li>
            <li>• Staff never shares login emails with players</li>
          </ul>
        </div>
      </div>
    </div>
  );
}


