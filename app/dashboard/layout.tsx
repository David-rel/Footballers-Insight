"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import TopBar from "@/components/layout/TopBar";
import Sidebar from "@/components/layout/Sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Prevent background scrolling when the mobile sidebar is open
  useEffect(() => {
    if (!sidebarOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [sidebarOpen]);

  useEffect(() => {
    if (status === "loading") return;
    if (!session) {
      router.push("/login");
      return;
    }

    // Check for parent/player users who need onboarding + incomplete player profiles
    if (
      session.user &&
      ((session.user as any).role === "player" ||
        (session.user as any).role === "parent")
    ) {
      // First check if user themselves needs onboarding (password not set)
      if (!(session.user as any).onboarded) {
        router.push(
          (session.user as any).role === "parent"
            ? "/onboarding/parent"
            : "/onboarding/player"
        );
        return;
      }

      // Then check if there are any incomplete player records
      async function checkIncompletePlayers() {
        try {
          const response = await fetch("/api/players/incomplete");
          if (response.ok) {
            const data = await response.json();
            if (data.hasIncomplete && data.player) {
              // Redirect to onboarding for this specific player
              router.push(`/onboarding/player?playerId=${data.player.id}`);
            }
          }
        } catch (error) {
          console.error("Failed to check incomplete players:", error);
        }
      }

      checkIncompletePlayers();
    }
  }, [session, status, router]);

  if (status === "loading" || !mounted) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-white/70">Loading...</p>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_20%_-10%,rgba(var(--gold-rgb),0.08),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(var(--gold-rgb),0.05),transparent_25%),#050505]">
      <TopBar
        isMenuOpen={sidebarOpen}
        onMenuClick={() => setSidebarOpen((v) => !v)}
      />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="mt-16 p-6 md:ml-64">{children}</main>
    </div>
  );
}
