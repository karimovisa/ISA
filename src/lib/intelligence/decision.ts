// ISA — Intelligence Layer · Decision Engine (LIE §12, the attention arbiter)
// The generators are abundant; this is the single gate to the user's attention.
// It scores every candidate globally, ranks them, and spends a small, finite
// attention budget — preferring SILENCE. "One clear thing beats five true
// things." Non-urgent truths are HELD for a review rather than pushed. It is the
// operational enforcement of calm; nothing surfaces except through here.

import type { IntelligenceContext } from "./context";
import { computeScore } from "./scoring";
import { checkAlignment } from "./identity";
import { explain, patternEvidence } from "./explain";
import type {
  Candidate,
  CoachMessage,
  DecisionResult,
  DecisionVerdict,
  Prediction,
  Recommendation,
} from "./types";

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

// ── candidate constructors: turn a generator's output into a competitor ──

export function recommendationCandidate(ctx: IntelligenceContext, rec: Recommendation): Candidate {
  const identity = checkAlignment(ctx.identity, rec.signals, rec.module === "goals");
  const timeliness = { critical: 0.9, high: 0.7, medium: 0.5, low: 0.3 }[rec.priority];
  return {
    id: rec.id,
    kind: "recommendation",
    module: rec.module,
    title: rec.title,
    importance: rec.importance,
    confidence: rec.confidence,
    timeliness,
    actionability: rec.action ? 0.8 : 0.3,
    novelty: 0.6,
    costOfSilence: rec.importance,
    identity,
    expiresAt: rec.expiresAt,
    payload: rec,
  };
}

export function predictionCandidate(ctx: IntelligenceContext, pred: Prediction): Candidate {
  const identity = checkAlignment(ctx.identity, [`risk:${pred.module}`], false);
  const timeliness = pred.risk === "high" ? 0.8 : pred.risk === "moderate" ? 0.5 : 0.3;
  const importance = clamp01(0.4 + (pred.probability ?? 0) * 0.4 + (pred.risk === "high" ? 0.15 : 0));
  return {
    id: pred.id,
    kind: "prediction",
    module: pred.module,
    title: pred.title,
    importance,
    confidence: pred.confidence,
    timeliness,
    actionability: 0.6,
    novelty: 0.6,
    costOfSilence: pred.risk === "high" ? 0.8 : 0.4,
    identity,
    expiresAt: null,
    payload: pred,
  };
}

export function coachCandidate(ctx: IntelligenceContext, msg: CoachMessage): Candidate {
  const identity = checkAlignment(ctx.identity, [`coach:${msg.module}`], false);
  const momentWeight: Record<CoachMessage["moment"], number> = {
    milestone: 0.8,
    achievement: 0.75,
    recovery: 0.7,
    morning: 0.5,
    evening: 0.5,
    weekly: 0.45,
    monthly: 0.4,
    daily: 0.35,
  };
  const importance = momentWeight[msg.moment];
  return {
    id: msg.id,
    kind: "coach",
    module: msg.module,
    title: msg.headline,
    importance,
    confidence: msg.explanation.confidence,
    timeliness: msg.moment === "recovery" || msg.moment === "milestone" ? 0.8 : 0.4,
    actionability: msg.action ? 0.7 : 0.4,
    novelty: 0.5,
    costOfSilence: msg.moment === "recovery" ? 0.6 : 0.2,
    identity,
    expiresAt: null,
    payload: msg,
  };
}

// ── arbitration ──

/** How depleted is the person right now? A depleted user gets a smaller budget
 *  and a higher bar (LIE §12.4 rule 3). Derived from the Recovery score. */
function depletion(ctx: IntelligenceContext): number {
  const recovery = computeScore(ctx, "recovery");
  if (recovery.confidence < 0.3) return 0; // unknown — don't assume depletion
  return clamp01((60 - recovery.value) / 60); // 0 when healthy, →1 as recovery collapses
}

/** The global priority score for one candidate. Identity is the highest-weighted
 *  input; a conflict would already have vetoed the candidate upstream. */
function priorityOf(c: Candidate, depleted: number): number {
  // Fit to the moment: when the person is depleted, only recovery/energy nudges fit.
  const restful =
    c.module === "energy" ||
    c.module === "progress" ||
    (c.kind === "coach" && (c.payload as CoachMessage).moment === "recovery");
  const fit = depleted > 0.4 ? (restful ? 0.9 : 0.35) : 0.7;
  const identityBoost = c.identity.status === "supports" ? 0.12 : 0;

  return clamp01(
    0.26 * c.importance +
      0.15 * c.timeliness +
      0.13 * c.actionability +
      0.12 * c.novelty +
      0.12 * c.confidence +
      0.10 * c.costOfSilence +
      0.08 * fit +
      identityBoost
  );
}

export type DecideOptions = {
  /** Recommendation/candidate ids the user already dismissed — their bar rises. */
  dismissedIds?: string[];
  /** Categories dismissed repeatedly — the whole class gets a higher bar (learning). */
  raisedBarCategories?: string[];
  /** Override the base interruption budget (default 3). */
  baseBudget?: number;
};

/**
 * Arbitrate. Returns the few candidates that earned attention, the rest held for
 * a review, and the full verdict trace. Most cycles should surface little or
 * nothing — that is correct, not a failure.
 */
export function decide(
  ctx: IntelligenceContext,
  candidates: Candidate[],
  opts: DecideOptions = {}
): DecisionResult {
  const dismissed = new Set(opts.dismissedIds ?? []);
  const raisedBar = new Set(opts.raisedBarCategories ?? []);
  const depleted = depletion(ctx);

  // Budget shrinks when depleted; never below 1, never a quota to fill.
  const base = opts.baseBudget ?? 3;
  const budget = Math.max(1, Math.round(base * (1 - depleted * 0.6)));
  // The bar rises with depletion — a tired person hears only what truly matters.
  const bar = 0.5 + depleted * 0.15;

  const scored = candidates
    .map((c) => ({ c, p: priorityOf(c, depleted) }))
    .sort((a, b) => b.p - a.p);

  const verdicts: DecisionVerdict[] = [];
  const surfaced: Candidate[] = [];
  const held: Candidate[] = [];
  let spent = 0;

  for (const { c, p } of scored) {
    // Identity veto (defensive — upstream already filters) or fabrication risk.
    if (c.identity.status === "conflicts" || c.confidence < 0.2) {
      verdicts.push({ id: c.id, outcome: "discard", priority: p, reason: "conflicts with identity or too little confidence" });
      continue;
    }
    const catBar = raisedBar.has(c.module) ? bar + 0.15 : bar;
    if (dismissed.has(c.id)) {
      verdicts.push({ id: c.id, outcome: "discard", priority: p, reason: "already dismissed by the user" });
      continue;
    }
    if (p >= catBar && spent < budget) {
      surfaced.push(c);
      spent += 1;
      verdicts.push({ id: c.id, outcome: "surface", priority: p, reason: "highest-value, within attention budget" });
    } else if (p >= catBar * 0.7) {
      held.push(c);
      verdicts.push({ id: c.id, outcome: "hold", priority: p, reason: "true & aligned — saved for a review, not pushed" });
    } else {
      verdicts.push({ id: c.id, outcome: "defer", priority: p, reason: "below the bar for now" });
    }
  }

  return {
    surfaced,
    held,
    verdicts,
    budget,
    spent,
    explanation: explain({
      why: `Of ${candidates.length} true candidates, ${spent} earned attention (budget ${budget}${depleted > 0.4 ? ", reduced — you look depleted" : ""}). The rest are held for a review.`,
      claim: "fact",
      evidence: [patternEvidence("attention arbitration", `${candidates.length} candidates scored`)],
      confidence: 0.9,
    }),
  };
}

/** Convenience: run the full arbitration over the standard generator outputs. */
export function arbitrate(
  ctx: IntelligenceContext,
  inputs: { recommendations?: Recommendation[]; predictions?: Prediction[]; coach?: CoachMessage[] },
  opts?: DecideOptions
): DecisionResult {
  const candidates: Candidate[] = [
    ...(inputs.recommendations ?? []).map((r) => recommendationCandidate(ctx, r)),
    ...(inputs.predictions ?? []).filter((p) => p.probability !== null).map((p) => predictionCandidate(ctx, p)),
    ...(inputs.coach ?? []).map((m) => coachCandidate(ctx, m)),
  ];
  return decide(ctx, candidates, opts);
}
