"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const spotlight = [
  {
    id: "matchday",
    title: "Matchday Briefing",
    summary: "Projected XI, readiness risks, and tactical notes in one laminated view.",
    bullets: [
      "Win prob. vs last five: +7%",
      "Set-piece focus: back-post overload",
      "Player watch: sprint load cap for LW",
    ],
  },
  {
    id: "training",
    title: "Training Plan",
    summary: "Session builder aligned to load targets and upcoming fixtures.",
    bullets: [
      "Microcycle: H + M + L progression",
      "RPE guardrails auto-adjust",
      "Position groups synced to GPS data",
    ],
  },
  {
    id: "transfer",
    title: "Transfer Lens",
    summary: "Profile, benchmark, and validate targets with role fit scoring.",
    bullets: [
      "Fit score: 86/100 vs league avg 74",
      "Top comps: progressive carries, duel win%",
      "Compliance: all documents verified",
    ],
  },
];

export default function SpotlightTabs() {
  const [active, setActive] = useState("matchday");
  const current = spotlight.find((item) => item.id === active) ?? spotlight[0];

  return (
    <div className="rounded-3xl border border-white/10 bg-black/60 p-6 shadow-[0_25px_70px_rgba(0,0,0,0.45)]">
      <div className="flex flex-wrap gap-3">
        {spotlight.map((item) => (
          <button
            key={item.id}
            onClick={() => setActive(item.id)}
            className={cn(
              "rounded-full border px-4 py-2 text-sm font-semibold transition",
              active === item.id
                ? "border-[#e3ca76]/60 bg-white/10 text-white shadow-[0_0_0_1px_rgba(227,202,118,0.2)]"
                : "border-white/10 text-white/60 hover:border-[#e3ca76]/50 hover:text-white"
            )}
          >
            {item.title}
          </button>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-[#e3ca76]/10 p-6 text-white">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[#e3ca76]">Spotlight</p>
            <h3 className="mt-1 text-2xl font-semibold">{current.title}</h3>
            <p className="mt-2 text-white/70">{current.summary}</p>
          </div>
          <div className="hidden h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-black/40 text-sm font-semibold text-white/70 sm:flex">
            Live
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {current.bullets.map((bullet) => (
            <div key={bullet} className="rounded-xl border border-white/10 bg-black/40 p-3 text-sm text-white/80">
              <div className="mb-2 h-1 w-8 rounded-full bg-gradient-to-r from-[#e3ca76] to-[#a78443]" />
              {bullet}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
