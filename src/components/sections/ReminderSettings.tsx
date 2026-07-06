"use client";

import { useMemo, useState } from "react";
import { AlarmClock, Bell, ListTodo, Repeat, Trash2, Plus } from "lucide-react";
import { useCollection } from "@/hooks/useCollection";
import { GlassCard } from "@/components/ui/GlassCard";
import { PressButton } from "@/components/ui/PressButton";
import {
  Modal,
  fieldClass,
  labelClass,
  primaryBtnClass,
} from "@/components/ui/Modal";
import { cn } from "@/lib/cn";
import type { Habit, Reminder } from "@/lib/types";

const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

const KINDS = [
  { id: "habit", label: "Habit", Icon: Repeat, hint: "Nudges you until it's checked off" },
  { id: "todo", label: "To-dos", Icon: ListTodo, hint: "Lists today's unfinished tasks" },
  { id: "custom", label: "Custom", Icon: Bell, hint: "Any reminder, your own text" },
] as const;

type Kind = (typeof KINDS)[number]["id"];

function fmtTime(t: string) {
  return t.slice(0, 5);
}

function daysLabel(days: number[]) {
  if (days.length === 7 || days.length === 0) return "Every day";
  if ([1, 2, 3, 4, 5].every((d) => days.includes(d)) && days.length === 5)
    return "Weekdays";
  if ([0, 6].every((d) => days.includes(d)) && days.length === 2)
    return "Weekends";
  return days
    .slice()
    .sort()
    .map((d) => DAY_LABELS[d])
    .join(" ");
}

export function ReminderSettings() {
  const reminders = useCollection<Reminder>("reminders", {
    orderBy: "remind_time",
    ascending: true,
  });
  const habits = useCollection<Habit>("habits");
  const activeHabits = useMemo(
    () => habits.data.filter((h) => h.is_active),
    [habits.data]
  );

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Reminder | null>(null);
  const [kind, setKind] = useState<Kind>("habit");
  const [habitId, setHabitId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [time, setTime] = useState("20:00");
  const [days, setDays] = useState<number[]>(ALL_DAYS);
  const [busy, setBusy] = useState(false);

  const openNew = () => {
    setEditing(null);
    setKind(activeHabits.length > 0 ? "habit" : "custom");
    setHabitId(activeHabits[0]?.id ?? "");
    setTitle("");
    setBody("");
    setTime("20:00");
    setDays(ALL_DAYS);
    setOpen(true);
  };

  const openEdit = (r: Reminder) => {
    setEditing(r);
    setKind(r.kind);
    setHabitId(r.habit_id ?? "");
    setTitle(r.title);
    setBody(r.body ?? "");
    setTime(fmtTime(r.remind_time));
    setDays(r.days?.length ? r.days : ALL_DAYS);
    setOpen(true);
  };

  const toggleDay = (d: number) =>
    setDays((cur) =>
      cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]
    );

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || days.length === 0) return;
    const habit = activeHabits.find((h) => h.id === habitId);
    const finalTitle =
      kind === "habit"
        ? habit?.name ?? "Habit"
        : kind === "todo"
          ? "Today's to-dos"
          : title.trim();
    if (!finalTitle) return;
    setBusy(true);
    const row = {
      kind,
      habit_id: kind === "habit" ? habitId || null : null,
      title: finalTitle,
      body: body.trim() || null,
      remind_time: time,
      days: [...days].sort(),
      enabled: true,
    };
    if (editing) await reminders.update(editing.id, row as Partial<Reminder>);
    else await reminders.add(row as Partial<Reminder>);
    setBusy(false);
    setOpen(false);
  };

  return (
    <>
      <GlassCard className="mt-6 max-w-xl p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/[0.06]">
            <AlarmClock size={20} className="text-fg" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-medium">Reminders</h3>
                <p className="mt-1 text-sm text-muted">
                  Pick a time — ISA pings you at that exact moment.
                </p>
              </div>
              <PressButton
                onClick={openNew}
                className="flex shrink-0 items-center gap-1.5 rounded-xl bg-white/10 px-3.5 py-2 text-sm font-medium text-fg transition hover:bg-white/15"
              >
                <Plus size={15} /> Add
              </PressButton>
            </div>

            {reminders.data.length > 0 && (
              <ul className="mt-4 space-y-2">
                {reminders.data.map((r) => {
                  const K = KINDS.find((k) => k.id === r.kind) ?? KINDS[2];
                  return (
                    <li
                      key={r.id}
                      className="group flex items-center gap-3 rounded-2xl border border-line bg-white/[0.02] px-3.5 py-2.5"
                    >
                      <K.Icon size={15} className="shrink-0 text-muted" />
                      <button
                        onClick={() => openEdit(r)}
                        className={cn(
                          "min-w-0 flex-1 text-left",
                          !r.enabled && "opacity-45"
                        )}
                      >
                        <div className="truncate text-sm text-fg">{r.title}</div>
                        <div className="text-xs text-muted">
                          {fmtTime(r.remind_time)} · {daysLabel(r.days ?? [])}
                        </div>
                      </button>
                      {/* enable toggle */}
                      <button
                        onClick={() =>
                          reminders.update(r.id, {
                            enabled: !r.enabled,
                          } as Partial<Reminder>)
                        }
                        aria-label={r.enabled ? "Disable" : "Enable"}
                        className={cn(
                          "relative h-5 w-9 shrink-0 rounded-full transition-colors",
                          r.enabled ? "bg-accent" : "bg-white/10"
                        )}
                      >
                        <span
                          className={cn(
                            "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all",
                            r.enabled ? "left-[18px]" : "left-0.5"
                          )}
                        />
                      </button>
                      <button
                        onClick={() => reminders.remove(r.id)}
                        aria-label="Delete reminder"
                        className="shrink-0 rounded p-1 text-muted opacity-0 transition hover:text-red-400 group-hover:opacity-100"
                      >
                        <Trash2 size={14} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {!reminders.loading && reminders.data.length === 0 && (
              <p className="mt-4 text-xs text-muted">
                No reminders yet. Add one for a habit, your to-do list, or
                anything else.
              </p>
            )}
          </div>
        </div>
      </GlassCard>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Edit reminder" : "New reminder"}
      >
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className={labelClass}>Remind me about</label>
            <div className="grid grid-cols-3 gap-2">
              {KINDS.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setKind(id)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-xl border px-2 py-2.5 text-xs transition",
                    kind === id
                      ? "border-accent bg-accent-soft text-fg"
                      : "border-line text-muted hover:text-fg"
                  )}
                >
                  <Icon size={16} />
                  {label}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-muted">
              {KINDS.find((k) => k.id === kind)?.hint}
            </p>
          </div>

          {kind === "habit" && (
            <div>
              <label className={labelClass}>Habit</label>
              {activeHabits.length > 0 ? (
                <select
                  value={habitId}
                  onChange={(e) => setHabitId(e.target.value)}
                  className={fieldClass}
                >
                  {activeHabits.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-xs text-muted">
                  You have no active habits — add one on the Habits page first.
                </p>
              )}
            </div>
          )}

          {kind === "custom" && (
            <div>
              <label className={labelClass}>Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Drink water"
                className={fieldClass}
                required
              />
            </div>
          )}

          <div>
            <label className={labelClass}>Time</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className={fieldClass}
              required
            />
          </div>

          <div>
            <label className={labelClass}>Days</label>
            <div className="flex gap-1.5">
              {DAY_LABELS.map((d, i) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleDay(i)}
                  className={cn(
                    "h-9 flex-1 rounded-lg text-xs font-medium transition",
                    days.includes(i)
                      ? "bg-accent-soft text-fg ring-1 ring-inset ring-accent/40"
                      : "bg-white/[0.04] text-muted hover:text-fg"
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={labelClass}>Message (optional)</label>
            <input
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Leave empty for ISA's default text"
              className={fieldClass}
            />
          </div>

          <PressButton
            type="submit"
            disabled={busy || (kind === "habit" && !habitId)}
            className={primaryBtnClass}
          >
            {busy ? "Saving…" : editing ? "Save changes" : "Add reminder"}
          </PressButton>
        </form>
      </Modal>
    </>
  );
}
