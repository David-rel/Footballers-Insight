"use client";

import { useEffect, useState } from "react";

type Role = "owner" | "admin" | "coach" | "parent" | "player";

function aiLabelForRole(role: Role | null) {
  if (role === "coach") return "Team AI Analysis";
  if (role === "owner" || role === "admin") return "Company AI Analysis";
  if (role === "player" || role === "parent") return "Player Analysis";
  return "AI Analysis";
}

export default function AIStatsPage() {
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const res = await fetch("/api/user/profile");
        if (!res.ok) return;
        const data = await res.json();
        if (mounted) setRole((data?.user?.role as Role) ?? null);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold text-white">
        {loading ? "AI Analysis" : aiLabelForRole(role)}
      </h1>
      <p className="text-white/70 mt-2">
        Coming soon — tell me what you want in here for this role.
      </p>
    </div>
  );
}


