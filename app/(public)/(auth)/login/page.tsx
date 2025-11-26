"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import SectionHeader from "@/components/ui/SectionHeader";

const SESSION_COOKIE = "fi_session";

function setSessionCookie(email: string) {
  document.cookie = `${SESSION_COOKIE}=${encodeURIComponent(email)}; path=/; max-age=86400; samesite=lax`;
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    // Front-end only demo auth: set a simple cookie to simulate a session.
    setSessionCookie(email || "demo@footballersinsight.com");
    router.push("/dashboard");
  }

  return (
    <div className="relative mx-auto flex min-h-[80vh] max-w-5xl flex-col gap-10 px-6 py-14">
      <SectionHeader
        eyebrow="Access"
        title="Welcome back"
        subtitle="Front-end only demo auth. Enter any email and password to continue."
        align="left"
      />

      <div className="grid gap-8 rounded-3xl border border-white/10 bg-black/60 p-8 shadow-[0_25px_80px_rgba(0,0,0,0.45)] md:grid-cols-[1.2fr_1fr]">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="text-sm text-white/70">Email</label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:border-[#e3ca76]/60 focus:outline-none"
              placeholder="you@club.com"
            />
          </div>
          <div>
            <label className="text-sm text-white/70">Password</label>
            <input
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:border-[#e3ca76]/60 focus:outline-none"
              placeholder="••••••••"
            />
          </div>
          <Button type="submit" full disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </Button>
          <p className="text-sm text-white/60">
            No account?{" "}
            <Link href="/signup" className="text-[#e3ca76] hover:text-white">
              Create one
            </Link>
          </p>
        </form>

        <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6 text-white/80">
          <p className="text-xs uppercase tracking-[0.2em] text-[#e3ca76]">Demo mode</p>
          <p className="text-sm text-white/70">
            This flow runs entirely on the front end. A simple cookie is set to mimic a logged-in session so you can
            navigate to the dashboard.
          </p>
          <ul className="space-y-2 text-sm text-white/70">
            <li>• Use any email and password</li>
            <li>• Cookie expires in 24h or when you sign out</li>
            <li>• Protected routes redirect based on that cookie</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
