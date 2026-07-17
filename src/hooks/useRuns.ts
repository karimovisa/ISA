"use client";

// ISA — the single source of truth for "my runs".
//
// Runs arrive from two places: manual entries (`runs`) and Strava (`strava_activities`).
// Reading only one of them is why 33 synced activities were invisible to Progress,
// the dashboard and Life Coverage — the sync worked, the rest of the app just
// wasn't looking. Everything that asks "did I run?" now asks here.

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { RunLog, StravaActivityRow } from "@/lib/types";

/** One run, whatever its origin. */
export type Run = {
  id: string;
  date: string; // YYYY-MM-DD (local calendar date)
  km: number;
  seconds: number;
  source: "manual" | "strava";
};

const ymd = (iso: string): string => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function mergeRuns(manual: RunLog[], strava: StravaActivityRow[]): Run[] {
  const out: Run[] = [
    ...manual.map((r) => ({
      id: r.id,
      date: r.log_date,
      km: r.distance_km,
      seconds: r.duration_s,
      source: "manual" as const,
    })),
    ...strava.map((a) => ({
      id: `strava-${a.id}`,
      date: ymd(a.start_date),
      km: a.distance_m / 1000,
      seconds: a.moving_time_s,
      source: "strava" as const,
    })),
  ];
  // A manual entry and a Strava import of the same session would double-count the
  // day, so keep one run per (date, rounded km) — Strava wins as the measured one.
  const seen = new Set<string>();
  return out
    .sort((a, b) => (a.source === b.source ? 0 : a.source === "strava" ? -1 : 1))
    .filter((r) => {
      const key = `${r.date}:${r.km.toFixed(1)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

/** Every run the user has, manual + Strava, newest first. */
export function useRuns(): { runs: Run[]; loading: boolean } {
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [{ data: m }, { data: s }] = await Promise.all([
        supabase.from("runs").select("*"),
        supabase.from("strava_activities").select("*"),
      ]);
      if (alive) {
        setRuns(mergeRuns((m as RunLog[]) ?? [], (s as StravaActivityRow[]) ?? []));
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return { runs, loading };
}
