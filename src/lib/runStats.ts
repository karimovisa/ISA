/** Normalized run — both Strava activities and manual logs map onto this. */
export type NormRun = {
  id: string;
  source: "strava" | "manual";
  date: string; // ISO
  distance_km: number;
  duration_s: number;
  name?: string;
};

/** Pace "m:ss /km" from distance (km) + duration (s). */
export function paceFromDuration(km: number, sec: number): string {
  if (!km || km <= 0 || !sec || sec <= 0) return "—";
  const secPerKm = sec / km;
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function weekStart(d: Date): number {
  const day = (d.getDay() + 6) % 7; // Monday = 0
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - day).getTime();
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

export function insightsOf(runs: NormRun[]): RunInsights {
  const totalKm = runs.reduce((s, r) => s + r.distance_km, 0);
  const totalSec = runs.reduce((s, r) => s + r.duration_s, 0);
  const monday = weekStart(new Date());
  const lastMonday = monday - 7 * 86_400_000;

  const kmIn = (from: number, to: number) =>
    runs
      .filter((r) => {
        const t = new Date(r.date).getTime();
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

/** Last-7-days daily km buckets. */
export function last7Of(runs: NormRun[]): { day: string; km: number }[] {
  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const out: { day: string; km: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toDateString();
    const km = runs
      .filter((r) => new Date(r.date).toDateString() === key)
      .reduce((s, r) => s + r.distance_km, 0);
    out.push({ day: labels[d.getDay()], km: +km.toFixed(1) });
  }
  return out;
}
