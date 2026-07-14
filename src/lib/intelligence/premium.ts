// ISA — Intelligence Layer · Premium gating (Premium Blueprint §10)
// "Free gives you a better-run life. Pro gives you a more-understood life."
// Present-tense intelligence (scores, daily/weekly briefs, recommendations that
// reflect what IS) stays free. Future-tense intelligence — prediction, proactive
// coaching, monthly/yearly foresight, deep synthesis, NL search — is Pro.
// Gating is a thin wrapper: the engines always compute honestly; this decides
// whether the RESULT is handed over, and never cripples the free tier.

import { canUse } from "@/lib/entitlements";
import type { FeatureKey } from "@/lib/entitlements";
import type { IntelligenceContext } from "./context";
import { generatePredictions, confidentPredictions } from "./predictions";
import { dailyCoach, coachCandidates } from "./coach";
import { buildMonthlyBrief } from "./monthly";
import { crossModuleLinks } from "./crossModule";
import { answerQuery } from "./semantic";
import type {
  CoachMessage,
  CrossModuleLink,
  MonthlyBrief,
  Prediction,
  SemanticAnswer,
} from "./types";

/** A feature-gated result. When `allowed` is false, `data` is null and the
 *  caller shows a calm upgrade hint (never a broken or half-shown feature). */
export type Gated<T> = {
  allowed: boolean;
  feature: FeatureKey;
  upgradeHint: string;
  data: T | null;
};

function gate<T>(ctx: IntelligenceContext, feature: FeatureKey, hint: string, produce: () => T): Gated<T> {
  const allowed = canUse(ctx.entitlements, feature);
  return { allowed, feature, upgradeHint: hint, data: allowed ? produce() : null };
}

/** Foresight — Pro. The honest "future-tense" layer. */
export function premiumPredictions(ctx: IntelligenceContext): Gated<Prediction[]> {
  return gate(ctx, "ai_predictions", "Predictions look ahead — where your goals, spending and habits are trending.", () =>
    confidentPredictions(ctx)
  );
}

/** All forecasts including honestly-flagged cold-start ones — Pro. */
export function premiumAllPredictions(ctx: IntelligenceContext): Gated<Prediction[]> {
  return gate(ctx, "ai_predictions", "Predictions look ahead across every domain.", () => generatePredictions(ctx));
}

/** Proactive, timed coaching — Pro. (The single daily message.) */
export function premiumCoach(ctx: IntelligenceContext): Gated<CoachMessage> {
  return gate(ctx, "ai_coach", "The coach speaks at the right moment — encouraging, specific, never pushy.", () =>
    dailyCoach(ctx)
  );
}

/** Every coach candidate for the moment — Pro. */
export function premiumCoachCandidates(ctx: IntelligenceContext): Gated<CoachMessage[]> {
  return gate(ctx, "ai_coach", "Personalised coaching across your modules.", () => coachCandidates(ctx));
}

/** Monthly foresight & season read — Pro. */
export function premiumMonthly(ctx: IntelligenceContext): Gated<MonthlyBrief> {
  return gate(ctx, "monthly_review", "The monthly view shows your season — growth, plateaus and breakthroughs.", () =>
    buildMonthlyBrief(ctx)
  );
}

/** Deep cross-life synthesis — Pro. */
export function premiumCrossModule(ctx: IntelligenceContext): Gated<CrossModuleLink[]> {
  return gate(ctx, "deep_analytics", "Deep analytics connect your domains — how sleep, focus, money and goals move together.", () =>
    crossModuleLinks(ctx)
  );
}

/** Natural-language search over your life — Pro. Async (may touch Memory). */
export async function premiumSearch(ctx: IntelligenceContext, query: string): Promise<Gated<SemanticAnswer>> {
  const allowed = canUse(ctx.entitlements, "nl_search");
  return {
    allowed,
    feature: "nl_search",
    upgradeHint: "Ask your life questions in plain language — \"when was I happiest?\", \"education expenses\".",
    data: allowed ? await answerQuery(ctx, query) : null,
  };
}
