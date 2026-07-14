// ISA — Intelligence Layer · Smart Prioritization (Intelligence Components)
// Answers "what matters most right now?" across the whole life — never a fixed
// order. It ranks the most important goal/project/habit/task, the highest-risk
// area, and the highest-impact actions, each with its reasoning. Dynamic: the
// ranking changes as the person's data changes.

import type { SourceModule } from "@/lib/life-events";
import type { MemoryRecord } from "@/lib/memory";
import type { IntelligenceContext } from "./context";
import { deepLink, moduleLabel, toIntelModule } from "./context";
import { computeAllScores, sig } from "./scoring";
import { generateRecommendations } from "./recommendations";
import { explain, memoryEvidence, patternEvidence, insightEvidence } from "./explain";
import type { IntelModule, PriorityItem, PriorityKind, Score } from "./types";

/** The most attention-worthy active memory in a module (importance × recency). */
function topMemory(ctx: IntelligenceContext, module: SourceModule): MemoryRecord | null {
  const inModule = ctx.memories.filter((m) => m.source_module === module && m.status !== "archived");
  if (!inModule.length) return null;
  return inModule
    .map((m) => {
      const days = m.last_event_at
        ? Math.max(0, (ctx.now.getTime() - new Date(m.last_event_at).getTime()) / 86_400_000)
        : 999;
      const recency = Math.exp(-days / 21); // recent matters more
      return { m, score: (m.importance_score ?? 0) * 0.7 + recency * 0.3 };
    })
    .sort((a, b) => b.score - a.score)[0].m;
}

function memoryPriority(
  ctx: IntelligenceContext,
  kind: PriorityKind,
  module: SourceModule,
  verb: string
): PriorityItem | null {
  const mem = topMemory(ctx, module);
  if (!mem) return null;
  const mod = toIntelModule(module);
  const score = mem.importance_score ?? 0.3;
  return {
    kind,
    rank: 0,
    module: mod,
    title: mem.title,
    score,
    reason: `${verb} — ${mem.summary || `your most active ${moduleLabel(mod).toLowerCase()}`}.`,
    explanation: explain({
      why: `Highest importance × recency in ${moduleLabel(mod)}.`,
      claim: "pattern",
      evidence: [memoryEvidence(mem)],
      confidence: Math.min(0.85, 0.4 + (mem.occurrence_count ?? 0) / 20),
    }),
    action: { label: `Open ${moduleLabel(mod)}`, deepLink: deepLink(mod) },
  };
}

/** The most at-risk life area = the lowest confident health score. */
function highestRiskArea(scores: Score[]): PriorityItem | null {
  const risky = scores
    .filter((s) => ["goal_health", "habit_health", "focus_health", "financial_health", "project_health", "recovery"].includes(s.key))
    .filter((s) => s.confidence >= 0.35)
    .sort((a, b) => a.value - b.value)[0];
  if (!risky || risky.value >= 55) return null;
  const modMap: Partial<Record<Score["key"], IntelModule>> = {
    goal_health: "goals",
    habit_health: "habits",
    focus_health: "focus",
    financial_health: "money",
    project_health: "projects",
    recovery: "energy",
  };
  const mod = modMap[risky.key] ?? "dashboard";
  return {
    kind: "risk_area",
    rank: 0,
    module: mod,
    title: `${risky.label} needs attention`,
    score: (60 - risky.value) / 60,
    reason: `${risky.label} is your lowest area at ${risky.value}/100 (${risky.trend}).`,
    explanation: risky.explanation,
    action: { label: `Open ${moduleLabel(mod)}`, deepLink: deepLink(mod) },
  };
}

/** The whole prioritized picture, ranked and numbered. */
export function computePriorities(ctx: IntelligenceContext): PriorityItem[] {
  const scores = computeAllScores(ctx);
  const recs = generateRecommendations(ctx);
  const items: (PriorityItem | null)[] = [
    memoryPriority(ctx, "goal", "goals", "Your most important goal"),
    memoryPriority(ctx, "project", "projects", "Your most active project"),
    memoryPriority(ctx, "habit", "habits", "The habit carrying the most"),
    memoryPriority(ctx, "task", "tasks", "The task that matters most"),
    highestRiskArea(scores),
  ];

  // Highest-impact action and highest-value recommendation from the rec pool.
  const topImpact = recs[0];
  if (topImpact) {
    items.push({
      kind: "impact_action",
      rank: 0,
      module: topImpact.module,
      title: topImpact.title,
      score: topImpact.importance,
      reason: topImpact.reason,
      explanation: topImpact.explanation,
      action: topImpact.action,
    });
  }
  const topValue = [...recs].sort((a, b) => b.importance * b.confidence - a.importance * a.confidence)[0];
  if (topValue && topValue.id !== topImpact?.id) {
    items.push({
      kind: "recommendation",
      rank: 0,
      module: topValue.module,
      title: topValue.title,
      score: topValue.importance * topValue.confidence,
      reason: topValue.reason,
      explanation: topValue.explanation,
      action: topValue.action,
    });
  }

  // Financial and health priorities, surfaced explicitly (they're load-bearing).
  const money = sig(ctx, "money");
  if (money.negativeInsights.length) {
    const ins = money.negativeInsights[0];
    items.push({
      kind: "financial",
      rank: 0,
      module: "money",
      title: "Top financial priority",
      score: 0.4 + ins.importance_score * 0.5,
      reason: `${ins.title} — ${ins.detail || "worth a look this week"}.`,
      explanation: explain({ why: ins.title, claim: "pattern", evidence: [insightEvidence(ins)], confidence: ins.confidence }),
      action: { label: "Open Money", deepLink: deepLink("money") },
    });
  }
  const recovery = scores.find((s) => s.key === "recovery");
  if (recovery && recovery.confidence >= 0.35 && recovery.value < 50) {
    items.push({
      kind: "health",
      rank: 0,
      module: "energy",
      title: "Top health priority: recovery",
      score: (60 - recovery.value) / 60,
      reason: recovery.reason,
      explanation: recovery.explanation,
      action: { label: "Open Progress", deepLink: deepLink("energy") },
    });
  }

  const ranked = items
    .filter((i): i is PriorityItem => i !== null)
    .sort((a, b) => b.score - a.score);
  ranked.forEach((it, i) => (it.rank = i + 1));
  return ranked;
}

/** Just the single most important thing right now (or null on a blank slate). */
export function topPriority(ctx: IntelligenceContext): PriorityItem | null {
  return computePriorities(ctx)[0] ?? null;
}

/** The risk-flavoured priorities only — for the daily "today's risks" section. */
export function riskPriorities(ctx: IntelligenceContext): PriorityItem[] {
  return computePriorities(ctx).filter((p) => p.kind === "risk_area" || p.kind === "financial" || p.kind === "health");
}

/** Ensure every SourceModule contributes to prioritization awareness. Unused
 *  helper kept intentionally small; exported for callers that page by module. */
export function priorityForModule(ctx: IntelligenceContext, module: IntelModule): PriorityItem | null {
  return computePriorities(ctx).find((p) => p.module === module) ?? null;
}

/** Evidence hook so prioritization patterns are inspectable in aggregate. */
export function prioritizationEvidence(ctx: IntelligenceContext) {
  return patternEvidence("prioritization", `${ctx.memories.length} memories weighed`);
}
