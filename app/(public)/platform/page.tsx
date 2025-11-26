import SectionHeader from "@/components/ui/SectionHeader";
import SpotlightTabs from "@/components/features/SpotlightTabs";
import AccessRoleCards from "@/components/features/AccessRoleCards";

const roleDetails = [
  {
    role: "Player",
    actions: ["Personal readiness scoring", "Recovery protocol guidance", "Performance trends"],
    security: "Private to player with coach overview, export controls enabled.",
  },
  {
    role: "Coach",
    actions: ["Squad availability", "Session planner", "Tactical focus with risk flags"],
    security: "Role-scoped to staff groups, session approvals, audit on edits.",
  },
  {
    role: "Admin",
    actions: ["Role-based access", "Compliance workflows", "Data retention + exports"],
    security: "SSO, SCIM, and full audit logging with policy-based controls.",
  },
];

const components = [
  {
    title: "Match Readiness",
    desc: "Availability and readiness in a single card with freshness indicators and alerts.",
  },
  {
    title: "Training Week",
    desc: "Microcycle planner aligned to load targets and upcoming fixtures.",
  },
  {
    title: "Permissions Matrix",
    desc: "Clear ownership for data, exports, and workflow approvals per role.",
  },
];

export default function PlatformPage() {
  return (
    <div className="relative mx-auto max-w-6xl space-y-12 px-6 py-14">
      <SectionHeader
        eyebrow="Platform"
        title="Role-driven, action-ready"
        subtitle="Dynamic experiences for players, coaches, and admins. Everything shares one source of truth."
      />

      <SpotlightTabs />

      <section className="space-y-6">
        <SectionHeader eyebrow="Roles" title="Tailored experiences" align="left" />
        <div className="grid gap-6 md:grid-cols-3">
          {roleDetails.map((role) => (
            <div key={role.role} className="rounded-2xl border border-white/10 bg-black/60 p-5 text-white shadow-[0_15px_50px_rgba(0,0,0,0.35)]">
              <p className="text-xs uppercase tracking-[0.2em] text-[#e3ca76]">{role.role}</p>
              <h3 className="mt-2 text-xl font-semibold">What you see</h3>
              <ul className="mt-3 space-y-2 text-sm text-white/70">
                {role.actions.map((action) => (
                  <li key={action} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#e3ca76]"></span>
                    {action}
                  </li>
                ))}
              </ul>
              <div className="mt-4 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70">
                Security: {role.security}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <SectionHeader eyebrow="Components" title="The building blocks" align="left" />
        <div className="grid gap-4 md:grid-cols-3">
          {components.map((component) => (
            <div key={component.title} className="rounded-2xl border border-white/10 bg-white/5 p-5 text-white/80 shadow-[0_15px_50px_rgba(0,0,0,0.35)]">
              <div className="mb-2 h-1 w-10 rounded-full bg-gradient-to-r from-[#e3ca76] to-[#a78443]" />
              <h3 className="text-lg font-semibold text-white">{component.title}</h3>
              <p className="mt-2 text-sm text-white/70">{component.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <SectionHeader eyebrow="Access" title="Pick your dashboard" align="left" />
        <AccessRoleCards />
      </section>
    </div>
  );
}
