"use client";

import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useEffect, useState, useRef } from "react";
import Button from "@/components/ui/Button";

export default function DashboardPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [emailVerified, setEmailVerified] = useState<boolean | null>(null);
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean>(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const hasCheckedRef = useRef(false);
  const hasRedirectedRef = useRef(false);
  const hasOnboardingRedirectedRef = useRef(false);

  async function handleSignOut() {
    await signOut({ redirect: false });
    router.push("/login");
  }

  // Log session for debugging
  useEffect(() => {
    if (session) {
      console.log("Dashboard Session:", session);
    }
  }, [session]);

  // Check email verification status directly from database - ONLY ONCE
  useEffect(() => {
    if (hasCheckedRef.current) return;
    if (status === "loading" || !session) return;

    hasCheckedRef.current = true;

    async function checkVerification() {
      try {
        const response = await fetch("/api/auth/check-verification");
        if (response.ok) {
          const data = await response.json();
          console.log("Verification check result:", data);
          setEmailVerified(data.emailVerified);
          setOnboarded(data.onboarded);
          setNeedsOnboarding(data.needsOnboarding || false);
          setUserRole(data.role || null);
        } else {
          // If check fails, assume not verified to be safe
          setEmailVerified(false);
          setOnboarded(false);
        }
      } catch (error) {
        console.error("Failed to check verification:", error);
        setEmailVerified(false);
        setOnboarded(false);
      } finally {
        setChecking(false);
      }
    }

    checkVerification();
  }, [session, status]);

  // Redirect if not verified - ONLY ONCE
  useEffect(() => {
    if (hasRedirectedRef.current) return;
    if (checking) return;
    if (emailVerified === false && session?.user?.email) {
      hasRedirectedRef.current = true;
      window.location.href = `/verify-email?email=${encodeURIComponent(
        session.user.email
      )}`;
    }
  }, [emailVerified, checking, session]);

  // Redirect to onboarding if needed - ONLY ONCE
  useEffect(() => {
    if (hasOnboardingRedirectedRef.current) return;
    if (checking) return;
    if (needsOnboarding && emailVerified === true) {
      hasOnboardingRedirectedRef.current = true;
      const role = userRole;
      window.location.href =
        role === "parent"
          ? "/onboarding/parent"
          : role === "player"
            ? "/onboarding/player"
            : "/onboarding";
    }
  }, [needsOnboarding, emailVerified, checking, userRole]);

  if (status === "loading" || checking) {
    return (
      <div className="relative mx-auto flex min-h-[80vh] max-w-6xl flex-col gap-10 px-6 py-14">
        <p className="text-white/70">Loading...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="relative mx-auto flex min-h-[80vh] max-w-6xl flex-col gap-10 px-6 py-14">
        <p className="text-white/70">Redirecting to login...</p>
      </div>
    );
  }

  // If not verified, show redirect message (redirect happens in useEffect)
  if (emailVerified === false) {
    return (
      <div className="relative mx-auto flex min-h-[80vh] max-w-6xl flex-col gap-10 px-6 py-14">
        <p className="text-white/70">Redirecting to email verification...</p>
      </div>
    );
  }

  // If needs onboarding, show redirect message (redirect happens in useEffect)
  if (needsOnboarding) {
    return (
      <div className="relative mx-auto flex min-h-[80vh] max-w-6xl flex-col gap-10 px-6 py-14">
        <p className="text-white/70">Redirecting to onboarding...</p>
      </div>
    );
  }

  // Only show dashboard if verified and onboarded
  // Both owners and admins need onboarding (admins have a simpler version)
  const canAccessDashboard = emailVerified === true && onboarded === true;

  if (!canAccessDashboard) {
    return (
      <div className="relative mx-auto flex min-h-[80vh] max-w-6xl flex-col gap-10 px-6 py-14">
        <p className="text-white/70">Loading...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="rounded-2xl border border-white/10 bg-black/60 p-8 text-white shadow-[0_20px_70px_rgba(0,0,0,0.4)]">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white">
            Welcome, {session.user?.name || session.user?.email || "User"}!
          </h1>
          <p className="mt-2 text-white/70">You're successfully signed in.</p>
        </div>

        <div className="mt-6 space-y-3 text-sm">
          <p className="text-white/70">
            <span className="text-white/90 font-medium">Email:</span>{" "}
            {session.user?.email}
          </p>
          {session.user?.name && (
            <p className="text-white/70">
              <span className="text-white/90 font-medium">Name:</span>{" "}
              {session.user.name}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
