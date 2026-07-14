"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Flame, Trophy, Percent, Activity, CheckCircle2, Lock } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { GlassCard } from "@/components/ui/GlassCard";
import { useEntitlements } from "@/components/EntitlementProvider";
import type { Habit, HabitLog } from "@/lib/types";

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

export default function HabitDetailPage() {
  const params = useParams();
  const id = String(params.id);
  const { canUse } = useEntitlements();
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
        <div className="mb-1 flex items-center gap-2">
          <h3 className="text-sm font-medium">AI Insights</h3>
          {!canUse("ai_coach") && <Lock size={13} className="text-muted" />}
        </div>
        <p className="text-sm text-muted">
          {canUse("ai_coach")
            ? "Building your pattern — best completion time, weakest day, and streak risk appear as ISA gathers more history."
            : "Deep habit intelligence (best time, weakest day, streak risk, correlations) is a Pro feature."}
        </p>
      </GlassCard>
    </div>
  );
}
