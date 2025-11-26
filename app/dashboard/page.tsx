"use client";

import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import SectionHeader from "@/components/ui/SectionHeader";

const SESSION_COOKIE = "fi_session";

function clearSessionCookie() {
  document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0; samesite=lax`;
}

export default function DashboardPage() {
  const router = useRouter();

  function handleSignOut() {
    clearSessionCookie();
    router.push("/login");
  }

  return (
    <div className="relative mx-auto flex min-h-[80vh] max-w-6xl flex-col gap-10 px-6 py-14">
      <SectionHeader
        eyebrow="Dashboard"
        title="You're signed in (demo)"
        subtitle="This page is protected by middleware using a simple cookie check. Replace with real auth when backend is ready."
        align="left"
      />

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-black/60 p-6 text-white shadow-[0_20px_70px_rgba(0,0,0,0.4)]">
          <p className="text-sm uppercase tracking-[0.2em] text-[#e3ca76]">Session</p>
          <p className="mt-2 text-lg font-semibold text-white">Front-end only</p>
          <p className="mt-2 text-sm text-white/70">
            Auth is simulated via a browser cookie set on login/signup. Middleware redirects traffic based on that
            cookie.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button onClick={handleSignOut}>Sign out</Button>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/80">
          <p className="text-sm uppercase tracking-[0.2em] text-[#e3ca76]">Next steps</p>
          <ul className="mt-3 space-y-2 text-sm text-white/70">
            <li>• Wire this flow to a real auth provider or API when available</li>
            <li>• Swap cookie handling for secure, HttpOnly session tokens</li>
            <li>• Expand protected routes under `/dashboard/*` as needed</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
