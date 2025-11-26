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
              <div className="text-sm uppercase tracking-[0.18em] text-white/60">Footballers Insight</div>
              <div className="text-lg font-semibold">Performance intelligence for football.</div>
            </div>
          </div>
          <p>
            Analytics, readiness, and governance for players, coaches, and clubs. Gold-standard dashboards to keep every decision sharp.
          </p>
          <div className="flex flex-wrap gap-2 text-xs uppercase tracking-wide text-[#e3ca76]">
            <span className="rounded-full border border-[#e3ca76]/30 px-3 py-1">Data-first</span>
            <span className="rounded-full border border-[#e3ca76]/30 px-3 py-1">Secure</span>
            <span className="rounded-full border border-[#e3ca76]/30 px-3 py-1">Role-driven</span>
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
            <div className="text-white">Dashboards</div>
            <div className="flex flex-col gap-2">
              <Link href="/login" className="hover:text-white">
                Player
              </Link>
              <Link href="/login" className="hover:text-white">
                Coach
              </Link>
              <Link href="/login" className="hover:text-white">
                Admin
              </Link>
            </div>
          </div>
          <div className="space-y-3">
            <div className="text-white">Contact</div>
            <div className="flex flex-col gap-2">
              <a href="mailto:support@footballersinsight.com" className="hover:text-white">
                support@footballersinsight.com
              </a>
              <a href="mailto:partners@footballersinsight.com" className="hover:text-white">
                partners@footballersinsight.com
              </a>
              <p className="text-white/50">Response in under 24h.</p>
            </div>
          </div>
        </div>
      </div>
      <div className="border-t border-white/5 bg-black/80 py-4 text-center text-xs text-white/50">
        © {new Date().getFullYear()} Footballers Insight. All rights reserved.
      </div>
    </footer>
  );
}
