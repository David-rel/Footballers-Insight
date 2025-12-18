"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Button from "@/components/ui/Button";
import SectionHeader from "@/components/ui/SectionHeader";

function PlayerOnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const playerId = searchParams.get("playerId");
  const { data: session, update, status } = useSession();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [dominantFoot, setDominantFoot] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingPlayer, setLoadingPlayer] = useState(false);
  const [error, setError] = useState("");
  const [playerInfo, setPlayerInfo] = useState<{
    firstName: string;
    lastName: string;
    teamName: string;
  } | null>(null);

  useEffect(() => {
    // Redirect if already onboarded or not a player
    // Only check if we have a valid session
    if (session?.user) {
      if ((session.user as any).role !== "player") {
        router.push("/dashboard");
        return;
      }
      // If user is onboarded and no playerId, redirect to dashboard
      // If user is onboarded but playerId exists, they're completing a player profile
      if ((session.user as any).onboarded && !playerId) {
        router.push("/dashboard");
        return;
      }
    }
  }, [session, router, playerId]);

  useEffect(() => {
    // If playerId is provided, fetch player info
    if (playerId && session?.user) {
      fetchPlayerInfo();
    }
  }, [playerId, session]);

  async function fetchPlayerInfo() {
    if (!playerId) return;
    
    try {
      setLoadingPlayer(true);
      const response = await fetch(`/api/players/incomplete`);
      if (response.ok) {
        const data = await response.json();
        if (data.hasIncomplete && data.player && data.player.id === playerId) {
          setPlayerInfo({
            firstName: data.player.firstName,
            lastName: data.player.lastName,
            teamName: data.player.teamName,
          });
          // Pre-fill form if player has partial data
          if (data.player.dob) {
            setDob(data.player.dob.split("T")[0]);
          }
          if (data.player.gender) {
            setGender(data.player.gender);
          }
          if (data.player.dominantFoot) {
            setDominantFoot(data.player.dominantFoot);
          }
        }
      }
    } catch (error) {
      console.error("Failed to fetch player info:", error);
    } finally {
      setLoadingPlayer(false);
    }
  }

  function calculateAgeGroup(dob: string): string {
    if (!dob) return "";
    const birthYear = new Date(dob).getFullYear();
    return birthYear.toString();
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    // If playerId exists, user is already onboarded, just updating player profile
    // Otherwise, they need to set password
    if (!playerId) {
      if (password.length < 8) {
        setError("Password must be at least 8 characters long");
        return;
      }

      if (password !== confirmPassword) {
        setError("Passwords do not match");
        return;
      }
    }

    if (!dob) {
      setError("Date of birth is required");
      return;
    }

    if (!gender) {
      setError("Gender is required");
      return;
    }

    if (!dominantFoot) {
      setError("Dominant foot is required");
      return;
    }

    setLoading(true);

    try {
      const ageGroup = calculateAgeGroup(dob);
      
      // If playerId exists, update that specific player
      if (playerId) {
        // Get teamId from player info
        const incompleteRes = await fetch("/api/players/incomplete");
        if (incompleteRes.ok) {
          const incompleteData = await incompleteRes.json();
          if (incompleteData.hasIncomplete && incompleteData.player.id === playerId) {
            const teamId = incompleteData.player.teamId;
            const response = await fetch(`/api/teams/${teamId}/players/${playerId}`, {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                firstName: incompleteData.player.firstName,
                lastName: incompleteData.player.lastName,
                dob,
                gender,
                dominantFoot,
                notes: notes || null,
              }),
            });

            if (response.ok) {
              // Check if there are more incomplete players
              setTimeout(async () => {
                const checkRes = await fetch("/api/players/incomplete");
                if (checkRes.ok) {
                  const checkData = await checkRes.json();
                  if (checkData.hasIncomplete) {
                    window.location.href = `/onboarding/player?playerId=${checkData.player.id}`;
                  } else {
                    window.location.href = "/dashboard";
                  }
                } else {
                  window.location.href = "/dashboard";
                }
              }, 300);
            } else {
              const errorData = await response.json();
              setError(errorData.error || "Failed to update player");
              setLoading(false);
            }
            return;
          }
        }
      }

      // Original flow: user onboarding with password
      const response = await fetch("/api/onboarding/player-complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          newPassword: password,
          dob,
          ageGroup,
          gender,
          dominantFoot,
          notes: notes || null,
        }),
      });

      if (response.ok) {
        // Update session to reflect onboarding - this triggers JWT callback to fetch from database
        await update();
        // Wait for session to refresh, then redirect
        // Using window.location ensures a full page reload with fresh session
        setTimeout(() => {
          window.location.href = "/dashboard";
        }, 300);
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to set password");
        setLoading(false);
      }
    } catch (err: any) {
      setError("An error occurred. Please try again.");
      setLoading(false);
    }
  }

  if (!session?.user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-white/70">Loading...</p>
      </div>
    );
  }

  return (
    <div className="relative mx-auto flex min-h-[80vh] max-w-5xl flex-col gap-10 px-6 py-14">
      <SectionHeader
        eyebrow={playerId ? "Complete Player Profile" : "Welcome"}
        title={playerId && playerInfo ? `Complete ${playerInfo.firstName} ${playerInfo.lastName}'s Profile` : "Complete Your Profile"}
        subtitle={playerId && playerInfo 
          ? `Please complete the profile information for ${playerInfo.firstName} ${playerInfo.lastName} on ${playerInfo.teamName}.`
          : "Set your password and provide your player information."}
        align="left"
      />

      <div className="grid gap-8 rounded-3xl border border-white/10 bg-black/60 p-8 shadow-[0_25px_80px_rgba(0,0,0,0.45)] md:grid-cols-[1.2fr_1fr]">
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/50 p-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {!playerId && (
            <>
              <div>
                <label className="text-sm text-white/70">New Password</label>
                <input
                  required
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:border-[#e3ca76]/60 focus:outline-none"
                  placeholder="Enter your new password"
                  minLength={8}
                />
                <p className="mt-1 text-xs text-white/50">
                  Password must be at least 8 characters long
                </p>
              </div>

              <div>
                <label className="text-sm text-white/70">Confirm Password</label>
                <input
                  required
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:border-[#e3ca76]/60 focus:outline-none"
                  placeholder="Confirm your new password"
                  minLength={8}
                />
              </div>
            </>
          )}

          <div className="pt-4 border-t border-white/10">
            <h3 className="text-lg font-semibold text-white mb-4">
              Player Information
            </h3>
          </div>

          <div>
            <label className="text-sm text-white/70">Date of Birth *</label>
            <input
              required
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:border-[#e3ca76]/60 focus:outline-none"
              max={new Date().toISOString().split("T")[0]}
            />
            {dob && (
              <p className="mt-1 text-xs text-white/50">
                Birth Year: {calculateAgeGroup(dob)}
              </p>
            )}
          </div>

          <div>
            <label className="text-sm text-white/70">Gender *</label>
            <select
              required
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-[#e3ca76]/60 focus:outline-none"
            >
              <option value="">Select gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="text-sm text-white/70">Dominant Foot *</label>
            <select
              required
              value={dominantFoot}
              onChange={(e) => setDominantFoot(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-[#e3ca76]/60 focus:outline-none"
            >
              <option value="">Select dominant foot</option>
              <option value="left">Left</option>
              <option value="right">Right</option>
              <option value="both">Both</option>
            </select>
          </div>

          <div>
            <label className="text-sm text-white/70">Notes (Optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:border-[#e3ca76]/60 focus:outline-none resize-none"
              placeholder="Any additional notes or information..."
            />
          </div>

          <Button type="submit" full disabled={loading || loadingPlayer}>
            {loading ? "Completing..." : playerId ? "Update Player Profile" : "Complete Profile & Continue"}
          </Button>
        </form>

        <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6 text-white/80">
          <p className="text-xs uppercase tracking-[0.2em] text-[#e3ca76]">
            Password Security
          </p>
          <p className="text-sm text-white/70">
            Choose a strong password to protect your account. Your password
            should:
          </p>
          <ul className="space-y-2 text-sm text-white/70">
            <li>• Be at least 8 characters long</li>
            <li>• Include a mix of letters and numbers</li>
            <li>• Use a combination of uppercase and lowercase</li>
            <li>• Not be easily guessable</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function PlayerOnboardingPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-white/70">Loading...</p>
      </div>
    }>
      <PlayerOnboardingContent />
    </Suspense>
  );
}
