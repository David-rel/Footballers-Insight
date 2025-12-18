import ContactForm from "@/components/features/ContactForm";
import SectionHeader from "@/components/ui/SectionHeader";

export default function ContactPage() {
  return (
    <div className="relative mx-auto max-w-6xl space-y-10 px-6 py-14">
      <SectionHeader
        eyebrow="Contact"
        title="Get in touch"
        subtitle="Questions about our player testing platform? Reach out directly. We respond within one business day."
      />

      <div className="grid gap-8 md:grid-cols-[2fr_1fr]">
        <ContactForm />
        <div className="space-y-4 rounded-3xl border border-white/10 bg-black/60 p-6 text-white shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
          <p className="text-sm text-white/70">Direct contact</p>
          <div className="space-y-4">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-[#e3ca76]">Contact</p>
              <p className="mt-2 text-lg font-semibold text-white">David Fales</p>
              <a href="mailto:davidfalesct@gmail.com" className="block mt-2 text-white/80 hover:text-[#e3ca76] transition">
                davidfalesct@gmail.com
              </a>
              <a href="tel:7206122979" className="block mt-2 text-white/80 hover:text-[#e3ca76] transition">
                720 612 2979
              </a>
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
            <p className="text-white">Response time</p>
            <p>We respond within 24 hours. Priority support for active customers.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
