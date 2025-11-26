const faqs = [
  {
    q: "How do dashboards differ by role?",
    a: "Players see readiness, recovery, and personal objectives. Coaches see squad availability, tactical insights, and training plans. Admins manage permissions, compliance, and audits.",
  },
  {
    q: "Is this data live?",
    a: "Yes. Metrics refresh automatically with your connected data sources. The UI is designed to show freshness and highlight any sync issues.",
  },
  {
    q: "Can we use SSO and granular permissions?",
    a: "The platform supports SSO and role-based access controls down to feature- and data-scope levels, with export controls and audit trails.",
  },
  {
    q: "Do you support multiple teams or academies?",
    a: "Yes. We support multi-tenant structures so clubs can manage first teams, academy groups, and loan players from one place.",
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
