"use client";

// ISA — Progress. Not an analytics dashboard: a personal life report that reads
// as ONE story — how am I improving, where am I struggling, what needs attention.
// Every string goes through t(): there is never mixed-language text on screen.

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine,
} from "recharts";
import {
  Sparkles, Lock, Timer, Target, Repeat, Smile, Footprints,
  TrendingUp, TrendingDown, Minus, BookOpen, FolderKanban, ListChecks, Moon, Sunrise, Hourglass,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useCollection } from "@/hooks/useCollection";
import { useRuns } from "@/hooks/useRuns";
import { GlassCard } from "@/components/ui/GlassCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { RunningSection } from "@/components/sections/RunningSection";
import { WeeklyReviewHistory } from "@/components/sections/WeeklyReviewHistory";
import { ReviewsCard } from "@/components/sections/ReviewsCard";
import { useEntitlements } from "@/components/EntitlementProvider";
import { analyzeGoal } from "@/lib/goals";
import { retrieveTimeline, type TimelineEntry } from "@/lib/memory";
import { pruneOrphans } from "@/lib/life-events/forget";
import { retrieveInsights, type Insight } from "@/lib/insights";
import { useT } from "@/lib/i18n";
import {
  compareRows, windowDays, earliestDate,
  type Period, type DomainKey, type Verdict, type Window,
} from "@/lib/progressCompare";
import type { FocusSession, Project, Goal, JournalEntry, Habit, RunLog } from "@/lib/types";

const DAY_KEYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const dayAgo = (n: number) => ymd(new Date(Date.now() - n * 86400000));
const pctChange = (now: number, before: number) =>
  before <= 0 ? (now > 0 ? 100 : 0) : Math.round(((now - before) / before) * 100);

// How each area reads in the report card. "sum" areas are compared per day and
// shown as a total for the window; "avg" areas (sleep) are an average already.
const AREAS: Record<DomainKey, { label: string; Icon: LucideIcon; kind: "sum" | "avg"; fmt: (v: number) => string }> = {
  focus: { label: "Focus", Icon: Timer, kind: "sum", fmt: (m) => `${(m / 60).toFixed(1)}h` },
  habits: { label: "Habits", Icon: Repeat, kind: "sum", fmt: (n) => `${Math.round(n)}` },
  tasks: { label: "Tasks", Icon: ListChecks, kind: "sum", fmt: (n) => `${Math.round(n)}` },
  journal: { label: "Journal", Icon: BookOpen, kind: "sum", fmt: (n) => `${Math.round(n)}` },
  running: { label: "Running", Icon: Footprints, kind: "sum", fmt: (km) => `${km.toFixed(1)} km` },
  sleep: { label: "Sleep", Icon: Moon, kind: "avg", fmt: (h) => `${h.toFixed(1)}h` },
  prayer: { label: "Prayer", Icon: Sunrise, kind: "sum", fmt: (n) => `${Math.round(n)}` },
};

const PERIOD_TAB: Record<Period, string> = { day: "Day", week: "Week", month: "Month" };
const PERIOD_CAPTION: Record<Period, string> = {
  day: "Today vs yesterday",
  week: "Last 7 days vs the 7 before",
  month: "This month vs the same days last month",
};

export default function ProgressPage() {
  const { t } = useT();
  const { canUse } = useEntitlements();
  const focus = useCollection<FocusSession>("focus_sessions");
  const projects = useCollection<Project>("projects");
  const goals = useCollection<Goal>("goals");
  const journal = useCollection<JournalEntry>("journal_entries");
  const habits = useCollection<Habit>("habits");
  // Manual entries AND Strava — reading only `runs` is what hid 33 synced activities.
  const { runs } = useRuns();

  const [habitRate, setHabitRate] = useState(0);
  const [moodAvg, setMoodAvg] = useState<number | null>(null);
  // The fair period comparison (report card). Rows load once from the earliest
  // window any period needs; switching Day/Week/Month is then instant.
  const [period, setPeriod] = useState<Period>("week");
  const [rows, setRows] = useState<{
    habitDates: string[];
    taskDates: string[];
    sleep: { date: string; hours: number }[];
    prayerDates: string[];
  }>({ habitDates: [], taskDates: [], sleep: [], prayerDates: [] });
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [advanced, setAdvanced] = useState<Insight[]>([]);
  // "Now" is captured once after load rather than read during render — render must
  // stay pure (and the value doesn't need to tick).
  const [now, setNow] = useState(0);

  const wk = dayAgo(6); // this week window
  const pwk = dayAgo(13); // previous week window

  useEffect(() => {
    (async () => {
      const [{ data: hl }, { data: ml }] = await Promise.all([
        supabase.from("habit_logs").select("completed,date").gte("date", wk),
        supabase.from("mood_logs").select("mood_score,date").gte("date", wk),
      ]);
      setNow(Date.now());
      const active = habits.data.filter((h) => h.is_active).length;
      const logs = (hl as { completed: boolean; date: string }[]) ?? [];
      const done = (from: string, to?: string) =>
        logs.filter((x) => x.completed && x.date >= from && (!to || x.date < to)).length;
      setHabitRate(active ? Math.min(1, done(wk) / (active * 7)) : 0);

      const moods = ((ml as { mood_score: number }[]) ?? []).map((x) => x.mood_score);
      setMoodAvg(moods.length ? moods.reduce((a, b) => a + b, 0) / moods.length : null);

      // Traces of things deleted before ISA learned to forget them are swept once
      // a day, so a deleted goal never reappears in the Life Timeline.
      void (async () => {
        const key = "isa_orphans_swept";
        const stamp = new Date().toDateString();
        let swept = false;
        try { swept = localStorage.getItem(key) === stamp; } catch { /* ignore */ }
        if (!swept) {
          await pruneOrphans();
          try { localStorage.setItem(key, stamp); } catch { /* ignore */ }
        }
        setTimeline(await retrieveTimeline({ limit: 12 }));
      })();
      if (canUse("deep_analytics")) void retrieveInsights({ source: "advanced", limit: 6 }).then(setAdvanced);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [habits.data.length]);

  useEffect(() => {
    const since = earliestDate();
    void Promise.all([
      supabase.from("habit_logs").select("date").eq("completed", true).gte("date", since),
      supabase.from("todos").select("date").eq("done", true).gte("date", since),
      supabase.from("sleep_logs").select("date,duration_hours").gte("date", since),
      // On time or late both count as prayed; only missed (qazo) doesn't.
      supabase.from("prayer_logs").select("date").neq("status", "qazo").gte("date", since),
    ]).then(([h, td, sl, pr]) => {
      const dates = (r: { data: unknown }) => ((r.data as { date: string }[] | null) ?? []).map((x) => x.date);
      setRows({
        habitDates: dates(h),
        taskDates: dates(td),
        sleep: ((sl.data as { date: string; duration_hours: number }[] | null) ?? []).map((x) => ({
          date: x.date,
          hours: Number(x.duration_hours),
        })),
        prayerDates: dates(pr),
      });
    });
  }, []);

  // ── Weekly activity (one readable chart) ──
  const days = useMemo(() => {
    const out: { key: string; label: string; isToday: boolean }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      out.push({ key: d.toDateString(), label: t(DAY_KEYS[d.getDay()]), isToday: i === 0 });
    }
    return out;
  }, [t]);

  const chart = useMemo(
    () =>
      days.map((d) => {
        const day = focus.data.filter((s) => new Date(s.created_at).toDateString() === d.key);
        const min = day.reduce((s, x) => s + x.duration_seconds, 0) / 60;
        return { day: d.label, isToday: d.isToday, score: Math.min(100, Math.round(min + day.length * 5)) };
      }),
    [days, focus.data]
  );
  const avg = Math.round(chart.reduce((s, d) => s + d.score, 0) / (chart.length || 1));
  const best = chart.reduce((a, b) => (b.score > a.score ? b : a), chart[0] ?? { day: "", score: 0 });
  const worst = chart.reduce((a, b) => (b.score < a.score ? b : a), chart[0] ?? { day: "", score: 0 });

  // ── Weekly numbers, this week vs last ──
  const minsIn = (from: string, to?: string) =>
    focus.data
      .filter((s) => {
        const d = ymd(new Date(s.created_at));
        return d >= from && (!to || d < to);
      })
      .reduce((s, x) => s + x.duration_seconds, 0) / 60;
  const weekFocusMin = minsIn(wk);
  const prevFocusMin = minsIn(pwk, wk);

  const journalDays = new Set(journal.data.filter((e) => e.entry_date >= wk).map((e) => e.entry_date)).size;
  const runWeekKm = runs.filter((r) => r.date >= wk).reduce((s, r) => s + r.km, 0);
  const prevRunKm = runs
    .filter((r) => r.date >= pwk && r.date < wk)
    .reduce((s, r) => s + r.km, 0);

  const activeGoals = goals.data.filter((g) => !g.archived);
  const goalAvg = activeGoals.length ? activeGoals.reduce((s, g) => s + g.percentage, 0) / activeGoals.length : 0;

  // ── The report card: equal windows, per-day rates, a vote across used areas ──
  const comparison = useMemo(
    () =>
      compareRows(
        {
          focus: focus.data.map((f) => ({ date: ymd(new Date(f.created_at)), min: f.duration_seconds / 60 })),
          habitDates: rows.habitDates,
          taskDates: rows.taskDates,
          journalDates: journal.data.map((e) => e.entry_date),
          runs: runs.map((r) => ({ date: r.date, km: r.km })),
          sleep: rows.sleep,
          prayerDates: rows.prayerDates,
        },
        period
      ),
    [period, focus.data, journal.data, runs, rows]
  );

  /** A domain's value for display: totals for sums, the average for averages. */
  const shown = (key: DomainKey, perDay: number, w: Window) =>
    AREAS[key].fmt(AREAS[key].kind === "sum" ? perDay * windowDays(w) : perDay);

  const n = comparison.domains.length;
  const VERDICT: Record<Verdict, { text: string; summary: string; Icon: LucideIcon; tone: string }> = {
    improving: {
      text: t("Improving"),
      summary: t("{up} of {n} areas improved", { up: comparison.ups, n }),
      Icon: TrendingUp,
      tone: "text-emerald-400",
    },
    steady: {
      text: t("Steady"),
      summary: t("Holding your level across {n} areas", { n }),
      Icon: Minus,
      tone: "text-fg",
    },
    softening: {
      text: t("Softening"),
      summary: t("{down} of {n} areas dipped — small steps bring them back", { down: comparison.downs, n }),
      Icon: TrendingDown,
      tone: "text-amber-400",
    },
    in_progress: {
      text: t("Day in progress"),
      summary: t("The day isn't over — there's still time to catch up"),
      Icon: Hourglass,
      tone: "text-fg",
    },
  };
  const verdict = comparison.verdict ? VERDICT[comparison.verdict] : null;

  const stats = [
    { Icon: Timer, label: t("Focus / week"), value: `${(weekFocusMin / 60).toFixed(1)}h` },
    { Icon: TrendingUp, label: t("Areas up"), value: n ? `${comparison.ups}/${n}` : "—" },
    { Icon: Repeat, label: t("Habits"), value: `${Math.round(habitRate * 100)}%` },
    { Icon: Target, label: t("Goal avg"), value: `${Math.round(goalAvg)}%` },
    { Icon: Footprints, label: t("Run / week"), value: `${runWeekKm.toFixed(1)}km` },
    { Icon: Smile, label: t("Mood"), value: moodAvg != null ? moodAvg.toFixed(1) : "—" },
  ];

  // ── AI insights: real comparisons, in the user's language ──
  const insights: string[] = [];
  if (prevFocusMin > 0 || weekFocusMin > 0) {
    const c = pctChange(weekFocusMin, prevFocusMin);
    if (Math.abs(c) >= 10)
      insights.push(
        c > 0
          ? t("You focused {n}% more than last week.", { n: Math.abs(c) })
          : t("You focused {n}% less than last week.", { n: Math.abs(c) })
      );
  }
  if (prevRunKm > 0 || runWeekKm > 0) {
    const c = pctChange(runWeekKm, prevRunKm);
    if (Math.abs(c) >= 15)
      insights.push(c > 0 ? t("Running is up {n}%.", { n: Math.abs(c) }) : t("Running consistency decreased.", {}));
  }
  if (journalDays >= 4) insights.push(t("Your journaling is steady — that usually predicts a productive week."));
  if (insights.length === 0) insights.push(t("Not enough history yet — a couple more weeks and patterns appear."));


  return (
    <div>
      <PageHeader title="Progress" subtitle="Am I becoming a better version of myself?" />

      {/* 1 — The report card: are you doing better than before? A fair vote across
          the areas you actually use, over equal windows. Life Coverage stays the
          product's one score (Dashboard / What ISA knows). */}
      <GlassCard tier="dense" className="mb-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wider text-muted">{t(PERIOD_CAPTION[period])}</p>
            {verdict ? (
              <>
                <span className={`mt-1 flex items-center gap-1.5 text-2xl font-bold ${verdict.tone}`}>
                  <verdict.Icon size={20} />
                  {verdict.text}
                </span>
                <p className="mt-1 text-xs text-muted">{verdict.summary}</p>
              </>
            ) : (
              <p className="mt-2 text-sm text-muted">{t("No activity to compare yet for this period.")}</p>
            )}
          </div>
          <div role="tablist" className="flex rounded-full border border-line p-0.5">
            {(["day", "week", "month"] as Period[]).map((p) => (
              <button
                key={p}
                role="tab"
                aria-selected={period === p}
                onClick={() => setPeriod(p)}
                className={`rounded-full px-3 py-1 text-xs transition ${
                  period === p ? "bg-white/10 font-semibold text-fg" : "text-muted hover:text-fg"
                }`}
              >
                {t(PERIOD_TAB[p])}
              </button>
            ))}
          </div>
        </div>

        {n > 0 && (
          <ul className="mt-5 grid gap-x-8 gap-y-3 sm:grid-cols-2">
            {comparison.domains.map((d) => {
              const { Icon, label } = AREAS[d.key];
              const tone =
                d.direction === "up" ? "text-emerald-400" : d.direction === "down" ? "text-amber-400" : "text-muted";
              return (
                <li key={d.key} className="flex items-center gap-3">
                  <Icon size={15} className="shrink-0 text-muted" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">{t(label)}</p>
                    <p className="text-[11px] tabular-nums text-muted">
                      {shown(d.key, d.current, comparison.current)}
                      <span className="opacity-60"> · {t("before")} {shown(d.key, d.previous, comparison.previous)}</span>
                    </p>
                  </div>
                  <span className={`shrink-0 text-sm font-semibold tabular-nums ${tone}`}>
                    {d.changePct == null
                      ? t("new")
                      : `${d.changePct > 0 ? "+" : ""}${d.changePct}%`}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </GlassCard>

      {/* 2 — Quick stats */}
      <div className="mb-4 grid grid-cols-3 gap-2.5 sm:grid-cols-6">
        {stats.map((s) => (
          <GlassCard tier="dense" key={s.label} className="p-3">
            <s.Icon size={14} className="mb-1.5 text-muted" />
            <div className="truncate text-lg font-bold tabular-nums">{s.value}</div>
            <div className="truncate text-[10px] text-muted">{s.label}</div>
          </GlassCard>
        ))}
      </div>

      {/* 3 — Weekly activity: one chart, readable in 2 seconds */}
      <GlassCard tier="dense" className="mb-4 p-5">
        <div className="mb-1 flex items-baseline justify-between">
          <h3 className="text-sm font-medium">{t("Weekly activity")}</h3>
          <span className="text-xs text-muted">
            {t("Average")} {avg}
          </span>
        </div>
        <p className="mb-3 text-xs text-muted">
          {t("Best")}: <span className="text-fg/80">{best?.day}</span> · {t("Quietest")}:{" "}
          <span className="text-fg/80">{worst?.day}</span>
        </p>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={chart} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
            <defs>
              <linearGradient id="wk" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.32} />
                <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" vertical={false} />
            <XAxis dataKey="day" stroke="var(--color-muted)" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="var(--color-muted)" fontSize={11} tickLine={false} axisLine={false} width={34} domain={[0, 100]} />
            <Tooltip
              contentStyle={{
                background: "rgba(20,20,22,0.95)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 12,
                fontSize: 12,
              }}
              labelStyle={{ color: "var(--color-muted)" }}
            />
            <ReferenceLine y={avg} stroke="var(--color-muted)" strokeDasharray="4 4" strokeOpacity={0.5} />
            <Area
              type="monotone"
              dataKey="score"
              name={t("Score")}
              stroke="var(--color-accent)"
              strokeWidth={2.5}
              fill="url(#wk)"
              dot={(props) => {
                const { cx, cy, payload, index } = props as { cx: number; cy: number; payload: { isToday: boolean }; index: number };
                return payload.isToday ? (
                  <circle key={index} cx={cx} cy={cy} r={5} fill="var(--color-accent)" stroke="var(--color-bg)" strokeWidth={2} />
                ) : (
                  <circle key={index} cx={cx} cy={cy} r={0} />
                );
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </GlassCard>

      {/* 4 — Goals: progress + time + prediction */}
      {activeGoals.length > 0 && (
        <GlassCard tier="dense" className="mb-4 p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-medium">
            <Target size={15} className="text-muted" /> {t("Goals")}
          </h3>
          <div className="space-y-4">
            {activeGoals.map((g) => {
              const a = analyzeGoal(g, []);
              const tone =
                a.pace === "ahead" ? "text-emerald-300" : a.pace === "behind" ? "text-amber-300" : "text-muted";
              return (
                <div key={g.id}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-3">
                    <p className="min-w-0 truncate text-sm font-medium">{g.title}</p>
                    <span className="shrink-0 text-sm font-bold tabular-nums">{a.pct}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                    <motion.div
                      className={`h-full rounded-full ${a.pace === "behind" ? "bg-amber-400" : "bg-accent"}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${a.pct}%` }}
                      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                    />
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px]">
                    <span className={tone}>{t(a.paceLabel)}</span>
                    <span className="text-muted">
                      {a.daysLeft != null ? t("{n} days left", { n: a.daysLeft }) : t("No deadline")}
                    </span>
                    {/* Never render analyzeGoal's English prose — show a translated figure. */}
                    {a.pace === "behind" && a.requiredWeekly != null && (
                      <span className="text-amber-300">· {t("Need {n}% this week", { n: a.requiredWeekly })}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </GlassCard>
      )}

      {/* 5 — Projects: compact cards, not a giant chart */}
      <GlassCard tier="dense" className="mb-4 p-5">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-medium">
          <FolderKanban size={15} className="text-muted" /> {t("Projects")}
        </h3>
        {projects.data.length === 0 ? (
          <p className="text-xs text-muted">{t("No projects yet — add one on the Projects page to track progress here.")}</p>
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2">
            {projects.data.map((p) => {
              const due = p.target_date && now ? new Date(p.target_date) : null;
              const daysLeft = due ? Math.ceil((due.getTime() - now) / 86400000) : null;
              const behind = daysLeft != null && daysLeft >= 0 && p.percentage < 100 - (daysLeft > 30 ? 0 : (30 - daysLeft) * 2);
              const overdue = daysLeft != null && daysLeft < 0 && p.percentage < 100;
              const label = p.percentage >= 100 ? t("Done") : overdue ? t("Overdue") : behind ? t("Behind schedule") : t("On schedule");
              const tone =
                p.percentage >= 100
                  ? "text-emerald-300"
                  : overdue
                    ? "text-red-300"
                    : behind
                      ? "text-amber-300"
                      : "text-muted";
              return (
                <div key={p.id} className="rounded-2xl border border-line bg-white/[0.02] p-3">
                  <div className="mb-1.5 flex items-baseline justify-between gap-2">
                    <p className="min-w-0 truncate text-sm font-medium">{p.title}</p>
                    <span className="shrink-0 text-sm font-bold tabular-nums">{p.percentage}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                    <motion.div
                      className={`h-full rounded-full ${behind || overdue ? "bg-amber-400" : "bg-accent"}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${p.percentage}%` }}
                      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                    />
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[11px]">
                    <span className={tone}>{label}</span>
                    <span className="text-muted">
                      {daysLeft != null
                        ? daysLeft >= 0
                          ? t("{n} days left", { n: daysLeft })
                          : t("No deadline")
                        : t("No deadline")}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>

      {/* 6 — Running */}
      <div className="mb-4"><RunningSection /></div>

      {/* 7 — AI insights: sentences, not numbers */}
      <GlassCard tier="dense" className="mb-4 p-5">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles size={15} className="text-accent" />
          <h3 className="text-sm font-medium">{t("AI insights")}</h3>
          {!canUse("deep_analytics") && <Lock size={12} className="text-muted" />}
        </div>
        <ul className="space-y-2">
          {insights.map((s) => (
            <li key={s} className="flex gap-2 text-sm leading-relaxed text-fg/85">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
              {s}
            </li>
          ))}
        </ul>
        {canUse("deep_analytics") && advanced.length > 0 && (
          <ul className="mt-3 space-y-2 border-t border-line pt-3">
            {advanced.map((a) => (
              <li key={a.id} className="text-sm">
                <p className="font-medium text-fg/90">{a.title}</p>
                <p className="text-xs leading-relaxed text-muted">{a.detail}</p>
              </li>
            ))}
          </ul>
        )}
        {!canUse("deep_analytics") && (
          <p className="mt-3 border-t border-line pt-3 text-xs leading-relaxed text-muted">
            {t("Cross-domain correlations (sleep↔focus, mood↔productivity), predictions, and monthly/yearly reviews are a Pro feature.")}
          </p>
        )}
      </GlassCard>

      {/* 8 — Timeline */}
      {timeline.length > 0 && (
        <GlassCard tier="dense" className="mb-4 p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-medium">
            <BookOpen size={15} className="text-muted" /> {t("Life Timeline")}
          </h3>
          <div className="space-y-2.5">
            {timeline.map((e) => (
              <div key={e.id} className="flex items-center gap-3">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                <span className="min-w-0 flex-1 truncate text-sm text-fg/90">{e.title}</span>
                <span className="shrink-0 text-[11px] text-muted">
                  {new Date(e.occurred_at).toLocaleDateString([], { month: "short", day: "numeric" })}
                </span>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      <div className="mb-4"><WeeklyReviewHistory /></div>
      <ReviewsCard />
    </div>
  );
}
