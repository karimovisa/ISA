"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Flame, Trophy, Percent, Activity, CheckCircle2, Lock, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { GlassCard } from "@/components/ui/GlassCard";
import { useEntitlements } from "@/components/EntitlementProvider";
import { useT } from "@/lib/i18n";
import type { Habit, HabitLog } from "@/lib/types";
import { timeInsightFor } from "@/lib/habitCoach";
import { aiInsight } from "@/lib/habitInsight";

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d; }

type Stats = { current: number; longest: number; completion: number; consistency: number; missedWeek: number; total: number };

function computeStats(logs: HabitLog[], created: string): Stats {
  const done = new Set(logs.filter((l) => l.completed).map((l) => l.date));
  // current streak (allow it to still count if today not yet done)
  let current = 0;
  for (let i = done.has(ymd(new Date())) ? 0 : 1; i < 400; i++) {
    if (done.has(ymd(daysAgo(i)))) current++; else break;
  }
  // longest
  const sorted = [...done].sort();
  let longest = 0, run = 0; let prev: Date | null = null;
  for (const s of sorted) {
    const d = new Date(`${s}T00:00:00`);
    if (prev && Math.round((d.getTime() - prev.getTime()) / 86400000) === 1) run++; else run = 1;
    longest = Math.max(longest, run); prev = d;
  }
  const createdDays = Math.min(30, Math.max(1, Math.round((Date.now() - new Date(created).getTime()) / 86400000) + 1));
  const last30 = [...done].filter((s) => s >= ymd(daysAgo(29))).length;
  const completion = Math.round((last30 / createdDays) * 100);
  const consistency = Math.round((last30 / 30) * 100);
  const weekStart = ymd(daysAgo(new Date().getDay()));
  const doneThisWeek = [...done].filter((s) => s >= weekStart).length;
  const daysIntoWeek = new Date().getDay() + 1;
  const missedWeek = Math.max(0, daysIntoWeek - doneThisWeek);
  return { current, longest, completion: Math.min(100, completion), consistency, missedWeek, total: done.size };
}

function partOf(hour: number): string {
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  if (hour < 22) return "evening";
  return "night";
}

function scheduleText(h: Habit): string {
  const cfg = h.frequency_config ?? {};
  if (h.frequency_type === "interval") { const e = cfg.every ?? 2; return e <= 1 ? "Daily" : `Every ${e} days`; }
  if (h.frequency_type === "weekdays") {
    const days = [...(cfg.days ?? [])].sort((a, b) => a - b);
    if (days.length === 7) return "Daily";
    if (days.length === 5 && [1, 2, 3, 4, 5].every((d) => days.includes(d))) return "Weekdays";
    const N = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return days.length ? days.map((d) => N[d]).join(", ") : "No days";
  }
  return "Daily";
}

export default function HabitDetailPage() {
  const params = useParams();
  const id = String(params.id);
  const { canUse } = useEntitlements();
  const { lang } = useT();
  const [habit, setHabit] = useState<Habit | null>(null);
  const [logs, setLogs] = useState<HabitLog[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [{ data: h }, { data: l }] = await Promise.all([
      supabase.from("habits").select("*").eq("id", id).maybeSingle(),
      supabase.from("habit_logs").select("*").eq("habit_id", id),
    ]);
    setHabit((h as Habit) ?? null);
    setLogs((l as HabitLog[]) ?? []);
    setLoading(false);
  }, [id]);
  useEffect(() => { load(); }, [load]);

  // Phase 4 (AI): a deeper, LLM-phrased insight from ISA's computed findings.
  // Pro-only, cached per habit per day, deterministic fallback when the model is
  // absent or fails. See src/lib/habitInsight.ts.
  const [insight, setInsight] = useState<string | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  useEffect(() => {
    if (!habit || !canUse("ai_coach")) return;
    const key = `isa_habit_insight_${habit.id}_${lang}_${ymd(new Date())}`;
    try {
      const raw = localStorage.getItem(key);
      if (raw) { setInsight((JSON.parse(raw) as { text: string }).text); return; }
    } catch { /* ignore */ }
    const st = computeStats(logs, habit.created_at);
    const completions = logs.filter((l) => l.completed);

    let facts: string; let fallback: string;
    if (st.total < 3) {
      // Thin data — tell the model plainly so it doesn't fabricate a trend.
      facts = `Habit: ${habit.name}. Schedule: ${scheduleText(habit)}. Only ${st.total} completion(s) so far — not enough history to see a pattern.`;
      fallback = "Not enough data yet to see a pattern — keep showing up and it'll appear.";
    } else {
      // Interpretive findings: each carries a direction or comparison, never a
      // naked number (nothing for the model to analyze).
      const minShare = Math.round((completions.filter((l) => l.completion_type === "minimum").length / completions.length) * 100);
      const stamped = completions.filter((l) => l.completed_at);
      let timeFinding = "";
      if (stamped.length >= 4) {
        const counts: Record<string, number> = {};
        for (const l of stamped) { const p = partOf(new Date(l.completed_at as string).getHours()); counts[p] = (counts[p] ?? 0) + 1; }
        const [part, n] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
        timeFinding = `Most completions land in the ${part} (${n} of ${stamped.length} timestamped).`;
      }
      const wkStart = ymd(daysAgo(new Date().getDay()));
      const prevStart = ymd(daysAgo(new Date().getDay() + 7));
      const doneDates = completions.map((l) => l.date);
      const thisWk = doneDates.filter((d) => d >= wkStart).length;
      const lastWk = doneDates.filter((d) => d >= prevStart && d < wkStart).length;
      const ti = timeInsightFor(logs);
      facts = [
        `Habit: ${habit.name}.`,
        `Schedule: ${scheduleText(habit)}.`,
        habit.target_value != null ? `Target: ${habit.target_value}${habit.target_unit ? ` ${habit.target_unit}` : ""}.` : "",
        `Consistency last 30 days: ${st.consistency}%.`,
        (thisWk || lastWk) ? `Completed ${thisWk} time(s) this week versus ${lastWk} last week.` : "",
        `Current streak ${st.current} day(s); longest ${st.longest}; ${st.total} completions total.`,
        timeFinding,
        minShare > 0 ? `Hard-day (minimum) version used in ${minShare}% of completions.` : "",
        habit.trigger_after ? `Trigger: after ${habit.trigger_after}.` : "",
      ].filter(Boolean).join(" ");
      fallback = ti
        ? `You tend to finish ${habit.name} in the ${ti.part} — lean into that window.`
        : st.consistency >= 70
          ? `You've held ${habit.name} ${st.consistency}% of the last month. Steady.`
          : st.current >= 2
            ? `${st.current} days going on ${habit.name}. Small and consistent is the point.`
            : `Every time you show up for ${habit.name}, the pattern gets a little stronger.`;
    }
    setInsightLoading(true);
    aiInsight(facts, fallback, lang).then((r) => {
      setInsight(r.text); setInsightLoading(false);
      try { localStorage.setItem(key, JSON.stringify(r)); } catch { /* ignore */ }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [habit, logs, lang]);

  if (loading) return <div className="glass h-64 animate-pulse rounded-3xl" />;
  if (!habit) return <div className="text-muted">Habit not found. <Link href="/habits" className="text-accent">Back</Link></div>;

  const s = computeStats(logs, habit.created_at);
  const done = new Set(logs.filter((l) => l.completed).map((l) => l.date));
  const weeks = 13;
  const cells = Array.from({ length: weeks * 7 }, (_, i) => ymd(daysAgo(weeks * 7 - 1 - i)));

  const tiles = [
    { Icon: Flame, label: "Current streak", value: `${s.current}`, unit: "days" },
    { Icon: Trophy, label: "Longest streak", value: `${s.longest}`, unit: "days" },
    { Icon: Percent, label: "Completion", value: `${s.completion}`, unit: "%" },
    { Icon: Activity, label: "Consistency", value: `${s.consistency}`, unit: "%" },
    { Icon: CheckCircle2, label: "Total done", value: `${s.total}`, unit: "" },
    { Icon: Flame, label: "Missed this week", value: `${s.missedWeek}`, unit: "" },
  ];

  return (
    <div>
      <Link href="/habits" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-fg">
        <ArrowLeft size={15} /> Habits
      </Link>
      <div className="mb-1 flex items-center gap-2">
        <h1 className="text-3xl font-bold tracking-tight">{habit.name}</h1>
        <span className="rounded-full bg-white/8 px-2 py-0.5 text-xs text-muted">{habit.category}</span>
      </div>
      {habit.target_value != null && (
        <p className="mb-6 text-sm text-muted">Target: {habit.target_value}{habit.target_unit ? ` ${habit.target_unit}` : ""}</p>
      )}

      {(habit.trigger_after || habit.hard_day) && (
        <GlassCard className="mb-6 p-5">
          <dl className="space-y-3 text-sm">
            {habit.trigger_after && (
              <div className="flex gap-3">
                <dt className="w-28 shrink-0 text-muted">Trigger</dt>
                <dd className="text-fg/90">After {habit.trigger_after}</dd>
              </div>
            )}
            {habit.hard_day && (
              <div className="flex gap-3">
                <dt className="w-28 shrink-0 text-muted">Hard-day version</dt>
                <dd className="text-fg/90">{habit.hard_day}</dd>
              </div>
            )}
          </dl>
        </GlassCard>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {tiles.map((t) => (
          <GlassCard key={t.label} className="p-4">
            <t.Icon size={16} className="mb-2 text-muted" />
            <div className="text-2xl font-bold tabular-nums">{t.value}<span className="text-sm font-medium text-muted"> {t.unit}</span></div>
            <div className="text-xs text-muted">{t.label}</div>
          </GlassCard>
        ))}
      </div>

      <GlassCard className="mb-6 p-6">
        <h3 className="mb-4 text-sm font-medium text-muted">Last 13 weeks</h3>
        <div className="grid grid-flow-col grid-rows-7 gap-1">
          {cells.map((d) => {
            const c = done.has(d);
            const future = d > ymd(new Date());
            return <span key={d} title={d} className={`h-3 w-3 rounded-sm ${future ? "bg-transparent" : c ? "bg-fg" : "bg-white/8"}`} />;
          })}
        </div>
      </GlassCard>

      {habit.notes && (
        <GlassCard className="mb-6 p-5">
          <h3 className="mb-1 text-xs uppercase tracking-wider text-muted">Notes</h3>
          <p className="text-sm text-fg/90">{habit.notes}</p>
        </GlassCard>
      )}

      <GlassCard className="p-5">
        <div className="mb-1.5 flex items-center gap-2">
          <Sparkles size={14} style={{ color: "#86A97F" }} />
          <h3 className="text-sm font-medium">ISA insight</h3>
          {!canUse("ai_coach") && <Lock size={13} className="text-muted" />}
        </div>
        {canUse("ai_coach") ? (
          insightLoading && !insight ? (
            <div className="mt-2 space-y-1.5">
              <div className="h-3.5 w-3/4 animate-pulse rounded bg-white/10" />
              <div className="h-3.5 w-1/2 animate-pulse rounded bg-white/10" />
            </div>
          ) : (
            <p className="text-sm leading-relaxed text-fg/90">
              {insight ?? "Building your pattern — an insight appears as ISA gathers a little more history."}
            </p>
          )
        ) : (
          <p className="text-sm text-muted">Deep habit intelligence — your best time of day, patterns, and gentle nudges — is a Pro feature.</p>
        )}
      </GlassCard>
    </div>
  );
}
