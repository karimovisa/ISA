// ISA — Life report · data. Everything a weekly / monthly / yearly review shows,
// loaded once and reduced to plain numbers. The comparison is the SAME fair one
// the Progress page uses (compareRows), so reviews, the PDF and the app never
// disagree. Any period can be loaded — the live one, or a past week/month/year
// by its anchor (the period's last day).

import { supabase } from "@/lib/supabase/client";
import { mergeRuns } from "@/hooks/useRuns";
import { compareRows, inWindow, windowsFor, ymd, type ActivityRows, type Period, type Verdict } from "@/lib/progressCompare";
import { analyzeGoal, type GoalForecast } from "@/lib/goals";
import type { Goal, GoalMilestone, RunLog, StravaActivityRow } from "@/lib/types";

export type ReportPeriod = Extract<Period, "week" | "month" | "year">;

export type ReportData = Awaited<ReturnType<typeof loadReport>>;

const rowsOf = <T,>(r: { data: unknown }) => (r.data as T[] | null) ?? [];
const startIso = (date: string) => new Date(`${date}T00:00:00`).toISOString();

/** Activity rows (the comparison's inputs) from `since` onward. */
export async function loadActivityRows(since: string): Promise<ActivityRows> {
  const sinceIso = startIso(since);
  const [fs, hl, td, je, rn, st, sl, pr, md] = await Promise.all([
    supabase.from("focus_sessions").select("created_at,duration_seconds").gte("created_at", sinceIso),
    supabase.from("habit_logs").select("date").eq("completed", true).gte("date", since),
    supabase.from("todos").select("date").eq("done", true).gte("date", since),
    supabase.from("journal_entries").select("entry_date").gte("entry_date", since),
    supabase.from("runs").select("*").gte("log_date", since),
    supabase.from("strava_activities").select("*").gte("start_date", sinceIso),
    supabase.from("sleep_logs").select("date,duration_hours").gte("date", since),
    supabase.from("prayer_logs").select("date").neq("status", "qazo").gte("date", since),
    supabase.from("mood_logs").select("date,mood_score").gte("date", since),
  ]);
  return {
    focus: rowsOf<{ created_at: string; duration_seconds: number }>(fs).map((f) => ({
      date: ymd(new Date(f.created_at)),
      min: f.duration_seconds / 60,
    })),
    habitDates: rowsOf<{ date: string }>(hl).map((x) => x.date),
    taskDates: rowsOf<{ date: string }>(td).map((x) => x.date),
    journalDates: rowsOf<{ entry_date: string }>(je).map((x) => x.entry_date),
    runs: mergeRuns(rowsOf<RunLog>(rn), rowsOf<StravaActivityRow>(st)).map((r) => ({ date: r.date, km: r.km })),
    sleep: rowsOf<{ date: string; duration_hours: number }>(sl).map((x) => ({ date: x.date, hours: Number(x.duration_hours) })),
    prayerDates: rowsOf<{ date: string }>(pr).map((x) => x.date),
    mood: rowsOf<{ date: string; mood_score: number }>(md).map((x) => ({ date: x.date, score: Number(x.mood_score) })),
  };
}

/** The full review for one period. `anchor` = its last day (today for the live one). */
export async function loadReport(period: ReportPeriod, anchor = new Date()) {
  const now = new Date();
  const live = ymd(anchor) >= ymd(now);
  const { current, previous } = windowsFor(period, anchor);

  const [rows, tx, gl, ms, ck, ev, { data: { user } }] = await Promise.all([
    loadActivityRows(previous.from),
    supabase.from("transactions").select("date,type,amount,category").gte("date", current.from).lte("date", current.to),
    live ? supabase.from("goals").select("*") : Promise.resolve({ data: [] }),
    live ? supabase.from("goal_milestones").select("*") : Promise.resolve({ data: [] }),
    supabase.from("daily_checkins").select("date,verdict").gte("date", current.from).lte("date", current.to),
    supabase.from("life_events").select("occurred_at").gte("occurred_at", startIso(current.from)),
    supabase.auth.getUser(),
  ]);
  const cmp = compareRows(rows, period, anchor);

  // Money — this window only.
  const money = rowsOf<{ date: string; type: string; amount: number; category: string }>(tx);
  const income = money.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const spent = money.filter((t) => t.type === "expense");
  const expense = spent.reduce((s, t) => s + Number(t.amount), 0);
  const byCat = new Map<string, number>();
  for (const t of spent) byCat.set(t.category, (byCat.get(t.category) ?? 0) + Number(t.amount));
  const topCategories = [...byCat.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3);

  // Goals — active ones with ISA's forecast (only meaningful for the live period).
  const milestones = rowsOf<GoalMilestone>(ms);
  const goals = rowsOf<Goal>(gl)
    .filter((g) => !g.archived)
    .map((g) => {
      const a = analyzeGoal(g, milestones.filter((m) => m.goal_id === g.id), now);
      return { title: g.title, pct: a.pct, forecast: a.forecast as GoalForecast | null, paceLabel: a.paceLabel };
    })
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 4);

  // How the days felt (evening check-ins / dashboard reflection).
  const verdicts = rowsOf<{ date: string; verdict: string }>(ck);
  const days = {
    good: verdicts.filter((v) => v.verdict === "good").length,
    ok: verdicts.filter((v) => v.verdict === "ok").length,
    off: verdicts.filter((v) => v.verdict === "off").length,
  };

  // Most active day = most logged moments.
  const perDay = new Map<string, number>();
  for (const e of rowsOf<{ occurred_at: string }>(ev)) {
    const d = ymd(new Date(e.occurred_at));
    if (inWindow(d, current)) perDay.set(d, (perDay.get(d) ?? 0) + 1);
  }
  const best = [...perDay.entries()].sort((a, b) => b[1] - a[1])[0];

  const name =
    ((user?.user_metadata?.full_name as string | undefined) ?? "").split(" ")[0] ||
    (user?.email ?? "").split("@")[0];

  return {
    period,
    live,
    name,
    ...cmp,
    money: { income, expense, topCategories },
    goals,
    days,
    bestDay: best ? { date: best[0], moments: best[1] } : null,
    activeDays: perDay.size,
    generatedAt: now,
  };
}

export type HistoryItem = {
  period: ReportPeriod;
  anchor: Date; // the period's last day (today for the live one)
  live: boolean;
  from: string;
  to: string;
  verdict: Verdict | null;
  ups: number;
  areas: number;
};

const HISTORY: Record<ReportPeriod, number> = { week: 12, month: 12, year: 3 };

/** Past periods newest first, each with its verdict — from ONE set of rows. */
export async function loadHistory(period: ReportPeriod, now = new Date()): Promise<HistoryItem[]> {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const anchors: Date[] = [today];
  // Completed calendar weeks run Monday–Sunday; the latest finished one ends on
  // the last Sunday strictly before today.
  const lastSunday = new Date(today);
  lastSunday.setDate(today.getDate() - (today.getDay() === 0 ? 7 : today.getDay()));
  for (let i = 1; i < HISTORY[period]; i++) {
    if (period === "week") {
      anchors.push(new Date(lastSunday.getFullYear(), lastSunday.getMonth(), lastSunday.getDate() - 7 * (i - 1)));
    } else if (period === "month") {
      anchors.push(new Date(today.getFullYear(), today.getMonth() - i + 1, 0)); // last day of month −i
    } else {
      anchors.push(new Date(today.getFullYear() - i, 11, 31));
    }
  }
  const oldest = windowsFor(period, anchors[anchors.length - 1]).previous.from;
  const rows = await loadActivityRows(oldest);
  return anchors.map((anchor, i) => {
    const c = compareRows(rows, period, anchor);
    return {
      period,
      anchor,
      live: i === 0,
      from: c.current.from,
      to: c.current.to,
      verdict: c.verdict,
      ups: c.ups,
      areas: c.domains.length,
    };
  });
}
