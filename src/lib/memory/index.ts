// ISA — Memory Engine · Public API
// The ONLY interface the rest of ISA uses to reach memory. Never query the
// ai_memory / memory_relationships / life_timeline tables directly.
//
// Reads are RLS-scoped to the signed-in user (no user_id filter needed, matching
// the app's convention). Heavy processing runs server-side (pg_cron nightly +
// process_my_memory RPC on demand); this layer only reads and lightly curates.

import { supabase } from "@/lib/supabase/client";
import type {
  MemoryRecord,
  MemoryRelationship,
  TimelineEntry,
  MemoryFilter,
  RelatedMemory,
  MemoryContext,
  MemorySummary,
  RememberInput,
} from "./types";

export type * from "./types";

const MEM = "ai_memory";
const REL = "memory_relationships";
const TL = "life_timeline";

// ─────────────────────────── RETRIEVAL ───────────────────────────

/** Generic, filtered retrieval — the workhorse behind the typed helpers. */
export async function retrieve(f: MemoryFilter = {}): Promise<MemoryRecord[]> {
  let q = supabase.from(MEM).select("*");
  if (f.type) q = Array.isArray(f.type) ? q.in("memory_type", f.type) : q.eq("memory_type", f.type);
  if (f.module) q = q.eq("source_module", f.module);
  if (f.importance) q = q.eq("importance", f.importance);
  if (f.status) q = q.eq("status", f.status);
  if (f.minScore != null) q = q.gte("importance_score", f.minScore);
  if (f.tag) q = q.contains("tags", [f.tag]);
  if (f.goalId) q = q.contains("links", { goalId: f.goalId });
  if (f.projectId) q = q.contains("links", { projectId: f.projectId });
  if (f.from) q = q.gte("last_event_at", f.from);
  if (f.to) q = q.lte("last_event_at", f.to);
  const { data } = await q
    .order("importance_score", { ascending: false })
    .limit(f.limit ?? 100);
  return (data as MemoryRecord[]) ?? [];
}

/** Most recently touched memories. */
export async function retrieveRecent(limit = 20): Promise<MemoryRecord[]> {
  const { data } = await supabase
    .from(MEM)
    .select("*")
    .neq("status", "archived")
    .order("last_event_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  return (data as MemoryRecord[]) ?? [];
}

/** Highest-importance memories first (the "what matters most" view). */
export async function retrieveImportant(limit = 20): Promise<MemoryRecord[]> {
  const { data } = await supabase
    .from(MEM)
    .select("*")
    .neq("status", "archived")
    .order("importance_score", { ascending: false })
    .order("last_event_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  return (data as MemoryRecord[]) ?? [];
}

export function retrieveByTag(tag: string, limit = 50): Promise<MemoryRecord[]> {
  return retrieve({ tag, limit });
}
export function retrieveByGoal(goalId: string): Promise<MemoryRecord[]> {
  return retrieve({ goalId });
}
export function retrieveByProject(projectId: string): Promise<MemoryRecord[]> {
  return retrieve({ projectId });
}

/** Walk the knowledge graph one hop out from a memory. */
export async function retrieveRelated(memoryId: string): Promise<RelatedMemory[]> {
  const { data: rels } = await supabase
    .from(REL)
    .select("*")
    .or(`from_memory.eq.${memoryId},to_memory.eq.${memoryId}`)
    .order("weight", { ascending: false });
  const edges = (rels as MemoryRelationship[]) ?? [];
  if (!edges.length) return [];
  const otherIds = edges.map((r) => (r.from_memory === memoryId ? r.to_memory : r.from_memory));
  const { data: mems } = await supabase.from(MEM).select("*").in("id", otherIds);
  const byId = new Map((mems as MemoryRecord[] | null ?? []).map((m) => [m.id, m]));
  return edges
    .map((r) => {
      const otherId = r.from_memory === memoryId ? r.to_memory : r.from_memory;
      const memory = byId.get(otherId);
      return memory ? { memory, rel_type: r.rel_type, weight: r.weight } : null;
    })
    .filter((x): x is RelatedMemory => x !== null);
}

/** The chronological Life Timeline (newest first). */
export async function retrieveTimeline(range?: { from?: string; to?: string; limit?: number }): Promise<TimelineEntry[]> {
  let q = supabase.from(TL).select("*");
  if (range?.from) q = q.gte("occurred_at", range.from);
  if (range?.to) q = q.lte("occurred_at", range.to);
  const { data } = await q.order("occurred_at", { ascending: false }).limit(range?.limit ?? 200);
  return (data as TimelineEntry[]) ?? [];
}

/** Keyword search over title / summary (input sanitized for the filter DSL).
 *  Full-text / semantic search is a later, additive LLM step. */
export async function search(query: string, limit = 30): Promise<MemoryRecord[]> {
  const term = query.replace(/[,()%*]/g, " ").trim();
  if (!term) return [];
  const { data } = await supabase
    .from(MEM)
    .select("*")
    .or(`title.ilike.%${term}%,summary.ilike.%${term}%,subject_key.ilike.%${term}%`)
    .order("importance_score", { ascending: false })
    .limit(limit);
  return (data as MemoryRecord[]) ?? [];
}

// ─────────────────────────── WRITES / CURATION ───────────────────────────

/** Manually store (or evolve) a memory — preferences, declared facts, system
 *  notes. Consolidates on (memory_type, subject_key). */
export async function remember(input: RememberInput): Promise<MemoryRecord | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const row = {
    user_id: user.id,
    memory_type: input.memory_type ?? "preference",
    subject_key: input.subject_key,
    title: input.title,
    summary: input.summary ?? "",
    importance: input.importance ?? "medium",
    importance_score:
      { critical: 1, high: 0.75, medium: 0.5, low: 0.25, temporary: 0.1 }[input.importance ?? "medium"],
    status: "active",
    tags: input.tags ?? [],
    source_module: "system",
    data: input.data ?? {},
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from(MEM)
    .upsert(row, { onConflict: "user_id,memory_type,subject_key" })
    .select()
    .single();
  return error ? null : (data as MemoryRecord);
}

/** Patch a memory's curatable fields. */
export async function update(
  id: string,
  patch: Partial<Pick<MemoryRecord, "title" | "summary" | "tags" | "importance" | "status" | "data">>
): Promise<boolean> {
  const { error } = await supabase
    .from(MEM)
    .update({ ...patch, updated_at: new Date().toISOString() } as never)
    .eq("id", id);
  return !error;
}

/** Soft-archive — kept for history, dropped from active views. */
export function archive(id: string): Promise<boolean> {
  return update(id, { status: "archived" });
}

/** Merge one memory into another: archive the source and record a
 *  "merged_into" edge (append-only spirit — nothing is destroyed). */
export async function merge(fromId: string, intoId: string): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || fromId === intoId) return false;
  await supabase.from(REL).upsert(
    { user_id: user.id, from_memory: fromId, to_memory: intoId, rel_type: "merged_into", weight: 1 },
    { onConflict: "user_id,from_memory,to_memory,rel_type" }
  );
  return archive(fromId);
}

// ─────────────────────────── AGGREGATION / AI CONTEXT ───────────────────────────

/** Roll up the whole memory set into headline numbers. */
export async function summarize(filter: MemoryFilter = {}): Promise<MemorySummary> {
  const all = await retrieve({ ...filter, limit: filter.limit ?? 1000 });
  const byType: Record<string, number> = {};
  const byImportance: Record<string, number> = {};
  const tagCounts = new Map<string, number>();
  for (const m of all) {
    byType[m.memory_type] = (byType[m.memory_type] ?? 0) + 1;
    byImportance[m.importance] = (byImportance[m.importance] ?? 0) + 1;
    for (const t of m.tags) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
  }
  const topTags = [...tagCounts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
  return {
    total: all.length,
    byType,
    byImportance,
    topTags,
    criticalCount: byImportance.critical ?? 0,
  };
}

/** Optimized, compact snapshot for future AI features (weekly/monthly/yearly
 *  reviews, recommendations, predictions, coach, NL search). One call gives an
 *  AI everything it needs about a person without touching the tables. */
export async function getMemoryContext(options: { importantLimit?: number; timelineLimit?: number } = {}): Promise<MemoryContext> {
  const [important, recentTimeline, summary, topRel] = await Promise.all([
    retrieveImportant(options.importantLimit ?? 15),
    retrieveTimeline({ limit: options.timelineLimit ?? 20 }),
    summarize(),
    supabase.from(REL).select("*").order("weight", { ascending: false }).limit(10),
  ]);
  const edges = (topRel.data as MemoryRelationship[] | null) ?? [];
  const ids = [...new Set(edges.flatMap((e) => [e.from_memory, e.to_memory]))];
  const label = new Map<string, string>();
  if (ids.length) {
    const { data } = await supabase.from(MEM).select("id,subject_key").in("id", ids);
    for (const m of (data as { id: string; subject_key: string }[] | null) ?? []) label.set(m.id, m.subject_key);
  }
  return {
    important,
    recentTimeline,
    summary,
    topConnections: edges.map((e) => ({
      from: label.get(e.from_memory) ?? e.from_memory,
      to: label.get(e.to_memory) ?? e.to_memory,
      rel_type: e.rel_type,
      weight: e.weight,
    })),
  };
}

// ─────────────────────────── PROCESSING ───────────────────────────

/** Trigger an immediate rebuild of the signed-in user's memory from their
 *  life_events (otherwise it refreshes nightly via pg_cron). */
export async function process(): Promise<boolean> {
  const { error } = await supabase.rpc("process_my_memory");
  return !error;
}
