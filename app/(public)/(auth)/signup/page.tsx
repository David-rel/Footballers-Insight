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

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (password !== confirm) {
      alert("Passwords need to match.");
      return;
    }
    setLoading(true);
    // Front-end only demo auth: set a simple cookie to simulate a session.
    setSessionCookie(email || "new@footballersinsight.com");
    router.push("/dashboard");
  }

  return (
    <div className="relative mx-auto flex min-h-[80vh] max-w-5xl flex-col gap-10 px-6 py-14">
      <SectionHeader
        eyebrow="Access"
        title="Create your account"
        subtitle="Front-end only demo signup. Use any email and password to proceed."
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
          <div>
            <label className="text-sm text-white/70">Confirm password</label>
            <input
              required
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:border-[#e3ca76]/60 focus:outline-none"
              placeholder="••••••••"
            />
          </div>
          <Button type="submit" full disabled={loading}>
            {loading ? "Creating..." : "Create account"}
          </Button>
          <p className="text-sm text-white/60">
            Already have an account?{" "}
            <Link href="/login" className="text-[#e3ca76] hover:text-white">
              Sign in
            </Link>
          </p>
        </form>

        <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6 text-white/80">
          <p className="text-xs uppercase tracking-[0.2em] text-[#e3ca76]">Demo mode</p>
          <p className="text-sm text-white/70">
            Signup is simulated on the client only. After submitting, a cookie is set and you are redirected to the
            dashboard to preview protected content.
          </p>
          <ul className="space-y-2 text-sm text-white/70">
            <li>• Use any email and password</li>
            <li>• Passwords are not stored or sent anywhere</li>
            <li>• Cookie expires in 24h or when you sign out</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
