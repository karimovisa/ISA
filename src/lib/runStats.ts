import type { RunLog, StravaActivityRow } from "@/lib/types";

/** Pace "m:ss /km" from distance (km) + duration (s). */
export function paceFromDuration(km: number, sec: number): string {
  if (!km || km <= 0 || !sec || sec <= 0) return "—";
  const secPerKm = sec / km;
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Insights over manually-logged runs (RunLog rows). */
export function manualRunInsights(runs: RunLog[]): RunInsights {
  const totalKm = runs.reduce((s, r) => s + r.distance_km, 0);
  const totalSec = runs.reduce((s, r) => s + (r.duration_s ?? 0), 0);
  const monday = weekStart(new Date());
  const lastMonday = monday - 7 * 86_400_000;

  const kmIn = (from: number, to: number) =>
    runs
      .filter((r) => {
        const t = new Date(r.log_date).getTime();
        return t >= from && t < to;
      })
      .reduce((s, r) => s + r.distance_km, 0);

  const thisWeekKm = kmIn(monday, Date.now() + 86_400_000);
  const lastWeekKm = kmIn(lastMonday, monday);
  const longestKm = runs.reduce((m, r) => Math.max(m, r.distance_km), 0);

  return {
    totalRuns: runs.length,
    totalKm: +totalKm.toFixed(1),
    thisWeekKm: +thisWeekKm.toFixed(1),
    lastWeekKm: +lastWeekKm.toFixed(1),
    weekTrendPct:
      lastWeekKm > 0
        ? Math.round(((thisWeekKm - lastWeekKm) / lastWeekKm) * 100)
        : null,
    avgPace: paceFromDuration(totalKm, totalSec),
    longestKm: +longestKm.toFixed(1),
  };
}

/** Last-7-days daily km buckets from RunLog rows. */
export function manualLast7DaysKm(runs: RunLog[]): { day: string; km: number }[] {
  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const out: { day: string; km: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toDateString();
    const km = runs
      .filter((r) => new Date(r.log_date).toDateString() === key)
      .reduce((s, r) => s + r.distance_km, 0);
    out.push({ day: labels[d.getDay()], km: +km.toFixed(1) });
  }
  return out;
}

/** Pace as "m:ss /km" from Strava average_speed (m/s). */
export function paceLabel(speedMps: number): string {
  if (!speedMps || speedMps <= 0) return "—";
  const secPerKm = 1000 / speedMps;
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function weekStart(d: Date): number {
  const day = (d.getDay() + 6) % 7; // Monday = 0
  const s = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
  return s.getTime();
}

export type RunInsights = {
  totalRuns: number;
  totalKm: number;
  thisWeekKm: number;
  lastWeekKm: number;
  weekTrendPct: number | null;
  avgPace: string;
  longestKm: number;
};

export function runInsights(runs: StravaActivityRow[]): RunInsights {
  const totalM = runs.reduce((s, r) => s + r.distance_m, 0);
  const thisWk = weekStart(new Date());
  const lastWk = thisWk - 7 * 86_400_000;

  const kmIn = (from: number, to: number) =>
    runs
      .filter((r) => {
        const t = new Date(r.start_date).getTime();
        return t >= from && t < to;
      })
      .reduce((s, r) => s + r.distance_m, 0) / 1000;

  const thisWeekKm = kmIn(thisWk, Date.now() + 86_400_000);
  const lastWeekKm = kmIn(lastWk, thisWk);

  // Distance-weighted average speed → representative pace.
  const totalTime = runs.reduce((s, r) => s + r.moving_time_s, 0);
  const avgSpeed = totalTime > 0 ? totalM / totalTime : 0;

  const longestKm = runs.reduce((m, r) => Math.max(m, r.distance_m), 0) / 1000;

  return {
    totalRuns: runs.length,
    totalKm: +(totalM / 1000).toFixed(1),
    thisWeekKm: +thisWeekKm.toFixed(1),
    lastWeekKm: +lastWeekKm.toFixed(1),
    weekTrendPct:
      lastWeekKm > 0
        ? Math.round(((thisWeekKm - lastWeekKm) / lastWeekKm) * 100)
        : null,
    avgPace: paceLabel(avgSpeed),
    longestKm: +longestKm.toFixed(1),
  };
}

/** Last-7-days daily km buckets for a chart. */
export function last7DaysKm(runs: StravaActivityRow[]): { day: string; km: number }[] {
  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const out: { day: string; km: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toDateString();
    const km =
      runs
        .filter((r) => new Date(r.start_date).toDateString() === key)
        .reduce((s, r) => s + r.distance_m, 0) / 1000;
    out.push({ day: labels[d.getDay()], km: +km.toFixed(1) });
  }
  return out;
}
