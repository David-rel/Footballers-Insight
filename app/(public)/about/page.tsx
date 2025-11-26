import SectionHeader from "@/components/ui/SectionHeader";

const values = [
  { title: "Data-first", desc: "Every decision backed by live telemetry, contextualized for the role." },
  { title: "Clarity", desc: "Surface the signal, hide the noise. Sharp visuals, instant actions." },
  { title: "Trust", desc: "Security, compliance, and permissions that scale with your club." },
];

const timeline = [
  { label: "Q1", headline: "Foundation", detail: "Role-based dashboards, availability tracking, load balance." },
  { label: "Q2", headline: "Automation", detail: "Session templates, alerting, and compliance workflows." },
  { label: "Q3", headline: "Intelligence", detail: "Predictive models, transfer lens, academy analytics." },
];

const team = [
  { initials: "DF", role: "Performance Lead" },
  { initials: "LC", role: "Data Science" },
  { initials: "AM", role: "Product Design" },
  { initials: "JG", role: "Engineering" },
];

export default function AboutPage() {
  return (
    <div className="relative mx-auto max-w-6xl space-y-12 px-6 py-14">
      <SectionHeader
        eyebrow="About"
        title="Why Footballers Insight"
        subtitle="Built with clubs to deliver the gold standard of readiness, governance, and tactical clarity."
      />

      <section className="grid gap-8 rounded-3xl border border-white/10 bg-black/60 p-8 shadow-[0_25px_80px_rgba(0,0,0,0.45)] md:grid-cols-2">
        <div className="space-y-4 text-white/80">
          <p>
            We started Footballers Insight to bridge the gap between data and action. Performance teams needed clarity, not another spreadsheet. Coaches needed live availability. Admins needed governance. Players needed simple, personal guidance.
          </p>
          <p>
            Our platform merges tactical context, health data, and compliance into role-specific dashboards—so everyone moves faster with confidence.
          </p>
        </div>
        <div className="rounded-2xl border border-[#e3ca76]/30 bg-gradient-to-br from-[#e3ca76]/15 to-transparent p-6 text-white shadow-inner">
          <p className="text-xs uppercase tracking-[0.2em] text-[#e3ca76]">Methodology</p>
          <div className="mt-4 space-y-3">
            {["Collect", "Model", "Deliver"].map((step, idx) => (
              <div key={step} className="flex items-start gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-black/50 text-sm font-semibold text-[#e3ca76]">
                  {idx + 1}
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">{step}</p>
                  <p className="text-sm text-white/70">
                    {step === "Collect"
                      ? "Integrate match, training, wellness, and medical data with strict permissions."
                      : step === "Model"
                        ? "Blend telemetry and context to score readiness, risk, and tactical fit."
                        : "Deliver insights per role with actions, alerts, and exports guarded by policy."}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <SectionHeader eyebrow="Values" title="What guides us" align="left" />
        <div className="grid gap-4 md:grid-cols-3">
          {values.map((value) => (
            <div key={value.title} className="rounded-2xl border border-white/10 bg-white/5 p-5 text-white/80 shadow-[0_15px_50px_rgba(0,0,0,0.35)]">
              <div className="mb-2 h-1 w-10 rounded-full bg-gradient-to-r from-[#e3ca76] to-[#a78443]" />
              <h3 className="text-lg font-semibold text-white">{value.title}</h3>
              <p className="mt-2 text-sm text-white/70">{value.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <SectionHeader eyebrow="Roadmap" title="Where we're headed" align="left" />
        <div className="grid gap-4 md:grid-cols-3">
          {timeline.map((item) => (
            <div key={item.label} className="rounded-2xl border border-white/10 bg-black/60 p-5 text-white shadow-[0_15px_50px_rgba(0,0,0,0.35)]">
              <p className="text-xs uppercase tracking-[0.2em] text-[#e3ca76]">{item.label}</p>
              <h3 className="mt-2 text-xl font-semibold">{item.headline}</h3>
              <p className="mt-2 text-white/70">{item.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <SectionHeader eyebrow="Team" title="Built with experience" align="left" />
        <div className="flex flex-wrap gap-4">
          {team.map((member) => (
            <div key={member.initials} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white/80">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#e3ca76] to-[#a78443] text-lg font-semibold text-black shadow-md">
                {member.initials}
              </span>
              <div>
                <p className="font-semibold text-white">{member.initials}</p>
                <p className="text-sm text-white/60">{member.role}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
