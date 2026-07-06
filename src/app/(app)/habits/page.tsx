"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Pencil, Archive, Repeat } from "lucide-react";
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
        d.getDate()
      ).padStart(2, "0")}`
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

  useEffect(() => {
    loadLogs();
    loadStreaks();
  }, [loadLogs, loadStreaks, habits.data.length]);

  const active = habits.data.filter((h) => h.is_active);
  const done = (habitId: string, date: string) =>
    logs.some((l) => l.habit_id === habitId && l.date === date && l.completed);

  const toggle = async (habit: Habit, date: string) => {
    const current = done(habit.id, date);
    // optimistic
    setLogs((prev) => {
      const ex = prev.find((l) => l.habit_id === habit.id && l.date === date);
      if (ex)
        return prev.map((l) =>
          l === ex ? { ...l, completed: !current } : l
        );
      return [
        ...prev,
        {
          id: `tmp-${habit.id}-${date}`,
          habit_id: habit.id,
          user_id: habit.user_id,
          date,
          completed: !current,
        } as HabitLog,
      ];
    });
    await supabase
      .from("habit_logs")
      .upsert(
        { habit_id: habit.id, user_id: habit.user_id, date, completed: !current },
        { onConflict: "habit_id,date" }
      );
    loadStreaks();
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
          ? await supabase.from("reminders").update(payload).eq("id", reminderId)
          : await supabase.from("reminders").insert(payload);
        if (error) toast("Habit saved, but the reminder failed.", "error");
      } else if (reminderId) {
        await supabase.from("reminders").delete().eq("id", reminderId);
      }
    }

    setSaving(false);
    setOpen(false);
  };
  const archive = (h: Habit) => habits.update(h.id, { is_active: false });

  return (
    <div>
      <PageHeader
        title="Habits"
        subtitle="Small daily actions. The compounding kind."
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
            return (
              <motion.div
                key={h.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
              >
                <GlassCard hover className="group flex items-center gap-4 p-5">
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

                  {/* 7-day dots */}
                  <div className="flex items-center gap-1.5">
                    {days.map((d) => {
                      const isDone = done(h.id, d);
                      const isToday = d === days[6];
                      return (
                        <button
                          key={d}
                          onClick={() => toggle(h, d)}
                          aria-label={`${h.name} ${d}`}
                          className={`h-4 w-4 rounded-full transition-all ${
                            isDone
                              ? "bg-white"
                              : "bg-white/10 hover:bg-white/25"
                          } ${isToday ? "ring-1 ring-white/40 ring-offset-2 ring-offset-transparent" : ""}`}
                        />
                      );
                    })}
                  </div>

                  <div className="flex shrink-0 gap-1 opacity-0 transition group-hover:opacity-100">
                    <button
                      onClick={() => openEdit(h)}
                      className="rounded-lg p-2 text-muted transition hover:text-fg"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => archive(h)}
                      title="Archive"
                      className="rounded-lg p-2 text-muted transition hover:text-amber-300"
                    >
                      <Archive size={15} />
                    </button>
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

          <PressButton type="submit" disabled={saving} className={primaryBtnClass}>
            {saving ? "Saving…" : editing ? "Save" : "Create habit"}
          </PressButton>
        </form>
      </Modal>
    </div>
  );
}
