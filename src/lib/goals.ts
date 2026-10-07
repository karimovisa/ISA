// ISA — Goal intelligence. Deterministic, honest analysis: pace, prediction,
// next step. The user achieves; ISA measures, tracks, predicts, guides.
import type { Goal, GoalMilestone } from "@/lib/types";

export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

export type GoalPace = "no_deadline" | "ahead" | "on_track" | "behind" | "done";

/** A translatable message: an English key for t() plus its variables. */
export type GoalNote = { text: string; vars?: Record<string, string | number> };

/** When the goal lands at the current pace. */
export type GoalForecast =
  | { kind: "stalled" }
  | {
      kind: "date";
      finish: Date;
      /** Days after (+) or before (−) the deadline; null without one. */
      vsDeadline: number | null;
      /** "recent" = last 3 weeks of milestones; "overall" = since the goal began. */
      basis: "recent" | "overall";
    };

/** Recent pace looks back this far — the last few weeks say more than the start. */
const RECENT_DAYS = 21;
/** Beyond this the date is noise; call it stalled instead. */
const MAX_FORECAST_DAYS = 3 * 365;

/**
 * Project the finish date. Prefers the pace of the last 3 weeks (milestones
 * ticked off, by their done_at) — someone who started slow and sped up should
 * see the date their CURRENT pace gives. Falls back to the average since the goal
 * began; "stalled" when nothing has moved.
 */
export function forecastGoal(goal: Goal, milestones: GoalMilestone[], pct: number, now = new Date()): GoalForecast | null {
  if (pct >= 100) return null;
  let perDay = 0;
  let basis: "recent" | "overall" = "overall";
  if (milestones.length) {
    const since = now.getTime() - RECENT_DAYS * 86_400_000;
    const recent = milestones.filter((m) => m.done && m.done_at && new Date(m.done_at).getTime() >= since).length;
    if (recent > 0) {
      perDay = ((recent / milestones.length) * 100) / RECENT_DAYS;
      basis = "recent";
    }
  }
  if (perDay <= 0) {
    const elapsed = Math.max(1, daysBetween(new Date(goal.created_at), now));
    perDay = pct / elapsed;
  }
  if (perDay <= 0) return { kind: "stalled" };
  const days = Math.ceil((100 - pct) / perDay);
  if (days > MAX_FORECAST_DAYS) return { kind: "stalled" };
  const finish = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);
  const vsDeadline = goal.deadline ? daysBetween(new Date(`${goal.deadline}T00:00:00`), finish) : null;
  return { kind: "date", finish, vsDeadline, basis };
}

export type GoalAnalysis = {
  pct: number;
  daysLeft: number | null;
  pace: GoalPace;
  paceLabel: string;
  forecast: GoalForecast | null;
  nextStep: string | null;
  requiredWeekly: number | null;
  inactivityDays: number | null;
  insight: GoalNote | null;
};

/** Progress is milestones done/total when any exist, else the stored value. */
export function goalPct(goal: Goal, milestones: GoalMilestone[]): number {
  if (milestones.length === 0) return goal.percentage ?? 0;
  return Math.round((milestones.filter((m) => m.done).length / milestones.length) * 100);
}

export function analyzeGoal(goal: Goal, milestones: GoalMilestone[], now = new Date()): GoalAnalysis {
  const total = milestones.length;
  const pct = goalPct(goal, milestones);
  const created = new Date(goal.created_at);
  const deadline = goal.deadline ? new Date(goal.deadline) : null;
  const daysLeft = deadline ? daysBetween(now, deadline) : null;

  const pending = milestones.filter((m) => !m.done).sort((a, b) => a.position - b.position);
  const nextStep = pending[0]?.title ?? (total === 0 ? null : null);

  const lastDone = milestones
    .filter((m) => m.done && m.done_at)
    .map((m) => new Date(m.done_at as string).getTime())
    .sort((a, b) => b - a)[0];
  const inactivityDays = lastDone
    ? daysBetween(new Date(lastDone), now)
    : total > 0
      ? daysBetween(created, now)
      : null;

  if (pct >= 100)
    return { pct: 100, daysLeft, pace: "done", paceLabel: "Completed", forecast: null, nextStep: null, requiredWeekly: 0, inactivityDays, insight: { text: "Goal complete 🎉" } };

  const forecast = forecastGoal(goal, milestones, pct, now);

  if (!deadline)
    return {
      pct, daysLeft: null, pace: "no_deadline", paceLabel: "No deadline",
      forecast, nextStep, requiredWeekly: null, inactivityDays,
      insight: inactivityDays != null && inactivityDays >= 12 ? { text: "Hasn't moved in {n} days.", vars: { n: inactivityDays } } : null,
    };

  const totalDays = Math.max(1, daysBetween(created, deadline));
  const elapsed = Math.min(1, Math.max(0, daysBetween(created, now) / totalDays));
  const expected = Math.round(elapsed * 100);
  const diff = pct - expected;
  let pace: GoalPace = "on_track";
  let paceLabel = "On track";
  if (diff >= 8) { pace = "ahead"; paceLabel = "Ahead of schedule"; }
  else if (diff <= -10) { pace = "behind"; paceLabel = "Behind schedule"; }
  // When ISA can project a finish date, the label follows it — a goal that
  // started slowly but is now on pace to land early is not "behind".
  if (forecast?.kind === "date" && forecast.vsDeadline != null) {
    if (forecast.vsDeadline <= -7) { pace = "ahead"; paceLabel = "Ahead of schedule"; }
    else if (forecast.vsDeadline > 7) { pace = "behind"; paceLabel = "Behind schedule"; }
    else { pace = "on_track"; paceLabel = "On track"; }
  }

  const weeksLeft = daysLeft != null && daysLeft > 0 ? daysLeft / 7 : 0;
  const requiredWeekly = weeksLeft > 0 ? Math.ceil((100 - pct) / weeksLeft) : null;

  let insight: GoalNote | null = null;
  if (inactivityDays != null && inactivityDays >= 12) insight = { text: "Hasn't moved in {n} days.", vars: { n: inactivityDays } };
  else if (pace === "behind" && requiredWeekly != null) insight = { text: "You need about {n}% this week to catch up.", vars: { n: requiredWeekly } };
  else if (pace === "ahead") insight = { text: "You're ahead of schedule." };
  else if (daysLeft != null && daysLeft <= 3) insight = { text: "Only {n} days left.", vars: { n: daysLeft } };

  return { pct, daysLeft, pace, paceLabel, forecast, nextStep, requiredWeekly, inactivityDays, insight };
}
