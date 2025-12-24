import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [k: string]: JsonValue };

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

async function callOpenAIJsonSchema({
  model,
  system,
  userPayload,
}: {
  model: string;
  system: string;
  userPayload: JsonValue;
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      ok: false as const,
      status: 500,
      error: "OPENAI_API_KEY is not set",
    };
  }

  const schema = {
    name: "player_analysis_report",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        playerName: { type: "string" },
        teamName: { type: ["string", "null"] },
        checkInId: { type: "string" },
        checkInName: { type: "string" },
        createdAt: { type: "string" }, // ISO
        confidence: { type: "number" }, // 0..1
        quickSummary: { type: "string" },
        strengths: {
          type: "array",
          minItems: 3,
          maxItems: 8,
          items: { type: "string" },
        },
        areasToImprove: {
          type: "array",
          minItems: 2,
          maxItems: 6,
          items: { type: "string" },
        },
        top3Actions: {
          type: "array",
          minItems: 3,
          maxItems: 3,
          items: { type: "string" },
        },
        whatToDoNext: {
          type: "array",
          minItems: 2,
          maxItems: 6,
          items: { type: "string" },
        },
        coachingTips: {
          type: "array",
          minItems: 2,
          maxItems: 6,
          items: { type: "string" },
        },
        safetyNotes: {
          type: "array",
          minItems: 1,
          maxItems: 4,
          items: { type: "string" },
        },
      },
      required: [
        "playerName",
        "teamName",
        "checkInId",
        "checkInName",
        "createdAt",
        "confidence",
        "quickSummary",
        "strengths",
        "areasToImprove",
        "top3Actions",
        "whatToDoNext",
        "coachingTips",
        "safetyNotes",
      ],
    },
  } as const;

  // Prefer Responses API with json_schema.
  const responsesReq = {
    model,
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: system,
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: JSON.stringify(userPayload),
          },
        ],
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: schema,
    },
  };

  const r = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(responsesReq),
  });

  const bodyText = await r.text();
  if (!r.ok) {
    // Fallback to chat.completions json_object for older accounts / gateways.
    const chatReq = {
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify(userPayload) },
      ],
      response_format: { type: "json_object" },
    };

    const r2 = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(chatReq),
    });

    const body2 = await r2.json().catch(() => null);
    if (!r2.ok) {
      return {
        ok: false as const,
        status: 502,
        error:
          (isObj(body2) && typeof body2.error === "object"
            ? (body2.error as any)?.message
            : null) || `OpenAI request failed (${r.status})`,
        details: {
          responsesStatus: r.status,
          responsesBody: bodyText,
          chat: body2,
        },
      };
    }

    const content = body2?.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      return {
        ok: false as const,
        status: 502,
        error: "OpenAI chat response missing content",
        details: body2,
      };
    }
    try {
      return { ok: true as const, data: JSON.parse(content) };
    } catch (e: any) {
      return {
        ok: false as const,
        status: 502,
        error: "OpenAI chat response was not valid JSON",
        details: { content, parseError: e?.message ?? String(e), body2 },
      };
    }
  }

  let body: any = null;
  try {
    body = JSON.parse(bodyText);
  } catch (e: any) {
    return {
      ok: false as const,
      status: 502,
      error: "OpenAI responses returned invalid JSON envelope",
      details: { bodyText, parseError: e?.message ?? String(e) },
    };
  }

  // Log raw response (user requested, and useful when output is empty).
  console.log("OpenAI responses raw:", body);

  const tryParseStringJson = (s: unknown) => {
    if (typeof s !== "string") return null;
    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  };

  // 1) body.output_text often exists
  const fromOutputText = tryParseStringJson(body?.output_text);
  if (fromOutputText) return { ok: true as const, data: fromOutputText };

  // 2) Walk output content blocks to find JSON
  const outputs: any[] = Array.isArray(body?.output) ? body.output : [];
  for (const out of outputs) {
    const content: any[] = Array.isArray(out?.content) ? out.content : [];
    for (const c of content) {
      // Some accounts return JSON as a string in output_text
      const asText = tryParseStringJson(c?.text);
      if (asText) return { ok: true as const, data: asText };

      // Some return a structured object
      if (c?.type === "output_json" && c?.json) {
        return { ok: true as const, data: c.json };
      }
      if (c?.type === "json" && c?.json) {
        return { ok: true as const, data: c.json };
      }
    }
  }

  return {
    ok: false as const,
    status: 502,
    error: "OpenAI response did not contain JSON output",
    details: body,
  };
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const payload = (await request
      .json()
      .catch(() => null)) as JsonValue | null;
    if (!payload) {
      return NextResponse.json(
        { error: "Missing request body" },
        { status: 400 }
      );
    }

    // Extract playerId from the payload (sent by AI Stats page)
    const playerId =
      (isObj(payload) && isObj((payload as any).player)
        ? (payload as any).player?.id
        : null) ?? null;

    if (typeof playerId !== "string" || !playerId) {
      return NextResponse.json(
        { error: "Missing player.id in request body" },
        { status: 400 }
      );
    }

    // AuthZ: user must be allowed to view this player
    const userResult = await pool.query(
      "SELECT role, company_id FROM users WHERE id = $1",
      [session.user.id]
    );
    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    const userRole = userResult.rows[0].role as string;
    let companyId: string | null = userResult.rows[0].company_id;

    // If owner, get company from companies table
    if (userRole === "owner" && !companyId) {
      const companyResult = await pool.query(
        "SELECT id FROM companies WHERE owner_id = $1",
        [session.user.id]
      );
      if (companyResult.rows.length > 0) companyId = companyResult.rows[0].id;
    }

    // Get player info (team + supervisor)
    const playerRes = await pool.query(
      "SELECT id, team_id, parent_user_id FROM players WHERE id = $1",
      [playerId]
    );
    if (playerRes.rows.length === 0) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }
    const teamId = playerRes.rows[0].team_id as string;
    const parentUserId = playerRes.rows[0].parent_user_id as string;

    // Parents/players can only view players they supervise
    if (
      (userRole === "parent" || userRole === "player") &&
      parentUserId !== session.user.id
    ) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Staff checks
    if (userRole === "coach" || userRole === "owner" || userRole === "admin") {
      const teamRes = await pool.query(
        "SELECT company_id, coach_id FROM teams WHERE id = $1",
        [teamId]
      );
      if (teamRes.rows.length === 0) {
        return NextResponse.json({ error: "Team not found" }, { status: 404 });
      }
      const team = teamRes.rows[0];
      if (userRole === "coach" && team.coach_id !== session.user.id) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
      if (userRole !== "coach") {
        if (!companyId || team.company_id !== companyId) {
          return NextResponse.json({ error: "Access denied" }, { status: 403 });
        }
      }
    }

    // Determine the latest player evaluation for invalidation
    const latestEvalRes = await pool.query(
      `SELECT id, created_at
       FROM player_evaluations
       WHERE player_id = $1
       ORDER BY created_at DESC NULLS LAST
       LIMIT 1`,
      [playerId]
    );

    if (latestEvalRes.rows.length === 0) {
      return NextResponse.json(
        { error: "No player evaluations found yet" },
        { status: 404 }
      );
    }

    const latestEvalId = latestEvalRes.rows[0].id as string;
    const latestEvalCreatedAt = latestEvalRes.rows[0].created_at as string;

    // Cache lookup
    const cachedRes = await pool.query(
      `SELECT report, created_at, source_player_evaluation_id, source_player_evaluation_created_at
       FROM player_ai_analysis
       WHERE player_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [playerId]
    );

    const cachedRow = cachedRes.rows.length > 0 ? cachedRes.rows[0] : null;
    if (cachedRow) {
      // NOTE: cached.report can be returned as a string depending on pg config
      let cachedReport: any = cachedRow.report;
      if (typeof cachedReport === "string") {
        try {
          cachedReport = JSON.parse(cachedReport);
        } catch {
          // ignore
        }
      }

      const cachedSourceEvalId =
        cachedRow.source_player_evaluation_id as string;

      if (cachedSourceEvalId === latestEvalId) {
        return NextResponse.json(
          {
            report: cachedReport,
            cached: true,
            createdAt: cachedRow.created_at,
            stale: false,
          },
          { status: 200 }
        );
      }
    }

    // Coaches/admins/owners can only VIEW an existing report; they must not generate.
    if (userRole === "coach" || userRole === "admin" || userRole === "owner") {
      if (cachedRow) {
        let cachedReport: any = cachedRow.report;
        if (typeof cachedReport === "string") {
          try {
            cachedReport = JSON.parse(cachedReport);
          } catch {
            // ignore
          }
        }
        return NextResponse.json(
          {
            report: cachedReport,
            cached: true,
            createdAt: cachedRow.created_at,
            stale: true,
            message:
              "This player’s AI report is not up to date with the latest check-in. Ask the player/parent to open Player AI Analysis to refresh it.",
          },
          { status: 200 }
        );
      }

      return NextResponse.json(
        {
          error:
            "This player does not have an AI report yet. Ask the player/parent to open Player AI Analysis to generate it.",
        },
        { status: 404 }
      );
    }

    const system = [
      "You are an elite youth football (soccer) coach + sports scientist.",
      "You will receive structured player test results for multiple check-ins.",
      "Write a helpful, encouraging report for the PLAYER and PARENT in plain English.",
      "Be specific, actionable, and realistic. Avoid medical claims; add safety notes when appropriate.",
      "Output MUST match the required JSON schema exactly. Do not add extra keys.",
      "Do NOT create a training plan, weekly plan, workouts, or activities. Keep actions as short bullets/tidbits only.",
      "Use the most recent check-in as the main reference, and compare to the earlier check-ins provided.",
      "Make every bullet specific to the stats you were given (include numbers when helpful).",
      "Prefer short bullets, simple language, and 'what to do next'.",
      "",
      "CRITICAL COACHING RULES:",
      "- These are TESTS, not the objective. Treat them as signals of real football qualities.",
      "- Do NOT give advice like 'practice the test' or 're-test' or 'do more test reps'.",
      "- Instead: explain what the metric likely means on the pitch, then give 1–2 practical ways to improve that quality in normal football training.",
      "- Every action should be useful even if the player never repeats the test.",
      "",
      "How to translate tests into football practice (examples, not extra output keys):",
      "- If weak-foot passing gates is low → recommend weak-foot passing in football contexts (wall passes, rondos, one-touch constraints, scanning + body shape).",
      "- If agility time is slow → recommend change-of-direction technique (deceleration, plant foot angle, hip turn) + ball-carrying COD, not just running the 5-10-5.",
      "- If hop/jump endurance is weak → recommend landing mechanics + single-leg strength + acceleration/plyo done safely, tied to sprinting/cutting.",
      "- If juggling improved → explain first touch/ball mastery transfer (receiving, cushioning, manipulation under pressure).",
      "",
      "Style:",
      "- Speak like a coach who cares about matches and skills, not a tester.",
      "- Prefer on-ball ideas when possible (first touch, passing, receiving, turning, shooting, 1v1 decisions).",
      "- Keep it short and high-signal: avoid filler.",
      "",
      "EXPECTED JSON (return exactly this shape and only these keys):",
      "{",
      '  "playerName": "<string>",',
      '  "teamName": "<string|null>",',
      '  "checkInId": "<string>",',
      '  "checkInName": "<string>",',
      '  "createdAt": "<ISO timestamp string>",',
      '  "confidence": <number 0..1>,',
      '  "quickSummary": "<1-3 sentences>",',
      '  "strengths": ["<string>", "<string>", "<string>"],',
      '  "areasToImprove": ["<string>", "<string>"],',
      '  "top3Actions": ["<string>", "<string>", "<string>"],',
      '  "whatToDoNext": ["<string>", "<string>"],',
      '  "coachingTips": ["<string>", "<string>"],',
      '  "safetyNotes": ["<string>"]',
      "}",
      "",
      "Important:",
      "- If a metric is a TIME (lower is better), treat decreases as improvement.",
      "- Confidence is a number from 0 to 1.",
      "- Keep drills safe: warm-up, progressive loading, stop for pain.",
    ].join("\n");

    const model = "gpt-5-mini";
    const ai = await callOpenAIJsonSchema({
      model,
      system,
      userPayload: payload,
    });

    if (!ai.ok) {
      return NextResponse.json(
        { error: ai.error, details: (ai as any).details ?? null },
        { status: (ai as any).status ?? 502 }
      );
    }

    if (!ai.data) {
      console.log("AI returned empty data:", ai);
      return NextResponse.json(
        { error: "AI returned empty report", details: ai },
        { status: 502 }
      );
    }

    // Unwrap common nesting patterns: { report: {...} } or { report: { report: {...} } }
    let report: any = ai.data;
    if (report && typeof report === "object" && "report" in report) {
      report = (report as any).report;
      if (report && typeof report === "object" && "report" in report) {
        report = (report as any).report;
      }
    }

    console.log("AI report parsed:", report);
    // Save new report to cache
    try {
      await pool.query(
        `INSERT INTO player_ai_analysis
          (player_id, team_id, source_player_evaluation_id, source_player_evaluation_created_at, model, report)
         VALUES
          ($1, $2, $3, $4, $5, $6::jsonb)
         ON CONFLICT (player_id, source_player_evaluation_id, model)
         DO UPDATE SET report = EXCLUDED.report, created_at = CURRENT_TIMESTAMP`,
        [
          playerId,
          teamId,
          latestEvalId,
          latestEvalCreatedAt,
          model,
          JSON.stringify(report),
        ]
      );
    } catch (e) {
      console.error("Failed to cache AI report:", e);
      // Non-fatal: still return the report
    }

    return NextResponse.json(
      { report, cached: false, createdAt: new Date().toISOString() },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("AI player analysis error:", error);
    return NextResponse.json(
      {
        error: "Failed to generate analysis",
        details: error?.message ?? String(error),
      },
      { status: 500 }
    );
  }
}
