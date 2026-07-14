// ISA — Conversation Layer · Intent Engine (§9, deterministic)
// Classifies a message into one primary intent (plus any secondary ones), with a
// reason. No model call — pattern rules over the message and the entities pulled
// from it. When several intents fire, a fixed precedence resolves the conflict
// (an explicit action beats a question beats small talk).

import { extractEntities } from "./entities";
import type { IntentKind, IntentResult } from "./types";

type Rule = { kind: IntentKind; re: RegExp; weight: number };

// Order matters only for readability; precedence is applied explicitly below.
const RULES: Rule[] = [
  // Actions (create/write) — highest intent to DO something.
  { kind: "create", re: /\b(create|add|make|new|log|record)\b/i, weight: 3 },
  { kind: "create", re: /\bi (spent|paid|ran|saved|earned|jogged)\b/i, weight: 4 },
  { kind: "create", re: /\bremind me\b/i, weight: 4 },
  { kind: "complete", re: /\b(mark|complete|finish|done)\b/i, weight: 3 },
  { kind: "update", re: /\b(update|change|edit|rename|set)\b/i, weight: 2 },
  { kind: "delete", re: /\b(delete|remove)\b/i, weight: 3 },
  { kind: "archive", re: /\barchive\b/i, weight: 3 },
  // Navigation.
  { kind: "navigate", re: /\b(open|go to|show me|take me to|navigate)\b/i, weight: 3 },
  // Reflection / review / summary.
  { kind: "reflection", re: /\b(how (have|did) i (grow|change|do)|this year|proud of|looking back)\b/i, weight: 3 },
  { kind: "review", re: /\b(review|recap)\b/i, weight: 2 },
  { kind: "summarize", re: /\b(summar(y|ize|ise)|tl;?dr|overview of)\b/i, weight: 2 },
  { kind: "compare", re: /\b(compare|versus|vs\.?|better than|difference between)\b/i, weight: 2 },
  // Foresight.
  { kind: "forecast", re: /\b(will i|am i going to|forecast|predict|on track|reach my|by the deadline)\b/i, weight: 3 },
  // Decisions.
  { kind: "decision", re: /\bshould i\b|\b(is it worth|better to|or should)\b/i, weight: 3 },
  // Coaching / emotional.
  { kind: "coach", re: /\bi (feel|am feeling|'m feeling)\b|\b(lazy|stressed|unmotivated|burned out|tired|overwhelmed|stuck|anxious)\b/i, weight: 3 },
  // Search.
  { kind: "search", re: /\b(find|search|show all|list all|every|when did i|when was i)\b/i, weight: 2 },
  // Planning.
  { kind: "planning", re: /\b(help me (plan|prepare)|plan my|prepare (my|for)|routine|in \d+ days)\b/i, weight: 3 },
  // Small talk.
  { kind: "smalltalk", re: /^(hi|hey|hello|thanks|thank you|good (morning|evening|night)|salom)\b/i, weight: 2 },
  // Generic question (lowest — the fallback).
  { kind: "question", re: /\b(how|what|why|when|where|who|which|do i|can you|tell me)\b|\?$/i, weight: 1 },
];

// Higher = wins when scores tie. Doing/going somewhere beats asking.
const PRECEDENCE: Record<IntentKind, number> = {
  create: 10,
  complete: 9,
  delete: 9,
  archive: 8,
  update: 8,
  navigate: 7,
  planning: 6,
  forecast: 6,
  decision: 6,
  coach: 6,
  reflection: 5,
  review: 5,
  compare: 5,
  summarize: 4,
  search: 4,
  smalltalk: 2,
  question: 1,
} as Record<IntentKind, number>;

/** Classify a message. Always returns a result (falls back to "question"). */
export function detectIntent(message: string): IntentResult {
  const entities = extractEntities(message);
  const scores = new Map<IntentKind, number>();
  const reasons: string[] = [];

  for (const r of RULES) {
    if (r.re.test(message)) {
      scores.set(r.kind, (scores.get(r.kind) ?? 0) + r.weight);
    }
  }

  // Entity nudges — a bare "50,000 food" is a create even without a verb.
  if (entities.amount != null || entities.distanceKm != null) {
    scores.set("create", (scores.get("create") ?? 0) + 2);
    reasons.push("a loggable value is present");
  }

  if (scores.size === 0) {
    return {
      primary: "question",
      all: ["question"],
      confidence: 0.4,
      entities,
      reason: "no strong signal — treating as a general question",
    };
  }

  const ranked = [...scores.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return (PRECEDENCE[b[0]] ?? 0) - (PRECEDENCE[a[0]] ?? 0);
  });

  const [primary, topScore] = ranked[0];
  const total = ranked.reduce((s, [, v]) => s + v, 0);
  reasons.unshift(`matched "${primary}" strongest`);
  return {
    primary,
    all: ranked.map(([k]) => k),
    confidence: Math.min(0.95, topScore / (total + 1) + 0.4),
    entities,
    reason: reasons.join("; "),
  };
}
