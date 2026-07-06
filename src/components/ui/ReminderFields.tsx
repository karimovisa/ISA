"use client";

import { fieldClass, labelClass } from "@/components/ui/Modal";
import { cn } from "@/lib/cn";

export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

/** Time + day-of-week pickers shared by the habit and to-do reminder forms. */
export function ReminderFields({
  time,
  setTime,
  days,
  setDays,
}: {
  time: string;
  setTime: (t: string) => void;
  days: number[];
  setDays: (d: number[]) => void;
}) {
  const toggleDay = (d: number) =>
    setDays(days.includes(d) ? days.filter((x) => x !== d) : [...days, d]);

  return (
    <>
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
        {days.length === 0 && (
          <p className="mt-1.5 text-xs text-red-300">Pick at least one day.</p>
        )}
      </div>
    </>
  );
}

/** Small on/off switch row used to enable a reminder inside a form. */
export function ReminderToggle({
  on,
  onToggle,
  label,
}: {
  on: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center justify-between"
    >
      <span className="text-sm text-fg/90">{label}</span>
      <span
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full transition-colors",
          on ? "bg-accent" : "bg-white/10"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all",
            on ? "left-[18px]" : "left-0.5"
          )}
        />
      </span>
    </button>
  );
}
