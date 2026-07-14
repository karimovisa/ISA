// ISA — Intelligence Layer · Scoring Engine (§14 Scores)
// Transparent, component-based scores. Every score exposes its parts, their
// weights, its trend and its confidence — no magic numbers, nothing the user
// can't inspect (Honesty Over Illusion). Scores are the descriptive substrate
// the Prioritization, Prediction and Coach engines reason over.

import type { SourceModule } from "@/lib/life-events";
import type { IntelligenceContext, ModuleSignal } from "./context";
import { explain, sampleConfidence, patternEvidence, insightEvidence } from "./explain";
import type { EvidenceRef, Score, ScoreComponent, ScoreKey, Trend } from "./types";

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
const round = (n: number) => Math.round(n);

export const sig = (ctx: IntelligenceContext, m: SourceModule): ModuleSignal =>
  ctx.signalsByModule.get(m)!;

/** Recency as a 0..100 freshness score — 100 today, decaying to ~5 by 3 weeks. */
function recencyScore(recencyDays: number | null): number {
  if (recencyDays == null) return 0;
  if (recencyDays <= 1) return 100;
  if (recencyDays >= 21) return 5;
  return clamp(100 * Math.exp(-recencyDays / 10));
}

/** Balance of positive vs negative insights in a module → 0..100, 50 = neutral. */
function insightBalance(s: ModuleSignal): number {
  const pos = s.positiveInsights.length;
  const neg = s.negativeInsights.length;
  const tot = pos + neg;
  if (tot === 0) return 50;
  return round((pos / tot) * 100);
}

/** Trend from the module's own trend insights. */
function trendOf(s: ModuleSignal): Trend {
  if (s.trendUp === 0 && s.trendDown === 0) return "unknown";
  if (s.trendUp > s.trendDown) return "rising";
  if (s.trendDown > s.trendUp) return "falling";
  return "steady";
}

/** Weighted mean of components (weights need not sum to exactly 1). */
function weightedValue(components: ScoreComponent[]): number {
  const total = components.reduce((a, c) => a + c.weight, 0);
  if (total <= 0) return 0;
  return clamp(components.reduce((a, c) => a + c.value * c.weight, 0) / total);
}

/** Shared assembler so every score is built and explained the same way. */
function build(
  key: ScoreKey,
  label: string,
  components: ScoreComponent[],
  trend: Trend,
  reason: string,
  sample: number,
  evidence: EvidenceRef[]
): Score {
  const value = round(weightedValue(components));
  const confidence = sampleConfidence(sample, 8);
  return {
    key,
    label,
    value,
    components,
    trend,
    reason,
    confidence,
    explanation: explain({
      why: reason,
      claim: "pattern",
      evidence: evidence.length ? evidence : [patternEvidence(label, reason)],
      confidence,
    }),
  };
}

const comp = (label: string, value: number, weight: number, detail: string): ScoreComponent => ({
  label,
  value: round(value),
  weight,
  detail,
});

/** A single module's "health": how alive, how positive, how consistent it is. */
function moduleHealth(ctx: IntelligenceContext, key: ScoreKey, label: string, m: SourceModule): Score {
  const s = sig(ctx, m);
  const recency = recencyScore(s.recencyDays);
  const balance = insightBalance(s);
  const activity = clamp(Math.log10(1 + s.occurrences) * 45); // saturating volume score
  const components = [
    comp("Recent activity", recency, 0.4, s.lastEventAt ? `last active ${s.recencyDays}d ago` : "no activity yet"),
    comp("Signal balance", balance, 0.35, `${s.positiveInsights.length} positive / ${s.negativeInsights.length} watch`),
    comp("Depth", activity, 0.25, `${s.occurrences} events across ${s.memories} memories`),
  ];
  const trend = trendOf(s);
  const reason =
    s.memories === 0
      ? `Not enough ${label.toLowerCase()} activity yet to judge.`
      : `${label} is ${round(weightedValue(components)) >= 60 ? "healthy" : round(weightedValue(components)) >= 40 ? "holding" : "under strain"} — ${s.positiveInsights.length ? "positive signals present" : "few positive signals"}, last active ${s.recencyDays ?? "—"}d ago.`;
  const evidence = [...s.negativeInsights, ...s.positiveInsights].slice(0, 3).map(insightEvidence);
  return build(key, label, components, trend, reason, s.occurrences, evidence);
}

/** How evenly the person's life is spread across its core domains (0..100).
 *  High = balanced attention; low = one or two domains carrying everything. */
function lifeBalance(ctx: IntelligenceContext): Score {
  const core: SourceModule[] = ["goals", "habits", "focus", "money", "energy", "prayer", "journal", "health"];
  const active = core.map((m) => ({ m, s: sig(ctx, m) })).filter((x) => x.s.memories > 0);
  const weights = active.map((x) => Math.max(1, x.s.occurrences));
  const total = weights.reduce((a, b) => a + b, 0);
  let entropy = 0;
  if (total > 0 && weights.length > 1) {
    for (const w of weights) {
      const p = w / total;
      entropy -= p * Math.log(p);
    }
    entropy /= Math.log(weights.length); // normalize 0..1 against a perfectly even spread
  }
  const spread = round(entropy * 100);
  const breadth = round((active.length / core.length) * 100);
  const components = [
    comp("Spread of attention", spread, 0.6, `${active.length} of ${core.length} life domains active`),
    comp("Breadth", breadth, 0.4, active.map((x) => x.m).join(", ") || "no domains active yet"),
  ];
  const reason =
    active.length <= 1
      ? "Only one life domain is active — too early to speak of balance."
      : spread >= 60
        ? "Your attention is spread evenly across your life domains."
        : "A couple of domains are carrying most of your attention right now.";
  return build(
    "life_balance",
    "Life balance",
    components,
    "unknown",
    reason,
    active.reduce((a, x) => a + x.s.occurrences, 0),
    active.flatMap((x) => x.s.positiveInsights.slice(0, 1)).slice(0, 3).map(insightEvidence)
  );
}

/** Consistency across the routine-bearing domains (habits, prayer, focus, journal). */
function consistency(ctx: IntelligenceContext): Score {
  const routine: [SourceModule, string, number][] = [
    ["habits", "Habits", 0.35],
    ["prayer", "Prayer", 0.25],
    ["focus", "Focus", 0.25],
    ["journal", "Journal", 0.15],
  ];
  const components = routine.map(([m, lbl, w]) => {
    const s = sig(ctx, m);
    return comp(lbl, recencyScore(s.recencyDays), w, s.lastEventAt ? `last ${s.recencyDays}d ago` : "not started");
  });
  const active = routine.filter(([m]) => sig(ctx, m).memories > 0);
  const reason = active.length
    ? "How reliably your routines are holding across habits, prayer, focus and reflection."
    : "No routine domains active yet — nothing to measure consistency against.";
  return build(
    "consistency",
    "Consistency",
    components,
    "unknown",
    reason,
    active.reduce((a, [m]) => a + sig(ctx, m).occurrences, 0),
    []
  );
}

/** Momentum: is the person's overall direction rising or falling right now? */
function momentum(ctx: IntelligenceContext): Score {
  let up = 0;
  let down = 0;
  let recentVolume = 0;
  for (const m of ctx.signalsByModule.values()) {
    up += m.trendUp + m.positiveInsights.length;
    down += m.trendDown + m.negativeInsights.length;
    if (m.recencyDays != null && m.recencyDays <= 3) recentVolume += 1;
  }
  const directional = up + down === 0 ? 50 : round((up / (up + down)) * 100);
  const freshness = clamp((recentVolume / 6) * 100);
  const components = [
    comp("Direction", directional, 0.65, `${up} positive vs ${down} watch signals`),
    comp("Recent engagement", freshness, 0.35, `${recentVolume} domains active in the last 3 days`),
  ];
  const trend: Trend = up === down ? "steady" : up > down ? "rising" : "falling";
  const reason =
    up + down === 0
      ? "Not enough recent signal to read momentum yet."
      : trend === "rising"
        ? "Your recent signals lean positive — momentum is with you."
        : trend === "falling"
          ? "More watch-signals than positive ones lately — momentum has softened."
          : "Momentum is steady.";
  return build("momentum", "Momentum", components, trend, reason, up + down, []);
}

const SCORERS: Record<ScoreKey, (ctx: IntelligenceContext) => Score> = {
  goal_health: (c) => moduleHealth(c, "goal_health", "Goal health", "goals"),
  habit_health: (c) => moduleHealth(c, "habit_health", "Habit health", "habits"),
  focus_health: (c) => moduleHealth(c, "focus_health", "Focus health", "focus"),
  financial_health: (c) => moduleHealth(c, "financial_health", "Financial health", "money"),
  project_health: (c) => moduleHealth(c, "project_health", "Project health", "projects"),
  recovery: (c) => moduleHealth(c, "recovery", "Recovery", "energy"),
  life_balance: lifeBalance,
  consistency,
  momentum,
};

/** Compute one score. */
export function computeScore(ctx: IntelligenceContext, key: ScoreKey): Score {
  return SCORERS[key](ctx);
}

/** Compute every score once. */
export function computeAllScores(ctx: IntelligenceContext): Score[] {
  return (Object.keys(SCORERS) as ScoreKey[]).map((k) => SCORERS[k](ctx));
}
