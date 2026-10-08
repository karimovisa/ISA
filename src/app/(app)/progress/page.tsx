"use client";

// ISA — Progress. Not an analytics dashboard: a personal life report that reads
// as ONE story — how am I improving, where am I struggling, what needs attention.
// One period choice (Day / Week / Month) drives the report card, the activity
// chart and running, so no two numbers on the page ever disagree. Every string
// goes through t(): there is never mixed-language text on screen.

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, Line } from "recharts";
import { Sparkles, Target, TrendingUp, TrendingDown, Minus, BookOpen, FolderKanban, Hourglass, type LucideIcon } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useCollection } from "@/hooks/useCollection";
import { GlassCard } from "@/components/ui/GlassCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { RunningSection } from "@/components/sections/RunningSection";
import { ReviewsSection } from "@/components/sections/ReviewsSection";
import { AreaTiles } from "@/components/sections/AreaTiles";
import { useEntitlements } from "@/components/EntitlementProvider";
import { analyzeGoal } from "@/lib/goals";
import { retrieveTimeline, type TimelineEntry } from "@/lib/memory";
import { pruneOrphans } from "@/lib/life-events/forget";
import { retrieveInsights, type Insight } from "@/lib/insights";
import { loadActivityRows } from "@/lib/report/data";
import { isaNote } from "@/lib/report/render";
import { formatLocalDate } from "@/lib/datetime";
import { useT } from "@/lib/i18n";
import { compareRows, earliestDate, inWindow, windowsFor, ymd, type ActivityRows, type Period, type Verdict } from "@/lib/progressCompare";
import type { Project, Goal, GoalMilestone } from "@/lib/types";

const DAY_KEYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const EMPTY_ROWS: ActivityRows = { focus: [], habitDates: [], taskDates: [], journalDates: [], runs: [], sleep: [], prayerDates: [], mood: [] };

const PERIOD_TAB: Record<Exclude<Period, "year">, string> = { day: "Day", week: "Week", month: "Month" };
const PERIOD_CAPTION: Record<Exclude<Period, "year">, string> = {
  day: "Today vs yesterday",
  week: "Last 7 days vs the 7 before",
  month: "This month vs the same days last month",
};
const PERIOD_RUN_LABEL: Record<Exclude<Period, "year">, string> = { day: "Today", week: "Last 7 days", month: "This month" };

export default function ProgressPage() {
  const { t, lang } = useT();
  const { canUse } = useEntitlements();
  const projects = useCollection<Project>("projects");
  const goals = useCollection<Goal>("goals");
  const milestones = useCollection<GoalMilestone>("goal_milestones");

  const [period, setPeriod] = useState<Exclude<Period, "year">>("week");
  const [rows, setRows] = useState<ActivityRows>(EMPTY_ROWS);
  const [moments, setMoments] = useState<string[]>([]); // life-event dates → activity chart
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [advanced, setAdvanced] = useState<Insight[]>([]);
  // "Now" is captured once after load rather than read during render — render must
  // stay pure (and the value doesn't need to tick).
  const [now, setNow] = useState(0);

  // One load for everything the period-driven parts need (from the earliest window).
  useEffect(() => {
    let alive = true;
    const since = earliestDate();
    void Promise.all([
      loadActivityRows(since),
      supabase.from("life_events").select("occurred_at").gte("occurred_at", new Date(`${since}T00:00:00`).toISOString()),
    ]).then(([r, ev]) => {
      if (!alive) return;
      setRows(r);
      setMoments(((ev.data as { occurred_at: string }[] | null) ?? []).map((e) => ymd(new Date(e.occurred_at))));
      setNow(Date.now());
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      // Traces of things deleted before ISA learned to forget them are swept once
      // a day, so a deleted goal never reappears in the Life Timeline.
      const key = "isa_orphans_swept";
      const stamp = new Date().toDateString();
      let swept = false;
      try { swept = localStorage.getItem(key) === stamp; } catch { /* ignore */ }
      if (!swept) {
        await pruneOrphans();
        try { localStorage.setItem(key, stamp); } catch { /* ignore */ }
      }
      const tl = await retrieveTimeline({ limit: 12 });
      if (alive) setTimeline(tl);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const deep = canUse("deep_analytics");
  useEffect(() => {
    if (!deep) return;
    let alive = true;
    void retrieveInsights({ source: "advanced", limit: 6 }).then((a) => {
      if (alive) setAdvanced(a);
    });
    return () => {
      alive = false;
    };
  }, [deep]);

  // ── The report card: equal windows, per-day rates, a vote across used areas ──
  const comparison = useMemo(() => compareRows(rows, period), [rows, period]);
  const n = comparison.domains.length;

  const VERDICT: Record<Verdict, { text: string; summary: string; Icon: LucideIcon; tone: string }> = {
    improving: { text: t("Improving"), summary: t("{up} of {n} areas improved", { up: comparison.ups, n }), Icon: TrendingUp, tone: "text-emerald-400" },
    steady: { text: t("Steady"), summary: t("Holding your level across {n} areas", { n }), Icon: Minus, tone: "text-fg" },
    softening: {
      text: t("Softening"),
      summary: t("{down} of {n} areas dipped — small steps bring them back", { down: comparison.downs, n }),
      Icon: TrendingDown,
      tone: "text-amber-400",
    },
    in_progress: { text: t("Day in progress"), summary: t("The day isn't over — there's still time to catch up"), Icon: Hourglass, tone: "text-fg" },
  };
  const verdict = comparison.verdict ? VERDICT[comparison.verdict] : null;

  // ── Activity: logged moments per day across the period, with the period before ──
  const chart = useMemo(() => {
    // "Day" shows the week around today so there is a shape to read.
    const w = windowsFor(period === "day" ? "week" : period);
    const count = (d: string) => moments.filter((m) => m === d).length;
    const out: { day: string; date: string; now: number; before: number; isToday: boolean }[] = [];
    const start = new Date(`${w.current.from}T00:00:00`);
    const prevStart = new Date(`${w.previous.from}T00:00:00`);
    const today = ymd(new Date());
    for (let i = 0; ; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const key = ymd(d);
      if (key > w.current.to) break;
      const p = new Date(prevStart);
      p.setDate(prevStart.getDate() + i);
      const pk = ymd(p);
      out.push({
        day: period === "month" ? String(d.getDate()) : t(DAY_KEYS[d.getDay()]),
        date: key,
        now: count(key),
        before: inWindow(pk, w.previous) ? count(pk) : 0,
        isToday: key === today,
      });
    }
    return out;
  }, [moments, period, t]);
  const busiest = chart.reduce((a, b) => (b.now > a.now ? b : a), chart[0] ?? { now: 0, date: "", day: "" });

  const activeGoals = goals.data.filter((g) => !g.archived);
  const goalAvg = activeGoals.length ? Math.round(activeGoals.reduce((s, g) => s + (g.percentage ?? 0), 0) / activeGoals.length) : 0;
  const runWindows = windowsFor(period);

  return (
    <div>
      <PageHeader title="Progress" subtitle="Am I becoming a better version of myself?" />

      {/* 1 — The report card: are you doing better than before? One card — the
          verdict, every area as a tile, and ISA's note. Life Coverage stays the
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
            {(["day", "week", "month"] as const).map((p) => (
              <button
                key={p}
                role="tab"
                aria-selected={period === p}
                onClick={() => setPeriod(p)}
                className={`rounded-full px-3 py-1 text-xs transition ${period === p ? "bg-white/10 font-semibold text-fg" : "text-muted hover:text-fg"}`}
              >
                {t(PERIOD_TAB[p])}
              </button>
            ))}
          </div>
        </div>

        {n > 0 && (
          <div className="mt-5">
            <AreaTiles domains={comparison.domains} totals={comparison.totals} />
          </div>
        )}

        {n > 0 && (
          <p className="mt-4 flex gap-2 text-sm leading-relaxed text-fg/85">
            <Sparkles size={14} className="mt-1 shrink-0 text-accent" />
            {isaNote({ domains: comparison.domains, verdict: comparison.verdict, period }, t)}
          </p>
        )}

        {deep && advanced.length > 0 && (
          <ul className="mt-4 space-y-2 border-t border-line pt-4">
            {advanced.map((a) => (
              <li key={a.id} className="text-sm">
                <p className="font-medium text-fg/90">{a.title}</p>
                <p className="text-xs leading-relaxed text-muted">{a.detail}</p>
              </li>
            ))}
          </ul>
        )}
      </GlassCard>

      {/* 2 — Activity: logged moments per day, this period vs the one before */}
      <GlassCard tier="dense" className="mb-4 p-5">
        <div className="mb-1 flex items-baseline justify-between">
          <h3 className="text-sm font-medium">{t("Activity")}</h3>
          <span className="text-xs text-muted">{t("logged moments per day")}</span>
        </div>
        <p className="mb-3 text-xs text-muted">
          {busiest && busiest.now > 0
            ? t("Busiest: {day}", { day: formatLocalDate(new Date(`${busiest.date}T00:00:00`), lang, "weekdayDayMonth") })
            : t("Nothing logged yet in this period.")}
          <span className="ml-3 inline-flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 border-t border-dashed border-muted" /> {t("before")}
          </span>
        </p>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={chart} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
            <defs>
              <linearGradient id="act" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.32} />
                <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" vertical={false} />
            <XAxis dataKey="day" stroke="var(--color-muted)" fontSize={11} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis stroke="var(--color-muted)" fontSize={11} tickLine={false} axisLine={false} width={30} allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: "rgba(20,20,22,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, fontSize: 12 }}
              labelStyle={{ color: "var(--color-muted)" }}
            />
            <Line type="monotone" dataKey="before" name={t("before")} stroke="var(--color-muted)" strokeDasharray="4 4" strokeWidth={1.5} dot={false} />
            <Area
              type="monotone"
              dataKey="now"
              name={t("Moments")}
              stroke="var(--color-accent)"
              strokeWidth={2.5}
              fill="url(#act)"
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

      {/* 3 — Goals: progress, pace and ISA's forecast */}
      {activeGoals.length > 0 && (
        <GlassCard tier="dense" className="mb-4 p-5">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h3 className="flex items-center gap-2 text-sm font-medium">
              <Target size={15} className="text-muted" /> {t("Goals")}
            </h3>
            <span className="text-xs text-muted">{t("Average {n}%", { n: goalAvg })}</span>
          </div>
          <div className="space-y-4">
            {activeGoals.map((g) => {
              const a = analyzeGoal(g, milestones.data.filter((m) => m.goal_id === g.id));
              const tone = a.pace === "ahead" ? "text-emerald-300" : a.pace === "behind" ? "text-amber-300" : "text-muted";
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
                    <span className="text-muted">{a.daysLeft != null ? t("{n} days left", { n: a.daysLeft }) : t("No deadline")}</span>
                    {a.forecast?.kind === "date" && (
                      <span className="text-muted">· {t("At this pace you'll finish on {date}", { date: formatLocalDate(a.forecast.finish, lang, "dayMonth") })}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </GlassCard>
      )}

      {/* 4 — Projects: compact cards, not a giant chart */}
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
              const tone = p.percentage >= 100 ? "text-emerald-300" : overdue ? "text-red-300" : behind ? "text-amber-300" : "text-muted";
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
                      {daysLeft != null && daysLeft >= 0 ? t("{n} days left", { n: daysLeft }) : t("No deadline")}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>

      {/* 5 — Running, in step with the period above */}
      <div className="mb-4">
        <RunningSection period={{ current: runWindows.current, previous: runWindows.previous, label: t(PERIOD_RUN_LABEL[period]) }} />
      </div>

      {/* 6 — Life Timeline (things you deleted are gone from here too) */}
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
                <span className="shrink-0 text-[11px] text-muted">{formatLocalDate(new Date(e.occurred_at), lang, "dayMonthShort")}</span>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* 7 — Reviews: weekly / monthly / yearly, always fresh */}
      <ReviewsSection />
    </div>
  );
}
