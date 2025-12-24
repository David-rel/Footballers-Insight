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

function toStringArray(v: any): string[] | null {
  if (Array.isArray(v)) {
    const arr = v.filter((x) => typeof x === "string") as string[];
    return arr.length ? arr : [];
  }
  if (typeof v === "string" && v.trim()) return [v.trim()];
  return null;
}

function normalizeTeamReport(report: any) {
  if (!report || typeof report !== "object") return null;
  const teamId = report.teamId;
  const teamName = report.teamName;
  const evaluationId = report.evaluationId;
  const evaluationName = report.evaluationName;
  const createdAt = report.createdAt;
  const confidence = report.confidence;
  const quickSummary = report.quickSummary;
  if (
    typeof teamId !== "string" ||
    typeof teamName !== "string" ||
    typeof evaluationId !== "string" ||
    typeof evaluationName !== "string" ||
    typeof createdAt !== "string" ||
    typeof confidence !== "number" ||
    typeof quickSummary !== "string"
  ) {
    return null;
  }

  const teamStrengths = toStringArray(report.teamStrengths) ?? [];
  const biggestGaps = toStringArray(report.biggestGaps) ?? [];
  const top3Priorities = toStringArray(report.top3Priorities) ?? [];
  const coachingNotes = toStringArray(report.coachingNotes) ?? [];
  const safetyNotes = toStringArray(report.safetyNotes) ?? [];

  const rawSpotlights = Array.isArray(report.playerSpotlights)
    ? report.playerSpotlights
    : [];
  const playerSpotlights = rawSpotlights
    .map((p: any) => {
      if (!p || typeof p !== "object") return null;
      const playerName = p.playerName;
      if (typeof playerName !== "string") return null;
      const positives = toStringArray(p.positives) ?? [];
      const watchOuts = toStringArray(p.watchOuts) ?? [];
      return { playerName, positives, watchOuts };
    })
    .filter(Boolean);

  return {
    teamId,
    teamName,
    evaluationId,
    evaluationName,
    createdAt,
    confidence,
    quickSummary,
    teamStrengths,
    biggestGaps,
    top3Priorities,
    playerSpotlights,
    coachingNotes,
    safetyNotes,
  };
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
    name: "team_analysis_report",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        teamId: { type: "string" },
        teamName: { type: "string" },
        evaluationId: { type: "string" },
        evaluationName: { type: "string" },
        createdAt: { type: "string" }, // ISO
        confidence: { type: "number" }, // 0..1
        quickSummary: { type: "string" },
        teamStrengths: {
          type: "array",
          minItems: 3,
          maxItems: 10,
          items: { type: "string" },
        },
        biggestGaps: {
          type: "array",
          minItems: 2,
          maxItems: 10,
          items: { type: "string" },
        },
        top3Priorities: {
          type: "array",
          minItems: 3,
          maxItems: 3,
          items: { type: "string" },
        },
        playerSpotlights: {
          type: "array",
          minItems: 3,
          maxItems: 12,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              playerName: { type: "string" },
              positives: {
                type: "array",
                minItems: 1,
                maxItems: 4,
                items: { type: "string" },
              },
              watchOuts: {
                type: "array",
                minItems: 1,
                maxItems: 4,
                items: { type: "string" },
              },
            },
            required: ["playerName", "positives", "watchOuts"],
          },
        },
        coachingNotes: {
          type: "array",
          minItems: 2,
          maxItems: 10,
          items: { type: "string" },
        },
        safetyNotes: {
          type: "array",
          minItems: 1,
          maxItems: 6,
          items: { type: "string" },
        },
      },
      required: [
        "teamId",
        "teamName",
        "evaluationId",
        "evaluationName",
        "createdAt",
        "confidence",
        "quickSummary",
        "teamStrengths",
        "biggestGaps",
        "top3Priorities",
        "playerSpotlights",
        "coachingNotes",
        "safetyNotes",
      ],
    },
  } as const;

  // Prefer Responses API with json_schema (same approach as player-analysis).
  const responsesReq = {
    model,
    reasoning: { effort: "minimal" },
    text: { verbosity: "low" },
    input: [
      {
        role: "system",
        content: [{ type: "input_text", text: system }],
      },
      {
        role: "user",
        content: [{ type: "input_text", text: JSON.stringify(userPayload) }],
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
    // Fallback to chat.completions for older accounts / gateways (mirrors player-analysis).
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

  // Useful when debugging 502s / empty output
  console.log("OpenAI team-analysis responses raw:", body);

  const tryParseStringJson = (s: unknown) => {
    if (typeof s !== "string") return null;
    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  };

  const fromOutputText = tryParseStringJson(body?.output_text);
  if (fromOutputText) return { ok: true as const, data: fromOutputText };

  const outputs: any[] = Array.isArray(body?.output) ? body.output : [];
  for (const out of outputs) {
    const content: any[] = Array.isArray(out?.content) ? out.content : [];
    for (const c of content) {
      const asText = tryParseStringJson(c?.text);
      if (asText) return { ok: true as const, data: asText };
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

async function getAuthedTeamAccess(sessionUserId: string, teamId: string) {
  const userResult = await pool.query(
    "SELECT role, company_id FROM users WHERE id = $1",
    [sessionUserId]
  );
  if (userResult.rows.length === 0) {
    return { ok: false as const, status: 404, error: "User not found" };
  }
  const userRole = userResult.rows[0].role as string;
  let companyId: string | null = userResult.rows[0].company_id;

  if (userRole === "player" || userRole === "parent") {
    return { ok: false as const, status: 403, error: "Access denied" };
  }

  if (userRole === "owner" && !companyId) {
    const companyResult = await pool.query(
      "SELECT id FROM companies WHERE owner_id = $1",
      [sessionUserId]
    );
    if (companyResult.rows.length > 0) companyId = companyResult.rows[0].id;
  }
  if (!companyId) {
    return { ok: false as const, status: 404, error: "Company not found" };
  }

  const teamRes = await pool.query(
    "SELECT id, name, company_id, coach_id FROM teams WHERE id = $1",
    [teamId]
  );
  if (teamRes.rows.length === 0) {
    return { ok: false as const, status: 404, error: "Team not found" };
  }
  const team = teamRes.rows[0];

  if (userRole === "coach" && team.coach_id !== sessionUserId) {
    return { ok: false as const, status: 403, error: "Access denied" };
  }
  if (userRole !== "coach" && team.company_id !== companyId) {
    return { ok: false as const, status: 403, error: "Access denied" };
  }

  return { ok: true as const, userRole, companyId, team };
}

// Cached-only getter (used by company admins/owners)
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const url = new URL(request.url);
    const teamId = url.searchParams.get("teamId");
    if (!teamId) {
      return NextResponse.json({ error: "Missing teamId" }, { status: 400 });
    }

    const authz = await getAuthedTeamAccess(session.user.id, teamId);
    if (!authz.ok) {
      return NextResponse.json({ error: authz.error }, { status: authz.status });
    }

    // Only admin/owner/company view should rely on this cached endpoint
    if (authz.userRole !== "admin" && authz.userRole !== "owner") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const latestEvalRes = await pool.query(
      `SELECT id, created_at
       FROM evaluations
       WHERE team_id = $1
       ORDER BY created_at DESC NULLS LAST
       LIMIT 1`,
      [teamId]
    );
    const latestEvalId =
      latestEvalRes.rows.length > 0 ? (latestEvalRes.rows[0].id as string) : null;

    const cachedRes = await pool.query(
      `SELECT report, created_at, source_evaluation_id
       FROM team_ai_analysis
       WHERE team_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [teamId]
    );
    if (cachedRes.rows.length === 0) {
      return NextResponse.json(
        {
          error:
            "This team does not have an AI report yet. Ask the coach to open Team AI Analysis to generate it.",
        },
        { status: 404 }
      );
    }

    const cached = cachedRes.rows[0];
    let cachedReport: any = cached.report;
    if (typeof cachedReport === "string") {
      try {
        cachedReport = JSON.parse(cachedReport);
      } catch {}
    }
    const normalized = normalizeTeamReport(cachedReport) ?? cachedReport;
    const stale =
      latestEvalId && cached.source_evaluation_id
        ? String(cached.source_evaluation_id) !== String(latestEvalId)
        : false;

    return NextResponse.json(
      {
        report: normalized,
        cached: true,
        stale,
        createdAt: cached.created_at,
        message: stale
          ? "This team’s AI report is not up to date. Ask the coach to open Team AI Analysis to refresh it."
          : undefined,
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("AI team-analysis GET error:", e);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
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

    const teamId =
      (isObj(payload) && isObj((payload as any).team)
        ? (payload as any).team?.id
        : null) ?? null;

    if (typeof teamId !== "string" || !teamId) {
      return NextResponse.json(
        { error: "Missing team.id in request body" },
        { status: 400 }
      );
    }

    const authz = await getAuthedTeamAccess(session.user.id, teamId);
    if (!authz.ok) {
      return NextResponse.json({ error: authz.error }, { status: authz.status });
    }
    const userRole = authz.userRole as string;
    const companyId = authz.companyId as string;
    const team = authz.team as any;

    // Determine latest evaluation (invalidate cache if new)
    const latestEvalRes = await pool.query(
      `SELECT id, name, created_at
       FROM evaluations
       WHERE team_id = $1
       ORDER BY created_at DESC NULLS LAST
       LIMIT 1`,
      [teamId]
    );
    if (latestEvalRes.rows.length === 0) {
      return NextResponse.json(
        { error: "No evaluations found yet" },
        { status: 404 }
      );
    }
    const latestEvalId = latestEvalRes.rows[0].id as string;
    const latestEvalName =
      (latestEvalRes.rows[0].name as string) || "Evaluation";
    const latestEvalCreatedAt = latestEvalRes.rows[0].created_at as string;

    // Cache lookup
    const cachedRes = await pool.query(
      `SELECT report, created_at, source_evaluation_id
       FROM team_ai_analysis
       WHERE team_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [teamId]
    );
    const cachedRow = cachedRes.rows.length > 0 ? cachedRes.rows[0] : null;
    if (cachedRow) {
      const cachedSourceEvalId = cachedRow.source_evaluation_id as string;
      if (cachedSourceEvalId === latestEvalId) {
        let cachedReport: any = cached.report;
        if (typeof cachedReport === "string") {
          try {
            cachedReport = JSON.parse(cachedReport);
          } catch {
            // ignore
          }
        }
        const normalizedCached = normalizeTeamReport(cachedReport);
        console.log("Team AI report served from cache:", {
          teamId,
          sourceEvaluationId: latestEvalId,
          normalized: !!normalizedCached,
        });
        return NextResponse.json(
          {
            report: normalizedCached ?? cachedReport,
            cached: true,
            createdAt: cachedRow.created_at,
            stale: false,
          },
          { status: 200 }
        );
      }
    }

    // Owners/admins can only VIEW an existing report; they must not generate.
    if (userRole === "owner" || userRole === "admin") {
      if (cachedRow) {
        let cachedReport: any = cachedRow.report;
        if (typeof cachedReport === "string") {
          try {
            cachedReport = JSON.parse(cachedReport);
          } catch {}
        }
        const normalized = normalizeTeamReport(cachedReport) ?? cachedReport;
        return NextResponse.json(
          {
            report: normalized,
            cached: true,
            stale: true,
            createdAt: cachedRow.created_at,
            message:
              "This team’s AI report is not up to date. Ask the coach to open Team AI Analysis to refresh it.",
          },
          { status: 200 }
        );
      }

      return NextResponse.json(
        {
          error:
            "This team does not have an AI report yet. Ask the coach to open Team AI Analysis to generate it.",
        },
        { status: 404 }
      );
    }

    const model = "gpt-5-mini";

    const system = [
      "You are an elite youth football (soccer) coach + sports scientist.",
      "You are writing for a COACH about their TEAM.",
      "Your goal: help the coach improve match performance using the stats as signals.",
      "",
      "CRITICAL RULES:",
      "- Soccer only. Do not talk about other sports.",
      "- These are TESTS, not the objective. Treat them as signals of underlying football qualities.",
      "- Do NOT suggest drills, activities, sessions, workouts, or training plans.",
      "- Do NOT tell them to 'practice the test' or 're-test' or 'do more test reps'.",
      "- Provide coaching logic and ideas: priorities, cues, constraints, focus points, and what to watch for in training/matches.",
      "- If you feel a coach needs specific activities, say they should use the Activity Generator page for activities; keep this report to principles only.",
      "",
      "How to translate tests into football (examples, not extra keys):",
      "- Weak-foot passing metrics → body shape, scanning, passing choice under pressure; encourage weak-foot use in rondos/constraints (no drill plan).",
      "- Agility time → deceleration & turn quality; relate to pressing/1v1 defending and changing direction with/without ball.",
      "- Hop/jump → landing mechanics, unilateral strength balance; relate to first step, duels, cutting.",
      "",
      "OUTPUT MUST BE STRICT JSON ONLY. No extra keys.",
      "EXPECTED JSON (return exactly this shape and only these keys):",
      "{",
      '  "teamId": "<string>",',
      '  "teamName": "<string>",',
      '  "evaluationId": "<string>",',
      '  "evaluationName": "<string>",',
      '  "createdAt": "<ISO timestamp string>",',
      '  "confidence": <number 0..1>,',
      '  "quickSummary": "<short paragraph>",',
      '  "teamStrengths": ["<string>", "<string>", "<string>"],',
      '  "biggestGaps": ["<string>", "<string>"],',
      '  "top3Priorities": ["<string>", "<string>", "<string>"],',
      '  "playerSpotlights": [{"playerName":"<string>","positives":["<string>"],"watchOuts":["<string>"]}],',
      '  "coachingNotes": ["<string>", "<string>"],',
      '  "safetyNotes": ["<string>"]',
      "}",
    ].join("\n");

    // Ensure payload contains stable team/eval identifiers for the model
    const enrichedPayload: any = isObj(payload)
      ? { ...(payload as any) }
      : { payload };
    enrichedPayload.team = {
      ...(isObj((enrichedPayload as any).team)
        ? (enrichedPayload as any).team
        : {}),
      id: teamId,
      name: team.name,
    };
    enrichedPayload.latestEvaluation = {
      id: latestEvalId,
      name: latestEvalName,
      createdAt: latestEvalCreatedAt,
    };

    const ai = await callOpenAIJsonSchema({
      model,
      system,
      userPayload: enrichedPayload as JsonValue,
    });
    if (!ai.ok) {
      return NextResponse.json(
        { error: ai.error, details: (ai as any).details ?? null },
        { status: (ai as any).status ?? 502 }
      );
    }

    let report: any = ai.data;
    if (report && typeof report === "object" && "report" in report) {
      report = (report as any).report;
      if (report && typeof report === "object" && "report" in report) {
        report = (report as any).report;
      }
    }

    // Normalize so the frontend always receives consistent shapes (e.g. safetyNotes array)
    const normalized = normalizeTeamReport(report);
    if (!normalized) {
      console.log("Team AI report failed normalization:", report);
      return NextResponse.json(
        { error: "AI returned an empty or unrecognized report format." },
        { status: 502 }
      );
    }
    report = normalized;
    console.log("Team AI report normalized keys:", Object.keys(report));

    // Cache it (non-fatal if insert fails)
    try {
      await pool.query(
        `INSERT INTO team_ai_analysis
          (team_id, company_id, source_evaluation_id, source_evaluation_created_at, model, report)
         VALUES
          ($1, $2, $3, $4, $5, $6::jsonb)
         ON CONFLICT (team_id, source_evaluation_id, model)
         DO UPDATE SET report = EXCLUDED.report, created_at = CURRENT_TIMESTAMP`,
        [
          teamId,
          companyId,
          latestEvalId,
          latestEvalCreatedAt,
          model,
          JSON.stringify(report),
        ]
      );
    } catch (e) {
      console.error("Failed to cache team AI report:", e);
    }

    return NextResponse.json(
      { report, cached: false, createdAt: new Date().toISOString() },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("AI team analysis error:", e);
    return NextResponse.json(
      {
        error: "Failed to generate analysis",
        details: e?.message ?? String(e),
      },
      { status: 500 }
    );
  }
}
