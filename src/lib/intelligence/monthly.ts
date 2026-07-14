// ISA — Intelligence Layer · Monthly Intelligence (LIE §14, "what season am I in?")
// The first zoom where foresight becomes reliable: growth, declines, plateaus and
// breakthroughs across the season. It builds on the Foundation's deterministic
// monthly Review (SQL) plus the score set — it never recomputes what Reviews
// already produced. Pro-gated at the surface (see premium.ts).

import type { IntelligenceContext } from "./context";
import { computeAllScores } from "./scoring";
import { moduleLabel, toIntelModule } from "./context";
import { explain, patternEvidence, insightEvidence } from "./explain";
import type { MonthlyBrief, Score } from "./types";

const monthKey = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

export function buildMonthlyBrief(ctx: IntelligenceContext): MonthlyBrief {
  const scores = computeAllScores(ctx);
  const confident = scores.filter((s) => s.confidence >= 0.35);

  const growth: string[] = [];
  const declines: string[] = [];
  const plateaus: string[] = [];
  for (const s of confident) {
    if (s.trend === "rising") growth.push(`${s.label} is climbing (${s.value}/100).`);
    else if (s.trend === "falling") declines.push(`${s.label} softened (${s.value}/100).`);
    else if (s.trend === "steady") plateaus.push(`${s.label} held steady (${s.value}/100).`);
  }

  // Breakthroughs: pivotal milestones this month, from the timeline.
  const monthPrefix = monthKey(ctx.now);
  const breakthroughs = ctx.timeline
    .filter((t) => t.occurred_at.slice(0, 7) === monthPrefix && (t.importance === "pivotal" || t.importance === "significant"))
    .map((t) => t.title)
    .slice(0, 5);

  // Behaviour changes: the month's trend insights.
  const behaviorChanges = ctx.insights
    .filter((i) => i.insight_type === "positive_trend" || i.insight_type === "negative_trend" || i.insight_type === "emerging")
    .slice(0, 4)
    .map((i) => i.title);

  // Trends per domain, seeded from the latest Review payload when present.
  const review = ctx.reviews.monthly.find((r) => r.period_key === monthPrefix) ?? ctx.reviews.monthly[0];
  const trends: Record<string, string> = {};
  for (const s of confident) {
    const key = scoreModuleLabel(s);
    if (key) trends[key] = `${s.value}/100 (${s.trend}). ${s.reason}`;
  }
  if (review) {
    const p = review.payload ?? {};
    for (const [k, label] of [["net_savings", "savings"], ["focus_hours", "focus"], ["run_km", "running"]] as const) {
      if (typeof p[k] === "number") trends[label] = `${label}: ${p[k]} recorded this month (from your review).`;
    }
  }

  const balance = scores.find((s) => s.key === "life_balance") ?? null;

  return {
    periodKey: monthPrefix,
    growth,
    declines,
    plateaus,
    breakthroughs,
    behaviorChanges,
    balance: balance && balance.confidence >= 0.2 ? balance : null,
    trends,
    explanation: explain({
      why: `The season read from ${confident.length} confident scores, ${breakthroughs.length} milestones${review ? ", and your monthly review" : ""}.`,
      claim: "pattern",
      evidence: [
        patternEvidence("monthly season", monthPrefix),
        ...ctx.insights.filter((i) => i.insight_type === "emerging").slice(0, 2).map(insightEvidence),
      ],
      confidence: 0.7,
    }),
  };
}

function scoreModuleLabel(s: Score): string | null {
  const map: Partial<Record<Score["key"], Parameters<typeof toIntelModule>[0]>> = {
    goal_health: "goals",
    habit_health: "habits",
    focus_health: "focus",
    financial_health: "money",
    project_health: "projects",
    recovery: "energy",
  };
  const mod = map[s.key];
  return mod ? moduleLabel(toIntelModule(mod)) : null;
}
