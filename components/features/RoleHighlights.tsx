import Link from "next/link";
import { Target, Brain, BarChart3 } from "lucide-react";

const roleCards = [
  {
    title: "Testing",
    copy: "Run 13 repeatable tests to collect 39 objective data points per player. Simple, consistent measurements.",
    points: ["13 standardized tests", "39 data points collected", "Track progress over time"],
    icon: Target,
    cta: "View testing guide",
  },
  {
    title: "Player DNA",
    copy: "Raw test scores normalized into structured profiles showing strengths and weaknesses across four main traits.",
    points: ["4-trait profile", "39 data points tracked", "Week-over-week tracking"],
    icon: Brain,
    cta: "See Player DNA",
  },
  {
    title: "AI Session Plans",
    copy: "AI analyzes Player DNA and recent changes to suggest targeted practice plans and small group focuses.",
    points: ["Targeted drills", "Small group pairings", "Focus areas identified"],
    icon: BarChart3,
    cta: "View AI plans",
  },
];

export default function RoleHighlights() {
  return (
    <div className="grid gap-6 md:grid-cols-3">
      {roleCards.map((card) => (
        <div
          key={card.title}
          className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/5 to-black/60 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)]"
        >
          <div className="absolute inset-0 opacity-0 transition duration-500 group-hover:opacity-100" style={{ background: "radial-gradient(circle at 30% 20%, rgba(227,202,118,0.14), transparent 45%)" }} />
          <div className="relative flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#e3ca76] to-[#a78443] text-black shadow-md">
              <card.icon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-[#e3ca76]">{card.title}</p>
              <p className="text-lg font-semibold text-white">Dashboard</p>
            </div>
          </div>
          <p className="relative mt-3 text-white/70">{card.copy}</p>
          <ul className="relative mt-4 space-y-2 text-sm text-white/70">
            {card.points.map((point) => (
              <li key={point} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[#e3ca76]"></span>
                {point}
              </li>
            ))}
          </ul>
          <Link
            href="/login"
            className="relative mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#e3ca76] underline-offset-4 transition hover:text-white"
          >
            {card.cta}
            <span aria-hidden>→</span>
          </Link>
        </div>
      ))}
    </div>
  );
}
