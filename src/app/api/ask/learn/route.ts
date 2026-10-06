// ISA — Conversation Layer · /api/ask/learn (Gemini fact extraction, server-only)
// After a chat exchange, Gemini reads it into a few DURABLE facts about the user
// (goals, routines, constraints…) which consolidate into ai_memory as
// memory_type='user_fact' — one evolving row per key, never the transcript. ISA
// then hands these facts to the model on every later answer, so it knows the user.
// Auth-gated; writes only the caller's own rows.

import { adminClient } from "@/lib/strava";
import { extractFacts } from "@/lib/conversation/llm";
import type { ProviderMessage } from "@/lib/conversation/types";

export const dynamic = "force-dynamic";

const MAX_FACTS = 80; // per user — beyond this only updates to existing keys land
const SCORE = { high: 0.75, medium: 0.5, low: 0.25 } as const;

function isExchange(v: unknown): v is ProviderMessage[] {
  return (
    Array.isArray(v) &&
    v.length > 0 &&
    v.length <= 6 &&
    v.every(
      (m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.length <= 4000
    )
  );
}

export async function POST(request: Request) {
  const jwt = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!jwt) return new Response("unauthorized", { status: 401 });

  const admin = adminClient();
  const {
    data: { user },
  } = await admin.auth.getUser(jwt);
  if (!user) return new Response("unauthorized", { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response("bad request", { status: 400 });
  }
  const exchange = (body as { messages?: unknown } | null)?.messages;
  if (!isExchange(exchange)) return new Response("bad request", { status: 400 });

  try {
    const { data: rows } = await admin
      .from("ai_memory")
      .select("subject_key,summary")
      .eq("user_id", user.id)
      .eq("memory_type", "user_fact")
      .neq("status", "archived")
      .limit(MAX_FACTS);
    const known = ((rows as { subject_key: string; summary: string }[] | null) ?? []).map((r) => ({
      key: r.subject_key,
      fact: r.summary,
    }));
    const knownKeys = new Set(known.map((k) => k.key));

    const facts = (await extractFacts(exchange, known)).filter(
      (f) => knownKeys.has(f.key) || known.length < MAX_FACTS
    );
    if (!facts.length) return Response.json({ learned: 0 });

    const now = new Date().toISOString();
    await admin.from("ai_memory").upsert(
      facts.map((f) => ({
        user_id: user.id,
        memory_type: "user_fact",
        subject_key: f.key,
        title: f.key.replace(/_/g, " "),
        summary: f.fact,
        importance: f.importance,
        importance_score: SCORE[f.importance],
        status: "active",
        tags: ["conversation"],
        source_module: "conversation",
        last_event_at: now,
        data: { learnedAt: now },
        updated_at: now,
      })),
      { onConflict: "user_id,memory_type,subject_key" }
    );
    return Response.json({ learned: facts.length });
  } catch {
    // Learning is best-effort — a failure never affects the chat itself.
    return Response.json({ learned: 0 });
  }
}
