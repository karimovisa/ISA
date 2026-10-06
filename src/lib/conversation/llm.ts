// ISA — Conversation Layer · LLM provider (SERVER ONLY — never import client-side)
// The single, replaceable natural-language step. ISA has already done all the
// thinking; this file only turns ISA's findings into prose. The provider is
// Google Gemini (gemini-2.5-flash) via the official @google/genai SDK — swapping
// the model is a config change and never touches ISA's architecture (§19).
//
// The key lives only here, on the server. This file must only be imported by the
// /api/ask route handler.

import { GoogleGenAI } from "@google/genai";
import type { GenerationRequest, ProviderMessage, ProviderName } from "./types";

const MAX_TOKENS = 1024;
// Flash models tried in order. A model that is overloaded (503), out of quota
// (429 — the free tier allows ~20 requests/day PER MODEL) or retired (404) is
// skipped for the next one, so one busy model never silences ISA. GEMINI_MODEL,
// when set, is tried first.
const FALLBACK_MODELS = ["gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.5-flash", "gemini-3-flash-preview"];
const MODELS = [...new Set([process.env.GEMINI_MODEL, ...FALLBACK_MODELS].filter((m): m is string => !!m))];

type GenerateParams = Omit<Parameters<GoogleGenAI["models"]["generateContent"]>[0], "model">;

/** Run one generation, falling through MODELS on a retryable error. */
async function generateWithFallback(ai: GoogleGenAI, params: GenerateParams) {
  let lastError: unknown;
  for (const model of MODELS) {
    try {
      return await ai.models.generateContent({ ...params, model });
    } catch (e) {
      lastError = e;
      const status = (e as { status?: number }).status;
      if (status !== 503 && status !== 429 && status !== 404 && status !== 500) throw e;
    }
  }
  throw lastError;
}

/** Ensure the message list starts with a user turn and alternates cleanly. */
function sanitize(messages: ProviderMessage[]): ProviderMessage[] {
  const trimmed = [...messages];
  while (trimmed.length && trimmed[0].role !== "user") trimmed.shift();
  return trimmed.length ? trimmed : [{ role: "user", content: "(no message)" }];
}

/** Which provider is speaking. Now always Gemini when a key is present; the
 *  request may still ask for "deterministic" to force ISA's own voice. Returns
 *  null when no key is configured (the client then uses ISA's deterministic voice). */
export function resolveProvider(requested?: ProviderName): ProviderName | null {
  if (requested === "deterministic") return null;
  return process.env.GEMINI_API_KEY ? "gemini" : null;
}

/** Reusable Gemini client — built once per server instance. */
let client: GoogleGenAI | null = null;
function gemini(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!client) client = new GoogleGenAI({ apiKey });
  return client;
}

/**
 * Generate the natural-language phrasing of ISA's findings with Gemini. Returns
 * "" when no provider is configured (the client then uses ISA's deterministic
 * voice). The request carries ONLY ISA's computed facts — never a raw data query.
 */
export async function generate(req: GenerationRequest): Promise<string> {
  if (resolveProvider(req.provider) !== "gemini") return "";
  const ai = gemini();
  if (!ai) return "";

  const response = await generateWithFallback(ai, {
    contents: sanitize(req.messages).map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    config: {
      systemInstruction: req.system,
      maxOutputTokens: MAX_TOKENS,
      // ISA only needs Gemini to phrase already-computed facts, so disable the
      // model's own reasoning budget — it keeps the whole token allowance for the
      // answer and matches the fast, deterministic-shaped responses ISA expects.
      thinkingConfig: { thinkingBudget: 0 },
    },
  });

  return (response.text ?? "").trim();
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
  const ai = gemini();
  if (!ai) return [];
  const knownBlock = known.length
    ? known.map((k) => `- ${k.key}: ${k.fact}`).join("\n")
    : "(nothing yet)";
  const transcript = exchange.map((m) => `${m.role === "user" ? "USER" : "ISA"}: ${m.content}`).join("\n");
  const response = await generateWithFallback(ai, {
    contents: [{ role: "user", parts: [{ text: `KNOWN FACTS:\n${knownBlock}\n\nLATEST EXCHANGE:\n${transcript}` }] }],
    config: {
      systemInstruction: LEARN_SYSTEM,
      responseMimeType: "application/json",
      maxOutputTokens: 600,
      thinkingConfig: { thinkingBudget: 0 },
    },
  });
  try {
    const parsed = JSON.parse((response.text ?? "").trim()) as { facts?: Partial<LearnedFact>[] };
    return (parsed.facts ?? [])
      .map((f): LearnedFact => ({
        key: String(f.key ?? "").toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 60),
        fact: String(f.fact ?? "").trim().slice(0, 300),
        importance: f.importance === "high" || f.importance === "low" ? f.importance : "medium",
      }))
      .filter((f) => f.key && f.fact)
      .slice(0, 5);
  } catch {
    return [];
  }
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
 * Ask Gemini to read a free-form message into a create-action ISA can pre-fill.
 * Server-only. Returns null when no provider is configured or on any failure —
 * the caller then falls back to ISA's deterministic detection. Gemini only
 * PROPOSES; the user still confirms before anything is written.
 */
export async function extractAction(message: string): Promise<LlmAction | null> {
  const ai = gemini();
  if (!ai) return null;
  const response = await generateWithFallback(ai, {
    contents: [{ role: "user", parts: [{ text: message }] }],
    config: {
      systemInstruction: ACTION_SYSTEM,
      responseMimeType: "application/json",
      maxOutputTokens: 200,
      thinkingConfig: { thinkingBudget: 0 },
    },
  });
  try {
    const parsed = JSON.parse((response.text ?? "").trim()) as Partial<LlmAction>;
    const kind = parsed.kind;
    if (kind === "task" || kind === "goal" || kind === "habit") {
      const title = String(parsed.title ?? "").trim();
      return title ? { kind, title } : null;
    }
  } catch {
    // non-JSON reply → treat as "no action"
  }
  return null;
}
