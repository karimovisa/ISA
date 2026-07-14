// ISA — Intelligence Layer · Recommendation Engine (LIE §9, Intelligence Components §6)
// Proposes optional, reversible next steps — grounded in the person's own data
// and measured against their Identity first. A candidate that conflicts with a
// declared identity/value is DISCARDED before anything else (identity outranks
// optimization). Recommendations are proposals, never commands; every one
// carries its "because". Nothing generic ever ships.

import type { IntelligenceContext } from "./context";
import { deepLink, moduleLabel, toIntelModule } from "./context";
import { computeAllScores } from "./scoring";
import { generatePredictions } from "./predictions";
import { checkAlignment } from "./identity";
import { explain, insightEvidence, patternEvidence, sampleConfidence } from "./explain";
import type {
  ActionLink,
  IntelModule,
  Priority,
  Recommendation,
  Score,
} from "./types";

const priorityFor = (importance: number): Priority =>
  importance >= 0.8 ? "critical" : importance >= 0.6 ? "high" : importance >= 0.4 ? "medium" : "low";

const daysFromNow = (days: number): string =>
  new Date(Date.now() + days * 86_400_000).toISOString();

type Draft = {
  module: IntelModule;
  key: string; // stable id fragment
  title: string;
  body: string;
  baseImportance: number;
  confidence: number;
  reason: string;
  signals: string[];
  category: string;
  evidenceLabel: string;
  action: ActionLink | null;
  expiresInDays: number | null;
  advancesGoal: boolean;
};

/** Turn a draft into a finished, identity-checked Recommendation — or null when
 *  the Identity Layer vetoes it. */
function finalize(ctx: IntelligenceContext, d: Draft): Recommendation | null {
  const alignment = checkAlignment(ctx.identity, d.signals, d.advancesGoal);
  if (alignment.status === "conflicts") return null; // identity veto

  const importance = Math.min(1, d.baseImportance + alignment.weight);
  const reason = alignment.note ? `${d.reason} ${alignment.note}` : d.reason;
  return {
    id: `rec:${d.module}:${d.key}`,
    module: d.module,
    title: d.title,
    body: d.body,
    priority: priorityFor(importance),
    importance,
    confidence: d.confidence,
    reason,
    explanation: explain({
      why: reason,
      claim: "recommendation",
      evidence: [patternEvidence(d.evidenceLabel), ...alignment.evidence],
      confidence: d.confidence,
    }),
    action: d.action,
    expiresAt: d.expiresInDays == null ? null : daysFromNow(d.expiresInDays),
    createdAt: new Date().toISOString(),
    category: d.category,
    signals: d.signals,
  };
}

/** Drafts drawn from watch-signals (negative insights) — the clearest, most
 *  grounded source of a helpful nudge. */
function fromNegativeInsights(ctx: IntelligenceContext): Draft[] {
  const drafts: Draft[] = [];
  for (const m of ctx.signalsByModule.values()) {
    const mod = toIntelModule(m.module);
    for (const ins of m.negativeInsights.slice(0, 2)) {
      drafts.push({
        module: mod,
        key: `insight:${ins.id}`,
        title: `${moduleLabel(mod)}: worth a look`,
        body: ins.detail || ins.title,
        baseImportance: Math.min(0.85, 0.35 + ins.importance_score * 0.5),
        confidence: ins.confidence,
        reason: `${ins.title} — ${ins.detail || "flagged by your recent patterns"}.`,
        signals: [`watch:${m.module}`, `insight:${ins.insight_type}`],
        category: `${m.module}:${ins.subject_key}`,
        evidenceLabel: ins.title,
        action: { label: `Open ${moduleLabel(mod)}`, deepLink: deepLink(mod) },
        expiresInDays: 14,
        advancesGoal: false,
      });
    }
  }
  return drafts;
}

/** Drafts from struggling scores — a domain under strain gets one gentle,
 *  specific improvement proposal (not five). */
function fromScores(scores: Score[]): Draft[] {
  const moduleForScore: Partial<Record<Score["key"], IntelModule>> = {
    goal_health: "goals",
    habit_health: "habits",
    focus_health: "focus",
    financial_health: "money",
    project_health: "projects",
    recovery: "energy",
  };
  const drafts: Draft[] = [];
  for (const s of scores) {
    const mod = moduleForScore[s.key];
    if (!mod || s.value >= 50 || s.confidence < 0.3) continue;
    drafts.push({
      module: mod,
      key: `score:${s.key}`,
      title: `Give ${moduleLabel(mod).toLowerCase()} a small nudge`,
      body: s.reason,
      baseImportance: Math.min(0.8, (60 - s.value) / 60 + 0.2),
      confidence: s.confidence,
      reason: `${s.label} is at ${s.value}/100 (${s.trend}). One small step here would move it.`,
      signals: [`low:${mod}`, `score:${s.key}`],
      category: `score:${s.key}`,
      evidenceLabel: `${s.label} ${s.value}/100`,
      action: { label: `Open ${moduleLabel(mod)}`, deepLink: deepLink(mod) },
      expiresInDays: 7,
      advancesGoal: mod === "goals" || mod === "projects",
    });
  }
  return drafts;
}

/** Drafts from high-risk predictions — preventive, calm, actionable. */
function fromPredictions(ctx: IntelligenceContext): Draft[] {
  return generatePredictions(ctx)
    .filter((p) => p.risk === "high" && p.probability !== null)
    .map((p) => ({
      module: p.module,
      key: `pred:${p.kind}`,
      title: `Get ahead of it: ${p.title.toLowerCase()}`,
      body: p.outlook,
      baseImportance: Math.min(0.9, 0.5 + (p.probability ?? 0) * 0.4),
      confidence: p.confidence,
      reason: `${p.outlook} ${p.reason}`,
      signals: [`risk:${p.module}`, `pred:${p.kind}`],
      category: `pred:${p.kind}`,
      evidenceLabel: p.title,
      action: { label: `Open ${moduleLabel(p.module)}`, deepLink: deepLink(p.module) },
      expiresInDays: 10,
      advancesGoal: false,
    }));
}

/** All recommendations, identity-filtered and de-duplicated by category, ranked
 *  by importance. This is the raw candidate pool; the Decision Engine decides
 *  which (if any) actually reach the user. */
export function generateRecommendations(ctx: IntelligenceContext): Recommendation[] {
  const scores = computeAllScores(ctx);
  const drafts = [...fromNegativeInsights(ctx), ...fromScores(scores), ...fromPredictions(ctx)];

  const seen = new Set<string>();
  const recs: Recommendation[] = [];
  for (const d of drafts) {
    if (seen.has(d.category)) continue;
    const rec = finalize(ctx, d);
    if (!rec) continue;
    seen.add(d.category);
    recs.push(rec);
  }
  return recs.sort((a, b) => b.importance - a.importance);
}

/** Opportunities: leverage a domain that's going WELL (positive momentum), framed
 *  as an invitation, never pressure. Kept separate from problem-nudges. */
export function generateOpportunities(ctx: IntelligenceContext): Recommendation[] {
  const out: Recommendation[] = [];
  for (const m of ctx.signalsByModule.values()) {
    if (m.trendUp === 0 && m.positiveInsights.length < 2) continue;
    const mod = toIntelModule(m.module);
    const ins = m.positiveInsights[0];
    const confidence = sampleConfidence(m.occurrences, 8);
    const alignment = checkAlignment(ctx.identity, [`strength:${m.module}`], mod === "goals");
    if (alignment.status === "conflicts") continue;
    out.push({
      id: `opp:${mod}`,
      module: mod,
      title: `${moduleLabel(mod)} is a strength right now`,
      body: ins?.detail || `Your ${moduleLabel(mod).toLowerCase()} signals are trending positive — a good base to build on.`,
      priority: "low",
      importance: 0.4 + alignment.weight,
      confidence,
      reason: alignment.note ?? `Momentum is with your ${moduleLabel(mod).toLowerCase()} — worth remembering what's working.`,
      explanation: explain({
        why: `Positive trend in ${moduleLabel(mod)}.`,
        claim: "pattern",
        evidence: ins ? [insightEvidence(ins)] : [patternEvidence(`${moduleLabel(mod)} momentum`)],
        confidence,
      }),
      action: { label: `Open ${moduleLabel(mod)}`, deepLink: deepLink(mod) },
      expiresAt: daysFromNow(14),
      createdAt: new Date().toISOString(),
      category: `opp:${mod}`,
      signals: [`strength:${m.module}`],
    });
  }
  return out.sort((a, b) => b.importance - a.importance);
}

export function recommendationsByModule(ctx: IntelligenceContext, module: IntelModule): Recommendation[] {
  return generateRecommendations(ctx).filter((r) => r.module === module);
}
