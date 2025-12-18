"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const spotlight = [
  {
    id: "testing",
    title: "Test Collection",
    summary:
      "13 repeatable tests measure power, technique, mobility, and decision-making. All scores tracked consistently.",
    bullets: [
      "13 standardized tests",
      "39 data points per player",
      "Progress tracked week-over-week",
    ],
  },
  {
    id: "dna",
    title: "Player DNA Profile",
    summary:
      "Raw test scores combined into a complete player profile showing strengths across four main traits.",
    bullets: [
      "Power/Strength: Shot power, serve distance, jumps",
      "Technique/Control: Dribbling, passing, juggling",
      "Mobility/Stability: Agility, flexibility, core",
      "Decision/Cognition: 1v1 performance, reaction time",
    ],
  },
  {
    id: "ai-plans",
    title: "AI Session Plans",
    summary:
      "AI analyzes Player DNA and suggests targeted practice plans based on where each player needs help most.",
    bullets: [
      "Focus: Improve weak foot passing",
      "Small group: Pair with technical mentor",
      "Drill: Figure-8 dribble progression",
    ],
  },
];

export default function SpotlightTabs() {
  const [active, setActive] = useState("testing");
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
            <p className="text-xs uppercase tracking-[0.2em] text-[#e3ca76]">
              Spotlight
            </p>
            <h3 className="mt-1 text-2xl font-semibold">{current.title}</h3>
            <p className="mt-2 text-white/70">{current.summary}</p>
          </div>
          <div className="hidden h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-black/40 text-sm font-semibold text-white/70 sm:flex">
            Live
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {current.bullets.map((bullet) => (
            <div
              key={bullet}
              className="rounded-xl border border-white/10 bg-black/40 p-3 text-sm text-white/80"
            >
              <div className="mb-2 h-1 w-8 rounded-full bg-gradient-to-r from-[#e3ca76] to-[#a78443]" />
              {bullet}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
