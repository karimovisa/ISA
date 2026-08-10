"use client";

// ISA — Tasks & Habits, Phase 1 "Today" surface.
// One calm page under the Habits menu that answers "what do I do today?":
// today's TASKS (one-tap) and today's due HABITS (tap-to-complete, confirmed)
// living together, with a subtle "x / y completed" summary. A "Today / All"
// toggle reveals the full habit library for management. Streaks are deliberately
// absent here — consistency is Phase 2. Built on semantic theme tokens so it
// reads correctly in boys / girls-day (light) / girls-night.

import { createElement, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Pencil, Copy, Archive, Trash2, Repeat, Check, ChevronDown,
  Plus, Flag, CalendarDays, Droplet, BookOpen, Dumbbell, Leaf, Moon, ListTodo,
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
import type { Habit, Reminder, HabitFrequency, Goal, Todo, TaskPriority } from "@/lib/types";

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

/** Does this habit surface today? weekdays/specific-days check the day set;
 *  interval repeats every N days from its start; the rest always surface. */
function isDueToday(h: Habit): boolean {
  const now = new Date();
  if (h.frequency_type === "weekdays") return (h.frequency_config?.days ?? []).includes(now.getDay());
  if (h.frequency_type === "interval") {
    const every = h.frequency_config?.every ?? 1;
    if (every <= 1) return true;
    const elapsed = daysBetween(new Date(h.created_at), now);
    return elapsed >= 0 && elapsed % every === 0;
  }
  return true;
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
  const [confirmReq, setConfirmReq] = useState<ConfirmRequest | null>(null);
  const [showArchive, setShowArchive] = useState(false);
  const [showUpcoming, setShowUpcoming] = useState(false);

  useEffect(() => { setNow(new Date()); }, []);

  const loadToday = useCallback(async () => {
    const { data } = await supabase.from("habit_logs").select("habit_id,completed").eq("date", today);
    setDoneIds(new Set(((data as { habit_id: string; completed: boolean }[]) ?? []).filter((x) => x.completed).map((x) => x.habit_id)));
  }, [today]);
  useEffect(() => { loadToday(); }, [loadToday, habits.data.length]);

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

  // Completing asks first — the tick is easy to hit by accident, and an
  // unwanted completion silently distorts the day's record.
  const askComplete = (h: Habit) => {
    if (habitDone(h.id)) return;
    setConfirmReq({
      title: t("Mark \"{name}\" as done?", { name: h.name }),
      confirmLabel: t("Mark done"),
      onConfirm: () => void completeHabit(h),
    });
  };
  const completeHabit = async (h: Habit) => {
    if (habitDone(h.id)) return;
    setDoneIds((prev) => new Set(prev).add(h.id));
    await supabase.from("habit_logs").upsert(
      { habit_id: h.id, user_id: h.user_id, date: today, completed: true, value: h.target_value },
      { onConflict: "habit_id,date" });
    void captureLifeEvent({
      type: "HabitCompleted", occurredAt: today, payload: { habit: h.name, category: h.category },
      links: h.goal_id ? { habitIds: [h.id], goalIds: [h.goal_id] } : { habitIds: [h.id] },
      context: { outcome: "consistency", linkedToActiveGoal: !!h.goal_id },
    });
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
    setTargetValue(""); setTargetUnit(""); setNotes(""); setGoalId("");
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
    setNotes(h.notes ?? ""); setGoalId(h.goal_id ?? "");
    // Reveal "More" when the habit already carries optional detail, so it's visible.
    setShowMore(h.target_value != null || !!h.notes || !!h.goal_id);
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
      notes: notes.trim() || null,
      goal_id: goalId || null,
    };
  };

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
                        onComplete={() => askComplete(h)} onEdit={() => openEdit(h)} onDuplicate={() => duplicate(h)}
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
                    dueBadge={!isDueToday(h)} onComplete={() => askComplete(h)} onEdit={() => openEdit(h)}
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
  habit, done, secondary, dueBadge, onComplete, onEdit, onDuplicate, onArchive, onDelete, t,
}: {
  habit: Habit; done: boolean; secondary: string; dueBadge?: boolean;
  onComplete: () => void; onEdit: () => void; onDuplicate: () => void; onArchive: () => void; onDelete: () => void;
  t: (s: string, v?: Record<string, string | number>) => string;
}) {
  return (
    <motion.li layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      className={`flex items-center gap-3 px-2 py-2.5 ${done ? "opacity-60" : ""}`}>
      <button onClick={onComplete} disabled={done} aria-label={done ? t("Done today") : t("Complete")}
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
          {secondary}{dueBadge ? ` · ${t("not today")}` : ""}
        </p>
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
