// ISA — Life Intelligence Engine · Meaning layer
// Turns a raw action into WEIGHT and DIRECTION, relative to the individual and
// always explainable. Deterministic rule-based math over the person's own data
// — never a model call, never fabricated certainty (Honesty Over Illusion).
//
// This is intentionally the ONLY computation in the Event System. Pattern
// detection, recommendation and prediction are NOT here — they are later layers
// that read the signals these functions stamp onto each event.

import type {
  Confidence,
  EventIntelligence,
  EventLinks,
  Importance,
  TimeContext,
  Valence,
} from "./types";
import type { EventTypeDef, LifeEventType } from "./taxonomy";
import { MILESTONE_TYPES } from "./taxonomy";

/** A computed value that always travels with its confidence and its "because". */
export type Scored<T> = { value: T; confidence: Confidence; reasons: string[] };

const MIN_BASELINE_SAMPLES = 4;
const STREAK_MILESTONES = new Set([7, 30, 100, 365]);

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const round2 = (n: number) => Math.round(n * 100) / 100;

/** The classified outcome of an event — the caller knows its own domain result
 *  and passes it in. Absent → we fall back to the type's default direction. */
export type EventOutcome =
  | "progress"
  | "achievement"
  | "improvement"
  | "consistency"
  | "informational"
  | "setback"
  | "unhealthy"
  | "missed"
  | "mixed";

/** Everything the meaning layer needs to judge an event AGAINST the person.
 *  All optional: with nothing, we return a conservative, low-confidence read. */
export type LifeEventContext = {
  /** This event's key numeric metric (e.g. run km, expense amount). */
  metricValue?: number | null;
  /** The person's own baseline for that metric — the heart of "relative to me". */
  baseline?: { metric: string; mean: number; count: number } | null;
  /** Recent events of the same type — for novelty vs routine. */
  recentSameTypeCount?: number | null;
  /** Streak length for habit/streak events. */
  streakLength?: number | null;
  /** Is this tied to something the person is actively building or declared? */
  linkedToActiveGoal?: boolean;
  linkedToIdentityValue?: boolean;
  /** The domain's own read of what this event means. */
  outcome?: EventOutcome;
};

/**
 * How big is this event, FOR THIS PERSON? (LIE §5.3, importance is relative.)
 *   20 km when your average is 5 km → 4× → large.
 *   A daily 5-minute walk sits at ≈1× and is frequent → trivial.
 */
export function calculateMagnitude(def: EventTypeDef, ctx: LifeEventContext = {}): Scored<number> {
  const reasons: string[] = [];
  let magnitude = def.baseWeight;
  let confidence: Confidence = "low";

  // 1) Deviation from the person's own baseline.
  if (
    ctx.metricValue != null &&
    ctx.baseline &&
    ctx.baseline.count >= MIN_BASELINE_SAMPLES &&
    ctx.baseline.mean > 0
  ) {
    const ratio = ctx.metricValue / ctx.baseline.mean;
    const deviation = Math.abs(ratio - 1);
    magnitude += Math.min(0.5, deviation * 0.5); // capped so one metric can't dominate
    confidence = "high";
    reasons.push(
      ratio >= 1.15
        ? `${ratio.toFixed(1)}× your usual ${ctx.baseline.metric}`
        : ratio <= 0.85
          ? `well below your usual ${ctx.baseline.metric}`
          : `about your usual ${ctx.baseline.metric}`
    );
  } else if (ctx.metricValue != null) {
    reasons.push("not enough history yet — using the event's baseline weight");
  }

  // 2) Novelty vs routine.
  if (ctx.recentSameTypeCount != null) {
    if (ctx.recentSameTypeCount === 0) {
      magnitude += 0.15;
      reasons.push("first time you've done this recently");
    } else if (ctx.recentSameTypeCount >= 20) {
      magnitude -= 0.1;
      reasons.push("a routine, frequent event for you");
    }
  }

  // 3) Goal & identity linkage — what the person is building matters more.
  if (ctx.linkedToActiveGoal) {
    magnitude += 0.1;
    reasons.push("tied to an active goal");
  }
  if (ctx.linkedToIdentityValue) {
    magnitude += 0.15;
    reasons.push("touches a declared value"); // Identity reaches into weighting
  }

  // 4) Streak milestones.
  if (ctx.streakLength != null && STREAK_MILESTONES.has(ctx.streakLength)) {
    magnitude += 0.2;
    reasons.push(`${ctx.streakLength}-day milestone`);
  }

  return { value: round2(clamp01(magnitude)), confidence, reasons };
}

/**
 * Which way does this event point, relative to the person's goals and values?
 * Positive: progress / achievement / improvement / consistency.
 * Neutral:  informational updates.
 * Negative: setbacks / unhealthy patterns / missed commitments.
 * Ambiguous: conflicting signals (a big expense that also funds a goal).
 */
export function calculateValence(def: EventTypeDef, ctx: LifeEventContext = {}): Scored<Valence> {
  const reasons: string[] = [];
  if (!ctx.outcome) {
    return {
      value: def.valenceHint,
      confidence: "low",
      reasons: ["direction from the event type's default (no outcome given)"],
    };
  }
  let value: Valence;
  switch (ctx.outcome) {
    case "progress":
    case "achievement":
    case "improvement":
    case "consistency":
      value = "positive";
      reasons.push(`${ctx.outcome} — moving toward what the person wants`);
      break;
    case "informational":
      value = "neutral";
      reasons.push("informational — no clear direction");
      break;
    case "setback":
    case "unhealthy":
    case "missed":
      value = "negative";
      reasons.push(`${ctx.outcome} — pulls against a goal or value`);
      break;
    case "mixed":
      value = "ambiguous";
      reasons.push("conflicting signals — good in one domain, costly in another");
      break;
  }
  return { value, confidence: "high", reasons };
}

/** Attention & memory tier from magnitude, with a milestone short-circuit (§5.3). */
export function deriveImportance(
  type: LifeEventType,
  magnitude: number,
  reasons: string[] = []
): Scored<Importance> {
  const out = [...reasons];
  if (MILESTONE_TYPES.has(type) && magnitude >= 0.5) {
    out.push("a milestone in the person's story");
    return { value: "pivotal", confidence: "high", reasons: out };
  }
  let tier: Importance;
  if (magnitude >= 0.8) tier = "pivotal";
  else if (magnitude >= 0.55) tier = "significant";
  else if (magnitude >= 0.3) tier = "notable";
  else tier = "trivial";
  out.push(`${tier} — from magnitude ${magnitude.toFixed(2)}`);
  return { value: tier, confidence: "high", reasons: out };
}

/** 0..1 — is this worth surfacing to the higher (attention) layers later?
 *  A hook for the future Decision Engine; not a decision itself. */
export function aiRelevance(importance: Importance, valence: Valence, confidence: Confidence): number {
  const impWeight: Record<Importance, number> = {
    trivial: 0.1,
    notable: 0.35,
    significant: 0.7,
    pivotal: 1,
  };
  const problemBump = valence === "negative" || valence === "ambiguous" ? 0.1 : 0;
  const confWeight = confidence === "high" ? 1 : 0.75;
  return round2(clamp01(impWeight[importance] * confWeight + problemBump));
}

/** Cheap, deterministic tags the later engines group on. Not analysis — hooks. */
export function deriveSignals(
  def: EventTypeDef,
  valence: Valence,
  links: EventLinks,
  tc: TimeContext
): Omit<EventIntelligence, "aiRelevance"> {
  const base = `${def.module}:${def.category}`;
  const patternSignals = [
    base,
    `valence:${valence}`,
    tc.isWeekend ? "weekend" : "weekday",
    `part:${tc.partOfDay}`,
  ];
  const recommendationSignals: string[] = [];
  if (valence === "negative") recommendationSignals.push(`watch:${base}`);
  if (links.goalIds?.length) recommendationSignals.push("goal-linked");
  const predictionSignals = [base];
  return { patternSignals, recommendationSignals, predictionSignals };
}

/** The single meaning-layer entry point: run every calc for one event. */
export type EventAssessment = {
  magnitude: number;
  valence: Valence;
  importance: Importance;
  intelligence: EventIntelligence;
  reasons: string[];
};

export function assessEvent(
  type: LifeEventType,
  def: EventTypeDef,
  links: EventLinks,
  timeContext: TimeContext,
  ctx: LifeEventContext = {}
): EventAssessment {
  const mag = calculateMagnitude(def, ctx);
  const val = calculateValence(def, ctx);
  const imp = deriveImportance(type, mag.value);
  const intelligence: EventIntelligence = {
    aiRelevance: aiRelevance(imp.value, val.value, mag.confidence),
    ...deriveSignals(def, val.value, links, timeContext),
  };
  return {
    magnitude: mag.value,
    valence: val.value,
    importance: imp.value,
    intelligence,
    reasons: [...mag.reasons, ...val.reasons, ...imp.reasons],
  };
}
