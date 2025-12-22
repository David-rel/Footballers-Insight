import SectionHeader from "@/components/ui/SectionHeader";
import SpotlightTabs from "@/components/features/SpotlightTabs";
import AccessRoleCards from "@/components/features/AccessRoleCards";

const features = [
  {
    title: "Test Tracking",
    actions: ["13 standardized tests", "38 data points per player", "Progress over time"],
    detail: "Simple, repeatable tests that measure power, technique, mobility, and decision-making consistently.",
  },
  {
    title: "Player DNA",
    actions: ["4-trait profiles", "38 data points tracked", "Visual progress charts"],
    detail: "Raw test scores normalized into structured profiles showing strengths and weaknesses across four main traits.",
  },
  {
    title: "AI Session Plans",
    actions: ["Targeted drills", "Small group suggestions", "Focus area identification"],
    detail: "AI analyzes Player DNA and suggests practice plans based on where each player needs help most.",
  },
];

const components = [
  {
    title: "Test Dashboard",
    desc: "View all 13 test results, track progress over time, and see improvements across four main traits.",
  },
  {
    title: "Player DNA Map",
    desc: "Visual representation of each player's complete profile showing strengths and areas for development.",
  },
  {
    title: "AI Practice Planner",
    desc: "Generated session plans with targeted drills and small group focuses based on objective test data.",
  },
];

export default function PlatformPage() {
  return (
    <div className="relative mx-auto max-w-6xl space-y-12 px-6 py-14">
      <SectionHeader
        eyebrow="Platform"
        title="Testing to training plans"
        subtitle="From objective test data to AI-generated session plans. Everything connected in one platform."
      />

      <SpotlightTabs />

      <section className="space-y-6">
        <SectionHeader eyebrow="Features" title="Core capabilities" align="left" />
        <div className="grid gap-6 md:grid-cols-3">
          {features.map((feature) => (
            <div key={feature.title} className="rounded-2xl border border-white/10 bg-black/60 p-5 text-white shadow-[0_15px_50px_rgba(0,0,0,0.35)]">
              <p className="text-xs uppercase tracking-[0.2em] text-[#e3ca76]">{feature.title}</p>
              <h3 className="mt-2 text-xl font-semibold">What it does</h3>
              <p className="mt-2 text-sm text-white/70">{feature.detail}</p>
              <ul className="mt-3 space-y-2 text-sm text-white/70">
                {feature.actions.map((action) => (
                  <li key={action} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#e3ca76]"></span>
                    {action}
                  </li>
                ))}
              </ul>
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
