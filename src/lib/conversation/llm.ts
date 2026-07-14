// ISA — Conversation Layer · LLM providers (SERVER ONLY — never import client-side)
// The single, replaceable natural-language step. ISA has already done all the
// thinking; these functions only turn ISA's findings into prose. Provider is
// chosen by env so the deployment can swap Claude ↔ GPT ↔ Gemini ↔ a local model
// without touching ISA's architecture (§19). No SDK dependency — plain HTTP keeps
// the abstraction genuinely provider-agnostic.
//
// Keys live only here, on the server. This file must only be imported by the
// /api/ask route handler.

import type { GenerationRequest, ProviderMessage, ProviderName } from "./types";

const MAX_TOKENS = 1024;

/** Ensure the message list starts with a user turn and alternates cleanly. */
function sanitize(messages: ProviderMessage[]): ProviderMessage[] {
  const trimmed = [...messages];
  while (trimmed.length && trimmed[0].role !== "user") trimmed.shift();
  return trimmed.length ? trimmed : [{ role: "user", content: "(no message)" }];
}

/** Which provider to use: explicit request → env → whichever key is present. */
export function resolveProvider(requested?: ProviderName): ProviderName | null {
  const pick = requested ?? (process.env.LLM_PROVIDER as ProviderName | undefined);
  if (pick && pick !== "deterministic") return pick;
  if (process.env.ANTHROPIC_API_KEY) return "claude";
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.GEMINI_API_KEY) return "gemini";
  return null;
}

async function callClaude(req: GenerationRequest): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return "";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8",
      max_tokens: MAX_TOKENS,
      system: req.system,
      messages: sanitize(req.messages),
    }),
  });
  if (!res.ok) throw new Error(`claude ${res.status}`);
  const data = (await res.json()) as { content?: { type: string; text?: string }[] };
  return (data.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join("").trim();
}

async function callOpenAICompatible(req: GenerationRequest): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return "";
  const base = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      max_tokens: MAX_TOKENS,
      messages: [{ role: "system", content: req.system }, ...sanitize(req.messages)],
    }),
  });
  if (!res.ok) throw new Error(`openai ${res.status}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return (data.choices?.[0]?.message?.content ?? "").trim();
}

async function callGemini(req: GenerationRequest): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return "";
  const model = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: req.system }] },
        contents: sanitize(req.messages).map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        })),
        generationConfig: { maxOutputTokens: MAX_TOKENS },
      }),
    }
  );
  if (!res.ok) throw new Error(`gemini ${res.status}`);
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  return (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("").trim();
}

/**
 * Generate the natural-language phrasing of ISA's findings. Returns "" when no
 * provider is configured (the client then uses ISA's deterministic voice).
 */
export async function generate(req: GenerationRequest): Promise<string> {
  const provider = resolveProvider(req.provider);
  if (!provider) return "";
  switch (provider) {
    case "claude":
      return callClaude(req);
    case "openai":
      return callOpenAICompatible(req);
    case "gemini":
      return callGemini(req);
    default:
      return "";
  }
}
