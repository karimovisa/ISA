// ISA — Conversation & Action Layer · Shared contract (subsystem #6)
// ISA thinks first, then speaks. Every conversation flows through ISA's own
// deterministic intelligence (intent → context → reasoning → answer); the LLM is
// the LAST step and only turns ISA's computed facts into natural language. These
// shapes carry the thought BEFORE any words exist, so the layer works end-to-end
// even with no model connected.

import type { EvidenceRef, IntelModule } from "@/lib/intelligence";

// ─────────────────────────── INTENT ───────────────────────────

/** Every intent the engine recognises. Resolution is deterministic — no LLM. */
export type IntentKind =
  | "question" // "how am I doing?"
  | "search" // "find every journal about IELTS"
  | "reflection" // "how have I grown this year?"
  | "planning" // "help me prepare IELTS in 60 days"
  | "decision" // "should I rest today?"
  | "coach" // "I feel lazy"
  | "create" // "create a goal to save 3M" / "I spent 50,000"
  | "update" // "mark reading done"
  | "complete"
  | "delete"
  | "archive"
  | "summarize" // "summarize my week"
  | "review" // "show last week's review"
  | "compare"
  | "forecast" // "will I hit my goal?"
  | "navigate" // "open money"
  | "smalltalk"; // greetings / thanks — answered briefly, no machinery

/** A value pulled out of the message deterministically (regex/keyword). */
export type ExtractedEntities = {
  amount?: number; // money, in so'm
  distanceKm?: number; // running
  durationMin?: number;
  timeOfDay?: string; // "08:00"
  date?: string; // YYYY-MM-DD
  module?: IntelModule;
  category?: string; // money / habit category
  title?: string; // goal / habit / project title
  everyDay?: boolean; // recurrence hint
  topic?: string; // free-text subject for search/reflection
};

export type IntentResult = {
  primary: IntentKind;
  all: IntentKind[]; // when several fire, ranked; the engine resolves conflicts
  confidence: number; // 0..1
  entities: ExtractedEntities;
  reason: string; // why this intent (explainable)
};

// ─────────────────────────── ISA'S ANSWER (pre-language) ───────────────────────────

/** One structured piece of what ISA has decided to say. The composer/LLM turns
 *  these into prose; nothing here is invented — each traces to real records. */
export type AnswerSection = {
  heading: string;
  lines: string[]; // plain facts, already computed by ISA
  evidence: EvidenceRef[];
};

/** The complete, source-grounded result of ISA thinking about one message. The
 *  LLM may ONLY rephrase `draft`/`sections`; it may not add facts. */
export type IsaAnswer = {
  intent: IntentKind;
  headline: string; // the one-line answer
  draft: string; // a complete, deterministic natural-language answer (LLM-free fallback)
  sections: AnswerSection[];
  followUps: string[]; // suggested next questions, grounded in what ISA knows
  action: ActionProposal | null; // set when the message asks ISA to DO something
  navigation: { module: IntelModule; deepLink: string; label: string } | null;
  confidence: number;
  evidence: EvidenceRef[];
  claim: "fact" | "pattern" | "assumption" | "recommendation";
};

// ─────────────────────────── ACTIONS ───────────────────────────

/** The concrete things conversation can DO. Each maps to an existing module +
 *  a Life Event — the LLM never writes; ISA does, through the real module path. */
export type ActionKind =
  | "log_expense"
  | "log_income"
  | "create_goal"
  | "create_habit"
  | "set_reminder"
  | "log_run";

/** A proposed write, awaiting explicit user confirmation (never auto-executed). */
export type ActionProposal = {
  kind: ActionKind;
  summary: string; // "Log a 50,000 so'm Food expense today?"
  fields: Record<string, unknown>; // validated, ready-to-write values
  module: IntelModule;
  confirmLabel: string; // "Log expense"
  warnings: string[]; // anything the user should notice before confirming
};

export type ActionResult = {
  ok: boolean;
  kind: ActionKind;
  message: string; // "Logged. Your Food total this month is now …" (facts only)
  createdId: string | null;
  eventCaptured: boolean;
  error: string | null;
};

// ─────────────────────────── TURNS & PROVIDER ───────────────────────────

export type Role = "user" | "assistant";

export type ConversationTurn = {
  id: string;
  role: Role;
  text: string;
  at: string; // ISO
  answer?: IsaAnswer; // present on assistant turns ISA reasoned
};

/** The minimal message shape any LLM provider receives. The provider gets ISA's
 *  facts as its ONLY source and is instructed never to add anything. */
export type ProviderMessage = { role: Role; content: string };

export type ProviderName = "claude" | "openai" | "gemini" | "deterministic";

/** What the composer hands the (optional) LLM: a strict system prompt built from
 *  ISA's answer, plus the conversation. */
export type GenerationRequest = {
  system: string;
  messages: ProviderMessage[];
  provider?: ProviderName;
};

/** The full result of asking ISA one thing. */
export type AskResult = {
  answer: IsaAnswer;
  turn: ConversationTurn;
  spokenBy: ProviderName; // "deterministic" when no model phrased it
};
