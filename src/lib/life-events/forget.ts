// ISA — Forgetting. When the person deletes a goal, habit, project or savings
// goal, everything ISA derived from it goes too: its life events, the Life
// Timeline entries built from them, and its consolidated memories. Deleted means
// deleted — it must not resurface in the timeline, reviews or the AI's context.
//
// Events link to entities by id (links.goalIds …) but some older captures carry
// only a title in the payload, so both are matched.

import { supabase } from "@/lib/supabase/client";
import { invalidateContext } from "@/lib/intelligence";

export type ForgettableKind = "goal" | "habit" | "project" | "financeGoal";

const SPEC: Record<ForgettableKind, { link: string; types: string; titleKey: string; table: string; nameCol: string }> = {
  goal: { link: "goalIds", types: "Goal%", titleKey: "title", table: "goals", nameCol: "title" },
  habit: { link: "habitIds", types: "Habit%", titleKey: "habit", table: "habits", nameCol: "name" },
  project: { link: "taskIds", types: "Project%", titleKey: "title", table: "projects", nameCol: "title" },
  financeGoal: { link: "financeGoalIds", types: "SavingGoal%", titleKey: "name", table: "finance_goals", nameCol: "name" },
};

/** Delete these life events plus the timeline entries and milestone memories made from them. */
async function dropEvents(ids: string[]): Promise<void> {
  if (!ids.length) return;
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    await Promise.all([
      supabase.from("life_timeline").delete().in("event_id", chunk),
      supabase.from("ai_memory").delete().eq("memory_type", "milestone").in("subject_key", chunk),
    ]);
    await supabase.from("life_events").delete().in("id", chunk);
  }
}

/** Remove every trace of a deleted entity. Best-effort; never throws. */
export async function forgetEntity(kind: ForgettableKind, id: string, title?: string): Promise<void> {
  const s = SPEC[kind];
  try {
    const [byLink, byTitle] = await Promise.all([
      supabase.from("life_events").select("id").contains("links", { [s.link]: [id] }),
      title
        ? supabase.from("life_events").select("id").like("event_type", s.types).eq(`payload->>${s.titleKey}`, title)
        : Promise.resolve({ data: [] as { id: string }[] }),
    ]);
    const ids = [...new Set([...(byLink.data ?? []), ...(byTitle.data ?? [])].map((e) => (e as { id: string }).id))];
    await Promise.all([dropEvents(ids), supabase.from("ai_memory").delete().eq("subject_key", id)]);
    invalidateContext();
  } catch {
    /* forgetting is best-effort — the delete itself already happened */
  }
}

/**
 * One-time sweep for traces of things deleted before forgetEntity existed: life
 * events of a goal/habit/project/savings-goal type whose entity no longer exists
 * (by id, or — for id-less captures — by title).
 */
export async function pruneOrphans(): Promise<number> {
  let removed = 0;
  try {
    for (const kind of Object.keys(SPEC) as ForgettableKind[]) {
      const s = SPEC[kind];
      const [{ data: live }, { data: evs }] = await Promise.all([
        supabase.from(s.table).select(`id,${s.nameCol}`),
        supabase.from("life_events").select("id,links,payload").like("event_type", s.types),
      ]);
      if (!live || !evs) continue;
      const ids = new Set((live as unknown as Record<string, string>[]).map((r) => r.id));
      const names = new Set((live as unknown as Record<string, string>[]).map((r) => r[s.nameCol]));
      const orphans = (evs as { id: string; links: Record<string, string[]> | null; payload: Record<string, unknown> | null }[])
        .filter((e) => {
          const linked = e.links?.[s.link];
          if (linked?.length) return linked.every((x) => !ids.has(x));
          // Habits get renamed and their check-ins carry only the name — never
          // judge a habit event by title, or a rename would erase its history.
          if (kind === "habit") return false;
          const t = e.payload?.[s.titleKey];
          return typeof t === "string" && t !== "" && !names.has(t);
        })
        .map((e) => e.id);
      await dropEvents(orphans);
      // Entity memories (memory_type goal/habit/project/finance_goal) keyed by a dead id.
      const memType = kind === "financeGoal" ? "finance_goal" : kind;
      const { data: mems } = await supabase.from("ai_memory").select("id,subject_key").eq("memory_type", memType);
      const deadMems = ((mems as { id: string; subject_key: string }[] | null) ?? []).filter((m) => !ids.has(m.subject_key)).map((m) => m.id);
      if (deadMems.length) await supabase.from("ai_memory").delete().in("id", deadMems);
      removed += orphans.length + deadMems.length;
    }
    if (removed) invalidateContext();
  } catch {
    /* best-effort */
  }
  return removed;
}
