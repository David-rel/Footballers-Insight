"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Save, X } from "lucide-react";
import Button from "@/components/ui/Button";

interface Player {
  id: string;
  firstName: string;
  lastName: string;
}

export default function NewEvaluationPage() {
  const router = useRouter();
  const params = useParams();
  const teamId = params.id as string;

  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [oneVOneRounds, setOneVOneRounds] = useState(5);
  const [skillMovesCount, setSkillMovesCount] = useState(6);
  const [saving, setSaving] = useState(false);
  const [isConfiguring, setIsConfiguring] = useState(true);

  useEffect(() => {
    fetchPlayers();
  }, [teamId]);

  async function fetchPlayers() {
    try {
      const response = await fetch(`/api/teams/${teamId}/players`);
      if (response.ok) {
        const data = await response.json();
        setPlayers(data.players);
      }
    } catch (error) {
      console.error("Failed to fetch players:", error);
    } finally {
      setLoading(false);
    }
  }

  const handleCreateEvaluation = async () => {
    if (!name.trim()) {
      alert("Please enter an evaluation name");
      return;
    }

    try {
      setSaving(true);
      const response = await fetch(`/api/teams/${teamId}/evaluations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          oneVOneRounds,
          skillMovesCount,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.evaluation?.id) {
          router.push(`/dashboard/teams/${teamId}/evaluations/${data.evaluation.id}`);
        }
      } else {
        const error = await response.json();
        alert(error.error || "Failed to create evaluation");
      }
    } catch (error) {
      console.error("Failed to create evaluation:", error);
      alert("Failed to create evaluation");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-white/70">Loading...</p>
      </div>
    );
  }

  if (players.length === 0) {
    return (
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => router.push(`/dashboard/teams/${teamId}`)}
          className="flex items-center gap-2 text-white/70 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Team</span>
        </button>
        <div className="rounded-2xl border border-white/10 bg-black/60 p-8 text-center">
          <p className="text-white/70 text-lg mb-4">No players in this team</p>
          <p className="text-white/50 text-sm mb-6">
            You need to add players to the team before creating an evaluation.
          </p>
          <Button onClick={() => router.push(`/dashboard/teams/${teamId}`)}>
            Go to Team Page
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <button
        onClick={() => router.push(`/dashboard/teams/${teamId}`)}
        className="flex items-center gap-2 text-white/70 hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Team</span>
      </button>

      <div className="rounded-2xl border border-white/10 bg-black/60 p-6">
        <h1 className="text-3xl font-bold text-white mb-6">Create Evaluation</h1>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-white/90 mb-2">
              Evaluation Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#e3ca76]/50"
              placeholder="Enter evaluation name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/90 mb-2">
              Number of 1v1 Rounds
            </label>
            <input
              type="number"
              min="1"
              max="10"
              value={oneVOneRounds}
              onChange={(e) => setOneVOneRounds(parseInt(e.target.value) || 5)}
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#e3ca76]/50"
            />
            <p className="text-white/50 text-xs mt-1">
              This determines how many 1v1 round score fields will be created
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-white/90 mb-2">
              Number of Skill Moves
            </label>
            <input
              type="number"
              min="1"
              max="10"
              value={skillMovesCount}
              onChange={(e) => setSkillMovesCount(parseInt(e.target.value) || 6)}
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#e3ca76]/50"
            />
            <p className="text-white/50 text-xs mt-1">
              This determines how many skill move rating fields will be created
            </p>
          </div>

          <div className="flex items-center gap-3 pt-4">
            <Button
              onClick={handleCreateEvaluation}
              disabled={!name.trim() || saving}
              className="flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {saving ? "Creating..." : "Create Evaluation"}
            </Button>
            <Button
              onClick={() => router.push(`/dashboard/teams/${teamId}`)}
              variant="ghost"
              disabled={saving}
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

