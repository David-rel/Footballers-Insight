"use client";

import Link from "next/link";
import { FormEvent, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import SectionHeader from "@/components/ui/SectionHeader";

export default function VerifyEmailPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  useEffect(() => {
    // Get email from URL search params directly
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const emailParam = urlParams.get("email");
      if (emailParam) {
        setEmail(decodeURIComponent(emailParam));
      }
    }
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          code,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to verify email");
        setLoading(false);
        return;
      }

      setSuccess(true);

      // Just redirect directly - dashboard will check verification status from DB
      setTimeout(() => {
        window.location.href = "/dashboard";
      }, 1000);
    } catch (err: any) {
      setError("An error occurred. Please try again.");
      setLoading(false);
    }
  }

  async function handleResend() {
    if (!email) {
      setError("Email is required");
      return;
    }

    setResending(true);
    setError("");
    setResendSuccess(false);

    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to resend verification email");
        setResending(false);
        return;
      }

      setResendSuccess(true);
      setTimeout(() => setResendSuccess(false), 5000);
    } catch (err: any) {
      setError("An error occurred. Please try again.");
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="relative mx-auto flex min-h-[80vh] max-w-5xl flex-col gap-10 px-6 py-14">
      <SectionHeader
        eyebrow="Verification"
        title="Verify your email"
        subtitle="Enter the verification code sent to your email address."
        align="left"
      />

      <div className="grid gap-8 rounded-3xl border border-white/10 bg-black/60 p-8 shadow-[0_25px_80px_rgba(0,0,0,0.45)] md:grid-cols-[1.2fr_1fr]">
        {success ? (
          <div className="col-span-2 space-y-4">
            <div className="rounded-xl bg-green-500/10 border border-green-500/50 p-4 text-center">
              <p className="text-green-400 font-medium">
                Email verified successfully!
              </p>
              <p className="text-white/70 text-sm mt-2">
                Redirecting to dashboard...
              </p>
            </div>
          </div>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="space-y-5">
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
                <label className="text-sm text-white/70">
                  Verification Code
                </label>
                <input
                  required
                  type="text"
                  value={code}
                  onChange={(e) =>
                    setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:border-[#e3ca76]/60 focus:outline-none text-center text-2xl tracking-widest"
                  placeholder="000000"
                  maxLength={6}
                />
              </div>
              <Button type="submit" full disabled={loading}>
                {loading ? "Verifying..." : "Verify Email"}
              </Button>
              {resendSuccess && (
                <div className="rounded-xl bg-green-500/10 border border-green-500/50 p-3 text-sm text-green-400 text-center">
                  Verification email sent! Check your inbox.
                </div>
              )}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resending || !email}
                  className="text-sm text-[#e3ca76] hover:text-white disabled:text-white/30 disabled:cursor-not-allowed transition-colors"
                >
                  {resending ? "Sending..." : "Resend verification code"}
                </button>
                <Link
                  href="/login"
                  className="text-sm text-white/60 hover:text-white"
                >
                  Back to login
                </Link>
              </div>
            </form>

            <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6 text-white/80">
              <p className="text-xs uppercase tracking-[0.2em] text-[#e3ca76]">
                Email Verification
              </p>
              <p className="text-sm text-white/70">
                A 6-digit verification code was sent to your email address when
                you created your account. Enter it here to verify your email.
              </p>
              <ul className="space-y-2 text-sm text-white/70">
                <li>• Check your inbox for the code</li>
                <li>• Code is 6 digits</li>
                <li>• Verification required for full access</li>
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
