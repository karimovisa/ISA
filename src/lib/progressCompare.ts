// ISA — Progress comparison. "Am I doing better than before?" answered fairly:
// equal-length windows (this month so far vs the SAME days of last month, never a
// partial month vs a full one), only the areas the person actually uses, and a
// ±5% dead-band so day-to-day noise never reads as decline. The verdict is a vote
// across areas, so the user can see exactly why ("4 of 5 areas improved").
// Pure functions — the Progress page loads the rows and renders the result.

export type Period = "day" | "week" | "month";
export type Window = { from: string; to: string }; // inclusive local yyyy-mm-dd

export type DomainKey = "focus" | "habits" | "tasks" | "journal" | "running" | "sleep" | "prayer";
export type Direction = "up" | "down" | "flat";
export type Verdict = "improving" | "steady" | "softening" | "in_progress";

export type DomainResult = {
  key: DomainKey;
  current: number;
  previous: number;
  /** % change vs the previous window; null when there was nothing before. */
  changePct: number | null;
  direction: Direction;
};

export type Comparison = {
  domains: DomainResult[];
  ups: number;
  downs: number;
  verdict: Verdict | null; // null = no data in either window
};

/** Below this, a change is noise and counts as steady. */
const DEAD_BAND_PCT = 5;

export const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

/** The two equal-length windows a period compares. */
export function windowsFor(period: Period, now = new Date()): { current: Window; previous: Window } {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === "day") {
    return {
      current: { from: ymd(today), to: ymd(today) },
      previous: { from: ymd(addDays(today, -1)), to: ymd(addDays(today, -1)) },
    };
  }
  if (period === "week") {
    return {
      current: { from: ymd(addDays(today, -6)), to: ymd(today) },
      previous: { from: ymd(addDays(today, -13)), to: ymd(addDays(today, -7)) },
    };
  }
  // Month to date vs the same number of days at the start of last month.
  const dayOfMonth = today.getDate();
  const prevStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const prevLast = new Date(today.getFullYear(), today.getMonth(), 0).getDate();
  const prevEnd = new Date(prevStart.getFullYear(), prevStart.getMonth(), Math.min(dayOfMonth, prevLast));
  return {
    current: { from: ymd(new Date(today.getFullYear(), today.getMonth(), 1)), to: ymd(today) },
    previous: { from: ymd(prevStart), to: ymd(prevEnd) },
  };
}

export const inWindow = (date: string, w: Window) => date >= w.from && date <= w.to;

/** Days in a window (inclusive). Sums are compared per day, so a 31-day month
 *  never "beats" a 28-day one just by being longer. */
export function windowDays(w: Window): number {
  const a = new Date(`${w.from}T00:00:00`);
  const b = new Date(`${w.to}T00:00:00`);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000) + 1;
}

/** The earliest date any period needs — load rows from here once. */
export function earliestDate(now = new Date()): string {
  return (["day", "week", "month"] as Period[])
    .map((p) => windowsFor(p, now).previous.from)
    .sort()[0];
}

/** Raw activity rows, already reduced to local dates. Shared by Progress and the report. */
export type ActivityRows = {
  focus: { date: string; min: number }[];
  habitDates: string[];
  taskDates: string[];
  journalDates: string[];
  runs: { date: string; km: number }[];
  sleep: { date: string; hours: number }[];
  prayerDates: string[];
};

/** Totals inside one window (sleep is an average; null when nothing was logged). */
export function windowTotals(rows: ActivityRows, w: Window) {
  const count = (dates: string[]) => dates.filter((d) => inWindow(d, w)).length;
  const nights = rows.sleep.filter((x) => inWindow(x.date, w) && x.hours > 0);
  return {
    focus: rows.focus.filter((f) => inWindow(f.date, w)).reduce((s, f) => s + f.min, 0),
    habits: count(rows.habitDates),
    tasks: count(rows.taskDates),
    journal: new Set(rows.journalDates.filter((d) => inWindow(d, w))).size,
    running: rows.runs.filter((r) => inWindow(r.date, w)).reduce((s, r) => s + r.km, 0),
    // "Not logged" isn't "slept badly" — no nights means no sleep figure.
    sleep: nights.length ? nights.reduce((a, x) => a + Math.min(8, x.hours), 0) / nights.length : null,
    prayer: count(rows.prayerDates),
  } satisfies Record<DomainKey, number | null>;
}

/** The fair comparison for a period straight from rows: per-day rates for sums. */
export function compareRows(rows: ActivityRows, period: Period, now = new Date()) {
  const { current, previous } = windowsFor(period, now);
  const cur = windowTotals(rows, current);
  const prev = windowTotals(rows, previous);
  const perDay = (v: number | null, w: Window) => (v == null ? null : v / windowDays(w));
  const values = Object.fromEntries(
    (Object.keys(cur) as DomainKey[]).map((k) => [
      k,
      k === "sleep"
        ? { current: cur[k], previous: prev[k] }
        : { current: perDay(cur[k], current), previous: perDay(prev[k], previous) },
    ])
  ) as Record<DomainKey, { current: number | null; previous: number | null }>;
  return { current, previous, totals: { current: cur, previous: prev }, ...compare(values, period) };
}

function direction(current: number, previous: number): { changePct: number | null; direction: Direction } {
  if (previous <= 0) return { changePct: null, direction: current > 0 ? "up" : "flat" };
  const pct = Math.round(((current - previous) / previous) * 100);
  return { changePct: pct, direction: pct >= DEAD_BAND_PCT ? "up" : pct <= -DEAD_BAND_PCT ? "down" : "flat" };
}

/**
 * Compare each area's current vs previous value. An area with no activity in
 * either window is left out (unused modules never drag the verdict down). For
 * averages (e.g. sleep) pass null when a window has no entries — "not logged"
 * is not "worse".
 */
export function compare(
  values: Partial<Record<DomainKey, { current: number | null; previous: number | null }>>,
  period: Period
): Comparison {
  const domains: DomainResult[] = [];
  for (const [key, v] of Object.entries(values) as [DomainKey, { current: number | null; previous: number | null }][]) {
    if (!v || v.current == null || v.previous == null) continue;
    if (v.current <= 0 && v.previous <= 0) continue;
    domains.push({ key, current: v.current, previous: v.previous, ...direction(v.current, v.previous) });
  }
  const ups = domains.filter((d) => d.direction === "up").length;
  const downs = domains.filter((d) => d.direction === "down").length;
  let verdict: Verdict | null = null;
  if (domains.length) {
    if (ups > downs) verdict = "improving";
    else if (downs > ups) verdict = period === "day" ? "in_progress" : "softening"; // today isn't over yet
    else verdict = "steady";
  }
  // Biggest movers first so the card leads with what changed most.
  domains.sort((a, b) => Math.abs(b.changePct ?? 100) - Math.abs(a.changePct ?? 100));
  return { domains, ups, downs, verdict };
}
