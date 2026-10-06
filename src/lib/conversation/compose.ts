// ISA — Conversation Layer · Response Composer
// Builds the prompt the (optional) LLM sees, and assembles the final turn.
// The system prompt hands the LLM what ISA knows about the user plus ISA's
// computed findings; the model may reason and advise from them but never invent
// data. When no model runs, ISA's own deterministic `draft` is the answer verbatim.

import type {
  AskResult,
  ConversationTurn,
  GenerationRequest,
  IsaAnswer,
  ProviderMessage,
  ProviderName,
} from "./types";

/** ISA's permanent voice + the hard anti-fabrication contract. */
const PERSONA = `You are ISA — a calm, honest, understanding coach inside a Life Operating System.
You speak like a thoughtful friend who knows this person well: warm, specific, brief, never dramatic, never a hype-man, never judgmental. No exclamation spam, no emoji unless the user uses them.

HOW YOU THINK:
- Reason from three sources only: "WHAT YOU KNOW ABOUT THE USER" (facts they told you in earlier chats), "ISA'S FINDINGS" (computed from their data), and this conversation.
- Connect them: interpret what the facts mean for this person, weigh trade-offs, and give ONE concrete, specific recommendation they can act on today.
- Use what you know about them naturally (their goals, routines, constraints) — that is what makes advice personal. Don't recite the list back.

HARD RULES — these override everything:
- Never invent a number, date, event, streak, score or memory that is not in those sources. Reasoning and advice are welcome; fabricated data is not.
- If the data is thin, say so plainly and ask one short question that would help, instead of filling the gap.
- Keep it to a few sentences. Lead with the answer.
- Never claim you took an action. Actions require the user's explicit confirmation in the app.
- Reply in the language of the user's latest message (Uzbek, Russian or English).`;

/** Serialize ISA's answer into the immutable source block for the model. */
function findingsBlock(answer: IsaAnswer): string {
  const parts: string[] = [`HEADLINE: ${answer.headline}`, `CLAIM TYPE: ${answer.claim}`, `CONFIDENCE: ${answer.confidence.toFixed(2)}`];
  for (const s of answer.sections) {
    if (!s.lines.length) continue;
    parts.push(`\n${s.heading || "DETAILS"}:`);
    for (const l of s.lines) parts.push(`- ${l}`);
  }
  if (answer.action) parts.push(`\nPENDING ACTION (a template the user must confirm — do NOT claim it's done): ${answer.action.headline}`);
  if (answer.followUps.length) parts.push(`\nPOSSIBLE FOLLOW-UPS: ${answer.followUps.join(" | ")}`);
  return parts.join("\n");
}

/** Build the full generation request: persona+rules+user facts+findings as
 *  system, the conversation as messages. */
export function buildGenerationRequest(
  answer: IsaAnswer,
  history: ProviderMessage[],
  userMessage: string,
  userFacts: string[] = [],
  provider?: ProviderName
): GenerationRequest {
  const knows = userFacts.length ? userFacts.map((f) => `- ${f}`).join("\n") : "(nothing yet — you are still getting to know them)";
  const system =
    `${PERSONA}\n\nTODAY: ${new Date().toDateString()}` +
    `\n\n=== WHAT YOU KNOW ABOUT THE USER (from earlier chats) ===\n${knows}` +
    `\n\n=== ISA'S FINDINGS (computed from their data) ===\n${findingsBlock(answer)}`;
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
