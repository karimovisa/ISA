"use client";

import { AlarmClock, Bell, ListTodo, Repeat, Trash2, Wallet } from "lucide-react";
import { useCollection } from "@/hooks/useCollection";
import { GlassCard } from "@/components/ui/GlassCard";
import { cn } from "@/lib/cn";
import type { Reminder } from "@/lib/types";

const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const KIND_ICON = {
  habit: Repeat,
  todo: ListTodo,
  custom: Bell,
  recurring: Wallet,
} as const;

function daysLabel(days: number[]) {
  if (!days || days.length === 0 || days.length === 7) return "Every day";
  if (days.length === 5 && [1, 2, 3, 4, 5].every((d) => days.includes(d)))
    return "Weekdays";
  if (days.length === 2 && [0, 6].every((d) => days.includes(d)))
    return "Weekends";
  return [...days]
    .sort()
    .map((d) => DAY_LABELS[d])
    .join(" ");
}

/** Read-only list of every reminder (set inside Habits / To-dos), with a
 *  toggle and delete — a single place to see and manage them all. */
export function ReminderOverview() {
  const reminders = useCollection<Reminder>("reminders", {
    orderBy: "remind_time",
    ascending: true,
  });

  return (
    <GlassCard className="mt-6 max-w-xl p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/[0.06]">
          <AlarmClock size={20} className="text-fg" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-medium">Reminders</h3>
          <p className="mt-1 text-sm text-muted">
            Set these on a habit or your to-do list — manage them all here.
          </p>

          {!reminders.loading && reminders.data.length === 0 && (
            <p className="mt-4 text-xs text-muted">
              No reminders yet. Open a habit or the to-do card and tap the bell.
            </p>
          )}

          {reminders.data.length > 0 && (
            <ul className="mt-4 space-y-2">
              {reminders.data.map((r) => {
                const Icon = KIND_ICON[r.kind] ?? Bell;
                return (
                  <li
                    key={r.id}
                    className="group flex items-center gap-3 rounded-2xl border border-line bg-white/[0.02] px-3.5 py-2.5"
                  >
                    <Icon size={15} className="shrink-0 text-muted" />
                    <div className={cn("min-w-0 flex-1", !r.enabled && "opacity-45")}>
                      <div className="truncate text-sm text-fg">{r.title}</div>
                      <div className="text-xs text-muted">
                        {String(r.remind_time).slice(0, 5)} ·{" "}
                        {daysLabel(r.days ?? [])}
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        reminders.update(r.id, {
                          enabled: !r.enabled,
                        } as Partial<Reminder>)
                      }
                      aria-label={r.enabled ? "Disable" : "Enable"}
                      className={cn(
                        "relative h-5 w-9 shrink-0 rounded-full transition-colors",
                        r.enabled ? "bg-accent" : "bg-white/15"
                      )}
                    >
                      <span
                        className={cn(
                          "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all",
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
        </div>
      </div>
    </GlassCard>
  );
}
