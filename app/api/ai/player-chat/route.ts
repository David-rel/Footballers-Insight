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

function extractOutputText(body: any): string | null {
  if (typeof body?.output_text === "string" && body.output_text.trim()) {
    return body.output_text.trim();
  }
  if (typeof body?.summary_text === "string" && body.summary_text.trim()) {
    return body.summary_text.trim();
  }
  const outputs: any[] = Array.isArray(body?.output) ? body.output : [];
  for (const out of outputs) {
    const content: any[] = Array.isArray(out?.content) ? out.content : [];
    for (const c of content) {
      if (typeof c?.text === "string" && c.text.trim()) return c.text.trim();
      // Some shapes have nested text blocks
      if (c?.type === "output_text" && typeof c?.text === "string") {
        if (c.text.trim()) return c.text.trim();
      }
      // Newer shapes may nest text as { text: { value: "..." } }
      const nestedValue =
        typeof c?.text?.value === "string" ? (c.text.value as string) : null;
      if (nestedValue && nestedValue.trim()) return nestedValue.trim();
      if (c?.type === "summary_text") {
        if (typeof c?.text === "string" && c.text.trim()) return c.text.trim();
        if (nestedValue && nestedValue.trim()) return nestedValue.trim();
      }
    }
  }
  return null;
}

async function postResponses(apiKey: string, reqBody: any) {
  const r = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(reqBody),
  });

  const bodyText = await r.text();
  let body: any = null;
  try {
    body = JSON.parse(bodyText);
  } catch {
    body = { raw: bodyText };
  }

  return { r, body };
}

async function callOpenAIChat({
  model,
  system,
  messageText,
  previousResponseId,
}: {
  model: string;
  system: string;
  messageText: string;
  previousResponseId?: string | null;
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      ok: false as const,
      status: 500,
      error: "OPENAI_API_KEY is not set",
    };
  }

  const reqBody: any = {
    model,
    // Keep chat responses short by default (avoid essay mode).
    // If you want longer answers later, we can make this dynamic per user request.
    max_output_tokens: 420,
    // Reduce "essay mode" tendencies + token waste.
    reasoning: { effort: "minimal" },
    text: { verbosity: "low" },
    input: [
      {
        role: "system",
        content: [{ type: "input_text", text: system }],
      },
      {
        role: "user",
        content: [{ type: "input_text", text: messageText }],
      },
    ],
  };

  if (previousResponseId) {
    reqBody.previous_response_id = previousResponseId;
  }

  const { r, body } = await postResponses(apiKey, reqBody);

  if (!r.ok) {
    return {
      ok: false as const,
      status: 502,
      error:
        (isObj(body) && typeof (body as any)?.error === "object"
          ? (body as any)?.error?.message
          : null) || `OpenAI request failed (${r.status})`,
      details: body,
    };
  }

  const text = extractOutputText(body);
  if (!text) {
    // Sometimes when max_output_tokens is reached, the envelope is "incomplete"
    // and output_text may be missing. In that case, do a quick continuation with
    // strict brevity so the user still gets a usable chat reply.
    if (
      body?.status === "incomplete" &&
      body?.incomplete_details?.reason === "max_output_tokens" &&
      typeof body?.id === "string"
    ) {
      const followReq: any = {
        model,
        max_output_tokens: 220,
        reasoning: { effort: "minimal" },
        text: { verbosity: "low" },
        previous_response_id: body.id,
        input: [
          {
            role: "system",
            content: [{ type: "input_text", text: system }],
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: "Finish your last answer in 3–6 short bullets. No long paragraphs, no repeats.",
              },
            ],
          },
        ],
      };

      const { r: r2, body: body2 } = await postResponses(apiKey, followReq);
      if (r2.ok) {
        const t2 = extractOutputText(body2);
        if (t2) {
          return {
            ok: true as const,
            data: {
              responseId: typeof body2?.id === "string" ? body2.id : body.id,
              text: t2,
              raw: body2,
            },
          };
        }
      }
    }

    return {
      ok: false as const,
      status: 502,
      error: "OpenAI response missing output_text",
      details: body,
    };
  }

  return {
    ok: true as const,
    data: {
      responseId: typeof body?.id === "string" ? body.id : null,
      text,
      raw: body,
    },
  };
}

async function authorizePlayerAccess(sessionUserId: string, playerId: string) {
  const userResult = await pool.query(
    "SELECT role, company_id FROM users WHERE id = $1",
    [sessionUserId]
  );
  if (userResult.rows.length === 0) {
    return { ok: false as const, status: 404, error: "User not found" };
  }
  const userRole = userResult.rows[0].role as string;
  let companyId: string | null = userResult.rows[0].company_id;

  if (userRole === "owner" && !companyId) {
    const companyResult = await pool.query(
      "SELECT id FROM companies WHERE owner_id = $1",
      [sessionUserId]
    );
    if (companyResult.rows.length > 0) companyId = companyResult.rows[0].id;
  }

  const playerRes = await pool.query(
    "SELECT id, team_id, parent_user_id FROM players WHERE id = $1",
    [playerId]
  );
  if (playerRes.rows.length === 0) {
    return { ok: false as const, status: 404, error: "Player not found" };
  }
  const teamId = playerRes.rows[0].team_id as string;
  const parentUserId = playerRes.rows[0].parent_user_id as string;

  if (
    (userRole === "parent" || userRole === "player") &&
    parentUserId !== sessionUserId
  ) {
    return { ok: false as const, status: 403, error: "Access denied" };
  }

  if (userRole === "coach" || userRole === "owner" || userRole === "admin") {
    const teamRes = await pool.query(
      "SELECT company_id, coach_id FROM teams WHERE id = $1",
      [teamId]
    );
    if (teamRes.rows.length === 0) {
      return { ok: false as const, status: 404, error: "Team not found" };
    }
    const team = teamRes.rows[0];
    if (userRole === "coach" && team.coach_id !== sessionUserId) {
      return { ok: false as const, status: 403, error: "Access denied" };
    }
    if (userRole !== "coach") {
      if (!companyId || team.company_id !== companyId) {
        return { ok: false as const, status: 403, error: "Access denied" };
      }
    }
  }

  return { ok: true as const, userRole, teamId };
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const url = new URL(request.url);
    const playerId = url.searchParams.get("playerId");
    const threadId = url.searchParams.get("threadId");

    if (!playerId) {
      return NextResponse.json({ error: "Missing playerId" }, { status: 400 });
    }

    const authz = await authorizePlayerAccess(session.user.id, playerId);
    if (!authz.ok) {
      return NextResponse.json(
        { error: authz.error },
        { status: authz.status }
      );
    }

    if (threadId) {
      const threadRes = await pool.query(
        `SELECT id, player_id, user_id, messages, last_response_id, updated_at
         FROM player_ai_chat_threads
         WHERE id = $1`,
        [threadId]
      );
      if (threadRes.rows.length === 0) {
        return NextResponse.json(
          { error: "Chat thread not found" },
          { status: 404 }
        );
      }
      const t = threadRes.rows[0];
      if (t.user_id !== session.user.id || t.player_id !== playerId) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
      return NextResponse.json(
        {
          threadId: t.id,
          messages: Array.isArray(t.messages) ? t.messages : [],
          hasMemory: !!t.last_response_id,
          updatedAt: t.updated_at,
        },
        { status: 200 }
      );
    }

    // Load latest thread for this user+player (lets us "verify memory" / resume)
    const latestRes = await pool.query(
      `SELECT id, messages, last_response_id, updated_at
       FROM player_ai_chat_threads
       WHERE player_id = $1 AND user_id = $2
       ORDER BY updated_at DESC
       LIMIT 1`,
      [playerId, session.user.id]
    );
    if (latestRes.rows.length === 0) {
      return NextResponse.json(
        { threadId: null, messages: [], hasMemory: false },
        { status: 200 }
      );
    }
    const t = latestRes.rows[0];
    return NextResponse.json(
      {
        threadId: t.id,
        messages: Array.isArray(t.messages) ? t.messages : [],
        hasMemory: !!t.last_response_id,
        updatedAt: t.updated_at,
      },
      { status: 200 }
    );
  } catch (e) {
    console.error("AI player chat GET error:", e);
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

    const body = (await request.json().catch(() => null)) as {
      playerId?: string;
      threadId?: string | null;
      message?: string;
      context?: JsonValue;
    } | null;

    const playerId = body?.playerId;
    const threadId = body?.threadId ?? null;
    const message = body?.message;
    const context = body?.context ?? null;

    if (typeof playerId !== "string" || !playerId) {
      return NextResponse.json({ error: "Missing playerId" }, { status: 400 });
    }
    if (typeof message !== "string" || !message.trim()) {
      return NextResponse.json({ error: "Missing message" }, { status: 400 });
    }

    const authz = await authorizePlayerAccess(session.user.id, playerId);
    if (!authz.ok) {
      return NextResponse.json(
        { error: authz.error },
        { status: authz.status }
      );
    }

    const model = "gpt-5-mini";
    const system = [
      "You are an elite youth football (soccer) coach + sports scientist.",
      "You are chatting with a PLAYER/PARENT about their soccer stats.",
      "",
      "CRITICAL:",
      "- These are TESTS, not the objective. Treat them as signals of real football qualities.",
      "- Do NOT say 'practice the test' or 're-test' or 'do more test reps'.",
      "- Explain what the metric likely means on the pitch, then give small actions/tips (principles, cues, focus points).",
      "- Do NOT create drills, activities, sessions, or training plans. Do not ask the user to do drills.",
      "- If the user explicitly asks for drills/activities/specific sessions, reply: 'For specific activities, please use the Activity Generator page — this chat is only for ideas and coaching logic.' Then give brief principles/cues only.",
      "- Soccer only. Do NOT talk about other sports. If asked about other sports, steer back to soccer.",
      "- You are in CHAT MODE: keep replies short and back-and-forth.",
      "- Default length: 3–8 short lines OR up to 6 bullets. No long paragraphs.",
      "- Ask at most ONE clarifying question at the end when helpful.",
      "- Only write longer explanations if the user explicitly asks for detail (e.g. 'go deep', 'explain more').",
      "",
      "Style:",
      "- Talk like a human coach. Short paragraphs, occasional bullet points.",
      "- Keep suggestions safe: warm-up, progress gradually, stop for pain.",
    ].join("\n");

    const nowIso = new Date().toISOString();

    // Load / create thread
    if (threadId) {
      const threadRes = await pool.query(
        `SELECT id, player_id, user_id, team_id, model, last_response_id, messages
         FROM player_ai_chat_threads
         WHERE id = $1`,
        [threadId]
      );
      if (threadRes.rows.length === 0) {
        return NextResponse.json(
          { error: "Chat thread not found" },
          { status: 404 }
        );
      }
      const t = threadRes.rows[0];
      if (t.user_id !== session.user.id || t.player_id !== playerId) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }

      const prevId =
        typeof t.last_response_id === "string" ? t.last_response_id : null;
      const ai = await callOpenAIChat({
        model,
        system,
        messageText: message.trim(),
        previousResponseId: prevId,
      });
      if (!ai.ok) {
        console.error("Player chat OpenAI error:", ai);
        return NextResponse.json(
          { error: "Failed to chat" },
          { status: ai.status ?? 502 }
        );
      }

      const assistantText = ai.data.text;
      const nextResponseId = ai.data.responseId;

      const priorMessages: any[] = Array.isArray(t.messages) ? t.messages : [];
      const nextMessages = [
        ...priorMessages,
        {
          id: `u-${nowIso}`,
          role: "user",
          text: message.trim(),
          createdAt: nowIso,
        },
        {
          id: `a-${nowIso}`,
          role: "assistant",
          text: assistantText,
          createdAt: nowIso,
        },
      ];

      await pool.query(
        `UPDATE player_ai_chat_threads
         SET last_response_id = $1,
             messages = $2::jsonb
         WHERE id = $3`,
        [nextResponseId, JSON.stringify(nextMessages), threadId]
      );

      return NextResponse.json(
        {
          threadId,
          assistant: assistantText,
          messages: nextMessages,
          hasMemory: !!nextResponseId,
        },
        { status: 200 }
      );
    }

    // First message: include context once
    const initialMessageText =
      context != null
        ? [
            "PLAYER CONTEXT (JSON):",
            JSON.stringify(context),
            "",
            "USER QUESTION:",
            message.trim(),
          ].join("\n")
        : message.trim();

    // Create thread row first
    const createRes = await pool.query(
      `INSERT INTO player_ai_chat_threads (player_id, team_id, user_id, model, context, messages)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb)
       RETURNING id`,
      [
        playerId,
        authz.teamId,
        session.user.id,
        model,
        JSON.stringify(context ?? {}),
        JSON.stringify([
          {
            id: `u-${nowIso}`,
            role: "user",
            text: message.trim(),
            createdAt: nowIso,
          },
        ]),
      ]
    );
    const newThreadId = createRes.rows[0].id as string;

    const ai = await callOpenAIChat({
      model,
      system,
      messageText: initialMessageText,
      previousResponseId: null,
    });
    if (!ai.ok) {
      console.error("Player chat OpenAI error:", ai);
      return NextResponse.json(
        { error: "Failed to chat" },
        { status: ai.status ?? 502 }
      );
    }

    const assistantText = ai.data.text;
    const responseId = ai.data.responseId;
    const firstMessages = [
      {
        id: `u-${nowIso}`,
        role: "user",
        text: message.trim(),
        createdAt: nowIso,
      },
      {
        id: `a-${nowIso}`,
        role: "assistant",
        text: assistantText,
        createdAt: nowIso,
      },
    ];

    await pool.query(
      `UPDATE player_ai_chat_threads
       SET last_response_id = $1,
           messages = $2::jsonb
       WHERE id = $3`,
      [responseId, JSON.stringify(firstMessages), newThreadId]
    );

    return NextResponse.json(
      {
        threadId: newThreadId,
        assistant: assistantText,
        messages: firstMessages,
        hasMemory: !!responseId,
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("AI player chat error:", e);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
