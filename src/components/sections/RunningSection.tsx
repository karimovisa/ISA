"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { Footprints, Plus, RefreshCw, Trash2, Link2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useCollection } from "@/hooks/useCollection";
import { GlassCard } from "@/components/ui/GlassCard";
import { PressButton } from "@/components/ui/PressButton";
import { fieldClass } from "@/components/ui/Modal";
import { connectStrava, syncStrava } from "@/lib/stravaClient";
import { toast } from "@/lib/toast";
import { useT } from "@/lib/i18n";
import {
  insightsOf,
  last7Of,
  paceFromDuration,
  type NormRun,
} from "@/lib/runStats";
import { todayISO } from "@/lib/datetime";
import { captureLifeEvent } from "@/lib/life-events";
import type { RunLog, StravaActivityRow } from "@/lib/types";

const ORANGE = "#FC4C02";
const tooltipStyle = {
  background: "rgba(20,20,22,0.95)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 12,
  fontSize: 12,
};

export function RunningSection() {
  const { t } = useT();
  // Manual runs (always available).
  const manual = useCollection<RunLog>("runs", {
    orderBy: "log_date",
    ascending: false,
  });
  // Recent list stays short by default — the last two runs, expandable.
  const [showAll, setShowAll] = useState(false);

  // Strava state.
  const [connected, setConnected] = useState<boolean | null>(null);
  const [strava, setStrava] = useState<StravaActivityRow[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  // Manual form.
  const [date, setDate] = useState(todayISO());
  const [km, setKm] = useState("");
  const [min, setMin] = useState("");
  const [sec, setSec] = useState("");

  const loadStrava = useCallback(async () => {
    const { data: conn } = await supabase
      .from("strava_connections")
      .select("user_id")
      .maybeSingle();
    setConnected(!!conn);
    const { data: acts } = await supabase
      .from("strava_activities")
      .select("*")
      .order("start_date", { ascending: false });
    if (acts) setStrava(acts as StravaActivityRow[]);
  }, []);

  const sync = useCallback(async () => {
    setSyncing(true);
    setNote(null);
    const res = await syncStrava();
    setSyncing(false);
    if (res.error) {
      setNote(`Strava sync: ${res.error}`);
      toast(`Strava sync failed: ${res.error}`, "error");
    } else {
      setNote(`Imported ${res.imported ?? 0} run${res.imported === 1 ? "" : "s"} from Strava.`);
      await loadStrava();
    }
  }, [loadStrava]);

  useEffect(() => {
    loadStrava();
    const params = new URLSearchParams(window.location.search);
    const status = params.get("strava");
    if (status) {
      window.history.replaceState({}, "", window.location.pathname);
      if (status === "connected") {
        setNote("Connected to Strava. Importing your runs…");
        sync();
      } else setNote(`Strava connection ${status}.`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Merge both sources into one normalized, de-duplicated timeline.
  const runs = useMemo<NormRun[]>(() => {
    const s: NormRun[] = strava.map((a) => ({
      id: `s-${a.id}`,
      source: "strava",
      date: a.start_date,
      distance_km: a.distance_m / 1000,
      duration_s: a.moving_time_s,
      name: a.name,
    }));
    const m: NormRun[] = manual.data.map((r) => ({
      id: `m-${r.id}`,
      source: "manual",
      date: r.log_date,
      distance_km: r.distance_km,
      duration_s: r.duration_s ?? 0,
    }));
    return [...s, ...m].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [strava, manual.data]);

  const ins = insightsOf(runs);
  const chart = last7Of(runs);

  // Live pace so the user sees the result before saving — no mental math.
  const previewSecs = Number(min || 0) * 60 + Number(sec || 0);
  const previewPace =
    Number(km) > 0 && previewSecs > 0 ? paceFromDuration(Number(km), previewSecs) : null;

  const logManual = async (e: React.FormEvent) => {
    e.preventDefault();
    const distance = Number(km);
    if (!distance || distance <= 0) return;
    await manual.add({
      log_date: date,
      distance_km: distance,
      duration_s: Number(min || 0) * 60 + Number(sec || 0),
    });
    void captureLifeEvent({
      type: "RunLogged",
      occurredAt: date,
      payload: { distance_km: distance, duration_s: Number(min || 0) * 60 + Number(sec || 0) },
      context: { metricValue: distance, outcome: "achievement" },
    });
    setKm("");
    setMin("");
    setSec("");
    setDate(todayISO());
  };

  const removeManual = (id: string) => manual.remove(id.replace(/^m-/, ""));

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <GlassCard className="p-6">
        {/* Header + Strava controls */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Footprints size={18} className="text-fg/80" />
            <h3 className="text-sm font-medium">Running</h3>
          </div>
          {connected ? (
            <PressButton
              onClick={sync}
              disabled={syncing}
              className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs text-fg transition-colors hover:bg-white/15 disabled:opacity-50"
            >
              <RefreshCw size={13} className={syncing ? "animate-spin" : undefined} />
              {syncing ? "Syncing…" : "Sync Strava"}
            </PressButton>
          ) : (
            <PressButton
              onClick={connectStrava}
              className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium text-fg"
              style={{ backgroundColor: ORANGE }}
            >
              <Link2 size={13} />
              Connect Strava
            </PressButton>
          )}
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
                <linearGradient id="runGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-fg)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--color-fg)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" vertical={false} />
              <XAxis dataKey="day" stroke="var(--color-muted)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--color-muted)" fontSize={12} tickLine={false} axisLine={false} width={28} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="km" stroke="var(--color-fg)" strokeWidth={2} fill="url(#runGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Manual log */}
        <form
          onSubmit={logManual}
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
              step="any"
              min="0"
              inputMode="decimal"
              value={km}
              onChange={(e) => setKm(e.target.value)}
              placeholder="5.05"
              className={`${fieldClass} h-10 w-24 py-1`}
            />
          </Field>
          <Field label="Time (min : sec)">
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
          {previewPace && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs uppercase tracking-wider text-muted">Pace</span>
              <span className="flex h-10 items-center text-sm font-semibold tabular-nums text-fg/90">
                {previewPace} /km
              </span>
            </div>
          )}
          <PressButton
            type="submit"
            className="flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-black transition hover:bg-white/90"
          >
            <Plus size={15} />
            Log run
          </PressButton>
        </form>

        {/* Recent — last two by default, expandable */}
        {runs.length > 0 && (
          <ul className="mt-5 space-y-2">
            {runs.slice(0, showAll ? 12 : 2).map((r) => (
              <li
                key={r.id}
                className="group flex items-center justify-between border-t border-line pt-2 text-sm first:border-0 first:pt-0"
              >
                <span className="flex items-center gap-2 text-fg/90">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{
                      backgroundColor:
                        r.source === "strava" ? ORANGE : "rgba(255,255,255,0.4)",
                    }}
                    title={r.source === "strava" ? "Strava" : "Manual"}
                  />
                  {new Date(r.date).toLocaleDateString([], {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                <span className="flex items-center gap-3 text-muted">
                  <span className="tabular-nums text-fg/90">
                    {r.distance_km.toFixed(1)} km
                  </span>
                  <span className="tabular-nums">
                    {paceFromDuration(r.distance_km, r.duration_s)} /km
                  </span>
                  {r.source === "manual" && (
                    <button
                      onClick={() => removeManual(r.id)}
                      className="rounded p-1 text-muted opacity-0 transition hover:text-red-400 group-hover:opacity-100"
                      aria-label="Delete run"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}

        {runs.length > 2 && (
          <button
            onClick={() => setShowAll((v) => !v)}
            className="mt-3 w-full rounded-xl border border-line py-2 text-xs text-muted transition hover:text-fg"
          >
            {showAll ? t("Hide") : t("Show {n} more", { n: runs.length - 2 })}
          </button>
        )}

        {note && <p className="mt-4 text-xs text-muted">{note}</p>}
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
      <span className="text-xs uppercase tracking-wider text-muted">{label}</span>
      {children}
    </label>
  );
}
