"use client";

import { useEffect, useState } from "react";
import { AiStatsPlayerParentView } from "@/components/features/AiStatsPlayerParentView";
import { AiStatsCoachTeamView } from "@/components/features/AiStatsCoachTeamView";
import { AiStatsCompanyAdminView } from "@/components/features/AiStatsCompanyAdminView";

type Role = "owner" | "admin" | "coach" | "parent" | "player";

export default function AIStatsPage() {
  const [role, setRole] = useState<Role | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const res = await fetch("/api/user/profile");
        const data = await res.json().catch(() => null);
        if (mounted) setRole((data?.user?.role as Role) ?? null);
      } finally {
        if (mounted) setLoadingProfile(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  if (loadingProfile) {
    return (
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-white">AI Analysis</h1>
        <div className="mt-6 text-white/70 text-sm">Loading…</div>
      </div>
    );
  }

  if (role === "parent" || role === "player") {
    return <AiStatsPlayerParentView />;
  }

  if (role === "owner" || role === "admin") {
    return <AiStatsCompanyAdminView />;
  }

  return <AiStatsCoachTeamView />;
}
