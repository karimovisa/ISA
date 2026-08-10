"use client";

// ISA — Tasks & Habits, Phase 1 "Today" surface.
// One calm page under the Habits menu that answers "what do I do today?":
// today's TASKS (one-tap) and today's due HABITS (tap-to-complete, confirmed)
// living together, with a subtle "x / y completed" summary. A "Today / All"
// toggle reveals the full habit library for management. Streaks are deliberately
// absent here — consistency is Phase 2. Built on semantic theme tokens so it
// reads correctly in boys / girls-day (light) / girls-night.

import { createElement, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Pencil, Copy, Archive, Trash2, Repeat, Check, ChevronDown,
  Plus, Flag, CalendarDays, Droplet, BookOpen, Dumbbell, Leaf, Moon, ListTodo, Sparkles, X,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useCollection } from "@/hooks/useCollection";
import { Modal, fieldClass, labelClass, primaryBtnClass } from "@/components/ui/Modal";
import { PressButton } from "@/components/ui/PressButton";
import { PopMenu } from "@/components/ui/PopMenu";
import { ConfirmDialog, type ConfirmRequest } from "@/components/ui/ConfirmDialog";
import { ReminderFields, ReminderToggle, ALL_DAYS } from "@/components/ui/ReminderFields";
import { useT } from "@/lib/i18n";
import { toast } from "@/lib/toast";
import { todayISO, formatDate } from "@/lib/datetime";
import { captureLifeEvent } from "@/lib/life-events";
import type { Habit, Reminder, HabitFrequency, HabitCompletionType, Goal, Todo, TaskPriority } from "@/lib/types";
import { topSuggestion, suggestionKey, timeInsightFor, type Suggestion, type HabitLogLite, type TimeInsight } from "@/lib/habitCoach";

const CATEGORIES = ["Health", "Learning", "Productivity", "Finance", "Mindset", "Relationships", "Custom"];
/** The four Phase-1 scheduling choices (§4). "specific" and "weekdays" both
 *  persist as frequency_type 'weekdays' + a day set; "custom" is 'interval'. */
type When = "everyday" | "weekdays" | "specific" | "custom";
const WHEN_OPTIONS: { id: When; label: string }[] = [
  { id: "everyday", label: "Every day" },
  { id: "weekdays", label: "Weekdays" },
  { id: "specific", label: "Specific days" },
  { id: "custom", label: "Custom" },
];
const WD = ["S", "M", "T", "W", "T", "F", "S"];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const GREEN = "#86A97F";
const CARD = "rounded-[24px] border border-line bg-[var(--color-card)]";
const PRIORITY_CYCLE: TaskPriority[] = ["normal", "high", "low"];

/** Whole days between two dates, by local calendar (DST-safe via UTC midnights). */
function daysBetween(from: Date, to: Date): number {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b - a) / 86_400_000);
}

/** Local YYYY-MM-DD for any date. */
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Does this habit surface on the given day? weekdays/specific-days check the
 *  day set; interval repeats every N days from its start; the rest always do. */
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
const isDueToday = (h: Habit): boolean => isDueOn(h, new Date());

/** Done / due across the current week (Sun→today), counting only due days on
 *  or after the habit was created. The calm consistency signal (§8) — a plain
 *  count, never a punishing streak. doneKeys holds `${habitId}|${YYYY-MM-DD}`. */
function weekConsistency(h: Habit, doneKeys: Set<string>): { done: number; due: number } {
  const today = new Date();
  let due = 0, done = 0;
  for (let i = today.getDay(); i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    if (daysBetween(new Date(h.created_at), d) < 0) continue;
    if (!isDueOn(h, d)) continue;
    due++;
    if (doneKeys.has(`${h.id}|${ymd(d)}`)) done++;
  }
  return { done, due };
}

/** A quiet glyph per habit — matched by name/category, with a calm fallback. */
function habitGlyph(h: Habit) {
  const s = `${h.name} ${h.category ?? ""}`.toLowerCase();
  if (/water|suv|drink|ichish/.test(s)) return Droplet;
  if (/read|kitob|o'qi|oqi/.test(s)) return BookOpen;
  if (/workout|gym|sport|mashq|exercise|fitness|run|yugur|push|train/.test(s)) return Dumbbell;
  if (/medit|breath|nafas|yoga|calm|namoz|pray|tafakkur/.test(s)) return Leaf;
  if (/sleep|uyqu|bed|yot/.test(s)) return Moon;
  return Repeat;
}

export default function HabitsPage() {
  const { t, lang } = useT();
  const reduce = useReducedMotion();
  const today = todayISO();

  const habits = useCollection<Habit>("habits", { orderBy: "created_at", ascending: true });
  const todos = useCollection<Todo>("todos", { orderBy: "created_at", ascending: true });
  const goalsCol = useCollection<Goal>("goals");
  const activeGoals = goalsCol.data.filter((g) => !g.archived);

  const [view, setView] = useState<"today" | "all">("today");
  const [now, setNow] = useState<Date | null>(null);
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());
  const [weekDone, setWeekDone] = useState<Set<string>>(new Set()); // `${habitId}|${date}`
  const [completeSheet, setCompleteSheet] = useState<Habit | null>(null);
  const [confirmReq, setConfirmReq] = useState<ConfirmRequest | null>(null);
  const [showArchive, setShowArchive] = useState(false);
  const [showUpcoming, setShowUpcoming] = useState(false);

  useEffect(() => { setNow(new Date()); }, []);

  // One query covers both today's status and this week's consistency counts.
  const loadToday = useCallback(async () => {
    const ws = new Date(); ws.setDate(ws.getDate() - ws.getDay());
    const { data } = await supabase.from("habit_logs")
      .select("habit_id,date,completed").gte("date", ymd(ws));
    const rows = (data as { habit_id: string; date: string; completed: boolean }[]) ?? [];
    const done = new Set<string>(); const wk = new Set<string>();
    for (const r of rows) {
      if (!r.completed) continue;
      wk.add(`${r.habit_id}|${r.date}`);
      if (r.date === today) done.add(r.habit_id);
    }
    setDoneIds(done); setWeekDone(wk);
  }, [today]);
  useEffect(() => { loadToday(); }, [loadToday, habits.data.length]);

  // Phase 3 coach — 30 days of history feeds the deterministic nudges.
  const [recentLogs, setRecentLogs] = useState<HabitLogLite[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  useEffect(() => {
    try { const raw = localStorage.getItem("isa_habit_coach_dismissed"); if (raw) setDismissed(new Set(JSON.parse(raw) as string[])); } catch { /* ignore */ }
  }, []);
  const loadRecent = useCallback(async () => {
    const since = new Date(); since.setDate(since.getDate() - 30);
    const { data } = await supabase.from("habit_logs")
      .select("habit_id,date,completed,completion_type,completed_at").gte("date", ymd(since));
    setRecentLogs((data as HabitLogLite[]) ?? []);
  }, []);
  useEffect(() => { loadRecent(); }, [loadRecent, habits.data.length]);

  const scheduleLabel = useCallback((h: Habit): string => {
    const cfg = h.frequency_config ?? {};
    switch (h.frequency_type) {
      case "daily": return t("Daily");
      case "weekdays": {
        const days = [...(cfg.days ?? [])].sort((a, b) => a - b);
        if (days.length === 0) return t("No days");
        if (days.length === 7) return t("Daily");
        if (days.length === 5 && [1, 2, 3, 4, 5].every((d) => days.includes(d))) return t("Weekdays");
        if (days.length === 2 && days.includes(0) && days.includes(6)) return t("Weekends");
        return days.map((d) => t(DAY_NAMES[d])).join(", ");
      }
      case "interval": {
        const every = cfg.every ?? 2;
        return every <= 1 ? t("Daily") : t("Every {n} days", { n: every });
      }
      case "x_per_week": return `${cfg.count ?? 0}× / ${t("week")}`;
      case "x_per_month": return `${cfg.count ?? 0}× / ${t("month")}`;
      default: return t("Daily");
    }
  }, [t]);

  // ── HABITS ──
  const activeHabits = habits.data.filter((h) => h.is_active);
  const archived = habits.data.filter((h) => !h.is_active);
  const dueHabits = activeHabits.filter(isDueToday);
  const habitDone = (id: string) => doneIds.has(id);
  const sortDone = (list: Habit[]) => [...list].sort((a, b) => Number(habitDone(a.id)) - Number(habitDone(b.id)));

  // Tap to complete: habits with a hard-day version open a small choice sheet
  // (Done / Do the minimum); the rest complete in one tap. Tapping a done habit
  // undoes it — cheap to reverse, so no accidental-tap confirm is needed.
  const requestComplete = (h: Habit) => {
    if (habitDone(h.id)) return;
    if (h.hard_day) { setCompleteSheet(h); return; }
    void completeHabit(h, "full");
  };
  const completeHabit = async (h: Habit, type: HabitCompletionType) => {
    setCompleteSheet(null);
    if (habitDone(h.id)) return;
    setDoneIds((prev) => new Set(prev).add(h.id));
    setWeekDone((prev) => new Set(prev).add(`${h.id}|${today}`));
    await supabase.from("habit_logs").upsert(
      { habit_id: h.id, user_id: h.user_id, date: today, completed: true, completion_type: type,
        completed_at: new Date().toISOString(), value: type === "full" ? h.target_value : null },
      { onConflict: "habit_id,date" });
    void captureLifeEvent({
      type: "HabitCompleted", occurredAt: today,
      payload: { habit: h.name, category: h.category, minimum: type === "minimum" },
      links: h.goal_id ? { habitIds: [h.id], goalIds: [h.goal_id] } : { habitIds: [h.id] },
      context: { outcome: "consistency", linkedToActiveGoal: !!h.goal_id },
    });
  };
  const uncompleteHabit = async (h: Habit) => {
    setDoneIds((prev) => { const n = new Set(prev); n.delete(h.id); return n; });
    setWeekDone((prev) => { const n = new Set(prev); n.delete(`${h.id}|${today}`); return n; });
    await supabase.from("habit_logs").delete().eq("habit_id", h.id).eq("date", today);
  };

  // ── Coach (Phase 3): one nudge at a time, plus the actions it can offer ──
  const suggestion = useMemo(
    () => topSuggestion(activeHabits, recentLogs, dismissed),
    [activeHabits, recentLogs, dismissed]
  );
  const dismissSuggestion = (s: Suggestion) => {
    setDismissed((prev) => {
      const n = new Set(prev).add(suggestionKey(s));
      try { localStorage.setItem("isa_habit_coach_dismissed", JSON.stringify([...n])); } catch { /* ignore */ }
      return n;
    });
  };
  const adjustTarget = async (h: Habit, value: number) => {
    await habits.update(h.id, { target_value: value });
    void loadRecent();
    toast(t("Target updated to {v}.", { v: `${value}${h.target_unit ? ` ${h.target_unit}` : ""}` }), "success");
  };
  const ensureReminder = async (h: Habit, time: string) => {
    const { data: { user } } = await supabase.auth.getUser(); if (!user) return;
    const { data } = await supabase.from("reminders").select("id").eq("kind", "habit").eq("habit_id", h.id).limit(1).maybeSingle();
    if (data?.id) await supabase.from("reminders").update({ remind_time: time, enabled: true }).eq("id", data.id);
    else await supabase.from("reminders").insert({ user_id: user.id, kind: "habit", habit_id: h.id, title: h.name, remind_time: time, days: ALL_DAYS, enabled: true });
    toast(t("Reminder set for {time}.", { time }), "success");
  };

  // ── TASKS ──
  const openTasks = todos.data.filter((x) => !x.done);
  const overdue = openTasks.filter((x) => x.date < today).sort(byPriority);
  const todayTasks = openTasks.filter((x) => x.date === today).sort(byPriority);
  const upcoming = openTasks.filter((x) => x.date > today).sort((a, b) => a.date.localeCompare(b.date));
  const doneTasksToday = todos.data.filter((x) => x.done && x.date === today);

  const toggleTask = (x: Todo) => {
    todos.update(x.id, { done: !x.done });
    if (!x.done)
      void captureLifeEvent({
        type: "TaskCompleted", occurredAt: today, payload: { title: x.title },
        links: x.goal_id ? { goalIds: [x.goal_id] } : undefined,
        context: { outcome: "progress" },
      });
  };

  // ── Combined "x / y completed" summary (today's tasks + due habits) ──
  const dayTaskTotal = overdue.length + todayTasks.length + doneTasksToday.length;
  const summaryTotal = dayTaskTotal + dueHabits.length;
  const summaryDone = doneTasksToday.length + dueHabits.filter((h) => habitDone(h.id)).length;
  const summaryPct = summaryTotal ? Math.round((summaryDone / summaryTotal) * 100) : 0;

  const anyLoading = habits.loading || todos.loading;

  // ── Habit create / edit (V1 form, kept intact for Phase 1) ──
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Habit | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Custom");
  const [when, setWhen] = useState<When>("everyday");
  const [specificDays, setSpecificDays] = useState<number[]>([new Date().getDay()]);
  const [intervalEvery, setIntervalEvery] = useState(2);
  const [showMore, setShowMore] = useState(false);
  const [targetValue, setTargetValue] = useState("");
  const [targetUnit, setTargetUnit] = useState("");
  const [hardDay, setHardDay] = useState("");
  const [triggerAfter, setTriggerAfter] = useState("");
  const [notes, setNotes] = useState("");
  const [goalId, setGoalId] = useState("");
  const [remindOn, setRemindOn] = useState(false);
  const [remindTime, setRemindTime] = useState("20:00");
  const [remindDays, setRemindDays] = useState<number[]>(ALL_DAYS);
  const [reminderId, setReminderId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setName(""); setCategory("Custom");
    setWhen("everyday"); setSpecificDays([new Date().getDay()]); setIntervalEvery(2); setShowMore(false);
    setTargetValue(""); setTargetUnit(""); setHardDay(""); setTriggerAfter(""); setNotes(""); setGoalId("");
    setRemindOn(false); setRemindTime("20:00"); setRemindDays(ALL_DAYS); setReminderId(null);
  };
  const openNew = () => { setEditing(null); resetForm(); setOpen(true); };
  const openEdit = async (h: Habit) => {
    setEditing(h);
    setName(h.name); setCategory(h.category);
    // Map the stored frequency back onto the "When?" chooser.
    const cfg = h.frequency_config ?? {};
    if (h.frequency_type === "interval") { setWhen("custom"); setIntervalEvery(cfg.every ?? 2); setSpecificDays([new Date().getDay()]); }
    else if (h.frequency_type === "weekdays") {
      const days = cfg.days ?? [];
      if (days.length === 5 && [1, 2, 3, 4, 5].every((d) => days.includes(d))) { setWhen("weekdays"); setSpecificDays([1, 2, 3, 4, 5]); }
      else { setWhen("specific"); setSpecificDays(days.length ? days : [new Date().getDay()]); }
    } else { setWhen("everyday"); setSpecificDays([new Date().getDay()]); setIntervalEvery(2); }
    setTargetValue(h.target_value != null ? String(h.target_value) : ""); setTargetUnit(h.target_unit ?? "");
    setHardDay(h.hard_day ?? ""); setTriggerAfter(h.trigger_after ?? "");
    setNotes(h.notes ?? ""); setGoalId(h.goal_id ?? "");
    // Reveal "More" when the habit already carries optional detail, so it's visible.
    setShowMore(h.target_value != null || !!h.hard_day || !!h.trigger_after || !!h.notes || !!h.goal_id);
    setRemindOn(false); setRemindTime("20:00"); setRemindDays(ALL_DAYS); setReminderId(null);
    setOpen(true);
    const { data } = await supabase.from("reminders").select("*").eq("kind", "habit").eq("habit_id", h.id).limit(1).maybeSingle();
    if (data) { const r = data as Reminder; setReminderId(r.id); setRemindOn(r.enabled); setRemindTime(String(r.remind_time).slice(0, 5)); setRemindDays(r.days?.length ? r.days : ALL_DAYS); setShowMore(true); }
  };

  const habitFields = (): Partial<Habit> => {
    let frequency_type: HabitFrequency = "daily";
    let frequency_config: Habit["frequency_config"] = {};
    if (when === "weekdays") { frequency_type = "weekdays"; frequency_config = { days: [1, 2, 3, 4, 5] }; }
    else if (when === "specific") { frequency_type = "weekdays"; frequency_config = { days: [...specificDays].sort((a, b) => a - b) }; }
    else if (when === "custom") { frequency_type = "interval"; frequency_config = { every: intervalEvery }; }
    return {
      name: name.trim(), category, frequency_type, frequency_config,
      target_value: targetValue ? Number(targetValue) : null,
      target_unit: targetUnit.trim() || null,
      hard_day: hardDay.trim() || null,
      trigger_after: triggerAfter.trim() || null,
      notes: notes.trim() || null,
      goal_id: goalId || null,
    };
  };

  // §5 smart default: only nudge a hard-day version for a genuinely big target
  // (never for "brush teeth"). Suggest roughly a sixth of it as the minimum.
  const hardDaySuggestion = (() => {
    const v = Number(targetValue);
    if (!targetValue || Number.isNaN(v) || v < 15) return "";
    const small = Math.max(1, Math.round(v / 6));
    return targetUnit.trim() ? `${small} ${targetUnit.trim()}` : `${small}`;
  })();

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || saving || (when === "specific" && specificDays.length === 0)) return;
    setSaving(true);
    let habitId = editing?.id ?? null; let userId = editing?.user_id ?? null;
    if (editing) await habits.update(editing.id, habitFields());
    else {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setSaving(false); return; }
      userId = user.id;
      const { data: row, error } = await supabase.from("habits")
        .insert({ ...habitFields(), is_active: true, user_id: user.id }).select("id").single();
      if (error || !row) { toast("Couldn't save habit.", "error"); setSaving(false); return; }
      habitId = row.id as string; await habits.refresh();
    }
    if (habitId && userId) {
      if (remindOn) {
        const payload = { user_id: userId, kind: "habit", habit_id: habitId, title: name.trim(), remind_time: remindTime, days: [...remindDays].sort(), enabled: true };
        const { error } = reminderId ? await supabase.from("reminders").update(payload).eq("id", reminderId) : await supabase.from("reminders").insert(payload);
        if (error) toast("Habit saved, but the reminder failed.", "error");
      } else if (reminderId) await supabase.from("reminders").delete().eq("id", reminderId);
    }
    setSaving(false); setOpen(false);
  };

  const duplicate = async (h: Habit) => {
    const { data: { user } } = await supabase.auth.getUser(); if (!user) return;
    await supabase.from("habits").insert({
      name: `${h.name} copy`, category: h.category, frequency_type: h.frequency_type,
      frequency_config: h.frequency_config, target_value: h.target_value, target_unit: h.target_unit,
      hard_day: h.hard_day, trigger_after: h.trigger_after,
      notes: h.notes, is_active: true, user_id: user.id });
    habits.refresh();
  };
  const archive = (h: Habit) => { habits.update(h.id, { is_active: false }); toast(t("Archived."), "success"); };
  const restore = (h: Habit) => { habits.update(h.id, { is_active: true }); toast(t("Restored."), "success"); };
  const del = (h: Habit) =>
    setConfirmReq({
      title: t("Delete \"{name}\"?", { name: h.name }),
      body: t("This removes the habit and its whole history. It can't be undone."),
      confirmLabel: t("Delete"),
      danger: true,
      onConfirm: () => habits.remove(h.id),
    });

  const habitModal = (
    <Modal open={open} onClose={() => setOpen(false)} title={editing ? t("Edit habit") : t("New habit")}>
      <form onSubmit={save} className="space-y-5">
        {/* The whole quick-create: a name and a schedule. */}
        <div>
          <label className={labelClass}>{t("What habit do you want to build?")}</label>
          <input required autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={t("e.g. Read")} className={fieldClass} />
        </div>

        <div>
          <label className={labelClass}>{t("When?")}</label>
          <div className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap">
            {WHEN_OPTIONS.map((o) => (
              <button key={o.id} type="button" onClick={() => setWhen(o.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${when === o.id ? "bg-accent text-white" : "bg-[var(--color-surface)] text-muted hover:text-fg"}`}>
                {t(o.label)}
              </button>
            ))}
          </div>
          {when === "specific" && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {WD.map((w, i) => (
                <button key={i} type="button" onClick={() => setSpecificDays((d) => d.includes(i) ? d.filter((x) => x !== i) : [...d, i])}
                  className={`h-9 w-9 rounded-full text-xs font-medium transition ${specificDays.includes(i) ? "bg-accent text-white" : "bg-[var(--color-surface)] text-muted hover:text-fg"}`}>{w}</button>
              ))}
            </div>
          )}
          {when === "custom" && (
            <div className="mt-2.5 flex items-center gap-2.5 text-sm">
              <span className="text-muted">{t("Every")}</span>
              <div className="inline-flex items-center rounded-xl border border-line">
                <button type="button" aria-label={t("Fewer days")} onClick={() => setIntervalEvery((n) => Math.max(2, n - 1))} className="px-3 py-1.5 text-muted transition hover:text-fg">−</button>
                <span className="w-8 text-center tabular-nums text-fg">{intervalEvery}</span>
                <button type="button" aria-label={t("More days")} onClick={() => setIntervalEvery((n) => Math.min(30, n + 1))} className="px-3 py-1.5 text-muted transition hover:text-fg">+</button>
              </div>
              <span className="text-muted">{t("days")}</span>
            </div>
          )}
        </div>

        {/* Optional detail — folded away so creation stays a two-field task. */}
        <div className="overflow-hidden rounded-2xl border border-line">
          <button type="button" onClick={() => setShowMore((v) => !v)} className="flex w-full items-center justify-between px-4 py-3 text-sm text-muted transition hover:text-fg">
            <span>{t("More options")}</span>
            <ChevronDown size={16} className={`transition ${showMore ? "rotate-180" : ""}`} />
          </button>
          {showMore && (
            <div className="space-y-4 border-t border-line p-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>{t("Target")}</label>
                  <input type="number" value={targetValue} onChange={(e) => setTargetValue(e.target.value)} placeholder="20" className={fieldClass} />
                </div>
                <div>
                  <label className={labelClass}>{t("Unit")}</label>
                  <input value={targetUnit} onChange={(e) => setTargetUnit(e.target.value)} placeholder={t("pages / km / min")} className={fieldClass} />
                </div>
              </div>
              <div>
                <label className={labelClass}>{t("Hard-day version")}</label>
                <input value={hardDay} onChange={(e) => setHardDay(e.target.value)} placeholder={t("e.g. 5 min walk")} className={fieldClass} />
                {hardDaySuggestion && !hardDay.trim() ? (
                  <button type="button" onClick={() => setHardDay(hardDaySuggestion)}
                    className="mt-1.5 inline-flex items-center gap-1 text-xs text-accent transition hover:opacity-80">
                    <Plus size={12} /> {t("Suggest {s}", { s: hardDaySuggestion })}
                  </button>
                ) : (
                  <p className="mt-1.5 text-[11px] text-muted">{t("The smallest version that still counts, for rough days.")}</p>
                )}
              </div>
              <div>
                <label className={labelClass}>{t("Trigger (optional)")}</label>
                <input value={triggerAfter} onChange={(e) => setTriggerAfter(e.target.value)} placeholder={t("after brushing teeth")} className={fieldClass} />
              </div>
              <div>
                <label className={labelClass}>{t("Category")}</label>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIES.map((c) => (
                    <button key={c} type="button" onClick={() => setCategory(c)}
                      className={`rounded-full px-3 py-1 text-xs transition ${category === c ? "bg-accent text-white" : "bg-[var(--color-surface)] text-muted hover:text-fg"}`}>{t(c)}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelClass}>{t("Notes")}</label>
                <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("Anything to remember")} className={fieldClass} />
              </div>
              {activeGoals.length > 0 && (
                <div>
                  <label className={labelClass}>{t("Linked goal")}</label>
                  <select value={goalId} onChange={(e) => setGoalId(e.target.value)} className={fieldClass}>
                    <option value="">{t("None")}</option>
                    {activeGoals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
                  </select>
                </div>
              )}
              <div className="rounded-2xl border border-line bg-[var(--color-surface)] p-4">
                <ReminderToggle on={remindOn} onToggle={() => setRemindOn((v) => !v)} label={t("Remind me")} />
                {remindOn && <div className="mt-4"><ReminderFields time={remindTime} setTime={setRemindTime} days={remindDays} setDays={setRemindDays} /></div>}
              </div>
            </div>
          )}
        </div>

        <PressButton type="submit" disabled={saving || !name.trim() || (when === "specific" && specificDays.length === 0)} className={primaryBtnClass}>
          {saving ? t("Saving…") : editing ? t("Save") : t("Create habit")}
        </PressButton>
      </form>
    </Modal>
  );

  return (
    <div>
      {/* Header — "Today" with a Today/All toggle; summary lives just below */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[1.75rem] font-bold leading-tight tracking-tight">
            {view === "today" ? t("Today") : t("All habits")}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {view === "today" ? (now ? formatDate(now, lang) : " ") : t("Every habit you're building")}
          </p>
        </div>
        <div className="mt-1 inline-flex shrink-0 rounded-full border border-line p-0.5 text-xs">
          {(["today", "all"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`relative rounded-full px-3 py-1.5 font-medium transition-colors ${view === v ? "text-fg" : "text-muted hover:text-fg"}`}
            >
              {view === v && (
                <motion.span layoutId="habits-view-pill" className="absolute inset-0 rounded-full bg-accent-soft ring-1 ring-inset ring-accent/25"
                  transition={{ type: "spring", stiffness: 400, damping: 32 }} />
              )}
              <span className="relative z-10">{v === "today" ? t("Today") : t("All")}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Subtle day summary — the only "metric". Never shouts. */}
      {view === "today" && summaryTotal > 0 && (
        <div className="mb-6 flex items-center gap-3">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-[color:var(--color-muted)]/15">
            <motion.div className="h-full rounded-full" style={{ background: GREEN }}
              initial={{ width: reduce ? `${summaryPct}%` : 0 }} animate={{ width: `${summaryPct}%` }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }} />
          </div>
          <span className="shrink-0 text-xs tabular-nums text-muted">{summaryDone} / {summaryTotal} {t("completed")}</span>
        </div>
      )}

      {/* §9/§10/§14 — one calm nudge, only when something's worth saying */}
      {view === "today" && suggestion && (
        <CoachCard
          key={`${suggestion.habit.id}:${suggestion.kind}`}
          suggestion={suggestion}
          insightTime={timeInsightFor(recentLogs.filter((l) => l.habit_id === suggestion.habit.id))}
          onDismiss={() => dismissSuggestion(suggestion)}
          onAdjustTarget={(v) => { void adjustTarget(suggestion.habit, v); dismissSuggestion(suggestion); }}
          onArchive={() => { archive(suggestion.habit); dismissSuggestion(suggestion); }}
          onMoveReminder={(tm) => { void ensureReminder(suggestion.habit, tm); dismissSuggestion(suggestion); }}
          onAddReminder={() => { void ensureReminder(suggestion.habit, "20:00"); dismissSuggestion(suggestion); }}
          t={t}
        />
      )}

      {anyLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className={`${CARD} h-24 animate-pulse`} />)}</div>
      ) : view === "today" ? (
        <div className="space-y-6">
          {/* ── TASKS ── */}
          <section>
            <SectionLabel icon={ListTodo}>{t("Tasks")}</SectionLabel>
            <div className={`${CARD} mt-2.5 p-2`}>
              {overdue.length + todayTasks.length + doneTasksToday.length === 0 ? (
                <p className="px-3 py-5 text-center text-sm text-muted">{t("No tasks today. Add one below.")}</p>
              ) : (
                <ul className="divide-y divide-[var(--color-line)]">
                  <AnimatePresence initial={false}>
                    {[...overdue, ...todayTasks].map((x) => (
                      <TaskRow key={x.id} task={x} today={today} onToggle={() => toggleTask(x)} onDelete={() => todos.remove(x.id)} t={t} />
                    ))}
                    {doneTasksToday.map((x) => (
                      <TaskRow key={x.id} task={x} today={today} onToggle={() => toggleTask(x)} onDelete={() => todos.remove(x.id)} t={t} />
                    ))}
                  </AnimatePresence>
                </ul>
              )}

              {/* Upcoming — folded away so Today stays calm, but never hidden */}
              {upcoming.length > 0 && (
                <div className="border-t border-line px-1 pt-1">
                  <button onClick={() => setShowUpcoming((v) => !v)}
                    className="flex w-full items-center gap-1.5 px-2 py-2 text-xs font-medium text-muted transition hover:text-fg">
                    <ChevronDown size={14} className={`transition ${showUpcoming ? "rotate-180" : ""}`} />
                    {t("Upcoming")} · {upcoming.length}
                  </button>
                  {showUpcoming && (
                    <ul className="divide-y divide-[var(--color-line)]">
                      {upcoming.map((x) => (
                        <TaskRow key={x.id} task={x} today={today} onToggle={() => toggleTask(x)} onDelete={() => todos.remove(x.id)} t={t} />
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <TaskComposer today={today} onAdd={todos.add} t={t} />
            </div>
          </section>

          {/* ── HABITS (due today) ── */}
          <section>
            <div className="flex items-center justify-between px-1">
              <SectionLabel icon={Repeat}>{t("Habits")}</SectionLabel>
              <button onClick={openNew} className="inline-flex items-center gap-1 text-xs font-medium text-accent transition hover:opacity-80">
                <Plus size={14} /> {t("New habit")}
              </button>
            </div>
            <div className={`${CARD} mt-2.5 p-2`}>
              {dueHabits.length === 0 ? (
                <div className="px-3 py-6 text-center">
                  <p className="text-sm text-muted">{activeHabits.length ? t("Nothing due today — enjoy the breather.") : t("No habits yet.")}</p>
                  {activeHabits.length === 0 && (
                    <button onClick={openNew} className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-[var(--color-fg)] px-3.5 py-2 text-sm font-semibold text-[color:var(--color-bg)] transition active:scale-[0.98]">
                      <Plus size={15} /> {t("Add your first habit")}
                    </button>
                  )}
                </div>
              ) : (
                <ul className="divide-y divide-[var(--color-line)]">
                  <AnimatePresence initial={false}>
                    {sortDone(dueHabits).map((h) => (
                      <HabitRow key={h.id} habit={h} done={habitDone(h.id)} secondary={habitSecondary(h, scheduleLabel)}
                        weekly={weekConsistency(h, weekDone)}
                        onComplete={() => requestComplete(h)} onUncomplete={() => uncompleteHabit(h)}
                        onEdit={() => openEdit(h)} onDuplicate={() => duplicate(h)}
                        onArchive={() => archive(h)} onDelete={() => del(h)} t={t} />
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </div>
          </section>
        </div>
      ) : (
        // ── ALL HABITS (management) ──
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={openNew} className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--color-fg)] px-3.5 py-2 text-sm font-semibold text-[color:var(--color-bg)] transition active:scale-[0.98]">
              <Plus size={15} /> {t("New habit")}
            </button>
          </div>
          {activeHabits.length === 0 ? (
            <div className={`${CARD} px-3 py-10 text-center`}>
              <Repeat size={22} className="mx-auto mb-3 text-muted" />
              <p className="text-sm text-muted">{t("No habits yet.")}</p>
            </div>
          ) : (
            <div className={`${CARD} p-2`}>
              <ul className="divide-y divide-[var(--color-line)]">
                {activeHabits.map((h) => (
                  <HabitRow key={h.id} habit={h} done={habitDone(h.id)} secondary={habitSecondary(h, scheduleLabel)}
                    dueBadge={!isDueToday(h)} weekly={weekConsistency(h, weekDone)}
                    onComplete={() => requestComplete(h)} onUncomplete={() => uncompleteHabit(h)} onEdit={() => openEdit(h)}
                    onDuplicate={() => duplicate(h)} onArchive={() => archive(h)} onDelete={() => del(h)} t={t} />
                ))}
              </ul>
            </div>
          )}

          {archived.length > 0 && (
            <div>
              <button onClick={() => setShowArchive((v) => !v)}
                className="flex items-center gap-1.5 px-1 text-xs font-medium uppercase tracking-wider text-muted transition hover:text-fg">
                <Archive size={13} /> {t("Archived")} ({archived.length})
                <ChevronDown size={14} className={`transition ${showArchive ? "rotate-180" : ""}`} />
              </button>
              {showArchive && (
                <div className={`${CARD} mt-2.5 p-2`}>
                  <ul className="divide-y divide-[var(--color-line)]">
                    {archived.map((h) => (
                      <li key={h.id} className="flex items-center gap-3 px-2 py-2.5 opacity-70">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm">{h.name}</p>
                          <p className="text-xs text-muted">{scheduleLabel(h)}</p>
                        </div>
                        <button onClick={() => restore(h)} className="shrink-0 rounded-lg border border-line px-2.5 py-1 text-xs text-fg transition hover:bg-[var(--color-surface)]">
                          {t("Restore")}
                        </button>
                        <button onClick={() => del(h)} aria-label={t("Delete")} className="shrink-0 rounded-lg p-1.5 text-muted transition hover:text-red-400">
                          <Trash2 size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Completion choice — only for habits that carry a hard-day version (§7). */}
      <Modal open={!!completeSheet} onClose={() => setCompleteSheet(null)} title={completeSheet?.name ?? ""}>
        {completeSheet && (
          <div className="space-y-2.5">
            {completeSheet.target_value != null && (
              <p className="text-sm text-muted">
                {completeSheet.target_value}{completeSheet.target_unit ? ` ${completeSheet.target_unit}` : ""} · {scheduleLabel(completeSheet)}
              </p>
            )}
            <button onClick={() => completeHabit(completeSheet, "full")}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-fg)] px-4 py-3 text-sm font-semibold text-[color:var(--color-bg)] transition active:scale-[0.98]">
              <Check size={16} strokeWidth={3} /> {t("Mark done")}
            </button>
            <button onClick={() => completeHabit(completeSheet, "minimum")}
              className="w-full rounded-xl border border-line px-4 py-3 text-sm font-medium text-fg transition hover:bg-[var(--color-surface)]">
              {t("Do {hard} instead", { hard: completeSheet.hard_day ?? "" })}
            </button>
            <p className="pt-0.5 text-center text-[11px] text-muted">{t("Either way, today counts. Never miss twice.")}</p>
          </div>
        )}
      </Modal>

      <ConfirmDialog request={confirmReq} onClose={() => setConfirmReq(null)} />
      {habitModal}
    </div>
  );
}

// Secondary line for a habit row: "20 min · Daily" (target, then schedule).
function habitSecondary(h: Habit, scheduleLabel: (h: Habit) => string): string {
  const parts: string[] = [];
  if (h.target_value != null) parts.push(`${h.target_value}${h.target_unit ? ` ${h.target_unit}` : ""}`);
  parts.push(scheduleLabel(h));
  return parts.join(" · ");
}

function byPriority(a: Todo, b: Todo) {
  const rank: Record<TaskPriority, number> = { high: 0, normal: 1, low: 2 };
  return rank[a.priority ?? "normal"] - rank[b.priority ?? "normal"];
}

function SectionLabel({ children, icon: Icon }: { children: React.ReactNode; icon: typeof Repeat }) {
  return (
    <p className="flex items-center gap-1.5 px-1 text-xs font-medium uppercase tracking-[0.14em] text-muted">
      <Icon size={13} /> {children}
    </p>
  );
}

const priorityDot: Record<TaskPriority, string> = {
  high: "bg-red-400",
  normal: "bg-[color:var(--color-muted)]/50",
  low: "bg-[color:var(--color-muted)]/25",
};

function TaskRow({
  task, today, onToggle, onDelete, t,
}: {
  task: Todo; today: string; onToggle: () => void; onDelete: () => void; t: (s: string) => string;
}) {
  return (
    <motion.li layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }}
      className="group flex items-center gap-2.5 px-2 py-2.5">
      <button onClick={onToggle} aria-label={task.done ? t("Mark undone") : t("Mark done")}
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors ${
          task.done ? "border-[var(--color-fg)] bg-[var(--color-fg)] text-[color:var(--color-bg)]" : "border-[color:var(--color-muted)]/45 text-transparent hover:border-[color:var(--color-muted)]"}`}>
        <Check size={13} strokeWidth={3} />
      </button>
      {!task.done && <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${priorityDot[task.priority ?? "normal"]}`} />}
      <span className={`min-w-0 flex-1 truncate text-sm ${task.done ? "text-muted line-through" : "text-fg/90"}`}>{task.title}</span>
      {!task.done && task.date !== today && (
        <span className={`shrink-0 text-[11px] tabular-nums ${task.date < today ? "text-red-300" : "text-muted"}`}>{task.date.slice(5)}</span>
      )}
      <button onClick={onDelete} aria-label={t("Delete")}
        className="shrink-0 rounded p-1 text-muted opacity-40 transition hover:text-red-400 group-hover:opacity-100">
        <Trash2 size={13} />
      </button>
    </motion.li>
  );
}

function TaskComposer({
  today, onAdd, t,
}: {
  today: string; onAdd: (row: Partial<Todo>) => Promise<void>; t: (s: string) => string;
}) {
  const [draft, setDraft] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("normal");
  const [date, setDate] = useState(today);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = draft.trim(); if (!v) return;
    setDraft("");
    await onAdd({ title: v, date, done: false, priority } as Partial<Todo>);
    void captureLifeEvent({ type: "TaskCreated", occurredAt: date, payload: { title: v, priority } });
    setPriority("normal"); setDate(today);
  };

  return (
    <form onSubmit={submit} className="mt-1 flex items-center gap-2 border-t border-line px-2 pt-2">
      <button type="button" onClick={() => setPriority((p) => PRIORITY_CYCLE[(PRIORITY_CYCLE.indexOf(p) + 1) % 3])}
        title={t("Priority")} className="shrink-0 rounded-lg p-1.5 text-muted transition hover:text-fg">
        <Flag size={14} className={priority === "high" ? "text-red-400" : priority === "low" ? "text-muted/40" : "text-muted"} />
      </button>
      <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={t("Add a task…")}
        className="min-w-0 flex-1 bg-transparent py-1 text-sm text-fg/90 outline-none placeholder:text-muted/60" />
      <label title={t("Schedule")} className="relative flex shrink-0 cursor-pointer items-center rounded-lg p-1.5 text-muted transition hover:text-fg">
        <CalendarDays size={14} className={date !== today ? "text-accent" : ""} />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value || today)} aria-label={t("Schedule")}
          className="absolute inset-0 cursor-pointer opacity-0" />
      </label>
      <button type="submit" aria-label={t("Add")} className="shrink-0 rounded-lg bg-[var(--color-surface)] p-1.5 text-fg transition hover:bg-[var(--color-surface-strong)]">
        <Plus size={14} />
      </button>
    </form>
  );
}

function HabitRow({
  habit, done, secondary, dueBadge, weekly, onComplete, onUncomplete, onEdit, onDuplicate, onArchive, onDelete, t,
}: {
  habit: Habit; done: boolean; secondary: string; dueBadge?: boolean; weekly?: { done: number; due: number };
  onComplete: () => void; onUncomplete: () => void; onEdit: () => void; onDuplicate: () => void; onArchive: () => void; onDelete: () => void;
  t: (s: string, v?: Record<string, string | number>) => string;
}) {
  const showWeekly = !!weekly && weekly.due > 0;
  return (
    <motion.li layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      className={`flex items-center gap-3 px-2 py-2.5 ${done ? "opacity-60" : ""}`}>
      <button onClick={done ? onUncomplete : onComplete} aria-label={done ? t("Completed — tap to undo") : t("Complete")}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors"
        style={done ? { background: GREEN, borderColor: GREEN } : { borderColor: "var(--color-line)" }}>
        <Check size={16} strokeWidth={3} style={{ color: done ? "#fff" : "transparent" }} />
      </button>
      {createElement(habitGlyph(habit), { size: 17, className: "shrink-0 text-muted" })}
      <div className="min-w-0 flex-1">
        <Link href={`/habits/${habit.id}`} className={`block truncate text-sm font-medium transition hover:text-accent ${done ? "text-muted line-through" : "text-fg/90"}`}>
          {habit.name}
        </Link>
        <p className="mt-0.5 truncate text-xs text-muted">
          {secondary}
          {showWeekly ? ` · ${weekly!.done}/${weekly!.due} ${t("this week")}` : ""}
          {dueBadge ? ` · ${t("not today")}` : ""}
        </p>
        {habit.hard_day && (
          <p className="mt-0.5 truncate text-[11px] text-[color:var(--color-muted)]/80">{t("Hard day")}: {habit.hard_day}</p>
        )}
      </div>
      <div className="shrink-0">
        <PopMenu ariaLabel={t("Habit menu")}>
          {(close) => (
            <>
              <MI Icon={Pencil} label={t("Edit")} onClick={() => { close(); onEdit(); }} />
              <MI Icon={Copy} label={t("Duplicate")} onClick={() => { close(); onDuplicate(); }} />
              <MI Icon={Archive} label={t("Archive")} onClick={() => { close(); onArchive(); }} />
              <MI Icon={Trash2} label={t("Delete")} danger onClick={() => { close(); onDelete(); }} />
            </>
          )}
        </PopMenu>
      </div>
    </motion.li>
  );
}

function MI({ Icon, label, onClick, danger }: { Icon: typeof Pencil; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition hover:bg-[var(--color-surface)] ${danger ? "text-red-400" : "text-fg/90"}`}>
      <Icon size={15} /> {label}
    </button>
  );
}

// The one calm nudge (§9 recovery / §14 adaptation / §10 insight). Never more
// than one at a time; every path ends in a single reversible action or a dismiss.
function CoachCard({ suggestion, insightTime, onDismiss, onAdjustTarget, onArchive, onMoveReminder, onAddReminder, t }: {
  suggestion: Suggestion; insightTime: TimeInsight | null;
  onDismiss: () => void; onAdjustTarget: (value: number) => void; onArchive: () => void;
  onMoveReminder: (time: string) => void; onAddReminder: () => void;
  t: (s: string, v?: Record<string, string | number>) => string;
}) {
  const [reason, setReason] = useState<string | null>(null);
  const h = suggestion.habit;
  const unitStr = (v: number, u: string | null) => `${v}${u ? ` ${u}` : ""}`;
  const primary = "rounded-xl bg-[var(--color-fg)] px-3.5 py-2 text-sm font-semibold text-[color:var(--color-bg)] transition active:scale-[0.98]";
  const ghost = "rounded-xl border border-line px-3.5 py-2 text-sm font-medium text-fg transition hover:bg-[var(--color-surface)]";

  const shell = (children: React.ReactNode) => (
    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className={`${CARD} mb-6 p-4`}>
      <div className="mb-2 flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
          <Sparkles size={13} style={{ color: GREEN }} /> {t("ISA noticed")}
        </span>
        <button onClick={onDismiss} aria-label={t("Dismiss")} className="-m-1 rounded p-1 text-muted transition hover:text-fg"><X size={15} /></button>
      </div>
      {children}
    </motion.div>
  );

  if (suggestion.kind === "adaptive") {
    return shell(
      <div>
        <p className="text-sm text-fg/90">{t("You've leaned on {name}'s hard-day version {n}× lately — that's okay.", { name: h.name, n: suggestion.minimumCount })}</p>
        <p className="mt-1 text-sm text-muted">{t("Lower the target to {v}?", { v: unitStr(suggestion.suggestedTarget, suggestion.unit) })}</p>
        <div className="mt-3 flex gap-2">
          <button className={primary} onClick={() => onAdjustTarget(suggestion.suggestedTarget)}>{t("Adjust")}</button>
          <button className={ghost} onClick={onDismiss}>{t("Keep {v}", { v: unitStr(suggestion.currentTarget, suggestion.unit) })}</button>
        </div>
      </div>
    );
  }

  if (suggestion.kind === "insight") {
    return shell(
      <div>
        <p className="text-sm text-fg/90">{t("{name} works better in the {part} for you.", { name: h.name, part: t(suggestion.part) })}</p>
        <div className="mt-3 flex gap-2">
          <button className={primary} onClick={() => onMoveReminder(suggestion.time)}>{t("Move reminder to {time}", { time: suggestion.time })}</button>
          <button className={ghost} onClick={onDismiss}>{t("Keep")}</button>
        </div>
      </div>
    );
  }

  // recovery (§9) — a gentle reason, then one concrete, reversible offer.
  const REASONS = [
    { id: "too_difficult", label: "Too difficult" },
    { id: "wrong_time", label: "Wrong time" },
    { id: "forgot", label: "Forgot" },
    { id: "environment", label: "Environment" },
    { id: "no_longer", label: "No longer important" },
  ];
  const cur = h.target_value;
  return shell(
    <div>
      <p className="text-sm text-fg/90">{t("{name} has been tricky lately.", { name: h.name })}</p>
      {!reason ? (
        <>
          <p className="mt-1 text-sm text-muted">{t("What's getting in the way?")}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {REASONS.map((r) => (
              <button key={r.id} onClick={() => setReason(r.id)}
                className="rounded-full bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-muted transition hover:text-fg">{t(r.label)}</button>
            ))}
          </div>
        </>
      ) : reason === "too_difficult" ? (
        cur != null ? (
          <div className="mt-2">
            <p className="text-sm text-muted">{t("Make it smaller — {from} → {to}?", { from: unitStr(cur, h.target_unit), to: unitStr(Math.max(1, Math.round(cur / 2)), h.target_unit) })}</p>
            <div className="mt-3 flex gap-2">
              <button className={primary} onClick={() => onAdjustTarget(Math.max(1, Math.round(cur / 2)))}>{t("Change")}</button>
              <button className={ghost} onClick={onDismiss}>{t("Keep")}</button>
            </div>
          </div>
        ) : <ActionAck text={t("Try just a two-minute version next time — showing up is the win.")} onOk={onDismiss} label={t("Got it")} ghost={ghost} />
      ) : reason === "wrong_time" ? (
        insightTime ? (
          <div className="mt-2">
            <p className="text-sm text-muted">{t("You usually finish in the {part}. Move your reminder to {time}?", { part: t(insightTime.part), time: insightTime.time })}</p>
            <div className="mt-3 flex gap-2">
              <button className={primary} onClick={() => onMoveReminder(insightTime.time)}>{t("Move")}</button>
              <button className={ghost} onClick={onDismiss}>{t("Keep")}</button>
            </div>
          </div>
        ) : <ActionAck text={t("Pick a time that fits your day and give it a week.")} onOk={onDismiss} label={t("Got it")} ghost={ghost} />
      ) : reason === "forgot" ? (
        <div className="mt-2">
          <p className="text-sm text-muted">{t("A reminder would help you remember.")}</p>
          <div className="mt-3 flex gap-2">
            <button className={primary} onClick={onAddReminder}>{t("Add reminder")}</button>
            <button className={ghost} onClick={onDismiss}>{t("Keep")}</button>
          </div>
        </div>
      ) : reason === "no_longer" ? (
        <div className="mt-2">
          <p className="text-sm text-muted">{t("Want to archive {name}?", { name: h.name })}</p>
          <div className="mt-3 flex gap-2">
            <button className={primary} onClick={onArchive}>{t("Archive")}</button>
            <button className={ghost} onClick={onDismiss}>{t("Keep")}</button>
          </div>
        </div>
      ) : (
        <ActionAck text={t("Set up your space so the habit is the easy choice, then try again.")} onOk={onDismiss} label={t("Got it")} ghost={ghost} />
      )}
    </div>
  );
}

function ActionAck({ text, onOk, label, ghost }: { text: string; onOk: () => void; label: string; ghost: string }) {
  return (
    <div className="mt-2">
      <p className="text-sm text-muted">{text}</p>
      <div className="mt-3"><button className={ghost} onClick={onOk}>{label}</button></div>
    </div>
  );
}
