const faqs = [
  {
    q: "What tests do you run?",
    a: "We run 13 standardized tests covering shot power, serve distance, dribbling, passing, 1v1 performance, juggling, skill moves, agility, reaction time, single-leg hops, jump endurance, ankle flexibility, and core strength. These create 38 data points per player.",
  },
  {
    q: "How does Player DNA work?",
    a: "Raw test scores are combined into a complete player profile with 38 data points. This shows each player's strengths and weaknesses across four main traits: Power/Strength, Technique/Control, Mobility/Stability, and Decision/Cognition.",
  },
  {
    q: "How does AI generate session plans?",
    a: "The AI analyzes each player's current Player DNA profile, tracks how it changes over time, and identifies where help is needed most. It then suggests targeted drills, small group pairings, and focus areas for practice sessions.",
  },
  {
    q: "Is this affordable for youth clubs?",
    a: "Yes. We built this specifically for youth clubs and academies. Our pricing is designed to be accessible for teams of all sizes, making objective player development data available to everyone.",
  },
  {
    q: "What ages is this for?",
    a: "The platform works for all ages. The 13 tests can be adapted for different age groups while maintaining consistency in measurement and tracking.",
  },
];

export default function FAQList() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {faqs.map((faq) => (
        <details
          key={faq.q}
          className="group rounded-2xl border border-white/10 bg-black/50 p-4 text-white/80 shadow-[0_15px_40px_rgba(0,0,0,0.35)]"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-white">
            <span className="font-semibold">{faq.q}</span>
            <span className="text-[#e3ca76] transition group-open:rotate-45">+</span>
          </summary>
          <p className="mt-3 text-sm leading-relaxed text-white/70">{faq.a}</p>
        </details>
      ))}
    </div>
  );
}
