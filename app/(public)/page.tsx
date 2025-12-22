import HeroInsightPanel from "@/components/features/HeroInsightPanel";
import RoleHighlights from "@/components/features/RoleHighlights";
import SpotlightTabs from "@/components/features/SpotlightTabs";
import FAQList from "@/components/features/FAQList";
import StatsRow from "@/components/features/StatsRow";
import AccessRoleCards from "@/components/features/AccessRoleCards";
import SectionHeader from "@/components/ui/SectionHeader";
import Button from "@/components/ui/Button";
import Link from "next/link";

const liveMetrics = [
  "Player DNA tracking active",
  "13 tests per session",
  "AI session plans ready",
  "38 data points collected",
  "Progress tracked weekly",
];

export default function HomePage() {
  return (
    <div className="relative overflow-hidden">
      <section className="relative mx-auto flex max-w-6xl flex-col gap-10 px-6 pb-16 pt-12 md:flex-row md:items-center">
        <div className="relative z-10 flex-1 space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#e3ca76]/30 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#e3ca76]">
            Player Testing Platform
          </div>
          <h1 className="text-4xl font-semibold leading-[1.05] text-white sm:text-5xl md:text-6xl">
            Data-driven player development for youth clubs and academies.
          </h1>
          <p className="max-w-2xl text-lg text-white/70">
            Collect objective test data so coaches can know players objectively
            and focus more time on knowing them as people. AI-powered session
            plans target where help is needed most.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/login">
              <Button>Enter your dashboard</Button>
            </Link>
            <Link href="/platform">
              <Button variant="ghost">See the platform</Button>
            </Link>
          </div>
          <div className="flex flex-wrap gap-2 text-xs uppercase tracking-[0.2em] text-white/40">
            <span className="rounded-full border border-white/10 px-3 py-1">
              Affordable Pricing
            </span>
            <span className="rounded-full border border-white/10 px-3 py-1">
              All Ages
            </span>
            <span className="rounded-full border border-white/10 px-3 py-1">
              AI Session Plans
            </span>
          </div>
        </div>
        <div className="relative z-10 flex-1">
          <HeroInsightPanel />
        </div>
      </section>

      <section className="relative mx-auto max-w-6xl px-6 pb-12">
        <div className="flex items-center gap-3 overflow-hidden rounded-full border border-white/10 bg-black/60 px-4 py-3 text-sm text-white/80">
          <span className="flex h-2.5 w-2.5 items-center justify-center rounded-full bg-[#e3ca76] shadow-[0_0_0_6px_rgba(227,202,118,0.2)]" />
          <div
            className="flex gap-6 animate-[scroll_30s_linear_infinite] whitespace-nowrap"
            style={{
              animation: "scroll 30s linear infinite",
            }}
          >
            {liveMetrics.concat(liveMetrics).map((item, idx) => (
              <span
                key={`${item}-${idx}`}
                className="rounded-full bg-white/5 px-3 py-1 text-white/70"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="relative mx-auto max-w-6xl space-y-8 px-6 pb-16">
        <SectionHeader
          eyebrow="How It Works"
          title="From testing to training plans"
          subtitle="Simple, repeatable tests create objective player profiles. AI uses that data to suggest targeted session plans."
        />
        <RoleHighlights />
      </section>

      <section className="relative mx-auto max-w-6xl space-y-8 px-6 pb-16">
        <SectionHeader
          eyebrow="Platform"
          title="Everything you need in one place"
          subtitle="Test tracking, Player DNA profiles, progress monitoring, and AI-generated practice plans."
        />
        <SpotlightTabs />
      </section>

      <section className="relative mx-auto max-w-6xl space-y-8 px-6 pb-16">
        <SectionHeader
          eyebrow="The Process"
          title="Five steps to better development"
          subtitle="Testing, creating player profiles, grouping players by type, learning from training, and AI-powered session planning."
        />
        <StatsRow />
      </section>

      <section className="relative mx-auto max-w-6xl space-y-8 px-6 pb-16">
        <SectionHeader
          eyebrow="Answers"
          title="FAQ"
          subtitle="Everything you need to know about our testing platform and how it works."
        />
        <FAQList />
      </section>

      <section className="relative mx-auto max-w-6xl space-y-6 px-6 pb-20">
        <div className="rounded-3xl border border-[#e3ca76]/30 bg-gradient-to-r from-[#e3ca76]/20 via-black to-[#a78443]/25 p-10 text-center shadow-[0_25px_80px_rgba(0,0,0,0.45)]">
          <p className="text-xs uppercase tracking-[0.2em] text-[#e3ca76]">
            Get started
          </p>
          <h3 className="mt-2 text-3xl font-semibold text-white">
            Start tracking player development
          </h3>
          <p className="mt-3 text-white/70">
            Affordable testing platform for youth clubs and academies. Log in or
            create your account.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/login">
              <Button>Access now</Button>
            </Link>
            <Link href="/contact">
              <Button variant="outline">Talk to us</Button>
            </Link>
          </div>
        </div>
        <AccessRoleCards />
      </section>
    </div>
  );
}
