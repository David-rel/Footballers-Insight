"use client";

import React, { useState, useEffect } from "react";
import { X, Save, Trash2 } from "lucide-react";
import Button from "@/components/ui/Button";

interface Player {
  id: string;
  firstName: string;
  lastName: string;
}

interface EvaluationFormProps {
  teamId: string;
  players: Player[];
  evaluationId?: string;
  initialName?: string;
  initialOneVOneRounds?: number;
  initialSkillMovesCount?: number;
  initialScores?: Record<string, Record<string, string | number>>;
  onClose: () => void;
  onSave: () => void;
}

interface FieldDefinition {
  key: string;
  label: string;
  category: string;
  type: "number" | "text";
}

export default function EvaluationForm({
  teamId,
  players,
  evaluationId,
  initialName = "",
  initialOneVOneRounds = 5,
  initialSkillMovesCount = 6,
  initialScores = {},
  onClose,
  onSave,
}: EvaluationFormProps) {
  const [name, setName] = useState(initialName);
  const [oneVOneRounds, setOneVOneRounds] = useState(initialOneVOneRounds);
  const [skillMovesCount, setSkillMovesCount] = useState(
    initialSkillMovesCount
  );
  const [scores, setScores] =
    useState<Record<string, Record<string, string | number>>>(initialScores);
  const [saving, setSaving] = useState(false);
  const [currentEvaluationId, setCurrentEvaluationId] = useState<
    string | undefined
  >(evaluationId);
  const [isConfiguring, setIsConfiguring] = useState(
    !evaluationId && !initialName
  );

  // Initialize scores for all players if needed
  useEffect(() => {
    if (!isConfiguring && players.length > 0) {
      const newScores = { ...scores };
      players.forEach((player) => {
        if (!newScores[player.id]) {
          newScores[player.id] = {};
        }
      });
      setScores(newScores);
    }
  }, [isConfiguring, players]);

  const getFieldDefinitions = (): FieldDefinition[] => {
    const fields: FieldDefinition[] = [];

    // Power (8 fields)
    for (let i = 1; i <= 4; i++) {
      fields.push({
        key: `power_strong_${i}`,
        label: `Strong attempt ${i}`,
        category: "Power",
        type: "number",
      });
    }
    for (let i = 1; i <= 4; i++) {
      fields.push({
        key: `power_weak_${i}`,
        label: `Weak attempt ${i}`,
        category: "Power",
        type: "number",
      });
    }

    // Serve Distance (8 fields)
    for (let i = 1; i <= 4; i++) {
      fields.push({
        key: `serve_strong_${i}`,
        label: `Strong attempt ${i}`,
        category: "Serve Distance",
        type: "number",
      });
    }
    for (let i = 1; i <= 4; i++) {
      fields.push({
        key: `serve_weak_${i}`,
        label: `Weak attempt ${i}`,
        category: "Serve Distance",
        type: "number",
      });
    }

    // Figure 8 Loops (3 fields)
    fields.push({
      key: "figure8_strong",
      label: "Strong foot",
      category: "Figure 8 Loops",
      type: "number",
    });
    fields.push({
      key: "figure8_weak",
      label: "Weak foot",
      category: "Figure 8 Loops",
      type: "number",
    });
    fields.push({
      key: "figure8_both",
      label: "Both feet",
      category: "Figure 8 Loops",
      type: "number",
    });

    // Passing Gates (2 fields)
    fields.push({
      key: "passing_strong",
      label: "Strong foot",
      category: "Passing Gates",
      type: "number",
    });
    fields.push({
      key: "passing_weak",
      label: "Weak foot",
      category: "Passing Gates",
      type: "number",
    });

    // 1v1 (dynamic based on oneVOneRounds)
    for (let i = 1; i <= oneVOneRounds; i++) {
      fields.push({
        key: `onevone_round_${i}`,
        label: `Round ${i} score`,
        category: "1v1",
        type: "number",
      });
    }

    // Juggling (4 fields)
    for (let i = 1; i <= 4; i++) {
      fields.push({
        key: `juggling_${i}`,
        label: `Attempt ${i} touches`,
        category: "Juggling",
        type: "number",
      });
    }

    // Skill Moves (dynamic based on skillMovesCount)
    for (let i = 1; i <= skillMovesCount; i++) {
      fields.push({
        key: `skillmove_${i}`,
        label: `Move ${i} rating`,
        category: "Skill Moves",
        type: "number",
      });
    }

    // Agility (3 fields)
    for (let i = 1; i <= 3; i++) {
      fields.push({
        key: `agility_${i}`,
        label: `Trial ${i} time`,
        category: "5-10-5 Agility",
        type: "number",
      });
    }

    // Reaction Sprint (6 fields - cue and total for each of 3 trials)
    for (let i = 1; i <= 3; i++) {
      fields.push({
        key: `reaction_cue_${i}`,
        label: `Reaction trial ${i} time`,
        category: "Reaction Sprint",
        type: "number",
      });
      fields.push({
        key: `reaction_total_${i}`,
        label: `Reaction total trial ${i} time`,
        category: "Reaction Sprint",
        type: "number",
      });
    }

    // Single-leg Hop (6 fields)
    for (let i = 1; i <= 3; i++) {
      fields.push({
        key: `hop_left_${i}`,
        label: `Left attempt ${i} distance`,
        category: "Single-leg Hop",
        type: "number",
      });
    }
    for (let i = 1; i <= 3; i++) {
      fields.push({
        key: `hop_right_${i}`,
        label: `Right attempt ${i} distance`,
        category: "Single-leg Hop",
        type: "number",
      });
    }

    // Double-leg Jumps (3 fields)
    fields.push({
      key: "jumps_10s",
      label: "Count at 10 seconds",
      category: "Double-leg Jumps",
      type: "number",
    });
    fields.push({
      key: "jumps_20s",
      label: "Count at 20 seconds",
      category: "Double-leg Jumps",
      type: "number",
    });
    fields.push({
      key: "jumps_30s",
      label: "Count at 30 seconds",
      category: "Double-leg Jumps",
      type: "number",
    });

    // Ankle Dorsiflexion (2 fields)
    fields.push({
      key: "ankle_left",
      label: "Left distance",
      category: "Ankle Dorsiflexion",
      type: "number",
    });
    fields.push({
      key: "ankle_right",
      label: "Right distance",
      category: "Ankle Dorsiflexion",
      type: "number",
    });

    // Core Plank (2 fields)
    fields.push({
      key: "plank_time",
      label: "Hold time",
      category: "Core Plank",
      type: "number",
    });
    fields.push({
      key: "plank_form",
      label: "Form flag",
      category: "Core Plank",
      type: "number",
    });

    return fields;
  };

  const fields = getFieldDefinitions();
  const categories = Array.from(new Set(fields.map((f) => f.category)));

  const handleScoreChange = (
    playerId: string,
    fieldKey: string,
    value: string
  ) => {
    setScores((prev) => {
      const newScores = { ...prev };
      if (!newScores[playerId]) {
        newScores[playerId] = {};
      }
      newScores[playerId][fieldKey] =
        value === "" ? "" : isNaN(Number(value)) ? value : Number(value);
      return newScores;
    });
  };

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
          setCurrentEvaluationId(data.evaluation.id);
        }
        setIsConfiguring(false);
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

  const handleSaveScores = async () => {
    try {
      setSaving(true);
      const evalId = currentEvaluationId || evaluationId;

      if (!evalId) {
        alert("Evaluation ID not found. Please create the evaluation first.");
        return;
      }

      const response = await fetch(
        `/api/teams/${teamId}/evaluations/${evalId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scores }),
        }
      );

      if (response.ok) {
        onSave();
        onClose();
      } else {
        const error = await response.json();
        alert(error.error || "Failed to save scores");
      }
    } catch (error) {
      console.error("Failed to save scores:", error);
      alert("Failed to save scores");
    } finally {
      setSaving(false);
    }
  };

  if (isConfiguring) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-black/95 border border-white/10 rounded-2xl p-6 w-full max-w-md">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white">Create Evaluation</h2>
            <button
              onClick={onClose}
              className="text-white/70 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
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
                onChange={(e) =>
                  setOneVOneRounds(parseInt(e.target.value) || 5)
                }
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
                onChange={(e) =>
                  setSkillMovesCount(parseInt(e.target.value) || 6)
                }
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#e3ca76]/50"
              />
              <p className="text-white/50 text-xs mt-1">
                This determines how many skill move rating fields will be
                created
              </p>
            </div>

            <div className="flex items-center gap-3 pt-4">
              <Button
                onClick={handleCreateEvaluation}
                disabled={!name.trim() || saving}
                className="flex-1"
              >
                {saving ? "Creating..." : "Create Evaluation"}
              </Button>
              <Button onClick={onClose} variant="ghost" disabled={saving}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (players.length === 0) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-black/95 border border-white/10 rounded-2xl p-6 w-full max-w-md">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white">No Players</h2>
            <button
              onClick={onClose}
              className="text-white/70 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-white/70 mb-4">
            You need to add players to the team before creating an evaluation.
          </p>
          <Button onClick={onClose} className="w-full">
            Close
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-black/95 border border-white/10 rounded-2xl p-6 w-full max-w-[95vw] max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-white">
              {name || "Evaluation"}
            </h2>
            {currentEvaluationId && (
              <p className="text-white/50 text-sm mt-1">
                {oneVOneRounds} 1v1 rounds • {skillMovesCount} skill moves
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-auto">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-full">
              <thead className="sticky top-0 bg-black/95 z-10">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-white/90 border-b border-white/10 bg-black/95 sticky left-0 z-20 min-w-[200px] border-r border-white/10">
                    Player
                  </th>
                  {categories.map((category) => {
                    const categoryFields = fields.filter(
                      (f) => f.category === category
                    );
                    return (
                      <th
                        key={category}
                        colSpan={categoryFields.length}
                        className="px-2 py-3 text-center text-xs font-semibold text-white/90 border-b border-white/10 bg-black/95 border-r border-white/5"
                      >
                        <div className="font-bold text-sm mb-1">{category}</div>
                        <div className="flex">
                          {categoryFields.map((field) => (
                            <div
                              key={field.key}
                              className="px-1 text-[10px] text-white/70 min-w-[80px] max-w-[100px] truncate"
                              title={field.label}
                            >
                              {field.label}
                            </div>
                          ))}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {players.map((player) => (
                  <tr key={player.id} className="hover:bg-white/5">
                    <td className="px-4 py-3 text-white font-medium border-r border-white/10 bg-black/60 sticky left-0 z-10">
                      {player.firstName} {player.lastName}
                    </td>
                    {categories.map((category) => {
                      const categoryFields = fields.filter(
                        (f) => f.category === category
                      );
                      return (
                        <React.Fragment key={category}>
                          {categoryFields.map((field) => (
                            <td
                              key={field.key}
                              className="px-1 py-2 border-r border-white/5"
                            >
                              <input
                                type={field.type}
                                value={scores[player.id]?.[field.key] || ""}
                                onChange={(e) =>
                                  handleScoreChange(
                                    player.id,
                                    field.key,
                                    e.target.value
                                  )
                                }
                                className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-white text-xs focus:outline-none focus:border-[#e3ca76]/50 min-w-[80px]"
                                placeholder="—"
                              />
                            </td>
                          ))}
                        </React.Fragment>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 mt-4 pt-4 border-t border-white/10">
          <Button
            onClick={handleSaveScores}
            disabled={saving}
            className="flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {saving ? "Saving..." : "Save Scores"}
          </Button>
          <Button onClick={onClose} variant="ghost" disabled={saving}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
