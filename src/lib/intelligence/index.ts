// ISA — Intelligence Layer · Public API (subsystem #5)
// The Intelligence Layer sits on top of the completed AI Foundation (Events →
// Memory → Insights → Reviews) and turns understanding into DECISIONS, COACHING,
// PRIORITIES, PREDICTIONS and SCORES. Everything here is deterministic, honest,
// explainable, identity-aligned and gated by subscription. No LLM, no network.
//
// Import from "@/lib/intelligence". This barrel is the ONLY surface the app (and
// the future Conversation Layer) should use — internal modules may change.

// ── Shared contract ──
export type * from "./types";

// ── Context hub (load once, pass everywhere) ──
export {
  loadIntelligenceContext,
  invalidateContext,
  deriveSignals,
  deepLink,
  moduleLabel,
  toIntelModule,
  SOURCE_MODULES,
} from "./context";
export type { IntelligenceContext, ModuleSignal } from "./context";

// ── Explainability ──
export { explain, sampleConfidence, combineConfidence, memoryEvidence, insightEvidence, timelineEvidence, patternEvidence } from "./explain";

// ── Identity Layer (apex constraint) ──
export { loadIdentity, buildIdentity, checkAlignment, declareIdentity } from "./identity";

// ── Scoring ──
export { computeScore, computeAllScores, sig } from "./scoring";

// ── Personalization (Behavior Context) ──
export { buildPersonalization, bestContactHour, isQuietHour, preferredModuleOrder } from "./personalization";

// ── Predictions ──
export { generatePredictions, confidentPredictions, predictionsByModule } from "./predictions";

// ── Recommendations ──
export { generateRecommendations, generateOpportunities, recommendationsByModule } from "./recommendations";

// ── Prioritization ──
export { computePriorities, topPriority, riskPriorities, priorityForModule } from "./prioritization";

// ── Coach ──
export { dailyCoach, moduleCoach, coachCandidates } from "./coach";

// ── Decision Engine (attention arbiter) ──
export { decide, arbitrate, recommendationCandidate, predictionCandidate, coachCandidate } from "./decision";
export type { DecideOptions } from "./decision";

// ── Cross-Module Intelligence ──
export { crossModuleLinks, linksForModule } from "./crossModule";

// ── Temporal Intelligence ──
export { buildDailyBrief } from "./daily";
export { buildWeeklyBrief } from "./weekly";
export { buildMonthlyBrief } from "./monthly";

// ── Notification Intelligence ──
export { planNotifications } from "./notifications";

// ── Semantic Intelligence ──
export { answerQuery, parseIntent } from "./semantic";

// ── Adaptive Dashboard ──
export { adaptiveDashboard, adaptiveModuleOrder, baseDashboardOrder } from "./adaptive";

// ── Premium gating ──
export {
  premiumPredictions,
  premiumAllPredictions,
  premiumCoach,
  premiumCoachCandidates,
  premiumMonthly,
  premiumCrossModule,
  premiumSearch,
} from "./premium";
export type { Gated } from "./premium";
