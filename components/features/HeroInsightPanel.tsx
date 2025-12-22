import { TrendingUp, Activity, Target } from "lucide-react";

const cards = [
  {
    title: "Player DNA Profile",
    value: "38 points",
    delta: "4 traits tracked",
    icon: TrendingUp,
  },
  {
    title: "Tests Completed",
    value: "13/13",
    delta: "All tests recorded",
    icon: Activity,
  },
  {
    title: "AI Plans Ready",
    value: "5 sessions",
    delta: "Targeted to weaknesses",
    icon: Target,
  },
];

export default function HeroInsightPanel() {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-[#e3ca76]/10" />
      <div className="relative flex items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-[#e3ca76]">Player Profile</p>
          <h3 className="text-xl font-semibold text-white">Test Session — Week 4</h3>
        </div>
        <div className="rounded-full border border-white/10 bg-black/50 px-3 py-1 text-xs text-white/70">
          Last updated: <span className="text-[#e3ca76]">2 days ago</span>
        </div>
      </div>
      <div className="relative mt-5 grid gap-4 sm:grid-cols-3">
        {cards.map((card) => (
          <div
            key={card.title}
            className="rounded-2xl border border-white/10 bg-black/40 p-4 text-white shadow-inner shadow-black/30"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#e3ca76] to-[#a78443] text-black shadow-md">
                <card.icon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm text-white/70">{card.title}</p>
                <p className="text-xl font-semibold">{card.value}</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-[#e3ca76]">{card.delta}</p>
            <div className="mt-4 h-2 rounded-full bg-white/5">
              <div
                className="h-2 rounded-full bg-gradient-to-r from-[#e3ca76] to-[#a78443]"
                style={{ width: card.title === "Tests Completed" ? "100%" : card.title === "AI Plans Ready" ? "85%" : "100%" }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
