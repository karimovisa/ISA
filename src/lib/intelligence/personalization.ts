// ISA — Intelligence Layer · Personalization (Behavior Context, LIE §6.2)
// Learns HOW this person tends to act — active hours, preferred domains, and
// working/motivation style — from their own event history. Descriptive, not
// prescriptive: it feeds grounding to other engines and is updated incrementally
// as more life arrives. It never treats a hard week as a permanent trait.

import type { IntelligenceContext } from "./context";
import { SOURCE_MODULES, toIntelModule } from "./context";
import { explain, sampleConfidence, patternEvidence } from "./explain";
import type {
  IntelModule,
  MotivationStyle,
  PersonalizationProfile,
  PlanningStyle,
  Rhythm,
} from "./types";

const PART = (h: number): "morning" | "afternoon" | "evening" | "night" =>
  h < 5 ? "night" : h < 12 ? "morning" : h < 18 ? "afternoon" : h < 22 ? "evening" : "night";

/** Learn the profile from the timeline (pivotal moments) + module signals.
 *  Deterministic; every number is derived from the person's own records. */
export function buildPersonalization(ctx: IntelligenceContext): PersonalizationProfile {
  const hourCounts = new Array(24).fill(0);
  const dayCounts = new Array(7).fill(0);
  let sample = 0;

  for (const t of ctx.timeline) {
    const d = new Date(t.occurred_at);
    if (Number.isNaN(d.getTime())) continue;
    hourCounts[d.getHours()] += 1;
    dayCounts[d.getDay()] += 1;
    sample += 1;
  }

  const rankedHours = hourCounts
    .map((count, hour) => ({ hour, count }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count);

  const activeHours = rankedHours.slice(0, 6).map((x) => x.hour);
  const quietHours = hourCounts
    .map((count, hour) => ({ hour, count }))
    .filter((x) => x.count === 0 && x.hour >= 6 && x.hour <= 23)
    .map((x) => x.hour)
    .slice(0, 6);

  // Preferred modules: normalized share of consolidated events.
  const totals = SOURCE_MODULES.map((m) => ({
    module: toIntelModule(m),
    weight: ctx.signalsByModule.get(m)!.occurrences,
  })).filter((x) => x.weight > 0);
  const totalWeight = totals.reduce((a, b) => a + b.weight, 0) || 1;
  const preferredModules = totals
    .map((x) => ({ module: x.module, weight: Math.round((x.weight / totalWeight) * 100) / 100 }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 6);

  // Motivation style: what kind of positive signal dominates?
  const s = ctx.signalsByModule;
  const streakish = s.get("habits")!.occurrences + s.get("prayer")!.occurrences;
  const progressish = s.get("goals")!.occurrences + s.get("projects")!.occurrences + s.get("focus")!.occurrences;
  const reflectish = s.get("journal")!.occurrences + s.get("ideas")!.occurrences;
  const motivationStyle: MotivationStyle =
    sample < 8
      ? "unknown"
      : streakish >= progressish && streakish >= reflectish
        ? "streak"
        : progressish >= reflectish
          ? "progress"
          : "reflection";

  // Planning style: when does the person most often act?
  const morning = hourCounts.slice(5, 12).reduce((a, b) => a + b, 0);
  const evening = hourCounts.slice(18, 24).reduce((a, b) => a + b, 0);
  const planningStyle: PlanningStyle =
    sample < 8 ? "unknown" : morning > evening * 1.3 ? "morning" : evening > morning * 1.3 ? "evening" : "adhoc";

  const rhythms: Record<string, Rhythm> = {
    activity: {
      label: "When you act",
      peakHours: activeHours,
      activeDays: dayCounts
        .map((count, day) => ({ day, count }))
        .filter((x) => x.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, 4)
        .map((x) => x.day),
      confidence: sampleConfidence(sample, 12),
      sample,
    },
  };

  const topHour = activeHours[0];
  const why =
    sample < 8
      ? "Still learning your rhythm — a couple more weeks of activity will sharpen this."
      : `You're most active around ${topHour}:00 (${PART(topHour ?? 12)}), and lean toward ${preferredModules[0]?.module ?? "no"} work.`;

  return {
    activeHours,
    quietHours,
    preferredModules,
    rhythms,
    motivationStyle,
    planningStyle,
    sample,
    updatedAt: new Date().toISOString(),
    explanation: explain({
      why,
      claim: sample < 8 ? "assumption" : "pattern",
      evidence: [patternEvidence("activity rhythm", `${sample} timeline moments`)],
      confidence: sampleConfidence(sample, 12),
    }),
  };
}

/** The best hour to reach the person, given their learned active hours and the
 *  current time. Used by Notification Intelligence to time delivery. */
export function bestContactHour(profile: PersonalizationProfile, fallback = 9): number {
  return profile.activeHours[0] ?? fallback;
}

/** Is this hour one the person is usually quiet in? (protect their attention) */
export function isQuietHour(profile: PersonalizationProfile, hour: number): boolean {
  return profile.quietHours.includes(hour);
}

/** Modules the person leans on, most-preferred first — for the Adaptive Dashboard. */
export function preferredModuleOrder(profile: PersonalizationProfile): IntelModule[] {
  return profile.preferredModules.map((p) => p.module);
}
