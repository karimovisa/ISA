// ISA — Tasks & Habits V2, Phase 4 (AI). Deeper, natural-language habit insight
// (§10). ISA computes the facts deterministically; Gemini only PHRASES them — the
// request carries findings, never a raw data query — and any failure or missing
// key falls back to ISA's own deterministic voice. Pro-gated by the caller.

import { speakViaServer } from "@/lib/conversation/provider";

const SYSTEM =
  "You are ISA, a calm, premium personal life OS. You are given already-computed facts " +
  "about ONE of the user's habits. Reply with ONE short insight or gentle suggestion: " +
  "one to two sentences, about 30 words maximum, specific to these facts, speaking directly " +
  "to the user as 'you'. No greeting, no emoji, no lists, no clichés like 'keep it up' or " +
  "'great job'. If a clear time-of-day pattern exists you may suggest acting on it. If progress " +
  "is strong, name the specific number. Never invent facts beyond those given.";

export type HabitInsight = { text: string; ai: boolean };

/** Phrase ISA's findings with the model; on any failure return the deterministic
 *  fallback ISA already computed. Never throws. */
export async function aiInsight(facts: string, fallback: string): Promise<HabitInsight> {
  const { text } = await speakViaServer({ system: SYSTEM, messages: [{ role: "user", content: facts }] });
  const clean = text.trim();
  return clean ? { text: clean, ai: true } : { text: fallback, ai: false };
}
