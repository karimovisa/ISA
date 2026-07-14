// ISA — Goal intelligence. Deterministic, honest analysis: pace, prediction,
// next step. The user achieves; ISA measures, tracks, predicts, guides.
import type { Goal, GoalMilestone } from "@/lib/types";

export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

export type GoalPace = "no_deadline" | "ahead" | "on_track" | "behind" | "done";

export type GoalAnalysis = {
  pct: number;
  daysLeft: number | null;
  pace: GoalPace;
  paceLabel: string;
  prediction: string;
  nextStep: string | null;
  requiredWeekly: number | null;
  inactivityDays: number | null;
  insight: string | null;
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
    return { pct: 100, daysLeft, pace: "done", paceLabel: "Completed", prediction: "Done — nice work.", nextStep: null, requiredWeekly: 0, inactivityDays, insight: "Goal complete 🎉" };

  if (!deadline)
    return {
      pct, daysLeft: null, pace: "no_deadline", paceLabel: "No deadline",
      prediction: "Add a deadline to track pace.", nextStep, requiredWeekly: null, inactivityDays,
      insight: inactivityDays != null && inactivityDays >= 12 ? `Hasn't moved in ${inactivityDays} days.` : null,
    };

  const totalDays = Math.max(1, daysBetween(created, deadline));
  const elapsed = Math.min(1, Math.max(0, daysBetween(created, now) / totalDays));
  const expected = Math.round(elapsed * 100);
  const diff = pct - expected;
  let pace: GoalPace = "on_track";
  let paceLabel = "On track";
  if (diff >= 8) { pace = "ahead"; paceLabel = "Ahead of schedule"; }
  else if (diff <= -10) { pace = "behind"; paceLabel = "Behind schedule"; }

  const weeksLeft = daysLeft != null && daysLeft > 0 ? daysLeft / 7 : 0;
  const requiredWeekly = weeksLeft > 0 ? Math.ceil((100 - pct) / weeksLeft) : null;

  const daysElapsed = Math.max(1, daysBetween(created, now));
  const perDay = pct / daysElapsed;
  let prediction: string;
  if (perDay <= 0) {
    prediction = "Not enough movement to predict yet.";
  } else {
    const daysToFinish = Math.ceil((100 - pct) / perDay);
    const projected = daysToFinish - (daysLeft ?? 0);
    if (projected <= -1) prediction = `Likely to finish ${Math.abs(projected)} day${Math.abs(projected) === 1 ? "" : "s"} early.`;
    else if (projected >= 1) prediction = `Likely ${projected} day${projected === 1 ? "" : "s"} late unless pace rises.`;
    else prediction = "On track to finish right on time.";
  }

  let insight: string | null = null;
  if (inactivityDays != null && inactivityDays >= 12) insight = `Hasn't moved in ${inactivityDays} days.`;
  else if (pace === "behind" && requiredWeekly != null) insight = `You need about ${requiredWeekly}% this week to catch up.`;
  else if (pace === "ahead") insight = "You're ahead of schedule.";
  else if (daysLeft != null && daysLeft <= 3) insight = `Only ${daysLeft} days left.`;

  return { pct, daysLeft, pace, paceLabel, prediction, nextStep, requiredWeekly, inactivityDays, insight };
}
