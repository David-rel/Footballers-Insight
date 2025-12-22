"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Save, Printer } from "lucide-react";
import Button from "@/components/ui/Button";

interface Player {
  id: string;
  firstName: string;
  lastName: string;
}

interface FieldDefinition {
  key: string;
  label: string;
  category: string;
  type: "number" | "text";
}

export default function EvaluationPage() {
  const router = useRouter();
  const params = useParams();
  const teamId = params.id as string;
  const evaluationId = params.evaluationId as string;

  const [players, setPlayers] = useState<Player[]>([]);
  const [evaluation, setEvaluation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [scores, setScores] = useState<
    Record<string, Record<string, string | number>>
  >({});
  const [saving, setSaving] = useState(false);
  const tableRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    fetchData();
  }, [teamId, evaluationId]);

  async function fetchData() {
    try {
      setLoading(true);
      const [playersRes, evaluationRes] = await Promise.all([
        fetch(`/api/teams/${teamId}/players`),
        fetch(`/api/teams/${teamId}/evaluations/${evaluationId}`),
      ]);

      if (playersRes.ok) {
        const playersData = await playersRes.json();
        setPlayers(playersData.players);
      }

      if (evaluationRes.ok) {
        const evalData = await evaluationRes.json();
        setEvaluation(evalData.evaluation);
        setScores(evalData.evaluation.scores || {});
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  }

  // Initialize scores for all players if needed
  useEffect(() => {
    if (players.length > 0 && evaluation) {
      const newScores = { ...scores };
      players.forEach((player) => {
        if (!newScores[player.id]) {
          newScores[player.id] = {};
        }
      });
      setScores(newScores);
    }
  }, [players, evaluation]);

  const getFieldDefinitions = (): FieldDefinition[] => {
    if (!evaluation) return [];
    const fields: FieldDefinition[] = [];
    const oneVOneRounds = evaluation.oneVOneRounds || 5;
    const skillMovesCount = evaluation.skillMovesCount || 6;

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

  const handleSaveScores = async () => {
    try {
      setSaving(true);
      const response = await fetch(
        `/api/teams/${teamId}/evaluations/${evaluationId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scores }),
        }
      );

      if (response.ok) {
        router.push(`/dashboard/teams/${teamId}`);
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

  const handlePrint = (category: string) => {
    const categoryFields = fields.filter((f) => f.category === category);

    // Build table HTML with actual values
    let tableRows = "";
    players.forEach((player) => {
      let rowCells = `<td style="padding: 6px 8px; border: 1px solid #000; font-weight: bold; font-size: 11px;">${player.firstName} ${player.lastName}</td>`;
      categoryFields.forEach((field) => {
        const value = scores[player.id]?.[field.key] || "—";
        rowCells += `<td style="padding: 6px 8px; border: 1px solid #000; text-align: center; font-size: 11px;">${value}</td>`;
      });
      tableRows += `<tr>${rowCells}</tr>`;
    });

    let headerCells = `<th style="padding: 8px; border: 1px solid #000; background-color: #f0f0f0; font-weight: bold; text-align: left; font-size: 11px;">Player</th>`;
    categoryFields.forEach((field) => {
      headerCells += `<th style="padding: 8px; border: 1px solid #000; background-color: #f0f0f0; font-weight: bold; text-align: center; font-size: 11px;">${field.label}</th>`;
    });

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${evaluation.name} - ${category}</title>
          <style>
            @media print {
              @page {
                margin: 0.5cm;
                size: A4 landscape;
              }
              * {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              body {
                margin: 0;
                padding: 0;
                font-family: Arial, sans-serif;
                color: #000;
                background: #fff;
                transform-origin: top left;
              }
              .print-container {
                width: 100%;
                height: 100%;
                display: flex;
                flex-direction: column;
                page-break-inside: avoid;
              }
              .print-header {
                text-align: center;
                margin-bottom: 10px;
                flex-shrink: 0;
              }
              .print-title {
                font-size: 18px;
                font-weight: bold;
                margin-bottom: 4px;
                line-height: 1.2;
              }
              .print-subtitle {
                font-size: 14px;
                color: #333;
                margin-bottom: 2px;
                line-height: 1.2;
              }
              .print-date {
                font-size: 10px;
                color: #666;
                margin-top: 4px;
                line-height: 1.2;
              }
              table {
                width: 100%;
                border-collapse: collapse;
                flex: 1;
                font-size: 10px;
              }
              th, td {
                border: 1px solid #000;
                padding: 4px 6px;
                font-size: 10px;
                line-height: 1.3;
              }
              th {
                background-color: #f0f0f0;
                font-weight: bold;
                padding: 6px 8px;
              }
              tbody tr {
                page-break-inside: avoid;
              }
            }
            body {
              font-family: Arial, sans-serif;
              padding: 10px;
              color: #000;
              background: #fff;
              margin: 0;
            }
            .print-container {
              width: 100%;
              height: 100%;
              display: flex;
              flex-direction: column;
            }
            .print-header {
              text-align: center;
              margin-bottom: 10px;
            }
            .print-title {
              font-size: 18px;
              font-weight: bold;
              margin-bottom: 4px;
            }
            .print-subtitle {
              font-size: 14px;
              color: #333;
              margin-bottom: 2px;
            }
            .print-date {
              font-size: 10px;
              color: #666;
              margin-top: 4px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 10px;
            }
            th, td {
              border: 1px solid #000;
              padding: 4px 6px;
              font-size: 10px;
            }
            th {
              background-color: #f0f0f0;
              font-weight: bold;
              padding: 6px 8px;
            }
          </style>
        </head>
        <body>
          <div class="print-container">
            <div class="print-header">
              <div class="print-title">${evaluation.name}</div>
              <div class="print-subtitle">${category}</div>
              <div class="print-date">Printed: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</div>
            </div>
            <table>
              <thead>
                <tr>${headerCells}</tr>
              </thead>
              <tbody>
                ${tableRows}
              </tbody>
            </table>
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();

    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-white/70">Loading...</p>
      </div>
    );
  }

  if (!evaluation) {
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
          <p className="text-white/70 text-lg">Evaluation not found</p>
        </div>
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
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4">
      <div className="mb-8 sticky top-4 z-30">
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-black/80 to-black/60 backdrop-blur-sm shadow-xl p-8 border-[#e3ca76]/20">
          <button
            onClick={() => router.push(`/dashboard/teams/${teamId}`)}
            className="flex items-center gap-2 text-white/70 hover:text-white mb-6 transition-colors group"
          >
            <ArrowLeft className="w-5 h-5 group-hover:translate-x-[-4px] transition-transform" />
            <span className="text-base">Back to Team</span>
          </button>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-4 mb-3">
                <div className="w-1 h-12 bg-gradient-to-b from-[#e3ca76] to-[#a78443] rounded-full"></div>
                <div>
                  <h1 className="text-5xl font-bold text-white mb-2 bg-gradient-to-r from-white to-white/90 bg-clip-text">
                    {evaluation.name}
                  </h1>
                  <div className="flex items-center gap-4 text-white/60">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[#e3ca76]"></div>
                      <span className="text-base">
                        {evaluation.oneVOneRounds} 1v1 rounds
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[#e3ca76]"></div>
                      <span className="text-base">
                        {evaluation.skillMovesCount} skill moves
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <Button
              onClick={handleSaveScores}
              disabled={saving}
              className="flex items-center gap-2 text-base px-6 py-3 shadow-lg"
            >
              <Save className="w-5 h-5" />
              {saving ? "Saving..." : "Save Scores"}
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-8 pb-8">
        {categories.map((category) => {
          const categoryFields = fields.filter((f) => f.category === category);
          return (
            <div
              key={category}
              className="rounded-2xl border border-white/10 bg-black/60 p-6 shadow-lg"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-1 h-8 bg-gradient-to-b from-[#e3ca76] to-[#a78443] rounded-full"></div>
                  <h2 className="text-3xl font-bold text-white">{category}</h2>
                </div>
                <Button
                  onClick={() => handlePrint(category)}
                  variant="outline"
                  className="flex items-center gap-2 border-[#e3ca76]/50 text-[#e3ca76] hover:bg-[#e3ca76]/10"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print</span>
                </Button>
              </div>
              <div
                ref={(el) => {
                  tableRefs.current[category] = el;
                }}
                className="overflow-x-auto"
              >
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="px-6 py-3 text-left text-base font-semibold text-white/90 border-b border-white/10 bg-white/5">
                        Player
                      </th>
                      {categoryFields.map((field) => (
                        <th
                          key={field.key}
                          className="px-4 py-3 text-center text-sm font-semibold text-white/90 border-b border-white/10 bg-white/5 min-w-[140px]"
                        >
                          {field.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {players.map((player) => (
                      <tr
                        key={player.id}
                        className="hover:bg-white/5 transition-colors"
                      >
                        <td className="px-6 py-4 text-white font-semibold text-base">
                          {player.firstName} {player.lastName}
                        </td>
                        {categoryFields.map((field) => (
                          <td key={field.key} className="px-4 py-4">
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
                              className="w-full px-4 py-3 bg-white/10 border-2 border-white/20 rounded-lg text-white text-base focus:outline-none focus:border-[#e3ca76] focus:bg-white/15 text-center font-medium transition-all"
                              placeholder="—"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
