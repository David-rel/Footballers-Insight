import SectionHeader from "@/components/ui/SectionHeader";

const values = [
  { title: "Objective Data", desc: "Simple, repeatable tests create clear player profiles. No guesswork, just measurable progress." },
  { title: "AI-Powered Plans", desc: "Session plans generated from actual test data, targeting where each player needs help most." },
  { title: "Affordable Access", desc: "Built for youth clubs and academies. Pricing that works for teams of all sizes." },
];

const process = [
  { label: "Step 1", headline: "Testing & Collection", detail: "Run 13 repeatable tests with and without the ball to measure power, technique, decision making, and movement. All raw scores recorded consistently." },
  { label: "Step 2", headline: "Creating the Player DNA", detail: "Raw test scores combined into a complete player profile (38 data points) showing strengths and weaknesses across four main traits." },
  { label: "Step 3", headline: "Grouping Players by Type", detail: "Each player gets categorized based on their profile. Used to group similar players together and see how they compare." },
  { label: "Step 4", headline: "Learning from Training", detail: "Compare what training each player did with how their profile changed. Learn which drills and workloads actually improve each trait." },
  { label: "Step 5", headline: "AI Analysis for Practice Plans", detail: "Current Player DNA, cluster information, and recent changes are analyzed by AI to design practice plans with targeted drills and small group focuses." },
];

const fourTraits = [
  { trait: "Power/Strength", desc: "Shot power, serve distance, jump endurance, and core strength." },
  { trait: "Technique/Control", desc: "Dribbling, passing, juggling, skill moves, and ball control." },
  { trait: "Mobility/Stability", desc: "Agility, single-leg hops, ankle flexibility, and core endurance." },
  { trait: "Decision/Cognition", desc: "1v1 performance, reaction time, and in-game decision making." },
];

export default function AboutPage() {
  return (
    <div className="relative mx-auto max-w-6xl space-y-12 px-6 py-14">
      <SectionHeader
        eyebrow="About"
        title="Neural Player Map"
        subtitle="A player testing platform that connects objective test data to training plans through AI."
      />

      <section className="grid gap-8 rounded-3xl border border-white/10 bg-black/60 p-8 shadow-[0_25px_80px_rgba(0,0,0,0.45)] md:grid-cols-2">
        <div className="space-y-4 text-white/80">
          <p>
            Coaches talk about "developing players," but most of the time that means watching a few games, trusting memory, and guessing what to train next. There is almost no hard link between what happens in testing, what happens in training, and how the player actually changes over weeks and months.
          </p>
          <p>
            Neural Player Map fixes that. We take simple, realistic field tests and turn them into structured Player DNA for each player. The system tracks how that DNA changes when training changes, then uses AI to suggest practice plans that match what the data is telling us.
          </p>
          <p>
            The goal is not to replace coaching. The goal is to give coaches a clear picture of who their players are, how they are changing, and which training blocks are really doing the work.
          </p>
        </div>
        <div className="rounded-2xl border border-[#e3ca76]/30 bg-gradient-to-br from-[#e3ca76]/15 to-transparent p-6 text-white shadow-inner">
          <p className="text-xs uppercase tracking-[0.2em] text-[#e3ca76]">The Process</p>
          <div className="mt-4 space-y-3">
            {process.map((step, idx) => (
              <div key={step.label} className="flex items-start gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-black/50 text-sm font-semibold text-[#e3ca76]">
                  {idx + 1}
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">{step.headline}</p>
                  <p className="text-xs text-white/70 mt-1">{step.detail}</p>
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
        <SectionHeader eyebrow="The Process" title="Five steps to better development" align="left" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {process.map((item) => (
            <div key={item.label} className="rounded-2xl border border-white/10 bg-black/60 p-5 text-white shadow-[0_15px_50px_rgba(0,0,0,0.35)]">
              <p className="text-xs uppercase tracking-[0.2em] text-[#e3ca76]">{item.label}</p>
              <h3 className="mt-2 text-xl font-semibold">{item.headline}</h3>
              <p className="mt-2 text-sm text-white/70">{item.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <SectionHeader eyebrow="Four Main Traits" title="What we measure" align="left" />
        <div className="grid gap-4 md:grid-cols-2">
          {fourTraits.map((item) => (
            <div key={item.trait} className="rounded-2xl border border-white/10 bg-white/5 p-5 text-white/80 shadow-[0_15px_50px_rgba(0,0,0,0.35)]">
              <div className="mb-2 h-1 w-10 rounded-full bg-gradient-to-r from-[#e3ca76] to-[#a78443]" />
              <h3 className="text-lg font-semibold text-white">{item.trait}</h3>
              <p className="mt-2 text-sm text-white/70">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
