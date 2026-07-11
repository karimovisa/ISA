"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Pencil, Trash2, Repeat } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useCollection } from "@/hooks/useCollection";
import { GlassCard } from "@/components/ui/GlassCard";
import { PageHeader, AddButton } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  Modal,
  fieldClass,
  labelClass,
  primaryBtnClass,
} from "@/components/ui/Modal";
import { PressButton } from "@/components/ui/PressButton";
import { TodoList } from "@/components/sections/TodoList";
import {
  ReminderFields,
  ReminderToggle,
  ALL_DAYS,
} from "@/components/ui/ReminderFields";
import { toast } from "@/lib/toast";
import type { Habit, HabitLog, Reminder } from "@/lib/types";

function last7(): string[] {
  const out: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate(),
      ).padStart(2, "0")}`,
    );
  }
  return out;
}

export default function HabitsPage() {
  const habits = useCollection<Habit>("habits", {
    orderBy: "created_at",
    ascending: true,
  });
  const [logs, setLogs] = useState<HabitLog[]>([]);
  const [streaks, setStreaks] = useState<Record<string, number>>({});
  const [totals, setTotals] = useState<Record<string, number>>({});
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Habit | null>(null);
  const [name, setName] = useState("");
  // Per-habit reminder, edited inside the same modal.
  const [remindOn, setRemindOn] = useState(false);
  const [remindTime, setRemindTime] = useState("20:00");
  const [remindDays, setRemindDays] = useState<number[]>(ALL_DAYS);
  const [reminderId, setReminderId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const days = last7();

  const loadLogs = useCallback(async () => {
    const { data } = await supabase
      .from("habit_logs")
      .select("*")
      .gte("date", days[0]);
    if (data) setLogs(data as HabitLog[]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadStreaks = useCallback(async () => {
    const { data } = await supabase.rpc("get_my_habit_streaks");
    if (data) {
      const map: Record<string, number> = {};
      for (const r of data as { habit_id: string; streak: number }[])
        map[r.habit_id] = r.streak;
      setStreaks(map);
    }
  }, []);

  const loadTotals = useCallback(async () => {
    const { data } = await supabase.rpc("get_my_habit_totals");
    if (data) {
      const map: Record<string, number> = {};
      for (const r of data as { habit_id: string; total: number }[])
        map[r.habit_id] = r.total;
      setTotals(map);
    }
  }, []);

  useEffect(() => {
    loadLogs();
    loadStreaks();
    loadTotals();
  }, [loadLogs, loadStreaks, loadTotals, habits.data.length]);

  const active = habits.data.filter((h) => h.is_active);
  const done = (habitId: string, date: string) =>
    logs.some((l) => l.habit_id === habitId && l.date === date && l.completed);

  // One-way: marking a habit done for today requires confirmation, and once
  // confirmed it can't be undone the same day (the day-dot becomes locked —
  // see the disabled/canToggle logic in the row render below).
  const markDone = async (habit: Habit, date: string) => {
    if (
      !window.confirm(
        `Mark "${habit.name}" as done for today?\n\nThis can't be undone once confirmed.`,
      )
    )
      return;

    setLogs((prev) => {
      const ex = prev.find((l) => l.habit_id === habit.id && l.date === date);
      if (ex)
        return prev.map((l) => (l === ex ? { ...l, completed: true } : l));
      return [
        ...prev,
        {
          id: `tmp-${habit.id}-${date}`,
          habit_id: habit.id,
          user_id: habit.user_id,
          date,
          completed: true,
        } as HabitLog,
      ];
    });
    await supabase
      .from("habit_logs")
      .upsert(
        { habit_id: habit.id, user_id: habit.user_id, date, completed: true },
        { onConflict: "habit_id,date" },
      );
    loadStreaks();
    loadTotals();
  };

  const resetReminderForm = () => {
    setRemindOn(false);
    setRemindTime("20:00");
    setRemindDays(ALL_DAYS);
    setReminderId(null);
  };

  const openNew = () => {
    setEditing(null);
    setName("");
    resetReminderForm();
    setOpen(true);
  };
  const openEdit = async (h: Habit) => {
    setEditing(h);
    setName(h.name);
    resetReminderForm();
    setOpen(true);
    // Prefill this habit's reminder, if one exists.
    const { data } = await supabase
      .from("reminders")
      .select("*")
      .eq("kind", "habit")
      .eq("habit_id", h.id)
      .limit(1)
      .maybeSingle();
    if (data) {
      const r = data as Reminder;
      setReminderId(r.id);
      setRemindOn(r.enabled);
      setRemindTime(String(r.remind_time).slice(0, 5));
      setRemindDays(r.days?.length ? r.days : ALL_DAYS);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || saving) return;
    if (remindOn && remindDays.length === 0) return;
    setSaving(true);

    let habitId = editing?.id ?? null;
    let userId = editing?.user_id ?? null;

    if (editing) {
      await habits.update(editing.id, { name: name.trim() });
    } else {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setSaving(false);
        return;
      }
      userId = user.id;
      // Insert directly so we get the new id back for the reminder row.
      const { data: row, error } = await supabase
        .from("habits")
        .insert({ name: name.trim(), is_active: true, user_id: user.id })
        .select("id")
        .single();
      if (error || !row) {
        toast("Couldn't save habit — please try again.", "error");
        setSaving(false);
        return;
      }
      habitId = row.id as string;
      await habits.refresh();
    }

    // Sync the reminder with the toggle state.
    if (habitId && userId) {
      if (remindOn) {
        const payload = {
          user_id: userId,
          kind: "habit",
          habit_id: habitId,
          title: name.trim(),
          remind_time: remindTime,
          days: [...remindDays].sort(),
          enabled: true,
        };
        const { error } = reminderId
          ? await supabase
              .from("reminders")
              .update(payload)
              .eq("id", reminderId)
          : await supabase.from("reminders").insert(payload);
        if (error) toast("Habit saved, but the reminder failed.", "error");
      } else if (reminderId) {
        await supabase.from("reminders").delete().eq("id", reminderId);
      }
    }

    setSaving(false);
    setOpen(false);
  };
  const deleteHabit = (h: Habit) => {
    if (
      !window.confirm(
        `Delete "${h.name}"?\n\nThis removes its full history and can't be undone.`,
      )
    )
      return;
    habits.remove(h.id);
  };

  return (
    <div>
      <PageHeader
        title="Habits"
        subtitle="Check in each day. A missed day breaks the streak."
        action={<AddButton onClick={openNew} label="New habit" />}
      />

      <div className="mb-6">
        <TodoList />
      </div>

      {habits.loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="glass h-20 animate-pulse rounded-3xl" />
          ))}
        </div>
      ) : active.length === 0 ? (
        <EmptyState
          icon={Repeat}
          title="No habits yet"
          description="Pick one small thing to repeat every day."
          actionLabel="Add your first habit"
          onAction={openNew}
        />
      ) : (
        <div className="space-y-4">
          {active.map((h, i) => {
            const streak = streaks[h.id] ?? 0;
            const total = totals[h.id] ?? 0;
            return (
              <motion.div
                key={h.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
              >
                <GlassCard
                  hover
                  className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate font-medium">{h.name}</h3>
                      {streak > 0 && (
                        <span className="shrink-0 text-xs text-muted">
                          {streak} day{streak === 1 ? "" : "s"} streak
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 sm:w-auto sm:justify-end sm:gap-4">
                    {/* Lifetime completed-days count — always visible, off to the side. */}
                    <div className="flex shrink-0 flex-col items-center justify-center rounded-xl bg-white/[0.04] px-3 py-1.5">
                      <span className="text-lg font-bold tabular-nums leading-none">
                        {total}
                      </span>
                      <span className="mt-0.5 text-[10px] uppercase tracking-wide text-muted">
                        done
                      </span>
                    </div>

                    {/* 7-day dots — today is tappable only until marked done,
                        then it locks in; past days are read-only either way. */}
                    <div className="flex items-center gap-1.5">
                      {days.map((d) => {
                        const isDone = done(h.id, d);
                        const isToday = d === days[6];
                        const missed = !isDone && !isToday;
                        const canTap = isToday && !isDone;
                        return (
                          <button
                            key={d}
                            onClick={canTap ? () => markDone(h, d) : undefined}
                            disabled={!canTap}
                            title={
                              isToday
                                ? isDone
                                  ? "Done today — locked in"
                                  : "Tap to mark today"
                                : isDone
                                  ? "Done"
                                  : "Missed"
                            }
                            aria-label={`${h.name} ${d} ${
                              isDone ? "done" : missed ? "missed" : "today"
                            }`}
                            className={`h-4 w-4 shrink-0 rounded-full transition-all ${
                              isDone
                                ? "bg-fg"
                                : missed
                                  ? "bg-red-500/35"
                                  : "bg-white/10 hover:bg-white/25"
                            } ${
                              canTap
                                ? "ring-1 ring-fg/40 ring-offset-2 ring-offset-transparent"
                                : "cursor-default"
                            }`}
                          />
                        );
                      })}
                    </div>

                    {/* Always visible — no hover-gating, since touch devices
                        have no hover state and these were invisible on mobile. */}
                    <div className="flex shrink-0 gap-1">
                      <button
                        onClick={() => openEdit(h)}
                        className="rounded-lg p-2 text-muted transition hover:text-fg"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => deleteHabit(h)}
                        title="Delete"
                        className="rounded-lg p-2 text-muted transition hover:text-red-400"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            );
          })}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Edit habit" : "New habit"}
      >
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className={labelClass}>Name</label>
            <input
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Read 20 minutes"
              className={fieldClass}
            />
          </div>

          <div className="rounded-2xl border border-line bg-white/[0.02] p-4">
            <ReminderToggle
              on={remindOn}
              onToggle={() => setRemindOn((v) => !v)}
              label="Remind me with a notification"
            />
            {remindOn && (
              <div className="mt-4 space-y-4">
                <ReminderFields
                  time={remindTime}
                  setTime={setRemindTime}
                  days={remindDays}
                  setDays={setRemindDays}
                />
                <p className="text-xs text-muted">
                  Stays quiet on days you&apos;ve already checked it off.
                </p>
              </div>
            )}
          </div>

          <PressButton
            type="submit"
            disabled={saving}
            className={primaryBtnClass}
          >
            {saving ? "Saving…" : editing ? "Save" : "Create habit"}
          </PressButton>
        </form>
      </Modal>
    </div>
  );
}
