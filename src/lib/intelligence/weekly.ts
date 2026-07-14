// ISA — Intelligence Layer · Weekly Intelligence (LIE §14)
// The first zoom level where real patterns become visible. It is a reflection,
// not seven dailies stacked: biggest win, biggest challenge, what improved, what
// was least consistent, and one thing to carry forward. Built from scores +
// insights + the last 7 days of the timeline. Free-tier (present-tense mirror).

import type { SourceModule } from "@/lib/life-events";
import type { IntelligenceContext } from "./context";
import { moduleLabel, toIntelModule } from "./context";
import { computeAllScores } from "./scoring";
import { generateRecommendations } from "./recommendations";
import { explain, patternEvidence } from "./explain";
import type { Score, WeeklyBrief } from "./types";

const isoWeekKey = (d: Date): string => {
  const year = d.getFullYear();
  const start = new Date(year, 0, 1);
  const week = Math.ceil(((d.getTime() - start.getTime()) / 86_400_000 + start.getDay() + 1) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
};

export function buildWeeklyBrief(ctx: IntelligenceContext): WeeklyBrief {
  const scores = computeAllScores(ctx);
  const weekAgo = new Date(ctx.now.getTime() - 7 * 86_400_000).toISOString();
  const recentTimeline = ctx.timeline.filter((t) => t.occurred_at >= weekAgo);

  // Biggest win: a pivotal moment this week, else the strongest positive insight.
  const pivotalWin = recentTimeline.find((t) => t.importance === "pivotal") ?? recentTimeline[0];
  const topPositive = ctx.insights
    .filter((i) => i.valence === "positive")
    .sort((a, b) => b.importance_score - a.importance_score)[0];
  const biggestWin = pivotalWin?.title ?? topPositive?.title ?? null;

  // Biggest challenge: the strongest negative insight of the week.
  const topNegative = ctx.insights
    .filter((i) => i.valence === "negative")
    .sort((a, b) => b.importance_score - a.importance_score)[0];
  const biggestChallenge = topNegative ? `${topNegative.title} — ${topNegative.detail || ""}`.trim() : null;

  // Most improved / least consistent from the score set.
  const confident = scores.filter((s) => s.confidence >= 0.35);
  const rising = confident.filter((s) => s.trend === "rising").sort((a, b) => b.value - a.value)[0];
  const mostImproved = rising ? rising.label : null;
  const lowest = [...confident].sort((a, b) => a.value - b.value)[0];
  const leastConsistent = lowest && lowest.value < 45 ? lowest.label : null;

  // Behaviour changes: trend insights, phrased honestly.
  const behaviorChanges = ctx.insights
    .filter((i) => i.insight_type === "positive_trend" || i.insight_type === "negative_trend")
    .slice(0, 3)
    .map((i) => i.title);

  // Per-domain one-liners.
  const domains: [SourceModule, string][] = [
    ["goals", "goals"],
    ["habits", "habits"],
    ["focus", "focus"],
    ["money", "money"],
    ["health", "health"],
  ];
  const summaries: Record<string, string> = {};
  for (const [m, key] of domains) {
    const score = scores.find((s) => scoreKeyForModule(m) === s.key);
    const sig = ctx.signalsByModule.get(m)!;
    summaries[key] = score && score.confidence >= 0.3
      ? `${moduleLabel(toIntelModule(m))}: ${score.value}/100 (${score.trend}).`
      : sig.memories > 0
        ? `${moduleLabel(toIntelModule(m))}: some activity, too early for a read.`
        : `${moduleLabel(toIntelModule(m))}: quiet this week.`;
  }

  const recs = generateRecommendations(ctx);
  const recommendationSummary = recs.length
    ? `${recs.length} gentle suggestion${recs.length > 1 ? "s" : ""} available; the clearest: ${recs[0].title}.`
    : "Nothing needs changing from me this week.";

  return {
    periodKey: isoWeekKey(ctx.now),
    biggestWin,
    biggestChallenge,
    mostImproved,
    leastConsistent,
    behaviorChanges,
    summaries,
    recommendationSummary,
    scores: confident,
    explanation: explain({
      why: `A mirror of the last 7 days from ${recentTimeline.length} moments and ${ctx.insights.length} active patterns.`,
      claim: "pattern",
      evidence: [patternEvidence("weekly reflection", `${recentTimeline.length} moments`)],
      confidence: 0.75,
    }),
  };
}

function scoreKeyForModule(m: SourceModule): Score["key"] | null {
  const map: Partial<Record<SourceModule, Score["key"]>> = {
    goals: "goal_health",
    habits: "habit_health",
    focus: "focus_health",
    money: "financial_health",
    projects: "project_health",
    energy: "recovery",
    health: "recovery",
  };
  return map[m] ?? null;
}
