// ISA — Intelligence Layer · Prediction Engine (LIE §10)
// Thoughtful foresight, never an oracle. Every forecast is probabilistic and
// explainable, drawn from the person's own history. The laws it obeys:
//   1. No prediction from thin data — below threshold it says "not enough history".
//   2. Always explainable — the "because" travels with it.
//   3. Foresight serves prevention, never alarm (calm, no fear).
// Pro-gated at the surface (see premium.ts); the math itself is always honest.

import type { SourceModule } from "@/lib/life-events";
import type { IntelligenceContext, ModuleSignal } from "./context";
import { toIntelModule } from "./context";
import { computeScore, sig } from "./scoring";
import { explain, insightEvidence, patternEvidence } from "./explain";
import type { EvidenceRef, IntelModule, Prediction, PredictionKind, Risk, Score } from "./types";

const MIN_HISTORY = 6; // events before a forecast is allowed at all
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

function riskFromScore(score: Score): Risk {
  if (score.value < 40 || score.trend === "falling") return "high";
  if (score.value < 60) return "moderate";
  return "low";
}

/** A forecast whose good outcome rises with the score (completion, consistency). */
function positiveForecast(
  ctx: IntelligenceContext,
  kind: PredictionKind,
  module: SourceModule,
  scoreKey: Parameters<typeof computeScore>[1],
  title: string,
  horizon: string,
  frame: (pct: number, s: ModuleSignal) => string
): Prediction | null {
  const s = sig(ctx, module);
  const score = computeScore(ctx, scoreKey);
  const evidence: EvidenceRef[] = [...s.positiveInsights, ...s.negativeInsights].slice(0, 3).map(insightEvidence);
  const enough = s.occurrences >= MIN_HISTORY;

  const trendAdj = score.trend === "rising" ? 8 : score.trend === "falling" ? -12 : 0;
  const probability = enough ? clamp01((score.value + trendAdj) / 100) : null;
  const confidence = enough ? clamp01(score.confidence * 0.9) : 0.2;

  return {
    id: `pred:${kind}`,
    kind,
    module: toIntelModule(module),
    title,
    outlook: enough
      ? frame(Math.round((probability ?? 0) * 100), s)
      : `Not enough ${title.toLowerCase()} history yet — I'll have a real forecast in a couple of weeks.`,
    probability,
    confidence,
    risk: enough ? riskFromScore(score) : "low",
    horizon,
    reason: enough ? score.reason : "Below the evidence threshold for an honest forecast.",
    historicalComparison: enough ? historicalCompare(ctx, module) : null,
    explanation: explain({
      why: enough ? score.reason : "Too little history to forecast — staying honest instead of guessing.",
      claim: enough ? "pattern" : "assumption",
      evidence: evidence.length ? evidence : [patternEvidence(title, `${s.occurrences} events`)],
      confidence,
    }),
  };
}

/** A risk forecast whose likelihood rises as the score FALLS (burnout, relapse). */
function riskForecast(
  ctx: IntelligenceContext,
  kind: PredictionKind,
  module: SourceModule,
  scoreKey: Parameters<typeof computeScore>[1],
  title: string,
  horizon: string,
  frame: (pct: number, s: ModuleSignal) => string
): Prediction | null {
  const s = sig(ctx, module);
  const score = computeScore(ctx, scoreKey);
  const enough = s.occurrences >= MIN_HISTORY;
  const evidence: EvidenceRef[] = s.negativeInsights.slice(0, 3).map(insightEvidence);

  const trendAdj = score.trend === "falling" ? 12 : score.trend === "rising" ? -8 : 0;
  const probability = enough ? clamp01((100 - score.value + trendAdj) / 100) : null;
  const confidence = enough ? clamp01(score.confidence * 0.85) : 0.2;
  const pct = Math.round((probability ?? 0) * 100);
  const risk: Risk = !enough ? "low" : pct >= 60 ? "high" : pct >= 35 ? "moderate" : "low";

  return {
    id: `pred:${kind}`,
    kind,
    module: toIntelModule(module),
    title,
    outlook: enough
      ? frame(pct, s)
      : `Not enough history to flag ${title.toLowerCase()} yet — no alarm from thin data.`,
    probability,
    confidence,
    risk,
    horizon,
    reason: enough ? score.reason : "Below the evidence threshold; staying quiet is the honest call.",
    historicalComparison: enough ? historicalCompare(ctx, module) : null,
    explanation: explain({
      why: enough
        ? `${title} likelihood is derived from ${score.label.toLowerCase()} (${score.value}/100) and its ${score.trend} trend.`
        : "Too little history to forecast a risk — prevention, not alarm.",
      claim: enough ? "pattern" : "assumption",
      evidence: evidence.length ? evidence : [patternEvidence(title, `${s.occurrences} events`)],
      confidence,
    }),
  };
}

/** Pull a comparable number from the most recent review, when present. */
function historicalCompare(ctx: IntelligenceContext, module: SourceModule): string | null {
  const last = ctx.reviews.monthly[0];
  if (!last) return null;
  const p = last.payload ?? {};
  const map: Partial<Record<SourceModule, string>> = {
    focus: "focus_hours",
    money: "net_savings",
    goals: "goals_completed",
    journal: "journal_entries",
    habits: "habits_completed",
    health: "run_km",
  };
  const field = map[module];
  if (field && typeof p[field] === "number") {
    return `Last month (${last.period_key}): ${p[field]} on this measure.`;
  }
  return null;
}

/** Every prediction the engine can make, computed once. Cold-start entries are
 *  included but honestly flagged (probability null) so callers can filter them. */
export function generatePredictions(ctx: IntelligenceContext): Prediction[] {
  const out: (Prediction | null)[] = [
    positiveForecast(ctx, "goal_completion", "goals", "goal_health", "Goal completion", "over the coming weeks", (pct) =>
      `Your active goals are trending toward completion at roughly ${pct}% strength — keep the current pace and they land.`
    ),
    positiveForecast(ctx, "project_completion", "projects", "project_health", "Project completion", "by the deadline", (pct) =>
      `Projects are moving at about ${pct}% of a healthy pace — steady enough to finish if focus holds.`
    ),
    positiveForecast(ctx, "running_consistency", "health", "recovery", "Running consistency", "next 7 days", (pct) =>
      `Activity looks ${pct >= 60 ? "likely" : "uncertain"} to continue (~${pct}%) based on your recent runs.`
    ),
    positiveForecast(ctx, "prayer_consistency", "prayer", "consistency", "Prayer consistency", "this week", (pct) =>
      `Your prayer rhythm looks about ${pct}% likely to hold this week.`
    ),
    positiveForecast(ctx, "focus_forecast", "focus", "focus_health", "Focus outlook", "next few days", (pct) =>
      `Deep-work capacity looks ${pct >= 60 ? "solid" : "fragile"} (~${pct}%) given your recent focus sessions.`
    ),
    positiveForecast(ctx, "learning_consistency", "journal", "consistency", "Reflection consistency", "this week", (pct) =>
      `Journaling looks about ${pct}% likely to continue this week.`
    ),
    positiveForecast(ctx, "savings_forecast", "money", "financial_health", "Savings outlook", "this month", (pct) =>
      `Your finances are tracking at ~${pct}% health — savings should ${pct >= 60 ? "grow" : "hold flat"} if spending stays in pattern.`
    ),
    riskForecast(ctx, "habit_failure", "habits", "habit_health", "Habit fragility", "next 7 days", (pct) =>
      `A habit slip is around ${pct}% likely this week — usually on your heaviest days. A lighter version can protect it.`
    ),
    riskForecast(ctx, "burnout_risk", "energy", "recovery", "Burnout risk", "next 1–2 weeks", (pct) =>
      `Recovery is running low; burnout risk is around ${pct}%. Doing less and protecting rest is the preventive move.`
    ),
    riskForecast(ctx, "expense_forecast", "money", "financial_health", "Overspending risk", "this month", (pct) =>
      `Overspending risk this month is about ${pct}% based on your recent pace.`
    ),
    riskForecast(ctx, "mood_forecast", "energy", "recovery", "Mood dip risk", "next few days", (pct) =>
      `A lower-mood stretch is around ${pct}% likely — worth protecting sleep and movement.`
    ),
    riskForecast(ctx, "sleep_trend", "energy", "recovery", "Sleep deficit", "next few days", (pct) =>
      `A building sleep deficit is around ${pct}% likely to bite soon — an earlier night pays off.`
    ),
  ];
  return out.filter((p): p is Prediction => p !== null);
}

/** Only the forecasts with real evidence behind them (probability !== null). */
export function confidentPredictions(ctx: IntelligenceContext): Prediction[] {
  return generatePredictions(ctx).filter((p) => p.probability !== null);
}

export function predictionsByModule(ctx: IntelligenceContext, module: IntelModule): Prediction[] {
  return generatePredictions(ctx).filter((p) => p.module === module);
}
