// ISA — Conversation Layer · Conversation memory (§14)
// The LLM never owns memory. When a conversation produces something worth
// carrying forward (a reflection, a decision, a plan), ISA writes a compact,
// consolidated note into the Memory Engine — deduped by subject, never a
// transcript, never anything sensitive. Trivial chat is deliberately forgotten.

import { remember } from "@/lib/memory";
import { invalidateContext } from "@/lib/intelligence";
import type { IntentKind, IsaAnswer } from "./types";

// Only these intents leave a durable trace — everything else fades (calm memory).
const WORTH_REMEMBERING: ReadonlySet<IntentKind> = new Set(["reflection", "decision", "planning"]);

/**
 * Persist a light note about a meaningful conversation. Consolidates on the
 * intent so repeats evolve one row instead of piling up. No-op for trivial turns.
 */
export async function noteConversation(userMessage: string, answer: IsaAnswer): Promise<boolean> {
  if (!WORTH_REMEMBERING.has(answer.intent)) return false;
  const subject = `chat:${answer.intent}`;
  const ok = await remember({
    memory_type: "conversation",
    subject_key: subject,
    title: answer.headline,
    summary: `You asked: "${userMessage.slice(0, 120)}". ISA: ${answer.headline}`,
    importance: "low",
    tags: ["conversation", answer.intent],
    data: { lastAsked: new Date().toISOString(), claim: answer.claim },
  });
  if (ok) invalidateContext();
  return ok !== null;
}
