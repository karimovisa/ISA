"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { GlassCard } from "@/components/ui/GlassCard";
import { todayISO } from "@/lib/datetime";
import type { PrayerLog } from "@/lib/types";

function shift(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

type Block = {
  prayed: number;
  expected: number;
  qazo: number;
  vaqtida: number;
  kechikkan: number;
  onTime: number;
};

export function PrayerStats() {
  const [logs, setLogs] = useState<PrayerLog[]>([]);
  const [since, setSince] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = todayISO();
    const from = shift(today, -31);
    Promise.all([
      supabase.from("prayer_logs").select("*").gte("date", from),
      supabase.from("prayer_preferences").select("created_at").maybeSingle(),
    ]).then(([logsRes, prefRes]) => {
      setLogs((logsRes.data as PrayerLog[]) ?? []);
      setSince(
        prefRes.data?.created_at
          ? String(prefRes.data.created_at).slice(0, 10)
          : from
      );
      setLoading(false);
    });
  }, []);

  // Only completed days (yesterday back), clamped to when the user activated.
  const compute = useMemo(() => {
    return (days: number): Block => {
      const today = todayISO();
      const start = since && since > shift(today, -days) ? since : shift(today, -days);
      const inRange = (d: string) => d >= start && d < today;
      const rows = logs.filter((l) => inRange(l.date) && l.ticked_at);

      // Number of completed days actually covered.
      let dayCount = 0;
      for (let i = 1; i <= days; i++) {
        const d = shift(today, -i);
        if (d >= start) dayCount++;
      }
      const expected = dayCount * 5;
      const prayed = rows.length;
      const vaqtida = rows.filter((r) => r.status === "vaqtida").length;
      const kechikkan = rows.filter((r) => r.status === "kechikkan").length;
      const qazo = Math.max(0, expected - prayed);
      const onTime = prayed ? Math.round((vaqtida / prayed) * 100) : 0;
      return { prayed, expected, qazo, vaqtida, kechikkan, onTime };
    };
  }, [logs, since]);

  if (loading) {
    return <div className="glass h-72 animate-pulse rounded-3xl" />;
  }

  const week = compute(7);
  const month = compute(30);

  return (
    <GlassCard className="p-6">
      <h3 className="mb-4 text-sm font-medium">Statistika</h3>
      <div className="space-y-5">
        <StatBlock title="Oxirgi 7 kun" b={week} />
        <div className="border-t border-line" />
        <StatBlock title="Oxirgi 30 kun" b={month} />
      </div>
      <p className="mt-4 text-xs text-muted">
        Bugungi namozlar tugagach hisobga qo'shiladi.
      </p>
    </GlassCard>
  );
}

function StatBlock({ title, b }: { title: string; b: Block }) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-xs uppercase tracking-wider text-muted">
          {title}
        </span>
        <span className="text-xs text-muted">
          {b.prayed}/{b.expected} o'qilgan
        </span>
      </div>
      {b.expected > 0 && (
        <div className="mb-3 flex h-2 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="bg-emerald-500/80"
            style={{ width: `${(b.vaqtida / b.expected) * 100}%` }}
          />
          <div
            className="bg-amber-400/80"
            style={{ width: `${(b.kechikkan / b.expected) * 100}%` }}
          />
          <div
            className="bg-red-500/70"
            style={{ width: `${(b.qazo / b.expected) * 100}%` }}
          />
        </div>
      )}
      <div className="grid grid-cols-3 gap-2 text-center">
        <Metric label="Vaqtida" value={b.vaqtida} tone="text-emerald-400" />
        <Metric label="Kechikkan" value={b.kechikkan} tone="text-amber-400" />
        <Metric label="Qazo" value={b.qazo} tone="text-red-400" />
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className="rounded-xl bg-white/[0.03] py-2.5">
      <div className={`text-xl font-bold tabular-nums ${tone}`}>{value}</div>
      <div className="text-[11px] text-muted">{label}</div>
    </div>
  );
}
