// ISA — Intelligence Layer · Cross-Module Intelligence (LIE §13)
// "The connections are the product." This surfaces evidence-based links between
// behaviours across modules. It NEVER assumes causation — it says "moves with"
// or "may be linked", and it only speaks when both ends have real evidence.
// Confirmed correlations come from the Foundation's Analytics Engine; co-
// occurrence links are offered cautiously and labelled as assumptions.

import type { SourceModule } from "@/lib/life-events";
import type { Insight } from "@/lib/insights";
import type { IntelligenceContext } from "./context";
import { moduleLabel, toIntelModule } from "./context";
import { explain, insightEvidence, patternEvidence } from "./explain";
import type { CrossModuleLink, IntelModule } from "./types";

/** Which module an insight belongs to, via the subject_key → module index. */
function insightModule(ctx: IntelligenceContext, ins: Insight): IntelModule | null {
  for (const [m, s] of ctx.signalsByModule) {
    if (s.positiveInsights.includes(ins) || s.negativeInsights.includes(ins)) return toIntelModule(m);
  }
  return null;
}

const MODULE_TOKENS: [IntelModule, RegExp][] = [
  ["energy", /sleep|energy|mood|rest|recover/i],
  ["focus", /focus|deep.?work/i],
  ["money", /spend|money|budget|expense|saving/i],
  ["goals", /goal/i],
  ["habits", /habit|streak/i],
  ["running", /run|activity|exercise/i],
  ["journal", /journal|reflect/i],
  ["prayer", /prayer|pray/i],
];

/** Try to name a second module referenced in a correlation insight's text. */
function secondModule(ins: Insight, exclude: IntelModule | null): IntelModule | null {
  const text = `${ins.title} ${ins.detail}`;
  for (const [mod, re] of MODULE_TOKENS) {
    if (mod !== exclude && re.test(text)) return mod;
  }
  return null;
}

/** Confirmed links: correlation insights the Analytics Engine already vouched for. */
function fromCorrelations(ctx: IntelligenceContext): CrossModuleLink[] {
  return ctx.insights
    .filter((i) => i.insight_type === "correlation")
    .map((i) => {
      const from = insightModule(ctx, i) ?? "dashboard";
      const to = secondModule(i, from) ?? "dashboard";
      return {
        id: `xmod:corr:${i.id}`,
        from,
        to,
        relation: "moves with",
        strength: i.confidence,
        detail: i.detail || i.title,
        explanation: explain({
          why: `Correlation detected by the pattern engine: ${i.title}.`,
          claim: "pattern",
          evidence: [insightEvidence(i)],
          confidence: i.confidence,
        }),
      };
    });
}

/** The load-bearing relationships from the Engine's reasoning map — offered only
 *  when BOTH endpoints currently show evidence, and always as a cautious
 *  assumption (never a stated cause). */
const KNOWN_PAIRS: [SourceModule, SourceModule, string][] = [
  ["energy", "focus", "Lower recovery tends to sit alongside weaker focus"],
  ["energy", "money", "Tired stretches often coincide with looser spending"],
  ["health", "energy", "More activity tends to sit alongside better energy"],
  ["money", "goals", "Financial pressure tends to slow goal funding"],
  ["habits", "goals", "Held habits tend to accompany goal progress"],
  ["journal", "habits", "Weeks you reflect tend to be more consistent"],
];

function fromCoOccurrence(ctx: IntelligenceContext): CrossModuleLink[] {
  const out: CrossModuleLink[] = [];
  for (const [a, b, detail] of KNOWN_PAIRS) {
    const sa = ctx.signalsByModule.get(a)!;
    const sb = ctx.signalsByModule.get(b)!;
    const aHot = sa.negativeInsights.length + sa.positiveInsights.length > 0 && (sa.recencyDays ?? 99) <= 10;
    const bHot = sb.negativeInsights.length + sb.positiveInsights.length > 0 && (sb.recencyDays ?? 99) <= 10;
    if (!aHot || !bHot) continue; // both ends must show real, recent evidence
    const strength = Math.min(0.5, (sa.negativeInsights.length + sb.negativeInsights.length) * 0.12 + 0.2);
    out.push({
      id: `xmod:pair:${a}:${b}`,
      from: toIntelModule(a),
      to: toIntelModule(b),
      relation: "may be linked",
      strength,
      detail: `${detail} — both are active for you right now.`,
      explanation: explain({
        why: `${moduleLabel(toIntelModule(a))} and ${moduleLabel(toIntelModule(b))} both show recent signals; this is an observation to watch, not a proven cause.`,
        claim: "assumption",
        evidence: [
          ...sa.negativeInsights.slice(0, 1).map(insightEvidence),
          ...sb.negativeInsights.slice(0, 1).map(insightEvidence),
          patternEvidence(`${a}↔${b} co-occurrence`),
        ],
        confidence: strength,
      }),
    });
  }
  return out;
}

/** All cross-module links, confirmed correlations first, ranked by strength. */
export function crossModuleLinks(ctx: IntelligenceContext): CrossModuleLink[] {
  return [...fromCorrelations(ctx), ...fromCoOccurrence(ctx)].sort((a, b) => b.strength - a.strength);
}

/** Links touching a given module — for a module screen's "connected to" section. */
export function linksForModule(ctx: IntelligenceContext, module: IntelModule): CrossModuleLink[] {
  return crossModuleLinks(ctx).filter((l) => l.from === module || l.to === module);
}
