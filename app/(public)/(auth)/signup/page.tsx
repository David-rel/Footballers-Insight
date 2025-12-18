"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import SectionHeader from "@/components/ui/SectionHeader";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (password !== confirm) {
      setError("Passwords need to match.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to create account");
        setLoading(false);
        return;
      }

      // Redirect to login page
      router.push("/login?registered=true");
    } catch (err: any) {
      setError("An error occurred. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="relative mx-auto flex min-h-[80vh] max-w-5xl flex-col gap-10 px-6 py-14">
      <SectionHeader
        eyebrow="Access"
        title="Create your account"
        subtitle="Sign up to get started with Footballers Insight."
        align="left"
      />

      <div className="grid gap-8 rounded-3xl border border-white/10 bg-black/60 p-8 shadow-[0_25px_80px_rgba(0,0,0,0.45)] md:grid-cols-[1.2fr_1fr]">
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/50 p-3 text-sm text-red-400">
              {error}
            </div>
          )}
          <div>
            <label className="text-sm text-white/70">Full Name</label>
            <input
              required
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:border-[#e3ca76]/60 focus:outline-none"
              placeholder="John Doe"
            />
          </div>
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
          <p className="text-xs uppercase tracking-[0.2em] text-[#e3ca76]">Account Creation</p>
          <p className="text-sm text-white/70">
            After creating your account, you'll be redirected to login. You'll need to verify your email address before
            accessing all features.
          </p>
          <ul className="space-y-2 text-sm text-white/70">
            <li>• Password must be at least 8 characters</li>
            <li>• Email verification required</li>
            <li>• Secure password hashing</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
