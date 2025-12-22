"use client";

import { useState } from "react";

export default function ContactForm() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    role: "",
    lookingFor: "",
    message: "",
    requestDemo: false,
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setSuccess(true);
        setFormData({
          name: "",
          email: "",
          role: "",
          lookingFor: "",
          message: "",
          requestDemo: false,
        });
        // Reset success message after 5 seconds
        setTimeout(() => setSuccess(false), 5000);
      } else {
        const data = await response.json();
        setError(data.error || "Failed to send message. Please try again.");
      }
    } catch (err) {
      setError("Failed to send message. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-3xl border border-white/10 bg-black/60 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.4)]"
    >
      {success && (
        <div className="mb-4 rounded-xl bg-green-500/20 border border-green-500/50 p-3 text-sm text-green-400">
          Message sent successfully! We'll get back to you within one business
          day.
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-xl bg-red-500/20 border border-red-500/50 p-3 text-sm text-red-400">
          {error}
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm text-white/80">
          Name *
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Your name"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:border-[#e3ca76]/60 focus:outline-none"
          />
        </label>
        <label className="space-y-2 text-sm text-white/80">
          Email *
          <input
            type="email"
            required
            value={formData.email}
            onChange={(e) =>
              setFormData({ ...formData, email: e.target.value })
            }
            placeholder="you@club.com"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:border-[#e3ca76]/60 focus:outline-none"
          />
        </label>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm text-white/80">
          Role
          <select
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            className="w-full appearance-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-[#e3ca76]/60 focus:outline-none"
          >
            <option value="" className="bg-black">
              Select role
            </option>
            <option value="Player" className="bg-black">
              Player
            </option>
            <option value="Coach" className="bg-black">
              Coach
            </option>
            <option value="Admin" className="bg-black">
              Admin
            </option>
            <option value="Other" className="bg-black">
              Other
            </option>
          </select>
        </label>
        <label className="space-y-2 text-sm text-white/80">
          Looking for
          <select
            value={formData.lookingFor}
            onChange={(e) =>
              setFormData({ ...formData, lookingFor: e.target.value })
            }
            className="w-full appearance-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-[#e3ca76]/60 focus:outline-none"
          >
            <option value="" className="bg-black">
              Select option
            </option>
            <option value="Platform demo" className="bg-black">
              Platform demo
            </option>
            <option value="Pricing information" className="bg-black">
              Pricing information
            </option>
            <option value="Testing setup help" className="bg-black">
              Testing setup help
            </option>
            <option value="General questions" className="bg-black">
              General questions
            </option>
          </select>
        </label>
      </div>
      <label className="mt-4 block space-y-2 text-sm text-white/80">
        Message *
        <textarea
          required
          rows={4}
          value={formData.message}
          onChange={(e) =>
            setFormData({ ...formData, message: e.target.value })
          }
          placeholder="Tell us about your club, team size, age groups, or questions about the testing platform."
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:border-[#e3ca76]/60 focus:outline-none"
        />
      </label>
      <label className="mt-4 flex items-center gap-3 text-sm text-white/70">
        <input
          type="checkbox"
          checked={formData.requestDemo}
          onChange={(e) =>
            setFormData({ ...formData, requestDemo: e.target.checked })
          }
          className="h-4 w-4 rounded border-white/20 bg-black text-[#e3ca76] focus:ring-[#e3ca76]"
        />
        Request a demo call
      </label>
      <button
        type="submit"
        disabled={loading}
        className="mt-5 w-full rounded-full bg-gradient-to-r from-[#e3ca76] to-[#a78443] px-4 py-3 text-sm font-semibold text-black shadow-[0_20px_60px_rgba(0,0,0,0.35)] transition hover:shadow-[0_0_0_2px_rgba(227,202,118,0.2)] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Sending..." : "Send message"}
      </button>
      <p className="mt-3 text-center text-xs text-white/50">
        We respond within one business day.
      </p>
    </form>
  );
}
