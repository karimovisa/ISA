"use client";

import { useCallback, useEffect, useState } from "react";
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
import { Activity, RefreshCw, ExternalLink } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { GlassCard } from "@/components/ui/GlassCard";
import { PressButton } from "@/components/ui/PressButton";
import { connectStrava, syncStrava } from "@/lib/stravaClient";
import { runInsights, last7DaysKm, paceLabel } from "@/lib/runStats";
import type { StravaActivityRow } from "@/lib/types";

const ORANGE = "#FC4C02";

const tooltipStyle = {
  background: "rgba(20,20,22,0.95)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 12,
  fontSize: 12,
};

export function StravaRunning() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [runs, setRuns] = useState<StravaActivityRow[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: conn } = await supabase
      .from("strava_connections")
      .select("user_id")
      .maybeSingle();
    setConnected(!!conn);
    const { data: acts } = await supabase
      .from("strava_activities")
      .select("*")
      .order("start_date", { ascending: false });
    if (acts) setRuns(acts as StravaActivityRow[]);
  }, []);

  const sync = useCallback(async () => {
    setSyncing(true);
    setNote(null);
    const res = await syncStrava();
    setSyncing(false);
    if (res.error) setNote(`Sync failed: ${res.error}`);
    else {
      setNote(`Imported ${res.imported ?? 0} new run${res.imported === 1 ? "" : "s"}.`);
      await load();
    }
  }, [load]);

  useEffect(() => {
    load();
    // Handle the OAuth return.
    const params = new URLSearchParams(window.location.search);
    const status = params.get("strava");
    if (status) {
      window.history.replaceState({}, "", window.location.pathname);
      if (status === "connected") {
        setNote("Connected to Strava. Importing your runs…");
        sync();
      } else {
        setNote(`Strava connection ${status}.`);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ins = runInsights(runs);
  const chart = last7DaysKm(runs);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <GlassCard className="p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Activity size={18} style={{ color: ORANGE }} />
            <h3 className="text-sm font-medium">Running · Strava</h3>
          </div>
          {connected && (
            <PressButton
              onClick={sync}
              disabled={syncing}
              className="flex items-center gap-2 rounded-full bg-white/8 px-3 py-1.5 text-xs text-white transition-colors hover:bg-white/15 disabled:opacity-50"
            >
              <RefreshCw
                size={13}
                className={syncing ? "animate-spin" : undefined}
              />
              {syncing ? "Syncing…" : "Sync"}
            </PressButton>
          )}
        </div>

        {connected === false && (
          <div className="flex flex-col items-start gap-3 py-4">
            <p className="text-sm text-muted">
              Connect Strava to auto-import your runs and see your pace, weekly
              volume, and trends here.
            </p>
            <PressButton
              onClick={connectStrava}
              className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
              style={{ backgroundColor: ORANGE }}
            >
              <ExternalLink size={15} />
              Connect with Strava
            </PressButton>
          </div>
        )}

        {connected && (
          <>
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

            <div className="mt-6">
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={chart}>
                  <defs>
                    <linearGradient id="stravaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={ORANGE} stopOpacity={0.5} />
                      <stop offset="100%" stopColor={ORANGE} stopOpacity={0} />
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
                    stroke={ORANGE}
                    strokeWidth={2}
                    fill="url(#stravaGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {runs.length > 0 && (
              <ul className="mt-4 space-y-2">
                {runs.slice(0, 5).map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between border-t border-line pt-2 text-sm first:border-0 first:pt-0"
                  >
                    <span className="truncate text-white/90">{r.name}</span>
                    <span className="shrink-0 text-muted">
                      {(r.distance_m / 1000).toFixed(1)} km ·{" "}
                      {paceLabel(r.average_speed)} /km
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
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
