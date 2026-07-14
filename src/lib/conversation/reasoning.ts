// ISA — Conversation Layer · Reasoning (the "ISA thinks" step)
// Routes an intent to the ALREADY-BUILT intelligence (subsystem #5) + Memory,
// Insights and Reviews, and assembles a fully-grounded IsaAnswer. This is where
// the real answer is computed — deterministically, with evidence. The LLM only
// ever rephrases what this produces; it never adds a fact.

import type { IntelligenceContext } from "@/lib/intelligence";
import {
  computeAllScores,
  computePriorities,
  generateRecommendations,
  generateOpportunities,
  confidentPredictions,
  predictionsByModule,
  dailyCoach,
  moduleCoach,
  buildWeeklyBrief,
  buildMonthlyBrief,
  buildDailyBrief,
  answerQuery,
  moduleLabel,
  deepLink,
} from "@/lib/intelligence";
import type { EvidenceRef } from "@/lib/intelligence";
import { canUse } from "@/lib/entitlements";
import { detectAction } from "./actions";
import { resolveNavigation } from "./navigation";
import type { AnswerSection, IntentResult, IsaAnswer } from "./types";

const sec = (heading: string, lines: string[], evidence: EvidenceRef[] = []): AnswerSection => ({
  heading,
  lines: lines.filter(Boolean),
  evidence,
});

function shell(
  intent: IntentResult,
  headline: string,
  sections: AnswerSection[],
  opts: Partial<IsaAnswer> = {}
): IsaAnswer {
  const evidence = opts.evidence ?? sections.flatMap((s) => s.evidence).slice(0, 8);
  const draft =
    opts.draft ??
    [headline, "", ...sections.flatMap((s) => [s.heading ? `${s.heading}:` : "", ...s.lines.map((l) => `• ${l}`), ""])]
      .join("\n")
      .trim();
  return {
    intent: intent.primary,
    headline,
    draft,
    sections,
    followUps: opts.followUps ?? [],
    action: opts.action ?? null,
    navigation: opts.navigation ?? null,
    confidence: opts.confidence ?? intent.confidence,
    evidence,
    claim: opts.claim ?? "pattern",
  };
}

/** The reasoning entry point. Async because semantic search may touch Memory. */
export async function reason(
  ctx: IntelligenceContext,
  intent: IntentResult,
  message: string
): Promise<IsaAnswer> {
  switch (intent.primary) {
    case "navigate":
      return navigateAnswer(intent, message);
    case "create":
    case "update":
    case "complete":
    case "delete":
    case "archive":
      return actionAnswer(intent, message);
    case "search":
      return await searchAnswer(ctx, intent, message);
    case "reflection":
      return reflectionAnswer(ctx, intent);
    case "review":
      return reviewAnswer(ctx, intent);
    case "summarize":
      return summarizeAnswer(ctx, intent);
    case "forecast":
      return forecastAnswer(ctx, intent);
    case "decision":
      return decisionAnswer(ctx, intent, message);
    case "coach":
      return coachAnswer(ctx, intent);
    case "planning":
      return planningAnswer(ctx, intent, message);
    case "compare":
      return summarizeAnswer(ctx, intent);
    case "smalltalk":
      return smalltalkAnswer(ctx, intent);
    case "question":
    default:
      return questionAnswer(ctx, intent);
  }
}

// ── individual routers ──

function navigateAnswer(intent: IntentResult, message: string): IsaAnswer {
  const nav = resolveNavigation(message);
  if (!nav) return shell(intent, "Which part of ISA would you like to open?", [], { claim: "fact" });
  return shell(
    intent,
    `Opening ${nav.label}.`,
    [sec("", [`Taking you to ${nav.label}.`])],
    { navigation: nav, claim: "fact", confidence: 0.9 }
  );
}

function actionAnswer(intent: IntentResult, message: string): IsaAnswer {
  const proposal = detectAction(message, intent);
  if (!proposal) {
    return shell(intent, "I can log expenses, runs, goals, habits and reminders — what would you like to record?", [], {
      claim: "fact",
    });
  }
  return shell(
    intent,
    proposal.summary,
    [sec("Before I do this", [proposal.summary, ...proposal.warnings], [])],
    { action: proposal, claim: "recommendation", confidence: 0.8 }
  );
}

async function searchAnswer(ctx: IntelligenceContext, intent: IntentResult, message: string): Promise<IsaAnswer> {
  const ans = await answerQuery(ctx, message);
  const lines = ans.results.slice(0, 8).map((r) => `${r.title}${r.occurredAt ? ` — ${r.occurredAt.slice(0, 10)}` : ""}${r.detail ? ` (${r.detail})` : ""}`);
  return shell(
    intent,
    ans.headline,
    [sec("Found", lines.length ? lines : ["Nothing matching yet."], ans.explanation.evidence)],
    { claim: "fact", confidence: ans.explanation.confidence, evidence: ans.explanation.evidence }
  );
}

function reflectionAnswer(ctx: IntelligenceContext, intent: IntentResult): IsaAnswer {
  const monthly = buildMonthlyBrief(ctx);
  const lines = [
    ...monthly.growth.slice(0, 3),
    ...monthly.breakthroughs.slice(0, 3).map((b) => `Milestone: ${b}`),
  ];
  const balance = monthly.balance ? `Life balance sits at ${monthly.balance.value}/100.` : "";
  return shell(
    intent,
    "Here's how you've been moving lately.",
    [
      sec("Growth", lines.length ? lines : ["It's a little early to reflect deeply — a few more weeks will show the arc."]),
      sec("Where things sit", [balance].filter(Boolean)),
    ],
    { claim: "pattern", confidence: monthly.explanation.confidence, evidence: monthly.explanation.evidence, followUps: ["What should I focus on next month?", "Show my biggest win this year"] }
  );
}

function reviewAnswer(ctx: IntelligenceContext, intent: IntentResult): IsaAnswer {
  const weekly = buildWeeklyBrief(ctx);
  const lines = [
    weekly.biggestWin ? `Biggest win: ${weekly.biggestWin}` : "",
    weekly.biggestChallenge ? `Biggest challenge: ${weekly.biggestChallenge}` : "",
    weekly.mostImproved ? `Most improved: ${weekly.mostImproved}` : "",
    weekly.recommendationSummary,
  ];
  return shell(
    intent,
    `Your week (${weekly.periodKey}).`,
    [sec("The week in brief", lines), sec("By area", Object.values(weekly.summaries))],
    { claim: "pattern", confidence: weekly.explanation.confidence, evidence: weekly.explanation.evidence }
  );
}

function summarizeAnswer(ctx: IntelligenceContext, intent: IntentResult): IsaAnswer {
  const scores = computeAllScores(ctx).filter((s) => s.confidence >= 0.3);
  const lines = scores.map((s) => `${s.label}: ${s.value}/100 (${s.trend})`);
  const priorities = computePriorities(ctx).slice(0, 3).map((p) => `${p.title} — ${p.reason}`);
  return shell(
    intent,
    "Your life at a glance.",
    [
      sec("Health scores", lines.length ? lines : ["Not enough history yet to score your areas."]),
      sec("What matters now", priorities),
    ],
    { claim: "pattern", evidence: scores.flatMap((s) => s.explanation.evidence).slice(0, 6), followUps: ["What's my biggest risk right now?", "What should I do today?"] }
  );
}

/** Pro-only answers must not leak through the chat surface. */
function upgradeAnswer(intent: IntentResult, what: string): IsaAnswer {
  return shell(
    intent,
    `${what} — ISA Pro'da.`,
    [sec("", [`Bu javob kelajakka qaraydi, shuning uchun u Pro'da. Bugungi holatingizni bepul ko'rishda davom etasiz.`])],
    { claim: "fact", confidence: 1 }
  );
}

function forecastAnswer(ctx: IntelligenceContext, intent: IntentResult): IsaAnswer {
  if (!canUse(ctx.entitlements, "ai_predictions")) return upgradeAnswer(intent, "Bashoratlar");
  const mod = intent.entities.module;
  const preds = (mod ? predictionsByModule(ctx, mod) : confidentPredictions(ctx)).slice(0, 5);
  if (!preds.length) {
    return shell(intent, "I don't have enough history for an honest forecast yet.", [
      sec("", ["A couple more weeks of activity and I'll be able to look ahead."]),
    ], { claim: "assumption", confidence: 0.3 });
  }
  const lines = preds.map((p) => `${p.title}: ${p.outlook}${p.probability != null ? ` (~${Math.round(p.probability * 100)}%, ${p.risk} risk)` : ""}`);
  return shell(
    intent,
    "Here's where things are trending.",
    [sec("Forecast", lines, preds.flatMap((p) => p.explanation.evidence).slice(0, 6))],
    { claim: "pattern", confidence: Math.max(...preds.map((p) => p.confidence)), evidence: preds.flatMap((p) => p.explanation.evidence).slice(0, 6) }
  );
}

function decisionAnswer(ctx: IntelligenceContext, intent: IntentResult, message: string): IsaAnswer {
  // Consult money, goals, predictions, recommendations, recovery — then present
  // the considerations. ISA advises; the human decides (never a hard "yes/no").
  const recs = generateRecommendations(ctx).slice(0, 2);
  const risks = confidentPredictions(ctx).filter((p) => p.risk === "high").slice(0, 2);
  const restful = /\brest|break|today off\b/i.test(message);
  const scores = computeAllScores(ctx);
  const recovery = scores.find((s) => s.key === "recovery");

  const considerations: string[] = [];
  if (restful && recovery && recovery.confidence >= 0.4) {
    considerations.push(
      recovery.value < 45
        ? `Your recovery is low (${recovery.value}/100) — resting is well justified today.`
        : `Your recovery looks okay (${recovery.value}/100), so it's a genuine choice rather than a need.`
    );
  }
  for (const r of recs) considerations.push(`${r.title}: ${r.reason}`);
  for (const p of risks) considerations.push(`Watch: ${p.outlook}`);

  return shell(
    intent,
    "Here's what I'd weigh — the call is yours.",
    [sec("Worth considering", considerations.length ? considerations : ["I don't have a strong signal either way; trust your read here."])],
    { claim: "recommendation", confidence: 0.7, evidence: recs.flatMap((r) => r.explanation.evidence).slice(0, 5), followUps: ["What's my top priority today?"] }
  );
}

function coachAnswer(ctx: IntelligenceContext, intent: IntentResult): IsaAnswer {
  if (!canUse(ctx.entitlements, "ai_coach")) return upgradeAnswer(intent, "AI Coach");
  const coach = dailyCoach(ctx);
  const lines = [coach.message, coach.suggestion ?? ""].filter(Boolean);
  return shell(
    intent,
    coach.headline,
    [sec("", lines)],
    { claim: "recommendation", confidence: coach.explanation.confidence, evidence: coach.explanation.evidence, navigation: coach.action ? { module: coach.module, deepLink: coach.action.deepLink, label: moduleLabel(coach.module) } : null }
  );
}

function planningAnswer(ctx: IntelligenceContext, intent: IntentResult, message: string): IsaAnswer {
  // A grounded, honest starter plan from the person's real state — not a fantasy
  // schedule. It proposes steps the user turns into goals/habits themselves.
  const daysMatch = message.match(/(\d+)\s*days?/i);
  const horizon = daysMatch ? `${daysMatch[1]} days` : "the next few weeks";
  const mod = intent.entities.module;
  const rec = generateRecommendations(ctx).find((r) => !mod || r.module === mod) ?? generateRecommendations(ctx)[0];
  const opp = generateOpportunities(ctx)[0];

  const steps = [
    `Set a clear goal for ${horizon}${intent.entities.topic ? ` around ${intent.entities.topic}` : ""}.`,
    "Break it into a daily habit you can hold on your heaviest days, not just your best ones.",
    rec ? `Address the weak spot first: ${rec.title.toLowerCase()}.` : "",
    opp ? `Lean on your current strength: ${opp.title.toLowerCase()}.` : "",
    "Check in weekly — I'll flag drift before it costs you.",
  ];
  return shell(
    intent,
    `A starting plan for ${horizon}.`,
    [sec("Steps", steps)],
    { claim: "recommendation", confidence: 0.65, evidence: rec ? rec.explanation.evidence : [], followUps: ["Create the goal for this", "Set a daily habit"] }
  );
}

function questionAnswer(ctx: IntelligenceContext, intent: IntentResult): IsaAnswer {
  // Module-scoped question → that module's coach/score; else the daily picture.
  const mod = intent.entities.module;
  if (mod) {
    const mc = moduleCoach(ctx, mod);
    if (mc) {
      return shell(intent, mc.headline, [sec("", [mc.message, mc.suggestion ?? ""].filter(Boolean))], {
        claim: "pattern",
        confidence: mc.explanation.confidence,
        evidence: mc.explanation.evidence,
        navigation: { module: mod, deepLink: deepLink(mod), label: moduleLabel(mod) },
      });
    }
  }
  const brief = buildDailyBrief(ctx);
  const lines = [
    brief.headline,
    ...brief.priorities.slice(0, 3).map((p) => `${p.title} — ${p.reason}`),
  ];
  return shell(
    intent,
    brief.greeting,
    [sec("Today", lines), ...(brief.wins.length ? [sec("Wins today", brief.wins)] : [])],
    { claim: "pattern", confidence: brief.explanation.confidence, evidence: brief.explanation.evidence, followUps: ["What's my biggest risk?", "How's my money?", "Should I rest today?"] }
  );
}

function smalltalkAnswer(ctx: IntelligenceContext, intent: IntentResult): IsaAnswer {
  const coach = dailyCoach(ctx);
  return shell(intent, coach.headline, [sec("", [coach.message])], {
    claim: "fact",
    confidence: 0.6,
    followUps: ["What should I focus on today?"],
  });
}
