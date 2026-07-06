"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Plus, Trash2, ListTodo, Bell } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useCollection } from "@/hooks/useCollection";
import { GlassCard } from "@/components/ui/GlassCard";
import { Modal, primaryBtnClass } from "@/components/ui/Modal";
import { PressButton } from "@/components/ui/PressButton";
import {
  ReminderFields,
  ReminderToggle,
  ALL_DAYS,
} from "@/components/ui/ReminderFields";
import { todayISO } from "@/lib/datetime";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/cn";
import type { Todo, Reminder } from "@/lib/types";

export function TodoList() {
  const todos = useCollection<Todo>("todos", {
    orderBy: "created_at",
    ascending: true,
  });
  const [draft, setDraft] = useState("");
  // Daily reminder for the whole list (one kind='todo' row per user).
  const [reminder, setReminder] = useState<Reminder | null>(null);
  const [remOpen, setRemOpen] = useState(false);
  const [remindOn, setRemindOn] = useState(false);
  const [remindTime, setRemindTime] = useState("20:00");
  const [remindDays, setRemindDays] = useState<number[]>(ALL_DAYS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("reminders")
      .select("*")
      .eq("kind", "todo")
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        const r = data as Reminder;
        setReminder(r);
        setRemindOn(r.enabled);
        setRemindTime(String(r.remind_time).slice(0, 5));
        setRemindDays(r.days?.length ? r.days : ALL_DAYS);
      });
  }, []);

  const saveReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || (remindOn && remindDays.length === 0)) return;
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return;
    }
    if (remindOn) {
      const payload = {
        user_id: user.id,
        kind: "todo",
        habit_id: null,
        title: "Today's to-dos",
        remind_time: remindTime,
        days: [...remindDays].sort(),
        enabled: true,
      };
      const res = reminder
        ? await supabase
            .from("reminders")
            .update(payload)
            .eq("id", reminder.id)
            .select()
            .single()
        : await supabase.from("reminders").insert(payload).select().single();
      if (res.error) toast("Couldn't save the reminder.", "error");
      else setReminder(res.data as Reminder);
    } else if (reminder) {
      await supabase.from("reminders").delete().eq("id", reminder.id);
      setReminder(null);
    }
    setSaving(false);
    setRemOpen(false);
  };

  const today = todayISO();
  const items = todos.data.filter((t) => t.date === today);
  const doneCount = items.filter((t) => t.done).length;
  const pct = items.length ? Math.round((doneCount / items.length) * 100) : 0;
  // undone rise to the top, done sink to the bottom (stable)
  const sorted = [...items].sort((a, b) => Number(a.done) - Number(b.done));

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = draft.trim();
    if (!v) return;
    setDraft("");
    await todos.add({ title: v, date: today, done: false });
  };

  return (
    <GlassCard className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListTodo size={18} className="text-muted" />
          <h3 className="text-sm font-medium">Today&apos;s to-do</h3>
        </div>
        <div className="flex items-center gap-2">
          {items.length > 0 && (
            <span className="text-xs tabular-nums text-muted">
              {doneCount}/{items.length}
            </span>
          )}
          <button
            onClick={() => setRemOpen(true)}
            title={
              reminder?.enabled
                ? `Daily reminder at ${String(reminder.remind_time).slice(0, 5)}`
                : "Set a daily reminder"
            }
            aria-label="To-do reminder"
            className={cn(
              "rounded-lg p-1.5 transition",
              reminder?.enabled
                ? "text-accent"
                : "text-muted hover:text-fg"
            )}
          >
            <Bell size={15} />
          </button>
        </div>
      </div>

      {items.length > 0 && (
        <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
          <motion.div
            className="h-full rounded-full bg-fg"
            initial={false}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
      )}

      <ul className="space-y-1">
        <AnimatePresence initial={false}>
          {sorted.map((t) => (
            <motion.li
              key={t.id}
              layout
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="group flex items-center gap-3 py-1.5"
            >
              <button
                onClick={() => todos.update(t.id, { done: !t.done })}
                aria-label={t.done ? "Mark undone" : "Mark done"}
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                  t.done
                    ? "border-fg bg-fg text-[color:var(--color-bg)]"
                    : "border-white/30 text-transparent hover:border-white/60"
                }`}
              >
                <Check size={12} strokeWidth={3} />
              </button>
              <span
                className={`flex-1 text-sm transition-colors ${
                  t.done ? "text-muted line-through" : "text-fg/90"
                }`}
              >
                {t.title}
              </span>
              <button
                onClick={() => todos.remove(t.id)}
                className="rounded p-1 text-muted opacity-0 transition hover:text-red-400 group-hover:opacity-100"
                aria-label="Delete"
              >
                <Trash2 size={13} />
              </button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      <form onSubmit={add} className="mt-2 flex items-center gap-2">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-dashed border-line text-muted">
          <Plus size={11} />
        </span>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a task…"
          className="flex-1 bg-transparent py-1 text-sm text-fg/90 placeholder:text-muted/60"
        />
      </form>

      <Modal
        open={remOpen}
        onClose={() => setRemOpen(false)}
        title="To-do reminder"
      >
        <form onSubmit={saveReminder} className="space-y-4">
          <ReminderToggle
            on={remindOn}
            onToggle={() => setRemindOn((v) => !v)}
            label="Remind me about unfinished tasks"
          />
          {remindOn && (
            <>
              <ReminderFields
                time={remindTime}
                setTime={setRemindTime}
                days={remindDays}
                setDays={setRemindDays}
              />
              <p className="text-xs text-muted">
                The notification lists what&apos;s left. If everything is done,
                it stays quiet.
              </p>
            </>
          )}
          <PressButton type="submit" disabled={saving} className={primaryBtnClass}>
            {saving ? "Saving…" : "Save"}
          </PressButton>
        </form>
      </Modal>
    </GlassCard>
  );
}
