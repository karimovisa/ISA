// ISA — Life report · data. Everything the weekly / monthly report shows, loaded
// once and reduced to plain numbers. The comparison is the SAME fair one the
// Progress page uses (compareRows), so the report and the app never disagree.

import { supabase } from "@/lib/supabase/client";
import { mergeRuns } from "@/hooks/useRuns";
import { compareRows, earliestDate, inWindow, ymd, type ActivityRows, type Period } from "@/lib/progressCompare";
import { analyzeGoal, type GoalForecast } from "@/lib/goals";
import type { Goal, GoalMilestone, RunLog, StravaActivityRow } from "@/lib/types";

export type ReportPeriod = Extract<Period, "week" | "month">;

export type ReportData = Awaited<ReturnType<typeof loadReport>>;

const rowsOf = <T,>(r: { data: unknown }) => (r.data as T[] | null) ?? [];

export async function loadReport(period: ReportPeriod, now = new Date()) {
  const since = earliestDate(now);
  const sinceIso = new Date(`${since}T00:00:00`).toISOString();

  const [
    fs, hl, td, je, rn, st, sl, pr, tx, gl, ms, ck, ev, { data: { user } },
  ] = await Promise.all([
    supabase.from("focus_sessions").select("created_at,duration_seconds").gte("created_at", sinceIso),
    supabase.from("habit_logs").select("date").eq("completed", true).gte("date", since),
    supabase.from("todos").select("date").eq("done", true).gte("date", since),
    supabase.from("journal_entries").select("entry_date").gte("entry_date", since),
    supabase.from("runs").select("*").gte("log_date", since),
    supabase.from("strava_activities").select("*").gte("start_date", sinceIso),
    supabase.from("sleep_logs").select("date,duration_hours").gte("date", since),
    supabase.from("prayer_logs").select("date").neq("status", "qazo").gte("date", since),
    supabase.from("transactions").select("date,type,amount,category").gte("date", since),
    supabase.from("goals").select("*"),
    supabase.from("goal_milestones").select("*"),
    supabase.from("daily_checkins").select("date,verdict").gte("date", since),
    supabase.from("life_events").select("occurred_at").gte("occurred_at", sinceIso),
    supabase.auth.getUser(),
  ]);

  const rows: ActivityRows = {
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
  };
  const cmp = compareRows(rows, period, now);
  const { current } = cmp;

  // Money — this window only.
  const money = rowsOf<{ date: string; type: string; amount: number; category: string }>(tx).filter((t) =>
    inWindow(t.date, current)
  );
  const income = money.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const spent = money.filter((t) => t.type === "expense");
  const expense = spent.reduce((s, t) => s + Number(t.amount), 0);
  const byCat = new Map<string, number>();
  for (const t of spent) byCat.set(t.category, (byCat.get(t.category) ?? 0) + Number(t.amount));
  const topCategories = [...byCat.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3);

  // Goals — active ones with ISA's forecast.
  const milestones = rowsOf<GoalMilestone>(ms);
  const goals = rowsOf<Goal>(gl)
    .filter((g) => !g.archived)
    .map((g) => {
      const a = analyzeGoal(g, milestones.filter((m) => m.goal_id === g.id), now);
      return { title: g.title, pct: a.pct, forecast: a.forecast as GoalForecast | null, paceLabel: a.paceLabel };
    })
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 4);

  // How the days felt (evening check-ins).
  const verdicts = rowsOf<{ date: string; verdict: string }>(ck).filter((c) => inWindow(c.date, current));
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
  const activeDays = perDay.size;

  const name =
    ((user?.user_metadata?.full_name as string | undefined) ?? "").split(" ")[0] ||
    (user?.email ?? "").split("@")[0];

  return {
    period,
    name,
    ...cmp,
    money: { income, expense, topCategories },
    goals,
    days,
    bestDay: best ? { date: best[0], moments: best[1] } : null,
    activeDays,
    generatedAt: now,
  };
}
