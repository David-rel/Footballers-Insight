const stats = [
  { label: "tests per session", value: "13" },
  { label: "data points per player", value: "39" },
  { label: "main traits measured", value: "4" },
  { label: "affordable pricing", value: "Yes" },
];

export default function StatsRow() {
  return (
    <div className="grid gap-4 rounded-3xl border border-white/10 bg-black/60 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.4)] sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <div key={stat.label} className="space-y-2">
          <div className="text-3xl font-semibold text-white">{stat.value}</div>
          <p className="text-xs uppercase tracking-[0.2em] text-white/50">{stat.label}</p>
          <div className="h-1 w-14 rounded-full bg-gradient-to-r from-[#e3ca76] to-[#a78443]" />
        </div>
      ))}
    </div>
  );
}
