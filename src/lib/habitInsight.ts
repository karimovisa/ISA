// ISA — Tasks & Habits V2, Phase 4 (AI). Deeper, natural-language habit insight
// (§10). ISA computes the facts deterministically; Gemini only PHRASES them — the
// request carries findings, never a raw data query — and any failure or missing
// key falls back to ISA's own deterministic voice. Pro-gated by the caller.

import { speakViaServer } from "@/lib/conversation/provider";

const LANG_NAME: Record<string, string> = { en: "English", uz: "Uzbek", ru: "Russian" };

/** ISA's analysis voice: phrase the findings, never invent. */
function systemFor(lang: string): string {
  return [
    "You are ISA's analysis voice. You do NOT have the user's raw data — ISA already computed the facts and handed you a short FINDINGS block. Your only job is to PHRASE those findings; never invent, estimate, or add a fact that isn't in the block.",
    "",
    "OUTPUT: 2–3 sentences, in the shape observation → what it means → one concrete action. Lead with the finding, not a greeting.",
    "",
    "RULES:",
    "- If a finding links two signals (a time-of-day or week-over-week pattern), lead with it — it's the most valuable insight.",
    "- Surface ONE insight and ONE action. Never list.",
    "- If the findings are thin or say data is insufficient, say so plainly ('Not enough data yet to see a pattern.'). Do not fabricate a trend.",
    "- Calm and direct, never alarmist. Never shame a missed day or a broken streak — frame forward ('You missed yesterday — you showed up today.').",
    "- No preamble, no filler, no 'As an AI', no greeting. Interpret, don't report: don't restate a raw number unless the number IS the point.",
    `- Respond in ${LANG_NAME[lang] ?? "English"}.`,
  ].join("\n");
}

export type HabitInsight = { text: string; ai: boolean };

/** Phrase ISA's findings with the model; on any failure return the deterministic
 *  fallback ISA already computed. Never throws. */
export async function aiInsight(facts: string, fallback: string, lang = "en"): Promise<HabitInsight> {
  const { text } = await speakViaServer({ system: systemFor(lang), messages: [{ role: "user", content: facts }] });
  const clean = text.trim();
  return clean ? { text: clean, ai: true } : { text: fallback, ai: false };
}
