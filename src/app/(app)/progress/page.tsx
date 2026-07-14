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
  Sparkles, Lock, Flame, Timer, Target, Repeat, Smile, Footprints,
  TrendingUp, TrendingDown, Minus, BookOpen, FolderKanban,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useCollection } from "@/hooks/useCollection";
import { GlassCard } from "@/components/ui/GlassCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { RunningSection } from "@/components/sections/RunningSection";
import { WeeklyReviewHistory } from "@/components/sections/WeeklyReviewHistory";
import { ReviewsCard } from "@/components/sections/ReviewsCard";
import { useEntitlements } from "@/components/EntitlementProvider";
import { analyzeGoal } from "@/lib/goals";
import { retrieveTimeline, type TimelineEntry } from "@/lib/memory";
import { retrieveInsights, type Insight } from "@/lib/insights";
import { useT } from "@/lib/i18n";
import type { FocusSession, Project, Goal, JournalEntry, Habit, RunLog } from "@/lib/types";

const DAY_KEYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const dayAgo = (n: number) => ymd(new Date(Date.now() - n * 86400000));
const pctChange = (now: number, before: number) =>
  before <= 0 ? (now > 0 ? 100 : 0) : Math.round(((now - before) / before) * 100);

/** One consistent metric row: a label, a 0..100 value and a bar. */
function Meter({ label, value, tone = "bg-fg" }: { label: string; value: number; tone?: string }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-xs text-muted">{label}</span>
        <span className="text-xs font-semibold tabular-nums">{value}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
        <motion.div
          className={`h-full rounded-full ${tone}`}
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(0, Math.min(100, value))}%` }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </div>
  );
}

export default function ProgressPage() {
  const { t } = useT();
  const { canUse } = useEntitlements();
  const focus = useCollection<FocusSession>("focus_sessions");
  const projects = useCollection<Project>("projects");
  const goals = useCollection<Goal>("goals");
  const journal = useCollection<JournalEntry>("journal_entries");
  const habits = useCollection<Habit>("habits");
  const runs = useCollection<RunLog>("runs");

  const [habitRate, setHabitRate] = useState(0);
  const [prevHabitRate, setPrevHabitRate] = useState(0);
  const [moodAvg, setMoodAvg] = useState<number | null>(null);
  const [energyAvg, setEnergyAvg] = useState<number | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [advanced, setAdvanced] = useState<Insight[]>([]);
  // "Now" is captured once after load rather than read during render — render must
  // stay pure (and the value doesn't need to tick).
  const [now, setNow] = useState(0);

  const wk = dayAgo(6); // this week window
  const pwk = dayAgo(13); // previous week window

  useEffect(() => {
    (async () => {
      const [{ data: hl }, { data: ml }, { data: es }] = await Promise.all([
        supabase.from("habit_logs").select("completed,date").gte("date", pwk),
        supabase.from("mood_logs").select("mood_score,date").gte("date", wk),
        supabase.from("daily_energy_scores").select("score,date").gte("date", wk),
      ]);
      setNow(Date.now());
      const active = habits.data.filter((h) => h.is_active).length;
      const logs = (hl as { completed: boolean; date: string }[]) ?? [];
      const done = (from: string, to?: string) =>
        logs.filter((x) => x.completed && x.date >= from && (!to || x.date < to)).length;
      setHabitRate(active ? Math.min(1, done(wk) / (active * 7)) : 0);
      setPrevHabitRate(active ? Math.min(1, done(pwk, wk) / (active * 7)) : 0);

      const moods = ((ml as { mood_score: number }[]) ?? []).map((x) => x.mood_score);
      setMoodAvg(moods.length ? moods.reduce((a, b) => a + b, 0) / moods.length : null);
      const en = ((es as { score: number }[]) ?? []).map((x) => x.score);
      setEnergyAvg(en.length ? en.reduce((a, b) => a + b, 0) / en.length : null);

      void retrieveTimeline({ limit: 12 }).then(setTimeline);
      if (canUse("deep_analytics")) void retrieveInsights({ source: "advanced", limit: 6 }).then(setAdvanced);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [habits.data.length]);

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
  const prevJournalDays = new Set(
    journal.data.filter((e) => e.entry_date >= pwk && e.entry_date < wk).map((e) => e.entry_date)
  ).size;

  const runWeekKm = runs.data.filter((r) => r.log_date >= wk).reduce((s, r) => s + r.distance_km, 0);
  const prevRunKm = runs.data
    .filter((r) => r.log_date >= pwk && r.log_date < wk)
    .reduce((s, r) => s + r.distance_km, 0);

  const activeGoals = goals.data.filter((g) => !g.archived);
  const goalAvg = activeGoals.length ? activeGoals.reduce((s, g) => s + g.percentage, 0) / activeGoals.length : 0;

  // ── The score: transparent weights, no magic ──
  const scoreOf = (p: { focus: number; habits: number; journal: number; goals: number; rest: number }) =>
    Math.round(100 * (0.3 * p.focus + 0.2 * p.habits + 0.15 * p.journal + 0.2 * p.goals + 0.15 * p.rest));

  const parts = {
    focus: Math.min(1, weekFocusMin / 300),
    habits: habitRate,
    journal: journalDays / 7,
    goals: goalAvg / 100,
    rest: energyAvg != null ? energyAvg / 100 : 0.5,
  };
  const score = scoreOf(parts);
  const prevScore = scoreOf({
    focus: Math.min(1, prevFocusMin / 300),
    habits: prevHabitRate,
    journal: prevJournalDays / 7,
    goals: parts.goals, // a snapshot, not a weekly figure
    rest: parts.rest,
  });
  const delta = score - prevScore;

  const LABELS: Record<keyof typeof parts, string> = {
    focus: t("Focus"),
    habits: t("Habits"),
    journal: t("Journal"),
    goals: t("Goals"),
    rest: t("Rest"),
  };
  const ranked = (Object.keys(parts) as (keyof typeof parts)[]).sort((a, b) => parts[b] - parts[a]);
  const strongest = ranked[0];
  const weakest = ranked[ranked.length - 1];

  const stats = [
    { Icon: Timer, label: t("Focus / week"), value: `${(weekFocusMin / 60).toFixed(1)}h` },
    { Icon: Flame, label: t("Momentum"), value: `${score}` },
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
  if (delta !== 0)
    insights.push(delta > 0 ? t("Momentum is improving.") : t("Momentum has softened this week."));
  if (insights.length === 0) insights.push(t("Not enough history yet — a couple more weeks and patterns appear."));

  const TrendIcon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
  const trendTone = delta > 0 ? "text-emerald-400" : delta < 0 ? "text-amber-400" : "text-muted";

  return (
    <div>
      <PageHeader title="Progress" subtitle="Am I becoming a better version of myself?" />

      {/* 1 — The weekly report card: the whole story in one glance */}
      <GlassCard className="mb-4 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wider text-muted">{t("Productivity Score")}</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-5xl font-bold tabular-nums">{score}</span>
              <span className={`flex items-center gap-0.5 text-sm font-semibold ${trendTone}`}>
                <TrendIcon size={15} />
                {delta > 0 ? "+" : ""}
                {delta}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted">{t("vs last week")}</p>
          </div>
          <div className="shrink-0 space-y-2 text-right">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted">{t("Strongest")}</p>
              <p className="text-sm font-semibold text-emerald-300">{LABELS[strongest]}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted">{t("Needs improvement")}</p>
              <p className="text-sm font-semibold text-amber-300">{LABELS[weakest]}</p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {(Object.keys(parts) as (keyof typeof parts)[]).map((k) => (
            <Meter
              key={k}
              label={LABELS[k]}
              value={Math.round(parts[k] * 100)}
              tone={k === strongest ? "bg-emerald-400" : k === weakest ? "bg-amber-400" : "bg-fg"}
            />
          ))}
        </div>
      </GlassCard>

      {/* 2 — Quick stats */}
      <div className="mb-4 grid grid-cols-3 gap-2.5 sm:grid-cols-6">
        {stats.map((s) => (
          <GlassCard key={s.label} className="p-3">
            <s.Icon size={14} className="mb-1.5 text-muted" />
            <div className="truncate text-lg font-bold tabular-nums">{s.value}</div>
            <div className="truncate text-[10px] text-muted">{s.label}</div>
          </GlassCard>
        ))}
      </div>

      {/* 3 — Weekly activity: one chart, readable in 2 seconds */}
      <GlassCard className="mb-4 p-5">
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
          <AreaChart data={chart} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
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
        <GlassCard className="mb-4 p-5">
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
      <GlassCard className="mb-4 p-5">
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
      <GlassCard className="mb-4 p-5">
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
        <GlassCard className="mb-4 p-5">
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
