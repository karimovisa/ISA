import type { FocusSession, Goal, JournalEntry } from "@/lib/types";

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Consecutive-day journaling streak ending today or yesterday. */
export function journalStreak(entries: JournalEntry[]): number {
  const days = new Set(
    entries.map((e) => startOfDay(new Date(e.entry_date)))
  );
  if (days.size === 0) return 0;

  const today = startOfDay(new Date());
  const DAY = 86_400_000;

  // Streak only counts if you wrote today or yesterday.
  let cursor = days.has(today) ? today : today - DAY;
  if (!days.has(cursor)) return 0;

  let streak = 0;
  while (days.has(cursor)) {
    streak++;
    cursor -= DAY;
  }
  return streak;
}

/** Total focus minutes in the last 7 days. */
export function focusMinutesThisWeek(sessions: FocusSession[]): number {
  const cutoff = Date.now() - 7 * 86_400_000;
  const seconds = sessions
    .filter((s) => new Date(s.created_at).getTime() >= cutoff)
    .reduce((sum, s) => sum + s.duration_seconds, 0);
  return Math.round(seconds / 60);
}

export type DeadlineInfo = {
  title: string;
  date: Date;
  daysLeft: number;
};

/** The closest upcoming goal deadline (today or later). */
export function nearestDeadline(goals: Goal[]): DeadlineInfo | null {
  const today = startOfDay(new Date());
  const upcoming = goals
    .filter((g) => g.deadline)
    .map((g) => {
      const date = new Date(g.deadline as string);
      return {
        title: g.title,
        date,
        daysLeft: Math.round((startOfDay(date) - today) / 86_400_000),
      };
    })
    .filter((g) => g.daysLeft >= 0)
    .sort((a, b) => a.daysLeft - b.daysLeft);

  return upcoming[0] ?? null;
}
