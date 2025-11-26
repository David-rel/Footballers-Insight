import ContactForm from "@/components/features/ContactForm";
import SectionHeader from "@/components/ui/SectionHeader";

const quickContacts = [
  { title: "Support", email: "support@footballersinsight.com", note: "Product help and onboarding" },
  { title: "Partnerships", email: "partners@footballersinsight.com", note: "Clubs, leagues, and data partners" },
  { title: "Careers", email: "careers@footballersinsight.com", note: "Tell us about your craft" },
];

export default function ContactPage() {
  return (
    <div className="relative mx-auto max-w-6xl space-y-10 px-6 py-14">
      <SectionHeader
        eyebrow="Contact"
        title="Talk to Footballers Insight"
        subtitle="Tell us about your squad, academy, or governance goals. We respond within one business day."
      />

      <div className="grid gap-8 md:grid-cols-[2fr_1fr]">
        <ContactForm />
        <div className="space-y-4 rounded-3xl border border-white/10 bg-black/60 p-6 text-white shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
          <p className="text-sm text-white/70">Prefer email? Reach out directly.</p>
          <div className="space-y-4">
            {quickContacts.map((item) => (
              <div key={item.email} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[#e3ca76]">{item.title}</p>
                <a href={`mailto:${item.email}`} className="block text-lg font-semibold text-white hover:text-[#e3ca76]">
                  {item.email}
                </a>
                <p className="text-sm text-white/60">{item.note}</p>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
            <p className="text-white">Service level</p>
            <p>Response in under 24 hours. Priority queues for active customers.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
