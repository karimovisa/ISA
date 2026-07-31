"use client";

// ISA — Dashboard. A decision center, not an analytics wall. It answers one
// question the moment you open it: "what should I do next?" Everything else is
// quiet. Calm, spacious, premium — a life OS, not a dashboard concept.
//
// Order is deliberate: Greeting → Mission → Quick Actions → Progress → Insight →
// Recent Activity → Statistics. Nothing else.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
  Target, Plus, Search, Sparkles, MessageSquare, CalendarDays,
  BookOpen, Footprints, Timer, Wallet, Repeat, ListTodo, Moon, ChevronRight,
  Flame, Zap, PenLine,
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useCollection } from "@/hooks/useCollection";
import { supabase } from "@/lib/supabase/client";
import { Atmosphere } from "@/components/brand/Atmosphere";
import { TodayPlan } from "@/components/sections/TodayPlan";
import { TodoList } from "@/components/sections/TodoList";
import { DailyCheckin } from "@/components/sections/DailyCheckin";
import { WeeklyReviewModal } from "@/components/sections/WeeklyReviewModal";
import { Onboarding } from "@/components/sections/Onboarding";
import { greetingFor, formatDate, todayISO } from "@/lib/datetime";
import { useT } from "@/lib/i18n";
import { nearestDeadline } from "@/lib/stats";
import { retrieveTopInsights, type Insight } from "@/lib/insights";
import type { Goal, JournalEntry, FocusSession, Todo, Transaction, Habit } from "@/lib/types";

// Green is reserved for progress / done / success — nothing else.
const GREEN = "#86A97F";
const DANGER = "#F26D6D";
const WARN = "#E0A458";
const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
const CARD = "rounded-[28px] border border-line bg-[var(--color-card)]";

type Activity = { id: string; label: string; when: string; Icon: typeof BookOpen };

const activityMeta = (type: string): { label: string; Icon: typeof BookOpen } => {
  const t = type.toLowerCase();
  if (t.includes("journal")) return { label: "Journal", Icon: BookOpen };
  if (t.includes("run")) return { label: "Running", Icon: Footprints };
  if (t.includes("goal")) return { label: "Goal updated", Icon: Target };
  if (t.includes("focus") || t.includes("deepwork")) return { label: "Focus", Icon: Timer };
  if (t.includes("expense") || t.includes("income") || t.includes("saving") || t.includes("budget"))
    return { label: "Money", Icon: Wallet };
  if (t.includes("habit") || t.includes("streak")) return { label: "Habit", Icon: Repeat };
  if (t.includes("task")) return { label: "Task", Icon: ListTodo };
  if (t.includes("sleep") || t.includes("energy")) return { label: "Sleep", Icon: Moon };
  if (t.includes("prayer")) return { label: "Prayer", Icon: Sparkles };
  return { label: "Activity", Icon: Sparkles };
};

const relTime = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
};

export default function DashboardPage() {
  const { displayName } = useAuth();
  const { t, lang } = useT();
  const reduce = useReducedMotion();

  const [dateNow, setDateNow] = useState<Date | null>(null);
  const [insight, setInsight] = useState<Insight | null>(null);
  const [today2, setToday2] = useState({ habitsDone: 0, habitsDue: 0, sleepToday: false });
  const [sleepAvg, setSleepAvg] = useState<number | null>(null);
  const [energy, setEnergy] = useState<number | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);

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
    void (async () => {
      const { data } = await supabase
        .from("life_events")
        .select("id, type, created_at")
        .order("created_at", { ascending: false })
        .limit(6);
      const rows = (data as { id: string; type: string; created_at: string }[]) ?? [];
      setActivity(
        rows.slice(0, 3).map((r) => {
          const m = activityMeta(r.type);
          return { id: r.id, label: m.label, when: relTime(r.created_at), Icon: m.Icon };
        })
      );
    })();
  }, []);

  useEffect(() => {
    void (async () => {
      const [{ data: hl }, { data: sl }, { data: es }] = await Promise.all([
        supabase.from("habit_logs").select("habit_id,completed,date").eq("date", today),
        supabase.from("sleep_logs").select("date,duration_hours"),
        supabase.from("daily_energy_scores").select("score,date").order("date", { ascending: false }).limit(1),
      ]);
      const logs = (hl as { habit_id: string; completed: boolean }[]) ?? [];
      const sleeps = (sl as { date: string; duration_hours: number }[]) ?? [];
      setEnergy((es as { score: number }[] | null)?.[0]?.score ?? null);
      setToday2({
        habitsDone: logs.filter((x) => x.completed).length,
        habitsDue: habits.data.filter((h) => h.is_active).length,
        sleepToday: sleeps.some((x) => x.date === today),
      });
      const cutoff = Date.now() - 7 * 86_400_000;
      const week = sleeps.filter((s) => new Date(s.date).getTime() >= cutoff && s.duration_hours > 0);
      setSleepAvg(week.length ? week.reduce((a, s) => a + Number(s.duration_hours), 0) / week.length : null);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [habits.data.length, today]);

  // ── Derived facts ──
  const activeGoals = useMemo(() => goals.data.filter((g) => !g.archived), [goals.data]);
  const primaryGoal = useMemo(() => {
    const withDeadline = activeGoals.filter((g) => g.deadline && (g.percentage ?? 0) < 100);
    if (withDeadline.length)
      return [...withDeadline].sort((a, b) => +new Date(a.deadline!) - +new Date(b.deadline!))[0];
    const open = activeGoals.filter((g) => (g.percentage ?? 0) < 100);
    return [...open].sort((a, b) => (a.percentage ?? 0) - (b.percentage ?? 0))[0] ?? activeGoals[0] ?? null;
  }, [activeGoals]);

  const todaysTodos = todos.data.filter((x) => x.date === today);
  const tasksDone = todaysTodos.filter((x) => x.done).length;
  const tasksRemaining = todaysTodos.length - tasksDone;
  const focusToday = focus.data.filter(
    (s) => new Date(s.created_at).toDateString() === new Date().toDateString()
  ).length;
  const journaledToday = journal.data.some((j) => j.entry_date === today);
  const deadline = nearestDeadline(activeGoals);

  // "% of today": a calm blend of the day's rhythm (habits, one task, focus,
  // journal, sleep) — the answer to "how am I doing?".
  const dayParts = [
    today2.habitsDue > 0 ? today2.habitsDone >= today2.habitsDue : true,
    todaysTodos.length > 0 ? tasksRemaining === 0 : true,
    focusToday > 0,
    journaledToday,
    today2.sleepToday,
  ];
  const todayPct = Math.round((dayParts.filter(Boolean).length / dayParts.length) * 100);

  const streak = Number(journalStreakDisplay(journal.data));
  const goalsForCards = useMemo(
    () =>
      [...activeGoals]
        .sort((a, b) => {
          const ad = a.deadline ? +new Date(a.deadline) : Infinity;
          const bd = b.deadline ? +new Date(b.deadline) : Infinity;
          return ad !== bd ? ad - bd : (a.percentage ?? 0) - (b.percentage ?? 0);
        })
        .slice(0, 3),
    [activeGoals]
  );

  const insightText = insight ? humanize(insight.detail || insight.title) : null;

  const anyLoading = goals.loading || journal.loading || focus.loading || todos.loading;
  const freshAccount =
    !anyLoading &&
    goals.data.length + journal.data.length + focus.data.length + todos.data.length + txns.data.length === 0;

  const rise = (delay = 0) => ({
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5, delay, ease: EASE },
  });

  const openCapture = () => window.dispatchEvent(new CustomEvent("isa:open-capture"));
  const openSearch = () => window.dispatchEvent(new CustomEvent("isa:open-palette"));

  return (
    <div className="relative mx-auto max-w-[1280px]">
      <Atmosphere />
      <WeeklyReviewModal />
      <Onboarding name={displayName} show={freshAccount} />

      {/* 1 — Greeting + vitals */}
      <motion.header {...rise(0)} className="pt-5 sm:pt-7">
        <h1
          className={`font-bold tracking-tight break-words text-balance ${
            displayName.length > 14 ? "text-4xl sm:text-5xl" : "text-[2.75rem] leading-[1.06] sm:text-5xl"
          }`}
        >
          {dateNow ? t(greetingFor(dateNow)) : t("Welcome")},<br />
          {displayName}.
        </h1>
        <p className="mt-2 text-[15px] text-muted">{dateNow ? formatDate(dateNow, lang) : " "}</p>

        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <span className="inline-flex items-center gap-1.5 text-fg/85">
            <Flame size={15} style={{ color: GREEN }} /> {streak} {t("day streak")}
          </span>
          <span className="h-3.5 w-px bg-[var(--color-line)]" />
          <span className="inline-flex items-center gap-1.5 text-fg/85">
            <Zap size={15} className="text-accent" /> {t("Energy")} {energy ?? "—"}
          </span>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
            <motion.div
              className="h-full rounded-full"
              style={{ background: GREEN }}
              initial={{ width: 0 }}
              animate={{ width: `${todayPct}%` }}
              transition={{ duration: 0.85, ease: EASE }}
            />
          </div>
          <span className="shrink-0 text-xs tabular-nums text-muted">{todayPct}% {t("today")}</span>
        </div>
      </motion.header>

      {/* Evening-only, once a day — the one thing ISA can't sense: sleep + why. */}
      <div className="mt-6">
        <DailyCheckin />
      </div>

      {/* 2 — Continue — the hero. Resume the goal that matters most today. */}
      <motion.section {...rise(0.06)} className="mt-7">
        <div className="relative overflow-hidden rounded-[32px] border border-line bg-[var(--color-card)] p-6 sm:p-8">
          {/* soft, GPU-cheap wash — a calm green that echoes the progress ring */}
          <div
            className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full"
            style={{ background: `radial-gradient(circle, ${GREEN}, transparent 68%)`, opacity: 0.16, filter: "blur(46px)" }}
          />
          <div className="relative flex items-center justify-between gap-6">
            <div className="min-w-0">
              <div className="mb-3 flex items-center gap-2">
                <Target size={15} style={{ color: GREEN }} />
                <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
                  {t("Today's Mission")}
                </span>
              </div>
              <h2 className="text-[26px] font-bold leading-tight tracking-tight sm:text-3xl">
                {primaryGoal ? primaryGoal.title : t("Set your first goal")}
              </h2>
              <p className="mt-2 text-[15px] leading-relaxed text-fg/70">
                {primaryGoal ? t("Focus now, get closer to your goal.") : t("A direction makes every day count.")}
              </p>
              {primaryGoal && (
                <div className="mt-4 text-[13px] text-muted">
                  <span className="font-semibold text-fg/90">{primaryGoal.percentage ?? 0}%</span>
                  {deadline && <> · {deadline.daysLeft} {t("days left")}</>}
                </div>
              )}
              <Link
                href={primaryGoal ? "/focus" : "/goals"}
                className="mt-6 inline-flex h-[54px] items-center gap-2 rounded-[18px] bg-[var(--color-fg)] px-7 text-[15px] font-semibold text-[color:var(--color-bg)] transition hover:opacity-90 active:scale-[0.98]"
              >
                {primaryGoal ? t("Continue") : t("Add a goal")}
                <ChevronRight size={18} />
              </Link>
            </div>
            {primaryGoal && (
              <div className="hidden shrink-0 sm:block">
                <Ring value={primaryGoal.percentage ?? 0} size={132} stroke={9} reduce={reduce}>
                  <span className="text-[26px] font-bold tabular-nums">{primaryGoal.percentage ?? 0}%</span>
                  <span className="mt-0.5 text-[11px] uppercase tracking-wider text-muted">{t("Progress")}</span>
                </Ring>
              </div>
            )}
          </div>
        </div>
      </motion.section>

      {/* 3 — Quick Actions — icons above text, one tap to begin */}
      <motion.section {...rise(0.1)} className="mt-8">
        <SectionLabel>{t("Quick actions")}</SectionLabel>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <QuickAction Icon={Plus} label={t("Add")} onClick={openCapture} />
          <QuickAction Icon={MessageSquare} label={t("Ask ISA")} href="/ask" />
          <QuickAction Icon={Target} label={t("Goal")} href="/goals?new=1" />
          <QuickAction Icon={PenLine} label={t("Note")} href="/ideas?new=1" />
          <QuickAction Icon={CalendarDays} label={t("Calendar")} href="/calendar" />
          <QuickAction Icon={Search} label={t("Search")} onClick={openSearch} />
        </div>
      </motion.section>

      {/* To-do — the day's tasks, high on the page so nothing slips. Its own
          card + header; reads/writes the `todos` table (add/check/delete). */}
      <motion.section {...rise(0.12)} className="mt-8">
        <TodoList />
      </motion.section>

      {/* 4 + 5 — Today (horizontal progress, no donut) + ISA Insight */}
      <div className="mt-8 grid gap-4 lg:grid-cols-5">
        <motion.section {...rise(0.14)} className="lg:col-span-3">
          <SectionLabel>{t("Today")}</SectionLabel>
          <div className={`${CARD} mt-3 p-6`}>
            <div className="flex items-end justify-between">
              <span className="text-4xl font-bold tabular-nums leading-none">{todayPct}%</span>
              <span className="text-sm text-muted">{t("of today")}</span>
            </div>
            <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/[0.06]">
              <motion.div
                className="h-full rounded-full"
                style={{ background: GREEN }}
                initial={{ width: 0 }}
                animate={{ width: `${todayPct}%` }}
                transition={{ duration: 0.9, ease: EASE }}
              />
            </div>
            <div className="mt-6 grid grid-cols-4 gap-3 border-t border-line pt-5">
              <MiniStat value={today2.habitsDone} label={t("Habits")} />
              <MiniStat value={tasksDone} label={t("Tasks")} />
              <MiniStat value={focusToday} label={t("Focus")} />
              <MiniStat value={sleepAvg != null ? `${sleepAvg.toFixed(1)}h` : "—"} label={t("Sleep")} />
            </div>
          </div>
        </motion.section>

        <motion.section {...rise(0.18)} className="lg:col-span-2">
          <SectionLabel>{t("ISA Insight")}</SectionLabel>
          <div className={`${CARD} mt-3 flex h-[calc(100%-2rem)] flex-col p-6`}>
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ background: `${GREEN}18` }}>
              <Sparkles size={19} style={{ color: GREEN }} />
            </span>
            <p className="mt-4 text-[15px] font-semibold leading-snug text-fg">
              {insightText ?? t("Keep going — ISA is still learning your rhythm.")}
            </p>
            {insight?.detail && insight.title && insight.detail !== insight.title && (
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{humanize(insight.title)}</p>
            )}
            <Link
              href="/ask"
              className="mt-auto inline-flex h-11 w-fit items-center gap-2 rounded-2xl bg-white/[0.06] px-4 text-sm font-medium text-fg transition hover:bg-white/[0.1]"
            >
              <Sparkles size={14} style={{ color: GREEN }} /> {t("Optimize my day")}
            </Link>
          </div>
        </motion.section>
      </div>

      {/* Today's plan — live timeline + habits checklist */}
      <motion.section {...rise(0.2)} className="mt-8">
        <TodayPlan />
      </motion.section>

      {/* 6 — Goals — large progress cards */}
      {goalsForCards.length > 0 && (
        <motion.section {...rise(0.22)} className="mt-8">
          <SectionLabel>{t("Goals")}</SectionLabel>
          <div className="mt-3 space-y-3">
            {goalsForCards.map((g) => (
              <GoalCard key={g.id} goal={g} t={t} reduce={reduce} />
            ))}
          </div>
        </motion.section>
      )}

      {/* 8 — Recent Activity — minimal timeline */}
      {activity.length > 0 && (
        <motion.section {...rise(0.3)} className="mb-4 mt-8">
          <SectionLabel>{t("Recent activity")}</SectionLabel>
          <div className={`${CARD} mt-3 divide-y divide-[var(--color-line)] px-6`}>
            {activity.map((a) => (
              <div key={a.id} className="flex items-center gap-3 py-4">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full" style={{ background: `${GREEN}22` }}>
                  <a.Icon size={14} style={{ color: GREEN }} />
                </span>
                <span className="flex-1 text-sm text-fg/90">{t(a.label)}</span>
                <span className="text-xs tabular-nums text-muted">{a.when}</span>
              </div>
            ))}
          </div>
        </motion.section>
      )}
    </div>
  );
}

// Internal engine names must never reach the user ("GoalCompleted").
function humanize(s: string): string {
  return s
    .replace(/\b([A-Z][a-z]+)([A-Z][a-z]+)+\b/g, (m) => m.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase())
    .replace(/^./, (c) => c.toUpperCase());
}

function journalStreakDisplay(entries: JournalEntry[]): string {
  const days = new Set(entries.map((e) => new Date(e.entry_date).toDateString()));
  const DAY = 86_400_000;
  let cursor = new Date();
  if (!days.has(cursor.toDateString())) cursor = new Date(Date.now() - DAY);
  let streak = 0;
  while (days.has(cursor.toDateString())) {
    streak++;
    cursor = new Date(cursor.getTime() - DAY);
  }
  return String(streak);
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="px-1 text-xs font-medium uppercase tracking-[0.14em] text-muted">{children}</p>;
}

function Ring({
  value, size, stroke, reduce, children,
}: {
  value: number; size: number; stroke: number; reduce: boolean | null; children: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.min(100, Math.max(0, value)) / 100);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-line)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={GREEN} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: reduce ? off : c }}
          animate={{ strokeDashoffset: off }}
          transition={{ duration: 0.9, ease: EASE }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

function QuickAction({
  Icon, label, href, onClick,
}: {
  Icon: typeof Plus; label: string; href?: string; onClick?: () => void;
}) {
  const inner = (
    <>
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.05]">
        <Icon size={19} className="text-fg/85" />
      </span>
      <span className="text-sm font-medium">{label}</span>
    </>
  );
  const cls =
    "flex h-[104px] flex-col items-center justify-center gap-2.5 rounded-[24px] border border-line bg-[var(--color-card)] transition hover:-translate-y-0.5 hover:border-white/10 active:scale-[0.98]";
  return href ? (
    <Link href={href} className={cls}>{inner}</Link>
  ) : (
    <button onClick={onClick} className={cls}>{inner}</button>
  );
}

function MiniStat({ value, label }: { value: number | string; label: string }) {
  return (
    <div>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="mt-0.5 text-xs text-muted">{label}</div>
    </div>
  );
}

function GoalCard({
  goal, t, reduce,
}: {
  goal: Goal;
  t: (s: string, v?: Record<string, string | number>) => string;
  reduce: boolean | null;
}) {
  const pct = Math.min(100, Math.max(0, goal.percentage ?? 0));
  const daysLeft = goal.deadline
    ? Math.round((new Date(goal.deadline).getTime() - Date.now()) / 86_400_000)
    : null;
  const status =
    pct >= 100
      ? { label: t("Done"), color: GREEN }
      : daysLeft != null && daysLeft < 0
        ? { label: t("Overdue"), color: DANGER }
        : daysLeft != null && daysLeft <= 7
          ? { label: t("Due soon"), color: WARN }
          : { label: t("On track"), color: "var(--color-muted)" };
  return (
    <Link href="/goals" className={`${CARD} block p-5 transition hover:-translate-y-0.5 hover:border-white/10`}>
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 truncate font-medium">{goal.title}</span>
        <span className="shrink-0 text-sm font-semibold tabular-nums" style={pct >= 100 ? { color: GREEN } : undefined}>
          {pct}%
        </span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.06]">
        <motion.div
          className="h-full rounded-full"
          style={{ background: GREEN }}
          initial={{ width: reduce ? `${pct}%` : 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.9, ease: EASE }}
        />
      </div>
      <div className="mt-2.5 flex items-center justify-between text-xs">
        <span style={{ color: status.color }}>{status.label}</span>
        {daysLeft != null && (
          <span className="text-muted">{daysLeft < 0 ? t("overdue") : `${daysLeft} ${t("days left")}`}</span>
        )}
      </div>
    </Link>
  );
}
