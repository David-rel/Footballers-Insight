"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Home" },
  { href: "/platform", label: "Platform" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-black/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-3 text-lg font-semibold tracking-tight">
          <img 
            src="/logodark.png" 
            alt="Footballers Insight" 
            className="h-14 w-auto rounded-lg"
          />
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "text-sm font-medium transition-colors",
                pathname === link.href ? "text-[#e3ca76]" : "text-white/70 hover:text-white"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/login"
            className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/80 transition hover:border-[#e3ca76]/50 hover:text-white"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-full bg-gradient-to-r from-[#e3ca76] to-[#a78443] px-4 py-2 text-sm font-semibold text-black shadow-[0_10px_40px_rgba(0,0,0,0.35)]"
          >
            Get started
          </Link>
        </div>

        <button
          onClick={() => setOpen((prev) => !prev)}
          className="relative flex h-11 w-11 items-center justify-center rounded-full border border-white/10 text-white md:hidden"
          aria-label="Toggle menu"
        >
          <span className="absolute h-0.5 w-5 -translate-y-1 bg-white transition" style={{ transform: open ? "translateY(0px) rotate(45deg)" : "translateY(-6px)" }} />
          <span className="absolute h-0.5 w-5 bg-white transition" style={{ opacity: open ? 0 : 1 }} />
          <span className="absolute h-0.5 w-5 translate-y-1 bg-white transition" style={{ transform: open ? "translateY(0px) rotate(-45deg)" : "translateY(6px)" }} />
        </button>
      </div>

      {open && (
        <div className="border-t border-white/5 bg-black/90 backdrop-blur md:hidden">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-4">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "text-base font-medium transition-colors",
                  pathname === link.href ? "text-[#e3ca76]" : "text-white/80 hover:text-white"
                )}
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-2 flex gap-3">
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="flex-1 rounded-full border border-white/10 px-4 py-2 text-center text-sm text-white/80 transition hover:border-[#e3ca76]/50 hover:text-white"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                onClick={() => setOpen(false)}
                className="flex-1 rounded-full bg-gradient-to-r from-[#e3ca76] to-[#a78443] px-4 py-2 text-center text-sm font-semibold text-black"
              >
                Get started
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
