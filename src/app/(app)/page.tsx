"use client";

// ISA — Dashboard. A control center, not a stats wall. It answers one question:
// "what should I do today?" — with a real mission list built from live data.
// Below it, Life Coverage says honestly how much of your life ISA can actually
// see. AI speaks only when it has something worth saying.

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
  Target, Wallet, Timer, Repeat, Quote, CalendarClock, Sparkles,
  ArrowUpRight, HelpCircle, Compass, Brain,
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useCollection } from "@/hooks/useCollection";
import { supabase } from "@/lib/supabase/client";
import { GlassCard } from "@/components/ui/GlassCard";
import { SleepCard } from "@/components/sections/SleepCard";
import { WeeklyReviewModal } from "@/components/sections/WeeklyReviewModal";
import { Onboarding } from "@/components/sections/Onboarding";
import { TodoList } from "@/components/sections/TodoList";
import { DailyCheckin } from "@/components/sections/DailyCheckin";
import { AscentProgress } from "@/components/ui/AscentProgress";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { greetingFor, formatDate, todayISO } from "@/lib/datetime";
import { useT } from "@/lib/i18n";
import { quoteOfTheDay } from "@/lib/quotes";
import { nearestDeadline, focusMinutesThisWeek } from "@/lib/stats";
import { summarizeMonth, currentMonthKey, overallBalance, formatSom } from "@/lib/money";
import { computeCoverage } from "@/lib/coverage";
import { retrieveTopInsights, type Insight } from "@/lib/insights";
import type { Goal, JournalEntry, FocusSession, Todo, Transaction, Habit } from "@/lib/types";

type Mission = { key: string; label: string; done: boolean; href: string };

export default function DashboardPage() {
  const { displayName } = useAuth();
  const { t } = useT();
  const reduce = useReducedMotion();
  const [dateNow, setDateNow] = useState<Date | null>(null);
  const [insight, setInsight] = useState<Insight | null>(null);
  const [today2, setToday2] = useState({ habitsDone: 0, habitsDue: 0, sleep: false, mood: false });
  const [counts, setCounts] = useState({ sleepLogs: 0, moodLogs: 0, runs: 0 });

  const goals = useCollection<Goal>("goals");
  const journal = useCollection<JournalEntry>("journal_entries");
  const focus = useCollection<FocusSession>("focus_sessions");
  const todos = useCollection<Todo>("todos");
  const txns = useCollection<Transaction>("transactions", { orderBy: "date", ascending: false });
  const habits = useCollection<Habit>("habits");

  const today = todayISO();

  useEffect(() => {
    setDateNow(new Date());
    void retrieveTopInsights(1).then((r) => setInsight(r[0] ?? null));
  }, []);

  useEffect(() => {
    (async () => {
      const [{ data: hl }, { data: sl }, { data: ml }, { data: rl }, { data: sa }] = await Promise.all([
        supabase.from("habit_logs").select("habit_id,completed,date").eq("date", today),
        supabase.from("sleep_logs").select("id,date"),
        supabase.from("mood_logs").select("id,date"),
        supabase.from("runs").select("id"),
        // Strava counts as running data too — coverage read only `runs` and so
        // claimed "no running" while 33 synced activities sat in the database.
        supabase.from("strava_activities").select("id"),
      ]);
      const logs = (hl as { completed: boolean }[]) ?? [];
      const sleeps = (sl as { date: string }[]) ?? [];
      const moods = (ml as { date: string }[]) ?? [];
      setToday2({
        habitsDone: logs.filter((x) => x.completed).length,
        habitsDue: habits.data.filter((h) => h.is_active).length,
        sleep: sleeps.some((x) => x.date === today),
        mood: moods.some((x) => x.date === today),
      });
      setCounts({
        sleepLogs: sleeps.length,
        moodLogs: moods.length,
        runs: ((rl as unknown[]) ?? []).length + ((sa as unknown[]) ?? []).length,
      });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [habits.data.length, today]);

  const todaysTodos = todos.data.filter((x) => x.date === today);
  const openTodos = todaysTodos.filter((x) => !x.done);
  const journaledToday = journal.data.some((j) => j.entry_date === today);
  const focusMinToday = Math.round(
    focus.data
      .filter((s) => new Date(s.created_at).toDateString() === new Date().toDateString())
      .reduce((s, x) => s + x.duration_seconds, 0) / 60
  );
  const spentToday = txns.data.some((x) => x.date === today);
  const deadline = nearestDeadline(goals.data);
  const month = summarizeMonth(txns.data, currentMonthKey());
  const balance = overallBalance(txns.data);
  const overall = goals.data.length
    ? Math.round(goals.data.reduce((s, g) => s + (g.percentage ?? 0), 0) / goals.data.length)
    : 0;
  const weeklyMin = focusMinutesThisWeek(focus.data);
  const activeHabits = habits.data.filter((h) => h.is_active).length;

  // ── Today's Mission — real, checkable, from live data ──
  const mission: Mission[] = [];
  if (activeHabits > 0)
    mission.push({
      key: "habits",
      label: t("Complete today's habits"),
      done: today2.habitsDue > 0 && today2.habitsDone >= today2.habitsDue,
      href: "/habits",
    });
  mission.push({ key: "focus", label: t("Focus for 25 minutes"), done: focusMinToday >= 25, href: "/focus" });
  mission.push({ key: "journal", label: t("Write today's journal"), done: journaledToday, href: "/journal" });
  if (todaysTodos.length > 0)
    mission.push({ key: "todos", label: t("Clear today's tasks"), done: openTodos.length === 0, href: "/" });
  mission.push({ key: "money", label: t("Log today's expenses"), done: spentToday, href: "/money" });
  mission.push({ key: "sleep", label: t("Log your sleep"), done: today2.sleep, href: "/" });
  mission.push({ key: "mood", label: t("Record your mood"), done: today2.mood, href: "/journal" });

  const doneCount = mission.filter((m) => m.done).length;
  const missionPct = mission.length ? Math.round((doneCount / mission.length) * 100) : 0;
  // "Less work, more meaning" — surface ONE thing worth doing next, and let the
  // rest of the day's rhythm sit quietly as progress rather than a chore-wall.
  const primary = mission.find((m) => !m.done) ?? null;

  // ── Life Coverage ──
  const coverage = computeCoverage({
    goals: goals.data.length,
    habits: habits.data.length,
    focusSessions: focus.data.length,
    journalEntries: journal.data.length,
    transactions: txns.data.length,
    sleepLogs: counts.sleepLogs,
    moodLogs: counts.moodLogs,
    runs: counts.runs,
  });

  const anyLoading = goals.loading || journal.loading || focus.loading || todos.loading;
  const freshAccount =
    !anyLoading &&
    goals.data.length + journal.data.length + focus.data.length + todos.data.length + txns.data.length === 0;

  const ease: [number, number, number, number] = [0.22, 1, 0.36, 1];
  const rise = (delay = 0) => ({
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.45, delay, ease },
  });

  // Internal engine names must never reach the user ("GoalCompleted").
  const humanize = (s: string) =>
    s
      .replace(/\b([A-Z][a-z]+)([A-Z][a-z]+)+\b/g, (m) => m.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase())
      .replace(/^./, (c) => c.toUpperCase());

  return (
    <div>
      <WeeklyReviewModal />
      <Onboarding name={displayName} show={freshAccount} />

      {/* 1 — Greeting */}
      <motion.section {...rise(0)} className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider text-muted">{dateNow ? formatDate(dateNow) : " "}</p>
          {/* A name is never truncated — it wraps, and long ones step the type
              down instead of turning into "Isl…". */}
          <h1
            className={`mt-1 font-bold tracking-tight break-words text-balance ${
              displayName.length > 14 ? "text-2xl sm:text-3xl" : "text-3xl sm:text-4xl"
            }`}
          >
            {dateNow ? t(greetingFor(dateNow)) : t("Welcome")}, {displayName}.
          </h1>
        </div>
        <button
          onClick={() => window.dispatchEvent(new CustomEvent("isa:open-help", { detail: "dashboard" }))}
          aria-label={t("Help")}
          className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line text-muted transition hover:bg-white/5 hover:text-fg"
        >
          <HelpCircle size={17} />
        </button>
      </motion.section>

      {/* Evening only, once a day — the one thing ISA can't derive: why. */}
      <DailyCheckin />

      {/* 2 — Today: one thing worth doing, then the day's rhythm as quiet progress */}
      <motion.div {...rise(0.05)} className="mb-4">
        <GlassCard className="bg-gradient-to-br from-accent/10 via-transparent to-transparent p-5">
          <div className="mb-2 flex items-center gap-2">
            <Compass size={16} className="text-accent" />
            <h2 className="text-sm font-semibold">{t("Today")}</h2>
          </div>

          {primary ? (
            <Link
              href={primary.href}
              className="-mx-2 flex items-center justify-between gap-3 rounded-xl px-2 py-2 transition hover:bg-white/[0.04]"
            >
              <span className="min-w-0">
                <span className="block text-base font-medium text-fg">{primary.label}</span>
                <span className="mt-0.5 block text-xs text-muted">{t("One small step. ISA tracks the rest.")}</span>
              </span>
              <ArrowUpRight size={17} className="shrink-0 text-muted" />
            </Link>
          ) : (
            <p className="py-1 text-sm text-fg/90">{t("You're on top of today. Nicely done.")}</p>
          )}

          {/* The old chore-list, reframed as passive progress — not a to-do wall. */}
          <div className="mt-4 border-t border-line pt-3">
            <div className="mb-2 flex items-center justify-between text-xs text-muted">
              <span>{t("Daily rhythm")}</span>
              <span className="tabular-nums">{doneCount}/{mission.length}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
              <motion.div
                className="h-full rounded-full bg-accent"
                initial={{ width: 0 }}
                animate={{ width: `${missionPct}%` }}
                transition={{ duration: 0.7, ease }}
              />
            </div>
          </div>

          {/* AI speaks only when it has something real to say. */}
          {insight && (
            <div className="mt-4 border-t border-line pt-3">
              <p className="text-xs leading-relaxed text-muted">
                <span className="inline-flex items-center gap-1 font-medium text-fg/80">
                  <Sparkles size={11} className="text-accent" /> {t("Insight")} ·{" "}
                </span>
                {humanize(insight.detail || insight.title)}
              </p>
            </div>
          )}
        </GlassCard>
      </motion.div>

      {/* 3 — Today's tasks */}
      <motion.div {...rise(0.1)} className="mb-4">
        <TodoList />
      </motion.div>

      {/* 4 — How much of your life ISA can see — a quiet hint, not a dashboard card */}
      <motion.div {...rise(0.14)} className="mb-4">
        <Link
          href="/knows"
          className="group flex items-center gap-2 px-1 text-xs text-muted transition hover:text-fg"
        >
          <Brain size={13} className="shrink-0 text-accent" />
          <span className="min-w-0 flex-1">
            {t("ISA knows you {n}% — the more you add, the smarter it gets.", { n: coverage.pct })}
          </span>
          <ArrowUpRight size={13} className="shrink-0 opacity-60 transition group-hover:opacity-100" />
        </Link>
      </motion.div>

      {/* 5 — Overview */}
      <div className="grid grid-cols-2 gap-3">
        <Overview {...rise(0.18)} href="/goals" Icon={Target} label={t("Goals")}
          value={<AnimatedNumber value={goals.data.length} />} sub={t("{n}% overall", { n: overall })} />
        <Overview {...rise(0.21)} href="/money" Icon={Wallet} label={t("Money")}
          value={<span className="tabular-nums">{formatSom(balance)}</span>}
          sub={month.savingRate >= 0 ? t("on track") : t("over budget")} small />
        <Overview {...rise(0.24)} href="/focus" Icon={Timer} label={t("Focus")}
          value={<AnimatedNumber value={weeklyMin} />} sub={t("min this week")} />
        <Overview {...rise(0.27)} href="/habits" Icon={Repeat} label={t("Habits")}
          value={<AnimatedNumber value={activeHabits} />} sub={t("active")} />
      </div>

      {/* 6 — Below the fold */}
      {deadline && (
        <motion.div {...rise(0.3)} className="mt-4">
          <Link href="/goals">
            <GlassCard hover className="flex items-center gap-3 p-4">
              <CalendarClock size={18} className="shrink-0 text-muted" />
              <span className="flex-1 truncate text-sm text-fg/90">{deadline.title}</span>
              <span className="shrink-0 text-sm font-semibold tabular-nums">
                {deadline.daysLeft} {t("days")}
              </span>
            </GlassCard>
          </Link>
        </motion.div>
      )}

      <motion.div {...rise(0.33)} className="mt-4">
        <SleepCard />
      </motion.div>

      <motion.div {...rise(0.36)} className="mt-4">
        <GlassCard className="mb-4 flex items-start gap-3 p-5">
          <Quote className="mt-0.5 shrink-0 text-accent" size={18} />
          <div>
            <p className="text-sm text-fg/90">{quote().text}</p>
            <p className="mt-1.5 text-xs uppercase tracking-wider text-muted">{quote().author}</p>
          </div>
        </GlassCard>
      </motion.div>

      <motion.div {...rise(0.4)}>
        <GlassCard className="p-5">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium">{t("The ascent")}</span>
            <span className="text-xl font-bold tabular-nums">
              <AnimatedNumber value={overall} suffix="%" />
            </span>
          </div>
          <AscentProgress value={overall} />
        </GlassCard>
      </motion.div>
    </div>
  );
}

const quote = quoteOfTheDay;

function Overview({
  href, Icon, label, value, sub, small, ...motionProps
}: {
  href: string;
  Icon: typeof Target;
  label: string;
  value: React.ReactNode;
  sub: string;
  small?: boolean;
} & React.ComponentProps<typeof motion.div>) {
  return (
    <motion.div {...motionProps}>
      <Link href={href} className="block">
        <GlassCard hover className="group p-4">
          <div className="flex items-center justify-between">
            <Icon size={18} className="text-fg/70" />
            <ArrowUpRight size={16} className="text-muted transition group-hover:text-fg" />
          </div>
          <div className={`mt-4 font-bold tracking-tight ${small ? "text-lg" : "text-3xl"}`}>{value}</div>
          <div className="mt-0.5 text-sm font-medium text-fg">{label}</div>
          <div className="text-xs text-muted">{sub}</div>
        </GlassCard>
      </Link>
    </motion.div>
  );
}
