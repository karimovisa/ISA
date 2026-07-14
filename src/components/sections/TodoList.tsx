"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Plus, Trash2, ListTodo, Bell, Flag, CalendarDays } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useCollection } from "@/hooks/useCollection";
import { GlassCard } from "@/components/ui/GlassCard";
import { Modal, primaryBtnClass } from "@/components/ui/Modal";
import { PressButton } from "@/components/ui/PressButton";
import { ReminderFields, ReminderToggle, ALL_DAYS } from "@/components/ui/ReminderFields";
import { todayISO } from "@/lib/datetime";
import { toast } from "@/lib/toast";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/cn";
import { captureLifeEvent } from "@/lib/life-events";
import type { Todo, Reminder, TaskPriority } from "@/lib/types";

const PRIORITY_CYCLE: TaskPriority[] = ["normal", "high", "low"];
const priorityDot: Record<TaskPriority, string> = {
  high: "bg-red-400",
  normal: "bg-white/25",
  low: "bg-white/10",
};

export function TodoList() {
  const todos = useCollection<Todo>("todos", { orderBy: "created_at", ascending: true });
  const { t } = useT();
  const [draft, setDraft] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("normal");
  const [date, setDate] = useState(todayISO());
  // reminder
  const [reminder, setReminder] = useState<Reminder | null>(null);
  const [remOpen, setRemOpen] = useState(false);
  const [remindOn, setRemindOn] = useState(false);
  const [remindTime, setRemindTime] = useState("20:00");
  const [remindDays, setRemindDays] = useState<number[]>(ALL_DAYS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("reminders").select("*").eq("kind", "todo").limit(1).maybeSingle().then(({ data }) => {
      if (!data) return;
      const r = data as Reminder;
      setReminder(r); setRemindOn(r.enabled); setRemindTime(String(r.remind_time).slice(0, 5));
      setRemindDays(r.days?.length ? r.days : ALL_DAYS);
    });
  }, []);

  const today = todayISO();
  const open = todos.data.filter((x) => !x.done);
  const overdue = open.filter((x) => x.date < today).sort(byPriority);
  const todayItems = open.filter((x) => x.date === today).sort(byPriority);
  const upcoming = open.filter((x) => x.date > today).sort((a, b) => a.date.localeCompare(b.date));
  const doneToday = todos.data.filter((x) => x.done && x.date === today);
  const pct = todayItems.length + doneToday.length ? Math.round((doneToday.length / (todayItems.length + doneToday.length)) * 100) : 0;

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = draft.trim(); if (!v) return;
    setDraft("");
    await todos.add({ title: v, date, done: false, priority } as Partial<Todo>);
    void captureLifeEvent({ type: "TaskCreated", occurredAt: date, payload: { title: v, priority } });
    setPriority("normal"); setDate(today);
  };

  const toggle = (x: Todo) => {
    todos.update(x.id, { done: !x.done });
    if (!x.done)
      void captureLifeEvent({
        type: "TaskCompleted", occurredAt: today, payload: { title: x.title },
        links: x.goal_id ? { goalIds: [x.goal_id] } : undefined,
        context: { outcome: "progress" },
      });
  };

  const saveReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || (remindOn && remindDays.length === 0)) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    if (remindOn) {
      const payload = { user_id: user.id, kind: "todo", habit_id: null, title: "Today's to-dos", remind_time: remindTime, days: [...remindDays].sort(), enabled: true };
      const res = reminder ? await supabase.from("reminders").update(payload).eq("id", reminder.id).select().single()
        : await supabase.from("reminders").insert(payload).select().single();
      if (res.error) toast("Couldn't save the reminder.", "error"); else setReminder(res.data as Reminder);
    } else if (reminder) { await supabase.from("reminders").delete().eq("id", reminder.id); setReminder(null); }
    setSaving(false); setRemOpen(false);
  };

  const row = (x: Todo) => (
    <motion.li key={x.id} layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
      className="group flex items-center gap-2.5 py-1.5">
      <button onClick={() => toggle(x)} aria-label={x.done ? "Mark undone" : "Mark done"}
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
          x.done ? "border-fg bg-fg text-[color:var(--color-bg)]" : "border-white/30 text-transparent hover:border-white/60"}`}>
        <Check size={12} strokeWidth={3} />
      </button>
      {!x.done && <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${priorityDot[x.priority ?? "normal"]}`} />}
      <span className={`flex-1 truncate text-sm ${x.done ? "text-muted line-through" : "text-fg/90"}`}>{x.title}</span>
      {!x.done && x.date !== today && (
        <span className={`shrink-0 text-[10px] ${x.date < today ? "text-red-300" : "text-muted"}`}>{x.date.slice(5)}</span>
      )}
      <button onClick={() => todos.remove(x.id)} className="rounded p-1 text-muted opacity-0 transition hover:text-red-400 group-hover:opacity-100" aria-label="Delete">
        <Trash2 size={13} />
      </button>
    </motion.li>
  );

  const group = (label: string, items: Todo[], tone?: string) =>
    items.length === 0 ? null : (
      <div className="mt-3 first:mt-0">
        <p className={`mb-1 text-[10px] font-semibold uppercase tracking-wider ${tone ?? "text-muted"}`}>{label} · {items.length}</p>
        <ul><AnimatePresence initial={false}>{items.map(row)}</AnimatePresence></ul>
      </div>
    );

  return (
    <GlassCard className="p-6">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListTodo size={18} className="text-muted" />
          <h3 className="text-sm font-medium">{t("Today's to-do")}</h3>
        </div>
        <div className="flex items-center gap-2">
          {todayItems.length + doneToday.length > 0 && <span className="text-xs tabular-nums text-muted">{doneToday.length}/{todayItems.length + doneToday.length}</span>}
          <button onClick={() => setRemOpen(true)} aria-label="To-do reminder"
            className={cn("rounded-lg p-1.5 transition", reminder?.enabled ? "text-accent" : "text-muted hover:text-fg")}><Bell size={15} /></button>
        </div>
      </div>

      {todayItems.length + doneToday.length > 0 && (
        <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
          <motion.div className="h-full rounded-full bg-fg" initial={false} animate={{ width: `${pct}%` }} transition={{ duration: 0.4 }} />
        </div>
      )}

      {group(t("Overdue"), overdue, "text-red-300")}
      {group(t("Today"), todayItems)}
      {group(t("Upcoming"), upcoming)}
      {doneToday.length > 0 && group(t("Completed"), doneToday)}

      <form onSubmit={add} className="mt-3 flex items-center gap-2 border-t border-line pt-3">
        <button type="button" onClick={() => setPriority((p) => PRIORITY_CYCLE[(PRIORITY_CYCLE.indexOf(p) + 1) % 3])}
          title={`Priority: ${priority}`} className="shrink-0 rounded-lg p-1.5 text-muted transition hover:text-fg">
          <Flag size={14} className={priority === "high" ? "text-red-400" : priority === "low" ? "text-white/30" : "text-muted"} />
        </button>
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={t("Add a task…")}
          className="min-w-0 flex-1 bg-transparent py-1 text-sm text-fg/90 placeholder:text-muted/60" />
        <label className="shrink-0 cursor-pointer rounded-lg p-1.5 text-muted transition hover:text-fg" title="Schedule">
          <CalendarDays size={14} className={date !== today ? "text-accent" : ""} />
          <input type="date" value={date} onChange={(e) => setDate(e.target.value || today)} className="sr-only" />
        </label>
        <button type="submit" className="shrink-0 rounded-lg bg-white/10 p-1.5 text-fg transition hover:bg-white/15"><Plus size={14} /></button>
      </form>

      <Modal open={remOpen} onClose={() => setRemOpen(false)} title="To-do reminder">
        <form onSubmit={saveReminder} className="space-y-4">
          <ReminderToggle on={remindOn} onToggle={() => setRemindOn((v) => !v)} label="Remind me about unfinished tasks" />
          {remindOn && (
            <>
              <ReminderFields time={remindTime} setTime={setRemindTime} days={remindDays} setDays={setRemindDays} />
              <p className="text-xs text-muted">Lists what&apos;s left. If everything&apos;s done, it stays quiet.</p>
            </>
          )}
          <PressButton type="submit" disabled={saving} className={primaryBtnClass}>{saving ? "Saving…" : "Save"}</PressButton>
        </form>
      </Modal>
    </GlassCard>
  );
}

function byPriority(a: Todo, b: Todo) {
  const rank: Record<TaskPriority, number> = { high: 0, normal: 1, low: 2 };
  return rank[a.priority ?? "normal"] - rank[b.priority ?? "normal"];
}
