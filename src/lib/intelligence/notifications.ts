// ISA — Intelligence Layer · Notification Intelligence (LIE §12.6 — one authority)
// Every notification passes through the Decision Engine; there is no side
// channel. This layer then decides WHEN to deliver (the person's active hours,
// never their quiet hours), MERGES similar reminders, SUPPRESSES anything that
// didn't earn attention, and escalates only when something truly matters.

import type { IntelligenceContext } from "./context";
import { moduleLabel } from "./context";
import { buildPersonalization, bestContactHour, isQuietHour } from "./personalization";
import { arbitrate } from "./decision";
import { generateRecommendations } from "./recommendations";
import { confidentPredictions } from "./predictions";
import { coachCandidates } from "./coach";
import type { Candidate, NotificationPlan, Priority } from "./types";

const priorityOfCandidate = (c: Candidate): Priority =>
  c.importance >= 0.8 ? "critical" : c.importance >= 0.6 ? "high" : c.importance >= 0.4 ? "medium" : "low";

/** Next ISO timestamp at `hour` local, today if still ahead, else tomorrow. */
function nextAt(now: Date, hour: number): string {
  const d = new Date(now);
  d.setMinutes(0, 0, 0);
  d.setHours(hour);
  if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 1);
  return d.toISOString();
}

/** Choose an intelligent delivery time: escalate urgent items to the next active
 *  hour; otherwise wait for the person's best hour; never land in quiet hours. */
function deliveryTime(ctx: IntelligenceContext, profile: ReturnType<typeof buildPersonalization>, priority: Priority): string {
  const now = ctx.now;
  const hour = now.getHours();
  let target = bestContactHour(profile);

  if (priority === "critical") {
    // Soon — but still nudge out of a quiet hour to the next non-quiet hour.
    let h = hour + 1;
    while (isQuietHour(profile, h % 24) && h < hour + 12) h += 1;
    return nextAt(now, h % 24);
  }
  if (isQuietHour(profile, target)) {
    const active = profile.activeHours.find((a) => !isQuietHour(profile, a));
    if (active != null) target = active;
  }
  return nextAt(now, target);
}

/**
 * Build the notification plan. Returns delivered plans (arbitration winners,
 * timed & merged) and suppressed plans (held/deferred — surfaced only so the UI
 * can show, transparently, what ISA chose NOT to interrupt with).
 */
export function planNotifications(
  ctx: IntelligenceContext,
  opts: { dismissedIds?: string[]; baseBudget?: number } = {}
): { delivered: NotificationPlan[]; suppressed: NotificationPlan[] } {
  const profile = buildPersonalization(ctx);
  const decision = arbitrate(
    ctx,
    {
      recommendations: generateRecommendations(ctx),
      predictions: confidentPredictions(ctx),
      coach: coachCandidates(ctx),
    },
    { dismissedIds: opts.dismissedIds, baseBudget: opts.baseBudget }
  );

  // Merge surfaced candidates that share a module into a single reminder.
  const byModule = new Map<string, Candidate[]>();
  for (const c of decision.surfaced) {
    const arr = byModule.get(c.module) ?? [];
    arr.push(c);
    byModule.set(c.module, arr);
  }

  const delivered: NotificationPlan[] = [];
  for (const [module, group] of byModule) {
    const lead = group[0];
    const priority = priorityOfCandidate(lead);
    const merged = group.slice(1).map((c) => c.id);
    delivered.push({
      id: `notif:${module}`,
      title: group.length > 1 ? `${moduleLabel(lead.module)}: ${group.length} things worth a moment` : lead.title,
      body:
        group.length > 1
          ? group.map((c) => `• ${c.title}`).join("\n")
          : lead.title,
      module: lead.module,
      deliverAt: deliveryTime(ctx, profile, priority),
      priority,
      suppressed: false,
      mergedFrom: merged,
      reason:
        group.length > 1
          ? `${group.length} candidates for ${moduleLabel(lead.module)} merged into one calm reminder.`
          : "Earned attention through the Decision Engine.",
    });
  }

  // Held candidates are deliberately NOT interrupted — recorded as suppressed.
  const suppressed: NotificationPlan[] = decision.held.map((c) => ({
    id: `notif:held:${c.id}`,
    title: c.title,
    body: "Held for your next review rather than interrupting you.",
    module: c.module,
    deliverAt: nextAt(ctx.now, bestContactHour(profile)),
    priority: priorityOfCandidate(c),
    suppressed: true,
    mergedFrom: [],
    reason: "True and aligned, but not worth an interruption right now (calm by default).",
  }));

  return { delivered, suppressed };
}
