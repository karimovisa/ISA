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
  Flame, Zap, PenLine, Check, Circle,
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useCollection } from "@/hooks/useCollection";
import { supabase } from "@/lib/supabase/client";
import { useEntitlements } from "@/components/EntitlementProvider";
import { crossDomainFindings } from "@/lib/crossDomain";
import { isDueOn } from "@/lib/habitCoach";
import { aiInsight } from "@/lib/habitInsight";
import { Atmosphere } from "@/components/brand/Atmosphere";
import { TodayHabits } from "@/components/sections/TodayHabits";
import { TodoList } from "@/components/sections/TodoList";
import { SleepCard } from "@/components/sections/SleepCard";
import { Reflection } from "@/components/sections/Reflection";
import { WeeklyReviewModal } from "@/components/sections/WeeklyReviewModal";
import { Onboarding } from "@/components/sections/Onboarding";
import { greetingFor, formatDate, todayISO } from "@/lib/datetime";
import { useT } from "@/lib/i18n";
import { retrieveTopInsights, type Insight } from "@/lib/insights";
import type { Goal, JournalEntry, FocusSession, Todo, Transaction, Habit } from "@/lib/types";

// Green is reserved for progress / done / success — nothing else.
const GREEN = "#86A97F";
const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
const ymdLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

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
  const { canUse } = useEntitlements();
  const reduce = useReducedMotion();

  const [dateNow, setDateNow] = useState<Date | null>(null);
  const [insight, setInsight] = useState<Insight | null>(null);
  const [xdInsight, setXdInsight] = useState<string | null>(null);
  const [today2, setToday2] = useState({ habitsDone: 0, habitsDue: 0, sleepToday: false });
  // Last night's sleep and the energy computed from THAT night — the hero and the
  // Today strip must describe the same day, never a weekly average beside a
  // single night's score.
  const [sleepHours, setSleepHours] = useState<number | null>(null);
  const [energy, setEnergy] = useState<number | null>(null);
  const [activeStreak, setActiveStreak] = useState(0);
  const [showDay, setShowDay] = useState(false);
  const [tick, setTick] = useState(0); // bumped when a habit is ticked on the page
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
      const [{ data: hl }, { data: sl }, { data: es }, { data: ev }] = await Promise.all([
        supabase.from("habit_logs").select("habit_id,completed,date").eq("date", today),
        supabase.from("sleep_logs").select("duration_hours").eq("date", today).maybeSingle(),
        supabase.from("daily_energy_scores").select("score").eq("date", today).maybeSingle(),
        supabase.from("life_events").select("occurred_at")
          .gte("occurred_at", new Date(Date.now() - 120 * 86_400_000).toISOString()),
      ]);
      const logs = (hl as { habit_id: string; completed: boolean }[]) ?? [];
      const now = new Date();
      // Only habits actually due today count — a Mon/Wed/Fri habit isn't "missed" on Tuesday.
      const due = habits.data.filter((h) => h.is_active && isDueOn(h, now));
      const dueIds = new Set(due.map((h) => h.id));
      setToday2({
        habitsDone: logs.filter((x) => x.completed && dueIds.has(x.habit_id)).length,
        habitsDue: due.length,
        sleepToday: !!sl,
      });

      const hours = sl ? Number((sl as { duration_hours: number }).duration_hours) : null;
      setSleepHours(hours);
      let score = (es as { score: number } | null)?.score ?? null;
      // Sleep logged but its energy never computed (e.g. written by another path) —
      // compute it now instead of showing a stale day's score.
      if (hours != null && score == null) {
        await supabase.rpc("recompute_my_energy", { p_date: today });
        const { data: again } = await supabase.from("daily_energy_scores").select("score").eq("date", today).maybeSingle();
        score = (again as { score: number } | null)?.score ?? null;
      }
      setEnergy(score);

      // Streak = consecutive days with ANY logged activity (habits, focus, journal,
      // money, tasks…), not just journaling. Today still counts as open.
      const active = new Set(
        ((ev as { occurred_at: string }[] | null) ?? []).map((e) => new Date(e.occurred_at).toDateString())
      );
      const cursor = new Date();
      if (!active.has(cursor.toDateString())) cursor.setDate(cursor.getDate() - 1);
      let streak = 0;
      while (active.has(cursor.toDateString())) {
        streak++;
        cursor.setDate(cursor.getDate() - 1);
      }
      setActiveStreak(streak);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [habits.data.length, today, tick]);

  // Cross-domain findings (v1): read-only, threshold-gated links across sleep,
  // energy, habits, spend and activity. The engine interprets; Gemini phrases it
  // (Pro), else the computed sentence shows as-is. See src/lib/crossDomain.ts.
  useEffect(() => {
    void (async () => {
      const cacheKey = `isa_xd_insight_${lang}_${today}`;
      try { const raw = localStorage.getItem(cacheKey); if (raw) { setXdInsight(raw); return; } } catch { /* ignore */ }
      const since = new Date(); since.setDate(since.getDate() - 45);
      const sinceISO = ymdLocal(since);
      const [sleepR, energyR, logsR, txR, evR] = await Promise.all([
        supabase.from("sleep_logs").select("date,duration_hours").gte("date", sinceISO),
        supabase.from("daily_energy_scores").select("date,score").gte("date", sinceISO),
        supabase.from("habit_logs").select("date,completed").gte("date", sinceISO),
        supabase.from("transactions").select("date,amount,category").eq("category", "Food").gte("date", sinceISO),
        supabase.from("life_events").select("occurred_at").gte("occurred_at", since.toISOString()),
      ]);
      const sleep = ((sleepR.data as { date: string; duration_hours: number }[]) ?? [])
        .map((r) => ({ date: r.date, hours: Number(r.duration_hours) })).filter((r) => r.hours > 0);
      const energy = ((energyR.data as { date: string; score: number }[]) ?? []).map((r) => ({ date: r.date, score: r.score }));
      const completions = ((logsR.data as { date: string; completed: boolean }[]) ?? []).filter((r) => r.completed).map((r) => r.date);
      const food = ((txR.data as { date: string; amount: number }[]) ?? []).map((r) => ({ date: r.date, amount: Number(r.amount) }));
      const activeDates = [...new Set(((evR.data as { occurred_at: string }[]) ?? []).map((r) => ymdLocal(new Date(r.occurred_at))))];

      const top = crossDomainFindings({ sleep, energy, completions, food, activeDates })[0];
      if (!top) return;
      const text = canUse("ai_coach") ? (await aiInsight(top.text, top.text, lang)).text : top.text;
      setXdInsight(text);
      try { localStorage.setItem(cacheKey, text); } catch { /* ignore */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Derived facts ──
  const activeGoals = useMemo(() => goals.data.filter((g) => !g.archived), [goals.data]);
  const todaysTodos = todos.data.filter((x) => x.date === today);
  const tasksDone = todaysTodos.filter((x) => x.done).length;
  const tasksRemaining = todaysTodos.length - tasksDone;
  const focusMinToday = Math.round(
    focus.data
      .filter((s) => new Date(s.created_at).toDateString() === new Date().toDateString())
      .reduce((m, s) => m + s.duration_seconds, 0) / 60
  );
  const journaledToday = journal.data.some((j) => j.entry_date === today);

  // "% of today": a calm blend of the day's rhythm. Only what's actually on
  // today's plate counts — an empty to-do list or no habits due is not a "done"
  // item that quietly inflates the number. Tap the bar to see the breakdown.
  const dayParts = [
    today2.habitsDue > 0 && {
      label: t("Habits"),
      done: today2.habitsDone >= today2.habitsDue,
      detail: `${today2.habitsDone}/${today2.habitsDue}`,
    },
    todaysTodos.length > 0 && {
      label: t("Tasks"),
      done: tasksRemaining === 0,
      detail: `${tasksDone}/${todaysTodos.length}`,
    },
    { label: t("Focus"), done: focusMinToday > 0, detail: focusMinToday ? t("{n} min", { n: focusMinToday }) : "" },
    { label: t("Journal"), done: journaledToday, detail: "" },
    { label: t("Sleep logged"), done: today2.sleepToday, detail: sleepHours != null ? `${sleepHours.toFixed(1)}h` : "" },
  ].filter((p): p is { label: string; done: boolean; detail: string } => !!p);
  const todayPct = Math.round((dayParts.filter((p) => p.done).length / dayParts.length) * 100);

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

  // The page follows the day: plan in the morning, do through the day, reflect
  // in the evening. Same content — only the order moves (one hour check, no cost).
  const hour = dateNow?.getHours() ?? 12;
  const partOfDay: "morning" | "day" | "evening" = hour < 12 ? "morning" : hour < 18 ? "day" : "evening";

  const goalLine = (g: Goal) => {
    const d = g.deadline ? Math.ceil((new Date(`${g.deadline}T00:00:00`).getTime() - (dateNow?.getTime() ?? 0)) / 86_400_000) : null;
    if (!dateNow || d == null) return null;
    return d < 0 ? t("{n} days overdue", { n: -d }) : t("{n} days left", { n: d });
  };

  const sections: Record<string, React.ReactNode> = {
    todo: <TodoList />,

    habits: (
      <div>
        <SectionLabel>{t("Habits")}</SectionLabel>
        <div className="mt-2">
          <TodayHabits onChange={() => setTick((n) => n + 1)} />
        </div>
      </div>
    ),

    sleep: (
      <div className="sm:max-w-md">
        <SleepCard />
      </div>
    ),

    goals: (
      <div>
        <SectionLabel>{t("Goals")}</SectionLabel>
        {goalsForCards.length === 0 ? (
          <div className="mt-3">
            <p className="text-[15px] text-fg/85">{t("A direction makes every day count.")}</p>
            <Link href="/goals" className="mt-1 inline-flex items-center gap-0.5 text-sm text-muted hover:text-fg">
              {t("Add a goal")} <ChevronRight size={14} />
            </Link>
          </div>
        ) : (
          <ul className="mt-2">
            {goalsForCards.map((g, i) => {
              const pct = Math.min(100, Math.max(0, g.percentage ?? 0));
              const line = goalLine(g);
              return (
                <li key={g.id} className="py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <Link href="/goals" className="min-w-0 truncate text-[15px] text-fg/90 hover:text-fg">{g.title}</Link>
                    <span className="shrink-0 text-sm font-semibold tabular-nums">{pct}%</span>
                  </div>
                  <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-white/[0.06]">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: GREEN }}
                      initial={{ width: reduce ? `${pct}%` : 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.8, ease: EASE }}
                    />
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-xs text-muted">
                    <span>{line ?? " "}</span>
                    {i === 0 && (
                      <Link href="/focus" className="inline-flex items-center gap-0.5 text-fg/80 hover:text-fg">
                        {t("Continue")} <ChevronRight size={13} />
                      </Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    ),

    actions: (
      <div>
        <SectionLabel>{t("Quick actions")}</SectionLabel>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-3">
          <QuickAction Icon={Plus} label={t("Add")} onClick={openCapture} />
          <QuickAction Icon={MessageSquare} label={t("Ask")} href="/ask" />
          <QuickAction Icon={Target} label={t("Goal")} href="/goals?new=1" />
          <QuickAction Icon={PenLine} label={t("Note")} href="/journal?tab=ideas" />
          <QuickAction Icon={CalendarDays} label={t("Calendar")} href="/calendar" />
          <QuickAction Icon={Search} label={t("Search")} onClick={openSearch} />
        </div>
      </div>
    ),

    insight: (
      <div>
        <SectionLabel>{t("ISA Insight")}</SectionLabel>
        <p className="mt-3 flex gap-2.5 text-[17px] leading-relaxed text-fg/90">
          <Sparkles size={16} className="mt-1.5 shrink-0" style={{ color: GREEN }} />
          <span>{xdInsight ?? insightText ?? t("Keep going — ISA is still learning your rhythm.")}</span>
        </p>
        <Link href="/ask" className="ml-[26px] mt-2 inline-flex items-center gap-0.5 text-sm text-muted hover:text-fg">
          {t("Optimize my day")} <ChevronRight size={14} />
        </Link>
      </div>
    ),

    activity:
      activity.length > 0 ? (
        <div>
          <SectionLabel>{t("Recent activity")}</SectionLabel>
          <ul className="mt-2">
            {activity.map((a) => (
              <li key={a.id} className="flex items-center gap-3 py-2 text-sm">
                <a.Icon size={14} style={{ color: GREEN }} />
                <span className="flex-1 text-fg/85">{t(a.label)}</span>
                <span className="text-xs tabular-nums text-muted">{a.when}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null,

    reflection: <Reflection />,
  };

  const ORDER: Record<typeof partOfDay, (keyof typeof sections)[]> = {
    morning: ["sleep", "todo", "habits", "goals", "actions", "insight", "reflection", "activity"],
    day: ["todo", "habits", "goals", "actions", "insight", "sleep", "reflection", "activity"],
    evening: ["reflection", "habits", "todo", "goals", "insight", "actions", "sleep", "activity"],
  };

  const stats = [
    { value: today2.habitsDue ? `${today2.habitsDone}/${today2.habitsDue}` : "—", label: t("habits") },
    { value: todaysTodos.length ? `${tasksDone}/${todaysTodos.length}` : "—", label: t("tasks") },
    { value: focusMinToday ? t("{n} min", { n: focusMinToday }) : "—", label: t("focus") },
    { value: sleepHours != null ? `${sleepHours.toFixed(1)}${t("h")}` : "—", label: t("sleep") },
  ];

  return (
    <div className="relative mx-auto max-w-2xl">
      <Atmosphere />
      <WeeklyReviewModal />
      <Onboarding name={displayName} show={freshAccount} />

      {/* TODAY — greeting, vitals, the day's progress and its numbers as text */}
      <motion.header {...rise(0)} className="pt-5 sm:pt-8">
        <h1
          className={`font-bold tracking-tight break-words text-balance ${
            displayName.length > 14 ? "text-4xl sm:text-5xl" : "text-[2.75rem] leading-[1.06] sm:text-[3.4rem]"
          }`}
        >
          {dateNow ? t(greetingFor(dateNow)) : t("Welcome")},<br />
          {displayName}.
        </h1>
        <p className="mt-2 text-[15px] text-muted">{dateNow ? formatDate(dateNow, lang) : " "}</p>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <span className="inline-flex items-center gap-1.5 text-fg/85">
            <Flame size={15} style={{ color: GREEN }} /> {activeStreak} {t("day streak")}
          </span>
          <span className="text-muted">·</span>
          <span className="inline-flex items-center gap-1.5 text-fg/85">
            <Zap size={15} className="text-fg/55" /> {t("Energy")} {energy ?? "—"}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setShowDay((v) => !v)}
          aria-expanded={showDay}
          className="mt-6 flex w-full items-center gap-3 text-left"
        >
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
            <motion.div
              className="h-full rounded-full"
              style={{ background: GREEN }}
              initial={{ width: 0 }}
              animate={{ width: `${todayPct}%` }}
              transition={{ duration: 0.85, ease: EASE }}
            />
          </div>
          <span className="shrink-0 text-xs tabular-nums text-muted">{todayPct}% {t("today")}</span>
        </button>
        {showDay && (
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs">
            {dayParts.map((p) => (
              <li key={p.label} className={`flex items-center gap-1.5 ${p.done ? "text-fg/85" : "text-muted"}`}>
                {p.done ? <Check size={13} style={{ color: GREEN }} /> : <Circle size={11} className="opacity-60" />}
                {p.label}
                {p.detail && <span className="tabular-nums text-muted">· {p.detail}</span>}
              </li>
            ))}
          </ul>
        )}

        <p className="mt-4 flex flex-wrap gap-x-2 gap-y-1 text-[15px] text-muted">
          {stats.map((st, i) => (
            <span key={st.label} className="whitespace-nowrap">
              <span className="font-semibold tabular-nums text-fg">{st.value}</span> {st.label}
              {i < stats.length - 1 && <span className="ml-2 text-muted/60">·</span>}
            </span>
          ))}
        </p>
      </motion.header>

      {ORDER[partOfDay].map((key, i) =>
        sections[key] ? (
          <motion.section key={key} {...rise(0.04 + i * 0.03)} className="mt-14">
            {sections[key]}
          </motion.section>
        ) : null
      )}
      <div className="h-10" />
    </div>
  );
}

// Internal engine names must never reach the user ("GoalCompleted").
function humanize(s: string): string {
  return s
    .replace(/\b([A-Z][a-z]+)([A-Z][a-z]+)+\b/g, (m) => m.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase())
    .replace(/^./, (c) => c.toUpperCase());
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-muted">{children}</h2>;
}

function QuickAction({
  Icon, label, href, onClick,
}: {
  Icon: typeof Plus; label: string; href?: string; onClick?: () => void;
}) {
  const inner = (
    <>
      <Icon size={16} className="text-fg/60" />
      <span>{label}</span>
    </>
  );
  const cls = "inline-flex items-center gap-2 text-[15px] text-fg/80 transition hover:text-fg";
  return href ? (
    <Link href={href} className={cls}>{inner}</Link>
  ) : (
    <button onClick={onClick} className={cls}>{inner}</button>
  );
}
