// ISA — Intelligence Layer · Adaptive Dashboard (Adaptive surface)
// Lets ISA gently reorder the dashboard by what matters to THIS person right now
// — learned from frequency, recency, importance, time-of-day and current risk.
// It evolves gradually (blends with a stable base order so nothing jumps), never
// confuses the user, and can be switched off entirely (adaptive = opt-in).

import type { SourceModule } from "@/lib/life-events";
import type { IntelligenceContext } from "./context";
import { moduleLabel, toIntelModule } from "./context";
import { buildPersonalization } from "./personalization";
import { computeAllScores } from "./scoring";
import type { DashboardSlot, IntelModule, Score } from "./types";

/** The stable, human-sensible default order — the anchor adaptation blends with. */
const BASE_ORDER: IntelModule[] = [
  "dashboard",
  "goals",
  "habits",
  "focus",
  "money",
  "prayer",
  "journal",
  "running",
  "ideas",
  "calendar",
  "progress",
];

const scoreModule: Partial<Record<Score["key"], IntelModule>> = {
  goal_health: "goals",
  habit_health: "habits",
  focus_health: "focus",
  financial_health: "money",
  project_health: "projects",
  recovery: "progress",
};

/**
 * Compute the adaptive dashboard order. `strength` (0..1) controls how far it may
 * drift from the base order — small by default so the surface evolves gently.
 */
export function adaptiveDashboard(ctx: IntelligenceContext, strength = 0.35): DashboardSlot[] {
  const profile = buildPersonalization(ctx);
  const scores = computeAllScores(ctx);
  const hour = ctx.now.getHours();

  // Base weight from stable order (earlier = higher).
  const baseWeight = new Map<IntelModule, number>();
  BASE_ORDER.forEach((m, i) => baseWeight.set(m, 1 - i / BASE_ORDER.length));

  // Preference weight from learned behaviour.
  const prefWeight = new Map<IntelModule, number>();
  for (const p of profile.preferredModules) prefWeight.set(p.module, p.weight);

  // Recency + risk boosts: a struggling or freshly-active domain rises.
  const dynamic = new Map<IntelModule, { weight: number; reason: string }>();
  for (const [m, sig] of ctx.signalsByModule) {
    const mod = toIntelModule(m as SourceModule);
    const recency = sig.recencyDays == null ? 0 : Math.exp(-sig.recencyDays / 7);
    dynamic.set(mod, { weight: recency * 0.5, reason: sig.lastEventAt ? `active ${sig.recencyDays}d ago` : "" });
  }
  for (const s of scores) {
    const mod = scoreModule[s.key];
    if (!mod || s.confidence < 0.35) continue;
    if (s.value < 45) {
      const prev = dynamic.get(mod) ?? { weight: 0, reason: "" };
      dynamic.set(mod, { weight: prev.weight + 0.4, reason: `${s.label} needs attention (${s.value}/100)` });
    }
  }

  // Time-of-day nudge: journaling in the evening, focus/goals in the morning.
  const timeBoost: Record<IntelModule, number> = {} as Record<IntelModule, number>;
  if (hour < 12) {
    timeBoost.focus = 0.25;
    timeBoost.goals = 0.2;
  } else if (hour >= 18) {
    timeBoost.journal = 0.25;
    timeBoost.progress = 0.15;
  }

  const modules = Array.from(new Set([...BASE_ORDER, ...dynamic.keys()]));
  const slots: DashboardSlot[] = modules.map((mod) => {
    const base = baseWeight.get(mod) ?? 0.1;
    const pref = prefWeight.get(mod) ?? 0;
    const dyn = dynamic.get(mod);
    const adaptive = pref * 0.4 + (dyn?.weight ?? 0) + (timeBoost[mod] ?? 0);
    const weight = base * (1 - strength) + adaptive * strength;
    const reason = dyn?.reason
      ? `${moduleLabel(mod)}: ${dyn.reason}`
      : pref > 0.15
        ? `${moduleLabel(mod)}: one of your most-used areas`
        : `${moduleLabel(mod)}: standard placement`;
    return { module: mod, weight: Math.round(weight * 100) / 100, reason };
  });

  return slots.sort((a, b) => b.weight - a.weight);
}

/** Adaptive order as a plain module list (for callers that just want the order). */
export function adaptiveModuleOrder(ctx: IntelligenceContext, strength = 0.35): IntelModule[] {
  return adaptiveDashboard(ctx, strength).map((s) => s.module);
}

/** The non-adaptive baseline, for when the user turns adaptivity off. */
export function baseDashboardOrder(): IntelModule[] {
  return [...BASE_ORDER];
}
