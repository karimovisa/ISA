// ISA — Intelligence Layer · Context hub (Performance Intelligence §17)
// The SINGLE place the whole layer reads the Foundation. Every engine takes an
// already-loaded IntelligenceContext so one screen paint = one batched fetch,
// cached briefly, never recomputed per engine.
//
// It reads ONLY the Foundation's public APIs (memory / insights / reviews /
// entitlements) — never a table, never the Foundation's internals. RLS in those
// APIs already scopes everything to the signed-in user (Security §18).

import { getMemoryContext, retrieve, retrieveTimeline } from "@/lib/memory";
import type { MemoryContext, MemoryRecord, TimelineEntry } from "@/lib/memory";
import { retrieveInsights } from "@/lib/insights";
import type { Insight } from "@/lib/insights";
import { retrieveReviews } from "@/lib/reviews";
import type { Review } from "@/lib/reviews";
import { loadEntitlements } from "@/lib/entitlements";
import type { Entitlements } from "@/lib/entitlements";
import type { SourceModule } from "@/lib/life-events";
import { todayISO } from "@/lib/datetime";
import { buildIdentity } from "./identity";
import type { IdentityProfile, IntelModule } from "./types";

/** The every-module SourceModule list, so signal maps are always complete. */
export const SOURCE_MODULES: SourceModule[] = [
  "tasks",
  "money",
  "goals",
  "projects",
  "habits",
  "focus",
  "journal",
  "calendar",
  "prayer",
  "energy",
  "health",
  "ideas",
  "system",
];

/** Everything one engine needs to know about ONE module, pre-aggregated. */
export type ModuleSignal = {
  module: SourceModule;
  memories: number;
  occurrences: number; // total consolidated events behind those memories
  avgMagnitude: number; // 0..1
  importanceScore: number; // 0..1, the strongest memory in the module
  lastEventAt: string | null;
  recencyDays: number | null; // whole days since the last event, null if never
  positiveInsights: Insight[];
  negativeInsights: Insight[];
  trendUp: number; // # of positive_trend / improvement insights
  trendDown: number; // # of negative_trend / decline insights
};

/** The immutable snapshot every engine reasons over. */
export type IntelligenceContext = {
  now: Date;
  today: string; // YYYY-MM-DD local
  memory: MemoryContext;
  memories: MemoryRecord[]; // broad set for signal derivation
  timeline: TimelineEntry[];
  insights: Insight[];
  reviews: { monthly: Review[]; yearly: Review[] };
  entitlements: Entitlements | null;
  identity: IdentityProfile; // the apex constraint (LIE §6.1)
  signalsByModule: Map<SourceModule, ModuleSignal>;
  loadedAt: number; // epoch ms
};

const daysBetween = (from: string, to: Date): number =>
  Math.max(0, Math.floor((to.getTime() - new Date(from).getTime()) / 86_400_000));

const POSITIVE_INSIGHTS = new Set(["positive_trend", "consistency", "milestone"]);
const NEGATIVE_INSIGHTS = new Set(["negative_trend", "anomaly"]);

/** Map an insight to a module using the subject_key → module index built from
 *  memories. Unresolved insights are treated as cross-cutting (not dropped). */
function classifyInsight(insight: Insight, subjectToModule: Map<string, SourceModule>): SourceModule | null {
  return subjectToModule.get(insight.subject_key) ?? null;
}

/** Pre-aggregate memories + insights into per-module signals. Deterministic. */
export function deriveSignals(
  memories: MemoryRecord[],
  insights: Insight[],
  now: Date
): Map<SourceModule, ModuleSignal> {
  const map = new Map<SourceModule, ModuleSignal>();
  for (const m of SOURCE_MODULES) {
    map.set(m, {
      module: m,
      memories: 0,
      occurrences: 0,
      avgMagnitude: 0,
      importanceScore: 0,
      lastEventAt: null,
      recencyDays: null,
      positiveInsights: [],
      negativeInsights: [],
      trendUp: 0,
      trendDown: 0,
    });
  }

  const subjectToModule = new Map<string, SourceModule>();
  const magSum = new Map<SourceModule, number>();

  for (const mem of memories) {
    const mod = (SOURCE_MODULES.includes(mem.source_module as SourceModule)
      ? (mem.source_module as SourceModule)
      : "system") as SourceModule;
    const sig = map.get(mod);
    if (!sig) continue;
    subjectToModule.set(mem.subject_key, mod);
    sig.memories += 1;
    sig.occurrences += mem.occurrence_count ?? 0;
    magSum.set(mod, (magSum.get(mod) ?? 0) + (mem.magnitude_avg ?? 0));
    sig.importanceScore = Math.max(sig.importanceScore, mem.importance_score ?? 0);
    if (mem.last_event_at && (!sig.lastEventAt || mem.last_event_at > sig.lastEventAt)) {
      sig.lastEventAt = mem.last_event_at;
    }
  }

  for (const [mod, sig] of map) {
    if (sig.memories > 0) sig.avgMagnitude = (magSum.get(mod) ?? 0) / sig.memories;
    if (sig.lastEventAt) sig.recencyDays = daysBetween(sig.lastEventAt, now);
  }

  for (const ins of insights) {
    const mod = classifyInsight(ins, subjectToModule);
    if (!mod) continue;
    const sig = map.get(mod);
    if (!sig) continue;
    if (ins.valence === "positive" || POSITIVE_INSIGHTS.has(ins.insight_type)) {
      sig.positiveInsights.push(ins);
      if (ins.insight_type === "positive_trend") sig.trendUp += 1;
    }
    if (ins.valence === "negative" || NEGATIVE_INSIGHTS.has(ins.insight_type)) {
      sig.negativeInsights.push(ins);
      if (ins.insight_type === "negative_trend") sig.trendDown += 1;
    }
  }

  return map;
}

// ─────────────────────────── caching ───────────────────────────
// A single signed-in user per client session, so a process-wide TTL cache is
// correct and cheap. invalidate() is called after any write the layer performs.

let cache: { ctx: IntelligenceContext; at: number } | null = null;
const TTL_MS = 60_000;

/** Load (or reuse) the shared context. Pass `force` to bypass the cache. */
export async function loadIntelligenceContext(
  opts: { force?: boolean } = {}
): Promise<IntelligenceContext> {
  const now = Date.now();
  if (!opts.force && cache && now - cache.at < TTL_MS) return cache.ctx;

  const [memory, memories, timeline, insights, monthly, yearly, entitlements] = await Promise.all([
    getMemoryContext({ importantLimit: 20, timelineLimit: 40 }),
    retrieve({ limit: 500 }),
    retrieveTimeline({ limit: 200 }),
    retrieveInsights({ limit: 300 }),
    retrieveReviews("monthly", 6),
    retrieveReviews("yearly", 3),
    loadEntitlements(),
  ]);

  const nowDate = new Date();
  const ctx: IntelligenceContext = {
    now: nowDate,
    today: todayISO(),
    memory,
    memories,
    timeline,
    insights,
    reviews: { monthly, yearly },
    entitlements,
    identity: buildIdentity(memories),
    signalsByModule: deriveSignals(memories, insights, nowDate),
    loadedAt: now,
  };
  cache = { ctx, at: now };
  return ctx;
}

/** Drop the cache so the next load re-reads the Foundation. */
export function invalidateContext(): void {
  cache = null;
}

// ─────────────────────────── module helpers ───────────────────────────

const ROUTES: Record<IntelModule, string> = {
  dashboard: "/",
  goals: "/goals",
  projects: "/projects",
  habits: "/habits",
  focus: "/focus",
  journal: "/journal",
  money: "/money",
  prayer: "/pray",
  running: "/progress",
  calendar: "/calendar",
  ideas: "/ideas",
  progress: "/progress",
  energy: "/progress",
  tasks: "/",
};

/** Deep link for a module. The one place routes are mapped, so a route rename
 *  is a single edit for the whole layer. */
export function deepLink(module: IntelModule): string {
  return ROUTES[module] ?? "/";
}

/** Present a SourceModule under its user-facing name. */
export function toIntelModule(m: SourceModule): IntelModule {
  if (m === "health") return "running";
  return m as IntelModule;
}

const LABELS: Record<IntelModule, string> = {
  dashboard: "Dashboard",
  goals: "Goals",
  projects: "Projects",
  habits: "Habits",
  focus: "Focus",
  journal: "Journal",
  money: "Money",
  prayer: "Prayer",
  running: "Running",
  calendar: "Calendar",
  ideas: "Ideas",
  progress: "Progress",
  energy: "Energy",
  tasks: "Tasks",
};

export function moduleLabel(m: IntelModule): string {
  return LABELS[m] ?? m;
}
