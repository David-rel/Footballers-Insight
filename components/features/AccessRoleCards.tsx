import Link from "next/link";
import { Shield, Sparkles, Workflow } from "lucide-react";

const roles = [
  {
    label: "Player Dashboard",
    desc: "Check readiness, recovery, and personal objectives before every session.",
    badge: "Personalized",
    icon: Sparkles,
  },
  {
    label: "Coach Dashboard",
    desc: "Manage availability, set plans, and get instant matchday briefings.",
    badge: "Squad view",
    icon: Workflow,
  },
  {
    label: "Admin Console",
    desc: "Govern access, monitor compliance, and secure exports across teams.",
    badge: "SSO ready",
    icon: Shield,
  },
];

export default function AccessRoleCards() {
  return (
    <div className="grid gap-6 md:grid-cols-3">
      {roles.map((role) => (
        <div
          key={role.label}
          className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)]"
        >
          <div className="absolute inset-0 opacity-0 transition duration-500 group-hover:opacity-100" style={{ background: "radial-gradient(circle at 20% 20%, rgba(227,202,118,0.12), transparent 45%)" }} />
          <div className="relative flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#e3ca76] to-[#a78443] text-black shadow-md">
              <role.icon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[#e3ca76]">{role.badge}</p>
              <h3 className="text-lg font-semibold text-white">{role.label}</h3>
            </div>
          </div>
          <p className="relative mt-3 text-white/70">{role.desc}</p>
          <div className="relative mt-4 flex gap-3 text-sm font-semibold">
            <Link
              href="/login"
              className="flex-1 rounded-full border border-[#e3ca76]/50 bg-gradient-to-r from-[#e3ca76] to-[#a78443] px-4 py-2 text-center text-black shadow-lg transition hover:shadow-[0_0_0_2px_rgba(227,202,118,0.2)]"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="flex-1 rounded-full border border-white/15 px-4 py-2 text-center text-white/80 transition hover:border-[#e3ca76]/40 hover:text-white"
            >
              Create account
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}
