"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
  Target,
  Wallet,
  Timer,
  Repeat,
  Quote,
  CalendarClock,
  Sparkles,
  ListTodo,
  PenLine,
  Lightbulb,
  ArrowUpRight,
  HelpCircle,
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useCollection } from "@/hooks/useCollection";
import { GlassCard } from "@/components/ui/GlassCard";
import { SleepCard } from "@/components/sections/SleepCard";
import { WeeklyReviewModal } from "@/components/sections/WeeklyReviewModal";
import { Onboarding } from "@/components/sections/Onboarding";
import { TodoList } from "@/components/sections/TodoList";
import { AscentProgress } from "@/components/ui/AscentProgress";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { greetingFor, formatDate, todayISO } from "@/lib/datetime";
import { useT } from "@/lib/i18n";
import { quoteOfTheDay } from "@/lib/quotes";
import { nearestDeadline, focusMinutesThisWeek } from "@/lib/stats";
import { summarizeMonth, currentMonthKey, overallBalance, formatSom } from "@/lib/money";
import { retrieveTopInsights, type Insight } from "@/lib/insights";
import type {
  Goal,
  JournalEntry,
  FocusSession,
  Todo,
  Transaction,
  Habit,
} from "@/lib/types";

type BriefLine = { text: string; tone: "positive" | "neutral" | "negative" };

export default function DashboardPage() {
  const { displayName } = useAuth();
  const { t } = useT();
  const reduce = useReducedMotion();
  const [dateNow, setDateNow] = useState<Date | null>(null);
  const [insight, setInsight] = useState<Insight | null>(null);
  useEffect(() => {
    setDateNow(new Date());
    retrieveTopInsights(1).then((r) => setInsight(r[0] ?? null));
  }, []);

  const goals = useCollection<Goal>("goals");
  const journal = useCollection<JournalEntry>("journal_entries");
  const focus = useCollection<FocusSession>("focus_sessions");
  const todos = useCollection<Todo>("todos");
  const txns = useCollection<Transaction>("transactions", { orderBy: "date", ascending: false });
  const habits = useCollection<Habit>("habits");

  const today = todayISO();
  const todaysTodos = todos.data.filter((x) => x.date === today);
  const openTodos = todaysTodos.filter((x) => !x.done);
  const journaledToday = journal.data.some((j) => j.entry_date === today);
  const deadline = nearestDeadline(goals.data);
  const month = summarizeMonth(txns.data, currentMonthKey());
  const balance = overallBalance(txns.data);
  const overall =
    goals.data.length > 0
      ? Math.round(goals.data.reduce((s, g) => s + (g.percentage ?? 0), 0) / goals.data.length)
      : 0;
  const weeklyMin = focusMinutesThisWeek(focus.data);
  const activeHabits = habits.data.filter((h) => h.is_active).length;

  // ── The Daily Brief — rule-based, from the user's own live data ──
  const brief: BriefLine[] = [];
  if (openTodos.length > 0)
    brief.push({ text: `${openTodos[0].title}${openTodos.length > 1 ? ` +${openTodos.length - 1} more` : ""}`, tone: "neutral" });
  else if (todaysTodos.length > 0)
    brief.push({ text: t("All of today's tasks are done"), tone: "positive" });
  brief.push(
    journaledToday
      ? { text: t("Journaled today"), tone: "positive" }
      : { text: t("Journal not written yet"), tone: "negative" }
  );
  if (txns.data.some((x) => x.date.slice(0, 7) === currentMonthKey()))
    brief.push(
      month.savingRate >= 0
        ? { text: t("Budget is on track"), tone: "positive" }
        : { text: t("Spending is over income this month"), tone: "negative" }
    );
  if (deadline)
    brief.push({ text: t("{title} due in {n} days", { title: deadline.title, n: deadline.daysLeft }), tone: deadline.daysLeft <= 3 ? "negative" : "neutral" });

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

  const toneColor = (tone: BriefLine["tone"]) =>
    tone === "positive" ? "text-emerald-400" : tone === "negative" ? "text-amber-400" : "text-fg/50";

  // Insight text can carry a raw event type from the engine ("GoalCompleted").
  // Never show internal names to the user — split them into plain words.
  const humanize = (s: string) =>
    s.replace(/\b([A-Z][a-z]+)([A-Z][a-z]+)+\b/g, (m) => m.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase())
      .replace(/^./, (c) => c.toUpperCase());

  return (
    <div>
      <WeeklyReviewModal />
      <Onboarding name={displayName} show={freshAccount} />

      {/* 1 — Greeting (compact) */}
      <motion.section {...rise(0)} className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted">
            {dateNow ? formatDate(dateNow) : " "}
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
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

      {/* 2 — AI Daily Brief (the heart) */}
      <motion.div {...rise(0.05)} className="mb-4">
        <GlassCard className="bg-gradient-to-br from-accent/10 via-transparent to-transparent p-5 sm:p-6">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles size={16} className="text-accent" />
            <h2 className="text-sm font-semibold">{t("Today's Focus")}</h2>
          </div>
          {brief.length === 0 ? (
            <p className="text-sm text-muted">{t("Add a task or two to start your day.")}</p>
          ) : (
            <ul className="space-y-2">
              {brief.map((line, i) => (
                <li key={i} className="flex items-center gap-2.5 text-sm">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${toneColor(line.tone).replace("text-", "bg-")}`} />
                  <span className="text-fg/90">{line.text}</span>
                </li>
              ))}
            </ul>
          )}
          {insight && (
            <div className="mt-4 border-t border-line pt-3">
              <p className="text-xs leading-relaxed text-muted">
                <span className="font-medium text-fg/80">{t("Insight")} · </span>
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

      {/* 5 — Quick Capture (2×2, thumb-reachable) */}
      <motion.div {...rise(0.14)} className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <QuickCapture href="/habits" Icon={ListTodo} label={t("Add Task")} />
        <QuickCapture href="/money" Icon={Wallet} label={t("Add Expense")} />
        <QuickCapture href="/ideas" Icon={Lightbulb} label={t("Add Note")} />
        <QuickCapture href="/journal" Icon={PenLine} label={t("Journal")} />
      </motion.div>

      {/* 6 — Overview (2-col compact) */}
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

      {/* 7 — Below the fold: next deadline, sleep, quote, ascent */}
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

// stable quote for the render
const quote = quoteOfTheDay;

function QuickCapture({ href, Icon, label }: { href: string; Icon: typeof Wallet; label: string }) {
  return (
    <Link href={href}>
      <GlassCard hover className="flex flex-col items-center gap-2 p-4 text-center">
        <Icon size={20} className="text-accent" />
        <span className="text-xs font-medium text-fg/90">{label}</span>
      </GlassCard>
    </Link>
  );
}

function Overview({
  href,
  Icon,
  label,
  value,
  sub,
  small,
  ...motionProps
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
