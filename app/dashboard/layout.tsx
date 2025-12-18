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

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (status === "loading") return;
    if (!session) {
      router.push("/login");
      return;
    }

    // Check for players who need onboarding
    if (session.user && (session.user as any).role === "player") {
      // First check if user themselves needs onboarding (password not set)
      if (!(session.user as any).onboarded) {
        router.push("/onboarding/player");
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
      <TopBar />
      <Sidebar />
      <main className="ml-64 mt-16 p-6">{children}</main>
    </div>
  );
}
