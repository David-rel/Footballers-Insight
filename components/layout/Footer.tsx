import Link from "next/link";

const quickLinks = [
  { label: "Home", href: "/" },
  { label: "Platform", href: "/platform" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
  { label: "Login", href: "/login" },
  { label: "Sign up", href: "/signup" },
];

export default function Footer() {
  return (
    <footer className="border-t border-white/5 bg-black/70">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-12 md:flex-row md:items-start md:justify-between">
        <div className="max-w-md space-y-3 text-white/70">
          <div className="flex items-center gap-3 text-white">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#e3ca76] to-[#a78443] text-lg font-bold text-black shadow-lg">
              FI
            </span>
            <div>
              <div className="text-sm uppercase tracking-[0.18em] text-white/60">Neural Player Map</div>
              <div className="text-lg font-semibold">Player testing platform for youth clubs.</div>
            </div>
          </div>
          <p>
            Objective test data and AI-powered session plans. Affordable player development for youth clubs and academies of all ages.
          </p>
          <div className="flex flex-wrap gap-2 text-xs uppercase tracking-wide text-[#e3ca76]">
            <span className="rounded-full border border-[#e3ca76]/30 px-3 py-1">Data-driven</span>
            <span className="rounded-full border border-[#e3ca76]/30 px-3 py-1">AI-powered</span>
            <span className="rounded-full border border-[#e3ca76]/30 px-3 py-1">Affordable</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 text-sm text-white/70 md:grid-cols-3">
          <div className="space-y-3">
            <div className="text-white">Navigate</div>
            <div className="flex flex-col gap-2">
              {quickLinks.map((link) => (
                <Link key={link.href} href={link.href} className="hover:text-white">
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <div className="text-white">Features</div>
            <div className="flex flex-col gap-2">
              <Link href="/platform" className="hover:text-white">
                Test Tracking
              </Link>
              <Link href="/platform" className="hover:text-white">
                Player DNA
              </Link>
              <Link href="/platform" className="hover:text-white">
                AI Session Plans
              </Link>
            </div>
          </div>
          <div className="space-y-3">
            <div className="text-white">Contact</div>
            <div className="flex flex-col gap-2">
              <p className="text-white">David Fales</p>
              <a href="mailto:davidfalesct@gmail.com" className="hover:text-white">
                davidfalesct@gmail.com
              </a>
              <a href="tel:7206122979" className="hover:text-white">
                720 612 2979
              </a>
              <p className="text-white/50 mt-2">Response in under 24h.</p>
            </div>
          </div>
        </div>
      </div>
      <div className="border-t border-white/5 bg-black/80 py-4 text-center text-xs text-white/50">
        © {new Date().getFullYear()} Neural Player Map. All rights reserved.
      </div>
    </footer>
  );
}
