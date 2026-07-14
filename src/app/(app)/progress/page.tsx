"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ResponsiveContainer, BarChart, Bar, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { Sparkles, Lock, Flame, Timer, Target, Repeat, Smile, Footprints } from "lucide-react";
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

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const tooltipStyle = { background: "rgba(20,20,22,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, fontSize: 12 };
function ymd(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function last7Days() { const out: { key: string; label: string }[] = []; for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); out.push({ key: d.toDateString(), label: DAY_LABELS[d.getDay()] }); } return out; }

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
  const [moodAvg, setMoodAvg] = useState<number | null>(null);
  const [energyAvg, setEnergyAvg] = useState<number | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [advanced, setAdvanced] = useState<Insight[]>([]);

  const wk = ymd(new Date(Date.now() - 6 * 86400000));
  useEffect(() => {
    (async () => {
      const [{ data: hl }, { data: ml }, { data: es }] = await Promise.all([
        supabase.from("habit_logs").select("completed,date").gte("date", wk),
        supabase.from("mood_logs").select("mood_score,date").gte("date", wk),
        supabase.from("daily_energy_scores").select("score,date").gte("date", wk),
      ]);
      const activeHabits = habits.data.filter((h) => h.is_active).length;
      const doneCnt = ((hl as { completed: boolean }[]) ?? []).filter((x) => x.completed).length;
      setHabitRate(activeHabits ? Math.min(1, doneCnt / (activeHabits * 7)) : 0);
      const moods = ((ml as { mood_score: number }[]) ?? []).map((x) => x.mood_score);
      setMoodAvg(moods.length ? moods.reduce((a, b) => a + b, 0) / moods.length : null);
      const en = ((es as { score: number }[]) ?? []).map((x) => x.score);
      setEnergyAvg(en.length ? en.reduce((a, b) => a + b, 0) / en.length : null);
      retrieveTimeline({ limit: 30 }).then(setTimeline);
      if (canUse("deep_analytics")) retrieveInsights({ source: "advanced", limit: 8 }).then(setAdvanced);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [habits.data.length]);

  const days = useMemo(() => last7Days(), []);
  const studyData = useMemo(() => days.map((d) => ({ day: d.label, hours: +(focus.data.filter((s) => new Date(s.created_at).toDateString() === d.key).reduce((s2, s) => s2 + s.duration_seconds, 0) / 3600).toFixed(2) })), [days, focus.data]);
  const productivityData = useMemo(() => days.map((d) => { const day = focus.data.filter((s) => new Date(s.created_at).toDateString() === d.key); const min = day.reduce((s, x) => s + x.duration_seconds, 0) / 60; return { day: d.label, score: Math.min(100, Math.round(min + day.length * 5)) }; }), [days, focus.data]);
  const projectData = useMemo(() => projects.data.map((p) => ({ name: p.title.length > 12 ? p.title.slice(0, 12) + "…" : p.title, percentage: p.percentage })), [projects.data]);

  const weekFocusMin = studyData.reduce((s, d) => s + d.hours, 0) * 60;
  const activeGoals = goals.data.filter((g) => !g.archived);
  const goalAvg = activeGoals.length ? activeGoals.reduce((s, g) => s + g.percentage, 0) / activeGoals.length : 0;
  const journalDays = new Set(journal.data.filter((e) => e.entry_date >= wk).map((e) => e.entry_date)).size;
  const runWeekKm = runs.data.filter((r) => r.log_date >= wk).reduce((s, r) => s + r.distance_km, 0);

  // ── Deterministic Productivity / momentum Score (explainable, no fabrication) ──
  const parts = {
    focus: Math.min(1, weekFocusMin / 300),
    habits: habitRate,
    journal: journalDays / 7,
    goals: goalAvg / 100,
    sleep: energyAvg != null ? energyAvg / 100 : 0.5,
  };
  const score = Math.round(100 * (0.30 * parts.focus + 0.20 * parts.habits + 0.15 * parts.journal + 0.20 * parts.goals + 0.15 * parts.sleep));

  const overview = [
    { Icon: Timer, label: "Focus / week", value: `${(weekFocusMin / 60).toFixed(1)}h` },
    { Icon: Flame, label: "Momentum", value: `${score}` },
    { Icon: Repeat, label: "Habits", value: `${Math.round(habitRate * 100)}%` },
    { Icon: Smile, label: "Mood", value: moodAvg != null ? moodAvg.toFixed(1) : "—" },
    { Icon: Target, label: "Goal avg", value: `${Math.round(goalAvg)}%` },
    { Icon: Footprints, label: "Run / week", value: `${runWeekKm.toFixed(1)}km` },
  ];

  return (
    <div>
      <PageHeader title="Progress" subtitle="Am I becoming a better version of myself?" />

      {/* Life Overview snapshot */}
      <div className="mb-4 grid grid-cols-3 gap-3 sm:grid-cols-6">
        {overview.map((o) => (
          <GlassCard key={o.label} className="p-4">
            <o.Icon size={15} className="mb-2 text-muted" />
            <div className="text-xl font-bold tabular-nums">{o.value}</div>
            <div className="text-[11px] text-muted">{t(o.label)}</div>
          </GlassCard>
        ))}
      </div>

      {/* Productivity Score */}
      <GlassCard className="mb-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-muted">{t("Productivity Score")}</h3>
            <p className="mt-1 text-xs text-muted">{t("Overall momentum — focus, habits, journaling, goals, rest.")}</p>
          </div>
          <span className="text-4xl font-bold tabular-nums">{score}</span>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/5">
          <motion.div className="h-full rounded-full bg-fg" initial={{ width: 0 }} animate={{ width: `${score}%` }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} />
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
          <span>Focus {Math.round(parts.focus * 100)}%</span><span>Habits {Math.round(parts.habits * 100)}%</span>
          <span>Journal {Math.round(parts.journal * 100)}%</span><span>Goals {Math.round(parts.goals * 100)}%</span>
          <span>Rest {Math.round(parts.sleep * 100)}%</span>
        </div>
      </GlassCard>

      {/* Goal analytics */}
      {activeGoals.length > 0 && (
        <GlassCard className="mb-6 p-6">
          <h3 className="mb-4 text-sm font-medium">{t("Goal analytics")}</h3>
          <div className="space-y-3">
            {activeGoals.map((g) => {
              const a = analyzeGoal(g, []);
              const tone = a.pace === "ahead" ? "text-emerald-300" : a.pace === "behind" ? "text-amber-300" : "text-muted";
              return (
                <div key={g.id} className="flex items-center justify-between gap-3 border-b border-line pb-3 last:border-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{g.title}</p>
                    <p className="text-xs text-muted">{a.prediction}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold tabular-nums">{a.pct}%</p>
                    <p className={`text-xs ${tone}`}>{a.paceLabel}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </GlassCard>
      )}

      {/* Running */}
      <div className="mb-6"><RunningSection /></div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title={t("Focus hours")} delay={0}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={studyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" vertical={false} />
              <XAxis dataKey="day" stroke="var(--color-muted)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--color-muted)" fontSize={12} tickLine={false} axisLine={false} width={28} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
              <Bar dataKey="hours" radius={[6, 6, 0, 0]} fill="var(--color-fg)" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title={t("Weekly productivity")} delay={0.05}>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={productivityData}>
              <defs><linearGradient id="prodGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--color-fg)" stopOpacity={0.35} /><stop offset="100%" stopColor="var(--color-fg)" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" vertical={false} />
              <XAxis dataKey="day" stroke="var(--color-muted)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--color-muted)" fontSize={12} tickLine={false} axisLine={false} width={28} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="score" stroke="var(--color-fg)" strokeWidth={2} fill="url(#prodGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title={t("Project progress")} delay={0.1} className="lg:col-span-2">
          {projectData.length === 0 ? (
            <div className="flex h-[220px] items-center justify-center px-6 text-center text-sm text-muted">{t("No projects yet — add one on the Projects page to track progress here.")}</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={projectData} layout="vertical" margin={{ left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} stroke="var(--color-muted)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" stroke="var(--color-muted)" fontSize={11} tickLine={false} axisLine={false} width={84} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Bar dataKey="percentage" radius={[0, 6, 6, 0]} fill="var(--color-fg)" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Life Timeline */}
      {timeline.length > 0 && (
        <GlassCard className="mt-6 p-6">
          <h3 className="mb-4 text-sm font-medium">{t("Life Timeline")}</h3>
          <div className="space-y-3">
            {timeline.map((e) => (
              <div key={e.id} className="flex items-center gap-3">
                <span className="h-2 w-2 shrink-0 rounded-full bg-accent" />
                <span className="min-w-0 flex-1 truncate text-sm text-fg/90">{e.title}</span>
                <span className="shrink-0 text-xs text-muted">{new Date(e.occurred_at).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}</span>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      <div className="mt-6"><WeeklyReviewHistory /></div>
      <div className="mt-6"><ReviewsCard /></div>

      {/* Pro deep analytics — real cross-domain intelligence for Pro users */}
      <GlassCard className="mt-6 p-5">
        <div className="mb-2 flex items-center gap-2">
          <Sparkles size={16} className="text-accent" />
          <h3 className="text-sm font-medium">{t("Deep analytics")}</h3>
          {!canUse("deep_analytics") && <Lock size={13} className="text-muted" />}
        </div>
        {canUse("deep_analytics") ? (
          advanced.length > 0 ? (
            <ul className="space-y-2.5">
              {advanced.map((a) => (
                <li key={a.id} className="text-sm">
                  <p className="font-medium text-fg/90">{a.title}</p>
                  <p className="text-xs leading-relaxed text-muted">{a.detail}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs leading-relaxed text-muted">
              {t("ISA is finding cross-domain patterns — correlations and predictions appear as more history builds.")}
            </p>
          )
        ) : (
          <p className="text-xs leading-relaxed text-muted">
            {t("Cross-domain correlations (sleep↔focus, mood↔productivity), predictions, and monthly/yearly reviews are a Pro feature.")}
          </p>
        )}
      </GlassCard>
    </div>
  );
}

function ChartCard({ title, children, delay, className }: { title: string; children: React.ReactNode; delay: number; className?: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay }} className={className}>
      <GlassCard className="p-6"><h3 className="mb-5 text-sm font-medium">{title}</h3>{children}</GlassCard>
    </motion.div>
  );
}
