"use client";

import Link from "next/link";
import { FormEvent, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Button from "@/components/ui/Button";
import SectionHeader from "@/components/ui/SectionHeader";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [registered, setRegistered] = useState(false);

  useEffect(() => {
    // Get registered param from URL directly
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("registered") === "true") {
        setRegistered(true);
      }
    }
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid email or password");
        setLoading(false);
        return;
      }

      if (result?.ok) {
        // Refresh the page to get the updated session
        router.refresh();
        // Small delay to ensure session is updated, then check if user needs onboarding
        setTimeout(async () => {
          try {
            const sessionRes = await fetch("/api/auth/session");
            const sessionData = await sessionRes.json();
            
            // If player is not onboarded, redirect to password reset
            if (sessionData?.user?.role === "player" && !sessionData?.user?.onboarded) {
              router.push("/onboarding/player");
            } else {
              router.push("/dashboard");
            }
          } catch (err) {
            // Fallback to dashboard if session check fails
            router.push("/dashboard");
          }
        }, 100);
      }
    } catch (err: any) {
      setError("An error occurred. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="relative mx-auto flex min-h-[80vh] max-w-5xl flex-col gap-10 px-6 py-14">
      <SectionHeader
        eyebrow="Access"
        title="Welcome back"
        subtitle="Sign in to your Footballers Insight account."
        align="left"
      />

      <div className="grid gap-8 rounded-3xl border border-white/10 bg-black/60 p-8 shadow-[0_25px_80px_rgba(0,0,0,0.45)] md:grid-cols-[1.2fr_1fr]">
        <form onSubmit={handleSubmit} className="space-y-5">
          {registered && (
            <div className="rounded-xl bg-green-500/10 border border-green-500/50 p-3 text-sm text-green-400">
              Account created successfully! Please sign in.
            </div>
          )}
          {error && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/50 p-3 text-sm text-red-400">
              {error}
            </div>
          )}
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
          <p className="text-xs uppercase tracking-[0.2em] text-[#e3ca76]">Secure Login</p>
          <p className="text-sm text-white/70">
            Your credentials are securely authenticated using NextAuth. All passwords are hashed and never stored in
            plain text.
          </p>
          <ul className="space-y-2 text-sm text-white/70">
            <li>• Secure password authentication</li>
            <li>• Email verification required</li>
            <li>• Session-based security</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
