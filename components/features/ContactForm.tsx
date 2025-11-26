export default function ContactForm() {
  return (
    <form className="rounded-3xl border border-white/10 bg-black/60 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm text-white/80">
          Name
          <input
            type="text"
            placeholder="Your name"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:border-[#e3ca76]/60 focus:outline-none"
          />
        </label>
        <label className="space-y-2 text-sm text-white/80">
          Email
          <input
            type="email"
            placeholder="you@club.com"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:border-[#e3ca76]/60 focus:outline-none"
          />
        </label>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm text-white/80">
          Role
          <select className="w-full appearance-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-[#e3ca76]/60 focus:outline-none">
            <option className="bg-black">Player</option>
            <option className="bg-black">Coach</option>
            <option className="bg-black">Admin</option>
            <option className="bg-black">Other</option>
          </select>
        </label>
        <label className="space-y-2 text-sm text-white/80">
          Looking for
          <select className="w-full appearance-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-[#e3ca76]/60 focus:outline-none">
            <option className="bg-black">Product tour</option>
            <option className="bg-black">Pricing</option>
            <option className="bg-black">Partnership</option>
            <option className="bg-black">Support</option>
          </select>
        </label>
      </div>
      <label className="mt-4 block space-y-2 text-sm text-white/80">
        Message
        <textarea
          rows={4}
          placeholder="Tell us about your team, goals, or timeframe."
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:border-[#e3ca76]/60 focus:outline-none"
        />
      </label>
      <label className="mt-4 flex items-center gap-3 text-sm text-white/70">
        <input type="checkbox" className="h-4 w-4 rounded border-white/20 bg-black text-[#e3ca76] focus:ring-[#e3ca76]" />
        Request a demo call
      </label>
      <button
        type="submit"
        className="mt-5 w-full rounded-full bg-gradient-to-r from-[#e3ca76] to-[#a78443] px-4 py-3 text-sm font-semibold text-black shadow-[0_20px_60px_rgba(0,0,0,0.35)] transition hover:shadow-[0_0_0_2px_rgba(227,202,118,0.2)]"
      >
        Send message
      </button>
      <p className="mt-3 text-center text-xs text-white/50">We respond within one business day.</p>
    </form>
  );
}
