// ISA — Conversation Layer · Response Composer
// Builds the strict prompt the (optional) LLM sees, and assembles the final turn.
// The system prompt hands the LLM ISA's computed facts as its ONLY source and
// forbids invention — the model may rephrase, never add. When no model runs,
// ISA's own deterministic `draft` is the answer verbatim.

import type {
  AskResult,
  ConversationTurn,
  GenerationRequest,
  IsaAnswer,
  ProviderMessage,
  ProviderName,
} from "./types";

/** ISA's permanent voice + the hard anti-fabrication contract. */
const PERSONA = `You are ISA — a calm, honest, understanding companion inside a Life Operating System.
You speak like a thoughtful friend who knows this person well: warm, specific, brief, never dramatic, never a hype-man, never judgmental. No exclamation spam, no emoji unless the user uses them.

CRITICAL RULES — these override everything:
- You do NOT think, remember, analyze, predict, or decide. ISA already did all of that. Your ONLY job is to phrase ISA's findings in natural language.
- Use ONLY the facts in "ISA'S FINDINGS" below. Never invent, infer, or embellish a number, date, memory, pattern, prediction, score, or event. If a fact isn't there, don't state it.
- If the findings are thin, say so plainly ("I don't have enough history yet") rather than filling the gap.
- Keep it to a few sentences. Say the one thing that matters. Lead with the answer.
- Never claim you took an action. Actions require the user's explicit confirmation in the app.`;

/** Serialize ISA's answer into the immutable source block for the model. */
function findingsBlock(answer: IsaAnswer): string {
  const parts: string[] = [`HEADLINE: ${answer.headline}`, `CLAIM TYPE: ${answer.claim}`, `CONFIDENCE: ${answer.confidence.toFixed(2)}`];
  for (const s of answer.sections) {
    if (!s.lines.length) continue;
    parts.push(`\n${s.heading || "DETAILS"}:`);
    for (const l of s.lines) parts.push(`- ${l}`);
  }
  if (answer.action) parts.push(`\nPENDING ACTION (needs user confirmation, do NOT claim it's done): ${answer.action.summary}`);
  if (answer.followUps.length) parts.push(`\nPOSSIBLE FOLLOW-UPS: ${answer.followUps.join(" | ")}`);
  return parts.join("\n");
}

/** Build the full generation request: persona+rules+findings as system, the
 *  conversation as messages. */
export function buildGenerationRequest(
  answer: IsaAnswer,
  history: ProviderMessage[],
  userMessage: string,
  provider?: ProviderName
): GenerationRequest {
  const system = `${PERSONA}\n\n=== ISA'S FINDINGS (your only source of truth) ===\n${findingsBlock(answer)}`;
  const messages: ProviderMessage[] = [...history.slice(-8), { role: "user", content: userMessage }];
  return { system, messages, provider };
}

let turnSeq = 0;
const nextId = () => `turn-${Date.now()}-${turnSeq++}`;

/** Assemble the assistant turn from ISA's answer and whoever phrased it. */
export function composeTurn(answer: IsaAnswer, spokenText: string, spokenBy: ProviderName): AskResult {
  const text = spokenText.trim() || answer.draft;
  const turn: ConversationTurn = {
    id: nextId(),
    role: "assistant",
    text,
    at: new Date().toISOString(),
    answer,
  };
  return { answer, turn, spokenBy };
}

/** The deterministic voice — ISA's own words, used when no model is connected. */
export function deterministicText(answer: IsaAnswer): string {
  return answer.draft;
}
