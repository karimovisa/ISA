// ISA — Intelligence Layer · AI Coach (AI Behavior Rules)
// The voice of a calm, warm, specific companion. It encourages, teaches and
// explains — it never shames, guilts, hypes, or overwhelms. It says one clear
// thing grounded in the person's real data, and it stays SILENT when it has
// nothing true and useful to say (returns null). Structure: observation →
// reasoning → optional suggestion.

import type { IntelligenceContext } from "./context";
import { deepLink, moduleLabel } from "./context";
import { greetingFor } from "@/lib/datetime";
import { computeAllScores, computeScore } from "./scoring";
import { explain, timelineEvidence, patternEvidence } from "./explain";
import type {
  CoachMessage,
  CoachMoment,
  CoachTone,
  IntelModule,
  Score,
} from "./types";

const partOfDay = (h: number): CoachMoment => (h < 12 ? "morning" : h < 18 ? "daily" : "evening");

function msg(params: {
  module: IntelModule;
  moment: CoachMoment;
  tone: CoachTone;
  headline: string;
  message: string;
  suggestion?: string | null;
  action?: { label: string; deepLink: string } | null;
  why: string;
  confidence: number;
  evidence?: ReturnType<typeof timelineEvidence>[];
}): CoachMessage {
  return {
    id: `coach:${params.moment}:${params.module}`,
    module: params.module,
    moment: params.moment,
    tone: params.tone,
    headline: params.headline,
    message: params.message,
    suggestion: params.suggestion ?? null,
    action: params.action ?? null,
    explanation: explain({
      why: params.why,
      claim: "pattern",
      evidence: params.evidence?.length ? params.evidence : [patternEvidence("coaching context")],
      confidence: params.confidence,
    }),
  };
}

/** Wins recorded on the Life Timeline today (pivotal, positive moments). */
function todaysWins(ctx: IntelligenceContext) {
  return ctx.timeline.filter((t) => t.occurred_at.slice(0, 10) === ctx.today);
}

/** The single weakest confident score — the one honest thing worth naming. */
function weakestScore(scores: Score[]): Score | null {
  const confident = scores.filter((s) => s.confidence >= 0.4);
  if (!confident.length) return null;
  return confident.reduce((a, b) => (b.value < a.value ? b : a));
}

/** The strongest confident score — for genuine, understated acknowledgement. */
function strongestScore(scores: Score[]): Score | null {
  const confident = scores.filter((s) => s.confidence >= 0.4);
  if (!confident.length) return null;
  return confident.reduce((a, b) => (b.value > a.value ? b : a));
}

const SCORE_MODULE: Partial<Record<Score["key"], IntelModule>> = {
  goal_health: "goals",
  habit_health: "habits",
  focus_health: "focus",
  financial_health: "money",
  project_health: "projects",
  recovery: "energy",
};

/** Recovery coaching — when the person looks depleted, the right move is REST,
 *  said plainly and without pressure. */
function recoveryCoach(ctx: IntelligenceContext): CoachMessage | null {
  const recovery = computeScore(ctx, "recovery");
  if (recovery.confidence < 0.4 || recovery.value >= 45) return null;
  return msg({
    module: "energy",
    moment: "recovery",
    tone: "recover",
    headline: "This looks like a recovery week",
    message: `Your recovery signals are low (${recovery.value}/100). That's a season, not a failing — capacity is genuinely down right now.`,
    suggestion: "Do less today and protect your sleep. The rest of your life recovers with it.",
    action: { label: "Open Progress", deepLink: deepLink("energy") },
    why: recovery.reason,
    confidence: recovery.confidence,
  });
}

/** Achievement/milestone coaching — mark a real win simply, connect it forward. */
function milestoneCoach(ctx: IntelligenceContext): CoachMessage | null {
  const wins = todaysWins(ctx);
  const pivotal = wins.find((w) => w.importance === "pivotal") ?? wins[0];
  if (!pivotal) return null;
  return msg({
    module: "dashboard",
    moment: "milestone",
    tone: "celebrate",
    headline: pivotal.title,
    message: `A real milestone today: ${pivotal.title}. Worth remembering how this one came together.`,
    suggestion: null,
    why: `Pivotal moment on your timeline (${pivotal.category}).`,
    confidence: 0.8,
    evidence: [timelineEvidence(pivotal)],
  });
}

/** The core daily message: greeting, the one thing that matters, gently. */
function timeOfDayCoach(ctx: IntelligenceContext): CoachMessage {
  const moment = partOfDay(ctx.now.getHours());
  const scores = computeAllScores(ctx);
  const wins = todaysWins(ctx);

  if (moment === "evening") {
    if (wins.length) {
      return msg({
        module: "dashboard",
        moment: "evening",
        tone: "encourage",
        headline: greetingFor(ctx.now),
        message: `You moved a few things today — ${wins.slice(0, 2).map((w) => w.title).join(", ")}. A quiet, steady day.`,
        suggestion: null,
        why: `${wins.length} timeline moments today.`,
        confidence: 0.7,
        evidence: wins.slice(0, 2).map(timelineEvidence),
      });
    }
    return msg({
      module: "dashboard",
      moment: "evening",
      tone: "explain",
      headline: greetingFor(ctx.now),
      message: "A calm evening. Nothing needs your attention from me tonight.",
      suggestion: null,
      why: "No pivotal events today; silence is the honest state.",
      confidence: 0.6,
    });
  }

  const weak = weakestScore(scores);
  if (weak && weak.value < 50) {
    const mod = SCORE_MODULE[weak.key] ?? "dashboard";
    return msg({
      module: mod,
      moment,
      tone: "suggest",
      headline: greetingFor(ctx.now),
      message: `If you want one focus today: ${weak.label.toLowerCase()} is the quietest part of your life right now (${weak.value}/100).`,
      suggestion: `A small step in ${moduleLabel(mod).toLowerCase()} would move it — no pressure if today isn't the day.`,
      action: { label: `Open ${moduleLabel(mod)}`, deepLink: deepLink(mod) },
      why: weak.reason,
      confidence: weak.confidence,
    });
  }

  const strong = strongestScore(scores);
  return msg({
    module: strong ? SCORE_MODULE[strong.key] ?? "dashboard" : "dashboard",
    moment,
    tone: "encourage",
    headline: greetingFor(ctx.now),
    message: strong
      ? `Things look steady${strong.value >= 60 ? ` — your ${strong.label.toLowerCase()} is a real strength (${strong.value}/100)` : ""}. Nothing urgent from me.`
      : "A fresh start. I'll learn your rhythm as the days add up.",
    suggestion: null,
    why: strong ? strong.reason : "Not enough history yet to coach specifically.",
    confidence: strong ? strong.confidence : 0.3,
  });
}

/** The daily coach: recovery > milestone > time-of-day. Returns exactly one
 *  message — the single most relevant — honoring "one clear thing". */
export function dailyCoach(ctx: IntelligenceContext): CoachMessage {
  return recoveryCoach(ctx) ?? milestoneCoach(ctx) ?? timeOfDayCoach(ctx);
}

/** A per-module coach message, or null when the module has nothing worth saying. */
export function moduleCoach(ctx: IntelligenceContext, module: IntelModule): CoachMessage | null {
  const scoreKey = (Object.entries(SCORE_MODULE).find(([, m]) => m === module)?.[0]) as
    | Score["key"]
    | undefined;
  if (!scoreKey) return null;
  const score = computeScore(ctx, scoreKey);
  if (score.confidence < 0.4) return null;

  const positive = score.value >= 60;
  return msg({
    module,
    moment: "daily",
    tone: positive ? "encourage" : "teach",
    headline: `${moduleLabel(module)} coach`,
    message: positive
      ? `${score.label} is holding well (${score.value}/100). Whatever you're doing here is working.`
      : `${score.label} is at ${score.value}/100 (${score.trend}). ${score.reason}`,
    suggestion: positive ? null : `One small, doable step beats a big plan here.`,
    action: { label: `Open ${moduleLabel(module)}`, deepLink: deepLink(module) },
    why: score.reason,
    confidence: score.confidence,
  });
}

/** All the candidate coach messages for a moment — the Decision Engine picks. */
export function coachCandidates(ctx: IntelligenceContext): CoachMessage[] {
  const out: CoachMessage[] = [];
  const recovery = recoveryCoach(ctx);
  const milestone = milestoneCoach(ctx);
  if (recovery) out.push(recovery);
  if (milestone) out.push(milestone);
  out.push(timeOfDayCoach(ctx));
  return out;
}
