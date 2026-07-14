// ISA — Intelligence Layer · Semantic Intelligence (§13, NL search without an LLM)
// Answers questions like "when was I happiest?", "show all education expenses",
// "what breaks my streak?" — by parsing intent deterministically and querying
// the Memory Engine, Life Timeline and Insights. No model, no network; every
// answer is traceable to real records. A future Conversation Layer can call this
// instead of rebuilding retrieval.

import type { SourceModule } from "@/lib/life-events";
import type { IntelligenceContext } from "./context";
import { toIntelModule } from "./context";
import { search as memorySearch } from "@/lib/memory";
import { explain, memoryEvidence, timelineEvidence, insightEvidence, patternEvidence } from "./explain";
import type { SemanticAnswer, SemanticIntent, SemanticResult } from "./types";

const has = (q: string, ...words: string[]) => words.some((w) => q.includes(w));

/** Map a raw question to a structured intent. Deterministic keyword routing. */
export function parseIntent(query: string): SemanticIntent {
  const q = query.toLowerCase();
  if (has(q, "happiest", "happy", "best mood", "most joy")) return "happiest";
  if (has(q, "saddest", "lowest", "worst mood", "down")) return "saddest";
  if (has(q, "productive", "most done", "focused most")) return "most_productive";
  if (has(q, "least productive", "unproductive", "distracted")) return "least_productive";
  if (has(q, "expense", "spent", "spending", "cost", "bought")) return "expenses";
  if (has(q, "streak", "break", "broke", "missed")) return "streak_breakers";
  if (has(q, "focus", "concentrat", "deep work")) return "focus_boosters";
  if (has(q, "when", "timeline", "history", "happened")) return "timeline";
  return "general";
}

/** Extract a topic qualifier after the intent word ("education" in "education
 *  expenses") for narrowing results. */
function topicFilter(query: string): string | null {
  const q = query.toLowerCase();
  const m = q.match(/(?:all|my|on|about|for)\s+([a-z]{3,})\s+(?:expense|spend|goal|habit)/);
  if (m) return m[1];
  const words = q.replace(/[?.,]/g, "").split(/\s+/).filter((w) => w.length > 3);
  const stop = new Set(["when", "show", "what", "which", "were", "most", "were", "have", "that", "this", "expenses", "expense", "productive"]);
  return words.find((w) => !stop.has(w)) ?? null;
}

const toResult = {
  memory: (m: Parameters<typeof memoryEvidence>[0]): SemanticResult => ({
    title: m.title,
    detail: m.summary || `${m.occurrence_count} occurrences`,
    occurredAt: m.last_event_at,
    module: toIntelModule((m.source_module as SourceModule) || "system"),
    ref: memoryEvidence(m),
  }),
};

/**
 * Answer a natural-language question over the already-loaded context. For broad
 * "general" queries it also runs a Memory keyword search. Returns a structured,
 * evidence-bearing answer — never a fabricated sentence.
 */
export async function answerQuery(ctx: IntelligenceContext, query: string): Promise<SemanticAnswer> {
  const intent = parseIntent(query);
  const topic = topicFilter(query);
  let results: SemanticResult[] = [];
  let headline = "";

  switch (intent) {
    case "happiest":
    case "most_productive": {
      const wins = ctx.timeline
        .filter((t) => t.importance === "pivotal" || t.importance === "significant")
        .slice(0, 6);
      results = wins.map((t) => ({
        title: t.title,
        detail: t.category,
        occurredAt: t.occurred_at,
        module: null,
        ref: timelineEvidence(t),
      }));
      headline = wins.length ? "Your strongest moments, most recent first." : "Not enough pivotal moments logged yet.";
      break;
    }
    case "saddest":
    case "least_productive": {
      const lows = ctx.insights.filter((i) => i.valence === "negative").slice(0, 6);
      results = lows.map((i) => ({
        title: i.title,
        detail: i.detail,
        occurredAt: i.created_at,
        module: null,
        ref: insightEvidence(i),
      }));
      headline = lows.length ? "The harder patterns your data shows." : "No difficult patterns stand out right now.";
      break;
    }
    case "expenses": {
      let money = ctx.memories.filter((m) => m.source_module === "money");
      if (topic) money = money.filter((m) => `${m.title} ${m.summary}`.toLowerCase().includes(topic));
      results = money.slice(0, 10).map(toResult.memory);
      headline = topic
        ? results.length
          ? `Money memories related to "${topic}".`
          : `No money records mention "${topic}" yet.`
        : "Your most significant money memories.";
      break;
    }
    case "streak_breakers": {
      const breakers = ctx.insights.filter(
        (i) => i.valence === "negative" && /streak|habit|miss/i.test(`${i.title} ${i.detail} ${i.subject_key}`)
      );
      results = breakers.slice(0, 8).map((i) => ({
        title: i.title,
        detail: i.detail,
        occurredAt: i.created_at,
        module: "habits",
        ref: insightEvidence(i),
      }));
      headline = breakers.length ? "What tends to break your consistency." : "No clear streak-breaker pattern yet.";
      break;
    }
    case "focus_boosters": {
      const boosters = ctx.insights.filter(
        (i) => (i.insight_type === "correlation" || i.valence === "positive") && /focus|sleep|energy|morning/i.test(`${i.title} ${i.detail}`)
      );
      results = boosters.slice(0, 8).map((i) => ({
        title: i.title,
        detail: i.detail,
        occurredAt: i.created_at,
        module: "focus",
        ref: insightEvidence(i),
      }));
      headline = boosters.length ? "What tends to lift your focus." : "Not enough focus data to say yet.";
      break;
    }
    case "timeline": {
      let entries = ctx.timeline;
      if (topic) entries = entries.filter((t) => `${t.title} ${t.category}`.toLowerCase().includes(topic));
      results = entries.slice(0, 10).map((t) => ({
        title: t.title,
        detail: t.category,
        occurredAt: t.occurred_at,
        module: null,
        ref: timelineEvidence(t),
      }));
      headline = results.length ? "From your life timeline." : "Nothing on the timeline matches that yet.";
      break;
    }
    default: {
      const mems = await memorySearch(query, 12);
      const scoped = topic ? mems.filter((m) => `${m.title} ${m.summary}`.toLowerCase().includes(topic)) : mems;
      results = (scoped.length ? scoped : mems).slice(0, 10).map(toResult.memory);
      headline = results.length ? "What your memory holds on that." : "I don't have memories matching that yet.";
    }
  }

  return {
    query,
    intent,
    headline,
    results,
    explanation: explain({
      why: `Interpreted as "${intent}"${topic ? ` about "${topic}"` : ""}; answered from your own records.`,
      claim: "fact",
      evidence: results.length ? results.slice(0, 3).map((r) => r.ref) : [patternEvidence("semantic search", intent)],
      confidence: results.length ? 0.8 : 0.4,
    }),
  };
}
