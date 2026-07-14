// ISA — Intelligence Layer · Daily Intelligence (LIE §14, "what matters today")
// One calm, realistic picture of the day. It leans on the Decision Engine so the
// "suggested actions" are the few that earned attention — not a to-do dump. Every
// section can be empty; a quiet day is a valid, good day.

import type { IntelligenceContext } from "./context";
import { computePriorities, riskPriorities } from "./prioritization";
import { generateRecommendations, generateOpportunities } from "./recommendations";
import { confidentPredictions } from "./predictions";
import { coachCandidates, dailyCoach } from "./coach";
import { arbitrate } from "./decision";
import { greetingFor } from "@/lib/datetime";
import { explain, patternEvidence } from "./explain";
import type { DailyBrief, Recommendation } from "./types";

/** Assemble today's brief. `dismissedIds` lets the Decision Engine respect what
 *  the user already waved away. */
export function buildDailyBrief(ctx: IntelligenceContext, dismissedIds: string[] = []): DailyBrief {
  const priorities = computePriorities(ctx).slice(0, 3);
  const risks = riskPriorities(ctx);
  const opportunities = generateOpportunities(ctx).slice(0, 2);
  const recs = generateRecommendations(ctx);

  const decision = arbitrate(
    ctx,
    { recommendations: recs, predictions: confidentPredictions(ctx), coach: coachCandidates(ctx) },
    { dismissedIds }
  );
  const suggestedActions = decision.surfaced
    .filter((c) => c.kind === "recommendation")
    .map((c) => c.payload as Recommendation);

  const wins = ctx.timeline
    .filter((t) => t.occurred_at.slice(0, 10) === ctx.today)
    .map((t) => t.title)
    .slice(0, 5);

  const coach = dailyCoach(ctx);
  const recovery = coach.moment === "recovery" ? coach : null;

  // Tomorrow prep: the top unaddressed priority + the nearest high-risk forecast.
  const tomorrow: string[] = [];
  if (priorities[0]) tomorrow.push(`Carry forward: ${priorities[0].title}`);
  const risk = confidentPredictions(ctx).find((p) => p.risk === "high");
  if (risk) tomorrow.push(`Watch: ${risk.title.toLowerCase()} — ${risk.outlook}`);

  const headline = risks[0]
    ? `${risks[0].title}`
    : priorities[0]
      ? `Today, the one that matters: ${priorities[0].title}`
      : "A calm day — nothing pressing from me.";

  return {
    date: ctx.today,
    greeting: greetingFor(ctx.now),
    headline,
    priorities,
    risks,
    opportunities,
    suggestedActions,
    wins,
    recovery,
    tomorrow,
    coach,
    explanation: explain({
      why: `Built from ${priorities.length} priorities, ${recs.length} candidate actions (${suggestedActions.length} surfaced), and ${wins.length} of today's moments.`,
      claim: "fact",
      evidence: [patternEvidence("daily synthesis", `${ctx.timeline.length} timeline entries`)],
      confidence: 0.85,
    }),
  };
}
