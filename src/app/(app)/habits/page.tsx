"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Pencil, Copy, Archive, Trash2, Repeat, Check, ChevronDown,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useCollection } from "@/hooks/useCollection";
import { GlassCard } from "@/components/ui/GlassCard";
import { PageHeader, AddButton } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal, fieldClass, labelClass, primaryBtnClass } from "@/components/ui/Modal";
import { PressButton } from "@/components/ui/PressButton";
import { PopMenu } from "@/components/ui/PopMenu";
import { ConfirmDialog, type ConfirmRequest } from "@/components/ui/ConfirmDialog";
import { TodoList } from "@/components/sections/TodoList";
import { ReminderFields, ReminderToggle, ALL_DAYS } from "@/components/ui/ReminderFields";
import { useT } from "@/lib/i18n";
import { toast } from "@/lib/toast";
import { captureLifeEvent } from "@/lib/life-events";
import type { Habit, HabitLog, Reminder, HabitFrequency, Goal } from "@/lib/types";

const CATEGORIES = ["Health", "Learning", "Productivity", "Finance", "Mindset", "Relationships", "Custom"];
const FREQ: { id: HabitFrequency; label: string }[] = [
  { id: "daily", label: "Every day" },
  { id: "weekdays", label: "Selected days" },
  { id: "x_per_week", label: "× / week" },
  { id: "x_per_month", label: "× / month" },
];
const WD = ["S", "M", "T", "W", "T", "F", "S"];

function last7(): string[] {
  const out: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  }
  return out;
}

function isDueToday(h: Habit): boolean {
  if (h.frequency_type === "weekdays") return (h.frequency_config?.days ?? []).includes(new Date().getDay());
  return true; // daily / x_per_week / x_per_month always surface today
}

export default function HabitsPage() {
  const { t } = useT();
  const habits = useCollection<Habit>("habits", { orderBy: "created_at", ascending: true });
  const goalsCol = useCollection<Goal>("goals");
  const activeGoals = goalsCol.data.filter((g) => !g.archived);
  const [logs, setLogs] = useState<HabitLog[]>([]);
  const [streaks, setStreaks] = useState<Record<string, number>>({});
  const [totals, setTotals] = useState<Record<string, number>>({});
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Habit | null>(null);
  const [confirmReq, setConfirmReq] = useState<ConfirmRequest | null>(null);
  const [showArchive, setShowArchive] = useState(false);

  // form
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Custom");
  const [freqType, setFreqType] = useState<HabitFrequency>("daily");
  const [freqDays, setFreqDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [freqCount, setFreqCount] = useState(3);
  const [targetValue, setTargetValue] = useState("");
  const [targetUnit, setTargetUnit] = useState("");
  const [notes, setNotes] = useState("");
  const [goalId, setGoalId] = useState("");
  const [remindOn, setRemindOn] = useState(false);
  const [remindTime, setRemindTime] = useState("20:00");
  const [remindDays, setRemindDays] = useState<number[]>(ALL_DAYS);
  const [reminderId, setReminderId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const days = last7();
  const loadLogs = useCallback(async () => {
    const { data } = await supabase.from("habit_logs").select("*").gte("date", days[0]);
    if (data) setLogs(data as HabitLog[]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const loadStreaks = useCallback(async () => {
    const { data } = await supabase.rpc("get_my_habit_streaks");
    if (data) setStreaks(Object.fromEntries((data as { habit_id: string; streak: number }[]).map((r) => [r.habit_id, r.streak])));
  }, []);
  const loadTotals = useCallback(async () => {
    const { data } = await supabase.rpc("get_my_habit_totals");
    if (data) setTotals(Object.fromEntries((data as { habit_id: string; total: number }[]).map((r) => [r.habit_id, r.total])));
  }, []);
  useEffect(() => { loadLogs(); loadStreaks(); loadTotals(); }, [loadLogs, loadStreaks, loadTotals, habits.data.length]);

  const active = habits.data.filter((h) => h.is_active);
  const archived = habits.data.filter((h) => !h.is_active);
  const dueToday = active.filter(isDueToday);
  const doneToday = (id: string) => logs.some((l) => l.habit_id === id && l.date === days[6] && l.completed);
  // completed sink to the bottom
  const sorted = [...dueToday].sort((a, b) => Number(doneToday(a.id)) - Number(doneToday(b.id)));

  const complete = async (h: Habit) => {
    if (doneToday(h.id)) return;
    // Completing is the primary action — it must be instant, never a confirm box.
    setLogs((prev) => [...prev.filter((l) => !(l.habit_id === h.id && l.date === days[6])),
      { id: `tmp-${h.id}`, habit_id: h.id, user_id: h.user_id, date: days[6], completed: true, value: h.target_value } as HabitLog]);
    await supabase.from("habit_logs").upsert(
      { habit_id: h.id, user_id: h.user_id, date: days[6], completed: true, value: h.target_value },
      { onConflict: "habit_id,date" });
    void captureLifeEvent({ type: "HabitCompleted", occurredAt: days[6], payload: { habit: h.name, category: h.category },
      links: h.goal_id ? { habitIds: [h.id], goalIds: [h.goal_id] } : { habitIds: [h.id] },
      context: { streakLength: (streaks[h.id] ?? 0) + 1, outcome: "consistency", linkedToActiveGoal: !!h.goal_id } });
    loadStreaks(); loadTotals();
  };

  const resetForm = () => {
    setName(""); setCategory("Custom"); setFreqType("daily"); setFreqDays([1, 2, 3, 4, 5]); setFreqCount(3);
    setTargetValue(""); setTargetUnit(""); setNotes(""); setGoalId("");
    setRemindOn(false); setRemindTime("20:00"); setRemindDays(ALL_DAYS); setReminderId(null);
  };
  const openNew = () => { setEditing(null); resetForm(); setOpen(true); };
  const openEdit = async (h: Habit) => {
    setEditing(h);
    setName(h.name); setCategory(h.category); setFreqType(h.frequency_type);
    setFreqDays(h.frequency_config?.days ?? [1, 2, 3, 4, 5]); setFreqCount(h.frequency_config?.count ?? 3);
    setTargetValue(h.target_value != null ? String(h.target_value) : ""); setTargetUnit(h.target_unit ?? "");
    setNotes(h.notes ?? ""); setGoalId(h.goal_id ?? "");
    setRemindOn(false); setRemindTime("20:00"); setRemindDays(ALL_DAYS); setReminderId(null);
    setOpen(true);
    const { data } = await supabase.from("reminders").select("*").eq("kind", "habit").eq("habit_id", h.id).limit(1).maybeSingle();
    if (data) { const r = data as Reminder; setReminderId(r.id); setRemindOn(r.enabled); setRemindTime(String(r.remind_time).slice(0, 5)); setRemindDays(r.days?.length ? r.days : ALL_DAYS); }
  };

  const habitFields = () => ({
    name: name.trim(), category,
    frequency_type: freqType,
    frequency_config: freqType === "weekdays" ? { days: [...freqDays].sort() }
      : freqType === "x_per_week" || freqType === "x_per_month" ? { count: freqCount } : {},
    target_value: targetValue ? Number(targetValue) : null,
    target_unit: targetUnit.trim() || null,
    notes: notes.trim() || null,
    goal_id: goalId || null,
  });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || saving) return;
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

  return (
    <div>
      <PageHeader title="Habits" subtitle="Today's habits. Tap to complete — ISA learns from every one."
        action={<AddButton onClick={openNew} label="New habit" />} />

      <div className="mb-6"><TodoList /></div>

      {habits.loading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="glass h-20 animate-pulse rounded-3xl" />)}</div>
      ) : dueToday.length === 0 ? (
        <EmptyState icon={Repeat} title={active.length ? "Nothing due today" : "No habits yet"}
          description={active.length ? "Enjoy the breather — no habits are scheduled for today." : "Pick one small thing to repeat and let ISA track it."}
          actionLabel="Add your first habit" onAction={openNew} />
      ) : (
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {sorted.map((h) => {
              const done = doneToday(h.id);
              const streak = streaks[h.id] ?? 0;
              const total = totals[h.id] ?? 0;
              return (
                <motion.div key={h.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  <GlassCard className={`flex items-center gap-4 p-4 ${done ? "opacity-70" : ""}`}>
                    <button onClick={() => complete(h)} disabled={done} aria-label={done ? "Done today" : "Complete"}
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border transition ${
                        done ? "border-fg bg-fg text-[color:var(--color-bg)]" : "border-white/25 text-transparent hover:border-white/50 hover:bg-white/5"}`}>
                      <Check size={20} strokeWidth={3} />
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Link href={`/habits/${h.id}`} onClick={(e) => e.stopPropagation()} className={`truncate font-medium transition hover:text-accent ${done ? "text-muted line-through" : ""}`}>{h.name}</Link>
                        <span className="shrink-0 rounded-full bg-white/8 px-2 py-0.5 text-[10px] text-muted">{h.category}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted">
                        {h.target_value != null ? `${h.target_value}${h.target_unit ? ` ${h.target_unit}` : ""} · ` : ""}
                        {streak > 0 ? `${streak}-day streak` : "No streak yet"}{total > 0 ? ` · ${total} done` : ""}
                      </p>
                      {/* 7-day history (missed = red) */}
                      <div className="mt-2 flex gap-1">
                        {days.map((d) => {
                          const dDone = logs.some((l) => l.habit_id === h.id && l.date === d && l.completed);
                          const isToday = d === days[6];
                          return <span key={d} title={d} className={`h-2 w-2 rounded-full ${dDone ? "bg-fg" : isToday ? "bg-white/20" : "bg-red-500/30"}`} />;
                        })}
                      </div>
                    </div>
                    {/* ⋮ menu — portaled so it's never clipped by the card */}
                    <div className="shrink-0">
                      <PopMenu ariaLabel="Habit menu">
                        {(close) => (
                          <>
                            <MI Icon={Pencil} label="Edit" onClick={() => { close(); openEdit(h); }} />
                            <MI Icon={Copy} label="Duplicate" onClick={() => { close(); duplicate(h); }} />
                            <MI Icon={Archive} label="Archive" onClick={() => { close(); archive(h); }} />
                            <MI Icon={Trash2} label="Delete" danger onClick={() => { close(); del(h); }} />
                          </>
                        )}
                      </PopMenu>
                    </div>
                  </GlassCard>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Archived habits — archiving now has somewhere to go, and a way back. */}
      {archived.length > 0 && (
        <div className="mt-8">
          <button
            onClick={() => setShowArchive((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted transition hover:text-fg"
          >
            <Archive size={13} />
            {t("Archived")} ({archived.length})
            <ChevronDown size={14} className={`transition ${showArchive ? "rotate-180" : ""}`} />
          </button>
          {showArchive && (
            <div className="mt-3 space-y-2">
              {archived.map((h) => (
                <GlassCard key={h.id} className="flex items-center gap-3 p-3 opacity-70">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{h.name}</p>
                    <p className="text-xs text-muted">{h.category}</p>
                  </div>
                  <button
                    onClick={() => restore(h)}
                    className="shrink-0 rounded-lg border border-line px-2.5 py-1 text-xs text-fg transition hover:bg-white/5"
                  >
                    {t("Restore")}
                  </button>
                  <button
                    onClick={() => del(h)}
                    aria-label={t("Delete")}
                    className="shrink-0 rounded-lg p-1.5 text-muted transition hover:text-red-400"
                  >
                    <Trash2 size={14} />
                  </button>
                </GlassCard>
              ))}
            </div>
          )}
        </div>
      )}

      <ConfirmDialog request={confirmReq} onClose={() => setConfirmReq(null)} />

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? t("Edit habit") : t("New habit")}>
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className={labelClass}>Name</label>
            <input required autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Read" className={fieldClass} />
          </div>
          <div>
            <label className={labelClass}>Category</label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((c) => (
                <button key={c} type="button" onClick={() => setCategory(c)}
                  className={`rounded-full px-3 py-1 text-xs transition ${category === c ? "bg-accent text-white" : "bg-white/5 text-muted hover:text-fg"}`}>{c}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Target (optional)</label>
              <input type="number" value={targetValue} onChange={(e) => setTargetValue(e.target.value)} placeholder="20" className={fieldClass} />
            </div>
            <div>
              <label className={labelClass}>Unit</label>
              <input value={targetUnit} onChange={(e) => setTargetUnit(e.target.value)} placeholder="pages / km / min" className={fieldClass} />
            </div>
          </div>
          <div>
            <label className={labelClass}>Frequency</label>
            <div className="flex flex-wrap gap-1.5">
              {FREQ.map((f) => (
                <button key={f.id} type="button" onClick={() => setFreqType(f.id)}
                  className={`rounded-full px-3 py-1 text-xs transition ${freqType === f.id ? "bg-white/15 text-fg" : "bg-white/5 text-muted hover:text-fg"}`}>{f.label}</button>
              ))}
            </div>
            {freqType === "weekdays" && (
              <div className="mt-2 flex gap-1.5">
                {WD.map((w, i) => (
                  <button key={i} type="button" onClick={() => setFreqDays((d) => d.includes(i) ? d.filter((x) => x !== i) : [...d, i])}
                    className={`h-8 w-8 rounded-full text-xs transition ${freqDays.includes(i) ? "bg-accent text-white" : "bg-white/5 text-muted"}`}>{w}</button>
                ))}
              </div>
            )}
            {(freqType === "x_per_week" || freqType === "x_per_month") && (
              <input type="number" min={1} value={freqCount} onChange={(e) => setFreqCount(Number(e.target.value))}
                className={`${fieldClass} mt-2 w-28`} />
            )}
          </div>
          <div>
            <label className={labelClass}>Notes (optional)</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything to remember" className={fieldClass} />
          </div>
          {activeGoals.length > 0 && (
            <div>
              <label className={labelClass}>Linked goal (optional)</label>
              <select value={goalId} onChange={(e) => setGoalId(e.target.value)} className={fieldClass}>
                <option value="">None</option>
                {activeGoals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
              </select>
            </div>
          )}
          <div className="rounded-2xl border border-line bg-white/[0.02] p-4">
            <ReminderToggle on={remindOn} onToggle={() => setRemindOn((v) => !v)} label="Remind me" />
            {remindOn && <div className="mt-4"><ReminderFields time={remindTime} setTime={setRemindTime} days={remindDays} setDays={setRemindDays} /></div>}
          </div>
          <PressButton type="submit" disabled={saving} className={primaryBtnClass}>{saving ? "Saving…" : editing ? "Save" : "Create habit"}</PressButton>
        </form>
      </Modal>
    </div>
  );
}

function MI({ Icon, label, onClick, danger }: { Icon: typeof Pencil; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition hover:bg-white/5 ${danger ? "text-red-400" : "text-fg/90"}`}>
      <Icon size={15} /> {label}
    </button>
  );
}
