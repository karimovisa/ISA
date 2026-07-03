"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Footprints, Plus, Trash2 } from "lucide-react";
import { useCollection } from "@/hooks/useCollection";
import { GlassCard } from "@/components/ui/GlassCard";
import { PressButton } from "@/components/ui/PressButton";
import { fieldClass } from "@/components/ui/Modal";
import { todayISO } from "@/lib/datetime";
import {
  manualRunInsights,
  manualLast7DaysKm,
  paceFromDuration,
} from "@/lib/runStats";
import type { RunLog } from "@/lib/types";

const tooltipStyle = {
  background: "rgba(20,20,22,0.95)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 12,
  fontSize: 12,
};

export function RunTracker() {
  const runs = useCollection<RunLog>("runs", {
    orderBy: "log_date",
    ascending: false,
  });
  const [date, setDate] = useState(todayISO());
  const [km, setKm] = useState("");
  const [min, setMin] = useState("");
  const [sec, setSec] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const distance = Number(km);
    const duration = Number(min || 0) * 60 + Number(sec || 0);
    if (!distance || distance <= 0) return;
    await runs.add({
      log_date: date,
      distance_km: distance,
      duration_s: duration,
    });
    setKm("");
    setMin("");
    setSec("");
    setDate(todayISO());
  };

  const ins = manualRunInsights(runs.data);
  const chart = manualLast7DaysKm(runs.data);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <GlassCard className="p-6">
        <div className="mb-5 flex items-center gap-2">
          <Footprints size={18} className="text-white/80" />
          <h3 className="text-sm font-medium">Running</h3>
        </div>

        {/* Insights */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="This week" value={`${ins.thisWeekKm} km`} />
          <Stat
            label="vs last week"
            value={
              ins.weekTrendPct === null
                ? "—"
                : `${ins.weekTrendPct > 0 ? "+" : ""}${ins.weekTrendPct}%`
            }
            tone={
              ins.weekTrendPct === null
                ? undefined
                : ins.weekTrendPct >= 0
                  ? "text-emerald-300"
                  : "text-red-300"
            }
          />
          <Stat label="Avg pace" value={`${ins.avgPace} /km`} />
          <Stat label="Longest" value={`${ins.longestKm} km`} />
        </div>

        {/* Chart */}
        <div className="mt-6">
          <ResponsiveContainer width="100%" height={170}>
            <AreaChart data={chart}>
              <defs>
                <linearGradient id="runManualGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#fff" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#fff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.05)"
                vertical={false}
              />
              <XAxis dataKey="day" stroke="#a0a0a0" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#a0a0a0" fontSize={12} tickLine={false} axisLine={false} width={28} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area
                type="monotone"
                dataKey="km"
                stroke="#fff"
                strokeWidth={2}
                fill="url(#runManualGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Log form */}
        <form
          onSubmit={submit}
          className="mt-5 flex flex-wrap items-end gap-3 border-t border-line pt-5"
        >
          <Field label="Date">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={`${fieldClass} h-10 py-1`}
            />
          </Field>
          <Field label="Distance (km)">
            <input
              type="number"
              step="0.1"
              min="0"
              value={km}
              onChange={(e) => setKm(e.target.value)}
              placeholder="5.0"
              className={`${fieldClass} h-10 w-24 py-1`}
            />
          </Field>
          <Field label="Time">
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="0"
                value={min}
                onChange={(e) => setMin(e.target.value)}
                placeholder="min"
                className={`${fieldClass} h-10 w-16 py-1 text-center`}
              />
              <span className="text-muted">:</span>
              <input
                type="number"
                min="0"
                max="59"
                value={sec}
                onChange={(e) => setSec(e.target.value)}
                placeholder="sec"
                className={`${fieldClass} h-10 w-16 py-1 text-center`}
              />
            </div>
          </Field>
          <PressButton
            type="submit"
            className="flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-black transition hover:bg-white/90"
          >
            <Plus size={15} />
            Log run
          </PressButton>
        </form>

        {/* Recent */}
        {runs.data.length > 0 && (
          <ul className="mt-5 space-y-2">
            {runs.data.slice(0, 5).map((r) => (
              <li
                key={r.id}
                className="group flex items-center justify-between border-t border-line pt-2 text-sm first:border-0 first:pt-0"
              >
                <span className="text-white/90">
                  {new Date(r.log_date).toLocaleDateString([], {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                <span className="flex items-center gap-3 text-muted">
                  <span className="tabular-nums text-white/90">
                    {r.distance_km} km
                  </span>
                  <span className="tabular-nums">
                    {paceFromDuration(r.distance_km, r.duration_s)} /km
                  </span>
                  <button
                    onClick={() => runs.remove(r.id)}
                    className="rounded p-1 text-muted opacity-0 transition hover:text-red-400 group-hover:opacity-100"
                    aria-label="Delete run"
                  >
                    <Trash2 size={13} />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </GlassCard>
    </motion.div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted">{label}</div>
      <div className={`mt-1 text-xl font-bold tabular-nums ${tone ?? ""}`}>
        {value}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs uppercase tracking-wider text-muted">
        {label}
      </span>
      {children}
    </label>
  );
}
