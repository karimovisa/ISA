// ISA — Conversation Layer · LLM provider (SERVER ONLY — never import client-side)
// The single, replaceable natural-language step. Providers are tried in order:
// Google Gemini (best Uzbek; free tier ≈20 requests/day per model) and then Groq
// (OpenAI-compatible; free tier ≈1,000/day on gpt-oss-120b). A model that is
// overloaded, out of quota or retired is skipped for the next, so ISA keeps
// talking; only when every provider fails does the client fall back to ISA's
// deterministic voice.
//
// Keys live only here, on the server. This file must only be imported by the
// /api/ask route handlers.

import { GoogleGenAI } from "@google/genai";
import type { GenerationRequest, ProviderMessage, ProviderName } from "./types";

const MAX_TOKENS = 1024;
// GEMINI_MODEL, when set, is tried first.
const GEMINI_MODELS = [
  ...new Set(
    [process.env.GEMINI_MODEL, "gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.5-flash", "gemini-3-flash-preview"]
      .filter((m): m is string => !!m)
  ),
];
// Groq retires models often, so the preference list is matched against the live
// /models list (cached) — a retired name is simply skipped, never a hard failure.
const GROQ_PREFERRED = ["openai/gpt-oss-120b", "qwen/qwen3.8-27b", "openai/gpt-oss-20b"];
const GROQ_API = "https://api.groq.com/openai/v1";
const NOT_CHAT = /whisper|tts|guard|safeguard|compound|orpheus|playai|embed/i;
let groqModelsCache: { at: number; ids: string[] } | null = null;

/** The chat models to try, best first: preferred ones that are live, then any
 *  other live chat model as a last resort. */
async function groqModels(apiKey: string): Promise<string[]> {
  if (groqModelsCache && Date.now() - groqModelsCache.at < COOLDOWN_MS) return groqModelsCache.ids;
  try {
    const res = await fetch(`${GROQ_API}/models`, {
      headers: { authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) throw new Error(`models ${res.status}`);
    const live = ((await res.json()) as { data?: { id: string }[] }).data?.map((m) => m.id) ?? [];
    const chat = live.filter((id) => !NOT_CHAT.test(id));
    const ids = [...GROQ_PREFERRED.filter((id) => chat.includes(id)), ...chat.filter((id) => !GROQ_PREFERRED.includes(id))].slice(0, 4);
    groqModelsCache = { at: Date.now(), ids };
    return ids;
  } catch (e) {
    logFail("groq/models", "list", e instanceof Error ? e.message : String(e));
    return GROQ_PREFERRED;
  }
}

/** Reasoning models spend tokens thinking — keep that short and out of the reply. */
function groqReasoning(model: string): Record<string, unknown> {
  if (model.startsWith("openai/gpt-oss")) return { reasoning_effort: "low", include_reasoning: false };
  if (model.startsWith("qwen/")) return { reasoning_format: "hidden" };
  return {};
}

// Errors worth moving on from: overloaded, quota, retired model, transient.
const RETRYABLE = new Set([404, 429, 500, 502, 503]);
// A slow model is treated like a busy one: cap each call, and the whole Gemini
// pass, so the user never waits long before Groq answers instead.
const MODEL_TIMEOUT_MS = 10_000;
const GEMINI_BUDGET_MS = 10_000;
// Models that hit their daily quota (429) or were retired (404) are skipped for
// an hour on this server instance; an overloaded one (503) for two minutes.
const COOLDOWN_MS = 60 * 60 * 1000;
const BUSY_COOLDOWN_MS = 2 * 60 * 1000;
const cooldownUntil = new Map<string, number>();
const coolingDown = (model: string) => (cooldownUntil.get(model) ?? 0) > Date.now();
const coolDown = (model: string, status: number) => {
  if (status === 429 || status === 404) cooldownUntil.set(model, Date.now() + COOLDOWN_MS);
  else if (status === 503) cooldownUntil.set(model, Date.now() + BUSY_COOLDOWN_MS);
};
// One line per failed model in the server logs (never the key or the prompt).
const logFail = (model: string, status: number | string, detail: string) =>
  console.warn(`[isa-llm] ${model} failed: ${status} ${detail.replace(/\s+/g, " ").slice(0, 160)}`);

type Completion = {
  system: string;
  messages: ProviderMessage[];
  maxTokens: number;
  json?: boolean;
};

/** Ensure the message list starts with a user turn and alternates cleanly. */
function sanitize(messages: ProviderMessage[]): ProviderMessage[] {
  const trimmed = [...messages];
  while (trimmed.length && trimmed[0].role !== "user") trimmed.shift();
  return trimmed.length ? trimmed : [{ role: "user", content: "(no message)" }];
}

/** Reusable Gemini client — built once per server instance. */
let client: GoogleGenAI | null = null;
function gemini(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!client) client = new GoogleGenAI({ apiKey });
  return client;
}

async function viaGemini(c: Completion): Promise<string | null> {
  const ai = gemini();
  if (!ai) return null;
  const deadline = Date.now() + GEMINI_BUDGET_MS;
  for (const model of GEMINI_MODELS) {
    if (coolingDown(model)) continue;
    const left = deadline - Date.now();
    if (left < 1_000) break;
    try {
      const response = await ai.models.generateContent({
        model,
        contents: sanitize(c.messages).map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        })),
        config: {
          systemInstruction: c.system,
          maxOutputTokens: c.maxTokens,
          ...(c.json ? { responseMimeType: "application/json" } : {}),
          // Keep the whole token allowance for the answer — fast, direct replies.
          thinkingConfig: { thinkingBudget: 0 },
          abortSignal: AbortSignal.timeout(Math.min(MODEL_TIMEOUT_MS, left)),
        },
      });
      const text = (response.text ?? "").trim();
      if (text) return text;
    } catch (e) {
      const status = (e as { status?: number }).status ?? 0;
      logFail(model, status || "timeout", e instanceof Error ? e.message : String(e));
      coolDown(model, status);
      // A timeout/abort has no status — treat it as busy and move on.
      if (status && !RETRYABLE.has(status)) return null;
    }
  }
  return null;
}

async function viaGroq(c: Completion): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) {
    console.warn("[isa-llm] GROQ_API_KEY is not set");
    return null;
  }
  for (const model of await groqModels(apiKey)) {
    if (coolingDown(model)) continue;
    try {
      const res = await fetch(`${GROQ_API}/chat/completions`, {
        method: "POST",
        signal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          max_tokens: c.maxTokens,
          ...groqReasoning(model),
          messages: [{ role: "system", content: c.system }, ...sanitize(c.messages)],
          ...(c.json ? { response_format: { type: "json_object" } } : {}),
        }),
      });
      if (!res.ok) {
        logFail(model, res.status, await res.text().catch(() => ""));
        coolDown(model, res.status);
        if (res.status === 401 || res.status === 403) return null; // bad key — no model will work
        continue;
      }
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const text = (data.choices?.[0]?.message?.content ?? "").trim();
      if (text) return text;
    } catch (e) {
      // network error or timeout → try the next model
      logFail(model, "network", e instanceof Error ? e.message : String(e));
    }
  }
  return null;
}

/** Run one completion through the provider chain. Null when every provider
 *  failed or none is configured. */
async function complete(c: Completion): Promise<{ text: string; provider: ProviderName } | null> {
  const g = await viaGemini(c);
  if (g) return { text: g, provider: "gemini" };
  const q = await viaGroq(c);
  if (q) return { text: q, provider: "groq" };
  return null;
}

/** Is any model configured? The request may still ask for "deterministic" to
 *  force ISA's own voice. */
export function resolveProvider(requested?: ProviderName): ProviderName | null {
  if (requested === "deterministic") return null;
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.GROQ_API_KEY) return "groq";
  return null;
}

/**
 * Phrase ISA's answer with the first provider that responds. Returns empty text
 * and provider "deterministic" when none is configured or all fail (the client
 * then uses ISA's deterministic voice).
 */
export async function generate(req: GenerationRequest): Promise<{ text: string; provider: ProviderName }> {
  if (!resolveProvider(req.provider)) return { text: "", provider: "deterministic" };
  const out = await complete({ system: req.system, messages: req.messages, maxTokens: MAX_TOKENS });
  return out ?? { text: "", provider: "deterministic" };
}

/** Parse a model's JSON reply, tolerating a ```json fence. */
function parseJson<T>(text: string): T | null {
  try {
    return JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim()) as T;
  } catch {
    return null;
  }
}

export type LearnedFact = { key: string; fact: string; importance: "high" | "medium" | "low" };

const LEARN_SYSTEM = [
  "You maintain ISA's long-term memory about ONE user, built from their chats with ISA (a personal life-OS coach).",
  "Read the latest exchange and return only DURABLE facts about the USER that will help ISA coach them later:",
  "goals and deadlines, exams/studies/work, routines and schedule, preferences, constraints, recurring struggles, decisions, commitments.",
  "Do NOT store: what ISA said, one-off small talk, momentary moods (unless they say it's recurring), or secrets (passwords, card/ID numbers, addresses).",
  "Each fact is ONE short sentence in the user's own language, written about the user (\"Prepares for IELTS, target 7.0 by March\").",
  "Reuse an existing key when the new info updates that fact; otherwise create a short snake_case key (e.g. ielts_goal, wake_time).",
  'Respond with JSON only: {"facts":[{"key":string,"fact":string,"importance":"high"|"medium"|"low"}]}. Return {"facts":[]} when nothing durable was said.',
].join("\n");

/**
 * Read a chat exchange into durable facts about the user. Server-only. Returns []
 * when no provider is configured, nothing is worth keeping, or on any failure.
 */
export async function extractFacts(
  exchange: ProviderMessage[],
  known: { key: string; fact: string }[]
): Promise<LearnedFact[]> {
  const knownBlock = known.length
    ? known.map((k) => `- ${k.key}: ${k.fact}`).join("\n")
    : "(nothing yet)";
  const transcript = exchange.map((m) => `${m.role === "user" ? "USER" : "ISA"}: ${m.content}`).join("\n");
  const out = await complete({
    system: LEARN_SYSTEM,
    messages: [{ role: "user", content: `KNOWN FACTS:\n${knownBlock}\n\nLATEST EXCHANGE:\n${transcript}` }],
    maxTokens: 600,
    json: true,
  });
  const parsed = out ? parseJson<{ facts?: Partial<LearnedFact>[] }>(out.text) : null;
  return (parsed?.facts ?? [])
    .map((f): LearnedFact => ({
      key: String(f.key ?? "").toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 60),
      fact: String(f.fact ?? "").trim().slice(0, 300),
      importance: f.importance === "high" || f.importance === "low" ? f.importance : "medium",
    }))
    .filter((f) => f.key && f.fact)
    .slice(0, 5);
}

export type LlmActionKind = "task" | "goal" | "habit" | "none";
export type LlmAction = { kind: LlmActionKind; title: string };

const ACTION_SYSTEM =
  "You classify a personal-assistant message into ONE thing the user wants to CREATE. " +
  'Respond with JSON only: {"kind": "task"|"goal"|"habit"|"none", "title": string}. ' +
  "kind = 'task' for a one-off to-do or plan, 'goal' for a longer-term objective/target, " +
  "'habit' for something recurring/daily, and 'none' if the message is a question, greeting, " +
  "search, reflection, or anything that is NOT a request to create one of those. " +
  "title = a short clean title in the SAME language as the user, with no leading verb " +
  "(no 'add'/'create'/'qo\\'sh'/'yarat'). If kind is 'none', title is an empty string.";

/**
 * Ask the model to read a free-form message into a create-action ISA can
 * pre-fill. Server-only. Returns null when no provider is configured or on any
 * failure — the caller then falls back to ISA's deterministic detection. The
 * model only PROPOSES; the user still confirms before anything is written.
 */
export async function extractAction(message: string): Promise<LlmAction | null> {
  const out = await complete({
    system: ACTION_SYSTEM,
    messages: [{ role: "user", content: message }],
    maxTokens: 200,
    json: true,
  });
  const parsed = out ? parseJson<Partial<LlmAction>>(out.text) : null;
  const kind = parsed?.kind;
  if (kind === "task" || kind === "goal" || kind === "habit") {
    const title = String(parsed?.title ?? "").trim();
    return title ? { kind, title } : null;
  }
  return null;
}
