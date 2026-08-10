// ISA — Tasks & Habits V2, Phase 3 detection (§9 recovery, §14 adaptation,
// §10 patterns). Deterministic rule-based heuristics, no LLM: fast, predictable,
// and quiet — it surfaces one useful nudge at a time, never a dashboard.

import type { Habit, HabitCompletionType } from "@/lib/types";

export type HabitLogLite = {
  habit_id: string;
  date: string;
  completed: boolean;
  completion_type: HabitCompletionType | null;
  completed_at: string | null;
};

export type PartOfDay = "morning" | "afternoon" | "evening" | "night";

export type Suggestion =
  | { kind: "recovery"; habit: Habit }
  | { kind: "adaptive"; habit: Habit; minimumCount: number; currentTarget: number; suggestedTarget: number; unit: string | null }
  | { kind: "insight"; habit: Habit; part: PartOfDay; time: string };

export type TimeInsight = { part: PartOfDay; time: string };

function daysBetween(from: Date, to: Date): number {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b - a) / 86_400_000);
}
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function isDueOn(h: Habit, date: Date): boolean {
  if (h.frequency_type === "weekdays") return (h.frequency_config?.days ?? []).includes(date.getDay());
  if (h.frequency_type === "interval") {
    const every = h.frequency_config?.every ?? 1;
    if (every <= 1) return true;
    const elapsed = daysBetween(new Date(h.created_at), date);
    return elapsed >= 0 && elapsed % every === 0;
  }
  return true;
}

const PART_TIME: Record<PartOfDay, string> = { morning: "08:00", afternoon: "14:00", evening: "18:30", night: "21:00" };
function partOfDay(hour: number): PartOfDay {
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  if (hour < 22) return "evening";
  return "night";
}

/** §9 — missed the last two due days (never miss twice). Only past days count;
 *  today is still open, so it never triggers on an as-yet-undone habit. */
function recovery(h: Habit, doneDates: Set<string>): Suggestion | null {
  const today = new Date();
  const recent: boolean[] = [];
  for (let i = 1; i <= 90 && recent.length < 2; i++) {
    const d = new Date(); d.setDate(today.getDate() - i);
    if (daysBetween(new Date(h.created_at), d) < 0) break;
    if (!isDueOn(h, d)) continue;
    recent.push(!doneDates.has(`${h.id}|${ymd(d)}`)); // true = missed
  }
  return recent.length === 2 && recent[0] && recent[1] ? { kind: "recovery", habit: h } : null;
}

/** §14 — leaning on the hard-day version. Needs a numeric target to lower. */
function adaptive(h: Habit, logs: HabitLogLite[]): Suggestion | null {
  if (!h.hard_day || h.target_value == null || h.target_value <= 1) return null;
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7);
  const min = logs.filter((l) => l.completed && l.completion_type === "minimum" && new Date(`${l.date}T00:00:00`) >= cutoff).length;
  if (min < 3) return null;
  const suggested = Math.max(1, Math.round(h.target_value / 2));
  if (suggested >= h.target_value) return null;
  return { kind: "adaptive", habit: h, minimumCount: min, currentTarget: h.target_value, suggestedTarget: suggested, unit: h.target_unit };
}

/** §10 — dominant time of day, once ~6 timestamped completions exist. */
export function timeInsightFor(logs: HabitLogLite[]): TimeInsight | null {
  const stamped = logs.filter((l) => l.completed && l.completed_at);
  if (stamped.length < 6) return null;
  const counts: Record<PartOfDay, number> = { morning: 0, afternoon: 0, evening: 0, night: 0 };
  for (const l of stamped) counts[partOfDay(new Date(l.completed_at as string).getHours())]++;
  let best: PartOfDay = "morning";
  (Object.keys(counts) as PartOfDay[]).forEach((p) => { if (counts[p] > counts[best]) best = p; });
  return counts[best] / stamped.length >= 0.6 ? { part: best, time: PART_TIME[best] } : null;
}

/** Re-nag at most once per ISO-ish week per (habit, kind). */
export function suggestionKey(s: Suggestion): string {
  const now = new Date();
  const jan1 = new Date(now.getFullYear(), 0, 1);
  const week = Math.ceil((((now.getTime() - jan1.getTime()) / 86_400_000) + jan1.getDay() + 1) / 7);
  return `${s.habit.id}:${s.kind}:${now.getFullYear()}w${week}`;
}

/** The single most relevant nudge across all active habits, or null. Priority:
 *  recovery → adaptation → insight; earliest habit within a tier wins. */
export function topSuggestion(habits: Habit[], logs: HabitLogLite[], dismissed: Set<string>): Suggestion | null {
  const byHabit = new Map<string, HabitLogLite[]>();
  const doneDates = new Set<string>();
  for (const l of logs) {
    const a = byHabit.get(l.habit_id) ?? []; a.push(l); byHabit.set(l.habit_id, a);
    if (l.completed) doneDates.add(`${l.habit_id}|${l.date}`);
  }
  const tiers: ((h: Habit) => Suggestion | null)[] = [
    (h) => recovery(h, doneDates),
    (h) => adaptive(h, byHabit.get(h.id) ?? []),
    (h) => {
      const ti = timeInsightFor(byHabit.get(h.id) ?? []);
      return ti ? { kind: "insight", habit: h, part: ti.part, time: ti.time } : null;
    },
  ];
  for (const detect of tiers) {
    for (const h of habits) {
      const s = detect(h);
      if (s && !dismissed.has(suggestionKey(s))) return s;
    }
  }
  return null;
}
