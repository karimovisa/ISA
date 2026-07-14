// ISA — Conversation Layer · Orchestrator (the pipeline, §GLOBAL ARCHITECTURE)
//   User message → Intent → Context → Reasoning (ISA thinks) → Compose → LLM (last)
// The LLM is optional and last: if it's unavailable or off, ISA speaks its own
// deterministic answer. Everything up to composition is pure ISA intelligence.

import { loadIntelligenceContext } from "@/lib/intelligence";
import { detectIntent } from "./intent";
import { reason } from "./reasoning";
import { buildGenerationRequest, composeTurn } from "./compose";
import { speakViaServer } from "./provider";
import type { AskResult, ConversationTurn, ProviderMessage } from "./types";

export type AskOptions = {
  /** Allow the optional LLM phrasing step (Pro). When false, ISA speaks its own
   *  deterministic words. Defaults to true. */
  allowLLM?: boolean;
  /** Force fresh context instead of the 60s cache (e.g. right after an action). */
  fresh?: boolean;
};

const toProviderMessages = (history: ConversationTurn[]): ProviderMessage[] =>
  history.filter((t) => t.text.trim()).map((t) => ({ role: t.role, content: t.text }));

/** ISA answers one message. Never throws — always returns something to say. */
export async function ask(
  message: string,
  history: ConversationTurn[] = [],
  opts: AskOptions = {}
): Promise<AskResult> {
  const intent = detectIntent(message);
  const ctx = await loadIntelligenceContext({ force: opts.fresh });
  const answer = await reason(ctx, intent, message);

  // Pure navigation / action-confirmation turns don't need a model — they're
  // exact by construction, and phrasing them risks drift.
  const needsPhrasing =
    opts.allowLLM !== false && !answer.navigation && !(answer.action && answer.sections.length <= 1);

  if (needsPhrasing) {
    const req = buildGenerationRequest(answer, toProviderMessages(history), message);
    const { text, provider } = await speakViaServer(req);
    if (text) return composeTurn(answer, text, provider ?? "claude");
  }
  return composeTurn(answer, answer.draft, "deterministic");
}

/** Build the user turn to append to history before calling ask(). */
let seq = 0;
export function userTurn(text: string): ConversationTurn {
  return { id: `u-${Date.now()}-${seq++}`, role: "user", text, at: new Date().toISOString() };
}
