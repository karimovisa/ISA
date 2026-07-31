// ISA — Sleep intelligence (morning-first). Pure helpers only: estimate last
// night from the user's OWN history, map quality to the 4-emoji scale, and label
// a record's provenance. Never fabricates — estimateSleep returns null when
// there isn't enough real history, so the card shows "no data", not a guess.
//
// Priority when several sources could describe one night:
//   health_data > manual > estimated   (health_data is future; see sleep-source-schema.sql)

import type { SleepLog, SleepSource } from "./types";

// ── Quality: the 4 taps on the card ↔ the 1..5 `quality` column ──
export type SleepQuality = { value: number; emoji: string; label: string };

// English `label`s are i18n keys (see i18n.tsx). `value` is what lands in the DB.
export const SLEEP_QUALITIES: SleepQuality[] = [
  { value: 1, emoji: "😴", label: "Slept badly" },
  { value: 3, emoji: "😐", label: "Slept okay" },
  { value: 4, emoji: "🙂", label: "Slept well" },
  { value: 5, emoji: "😌", label: "Slept great" },
];

/** Map a stored 1..5 quality back to the nearest card option (legacy rows may be
 *  any value in 1..5). */
export function qualityOption(q: number | null | undefined): SleepQuality | null {
  if (!q) return null;
  if (q <= 1) return SLEEP_QUALITIES[0];
  if (q <= 3) return SLEEP_QUALITIES[1];
  if (q === 4) return SLEEP_QUALITIES[2];
  return SLEEP_QUALITIES[3];
}

// ── Estimate ──
export type SleepEstimate = {
  bedClock: string; // "23:40"
  wakeClock: string; // "07:20"
  durationMin: number; // 460
};

const MIN_SAMPLES = 3; // fewer than this → we don't pretend to know
const LOOKBACK_DAYS = 30;
const MAX_SAMPLES = 14;

const clockOf = (iso: string): number => {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
};
const fmtClock = (min: number): string => {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/**
 * Estimate last night from the user's OWN real records (never from prior
 * estimates). Averages bedtime and wake clock-times over recent history and
 * returns null when there isn't enough signal. Bedtimes before noon are treated
 * as after-midnight so late nights cluster instead of averaging toward midday.
 */
export function estimateSleep(logs: SleepLog[], now = new Date()): SleepEstimate | null {
  const cutoff = now.getTime() - LOOKBACK_DAYS * 86_400_000;
  const real = logs
    .filter(
      (l) =>
        l.sleep_start &&
        l.sleep_end &&
        l.source !== "estimated" &&
        !l.is_estimated &&
        new Date(l.date).getTime() >= cutoff
    )
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, MAX_SAMPLES);

  if (real.length < MIN_SAMPLES) return null;

  const bedShifted = real.map((l) => {
    const m = clockOf(l.sleep_start!);
    return m < 720 ? m + 1440 : m; // before noon → previous night's bedtime
  });
  const wakeMins = real.map((l) => clockOf(l.sleep_end!));

  const bedAvg = (((Math.round(mean(bedShifted)) % 1440) + 1440) % 1440);
  const wakeAvg = Math.round(mean(wakeMins));
  const durationMin = (((wakeAvg - bedAvg) % 1440) + 1440) % 1440;

  return { bedClock: fmtClock(bedAvg), wakeClock: fmtClock(wakeAvg), durationMin };
}

// ── Shared helpers ──
export const splitDuration = (min: number): { h: number; m: number } => ({
  h: Math.floor(min / 60),
  m: Math.round(min % 60),
});

/** i18n key describing a record's provenance (shown after the duration). */
export function sourceLabelKey(source: SleepSource | null, isEstimated: boolean): string | null {
  if (isEstimated || source === "estimated") return "estimated";
  if (source === "manual") return "manually entered";
  return null; // health_data / unknown → no qualifier
}

/** Local "HH:MM" from a stored ISO timestamp. */
export const isoToClock = (iso: string): string => fmtClock(clockOf(iso));

/**
 * Turn clock times ("23:40" → "07:20") into concrete ISO timestamps around a
 * wake date. If bedtime reads later on the clock than wake, it was the night
 * before. duration is derived from the real span, so it crosses midnight safely.
 */
export function clocksToTimestamps(
  wakeDateISO: string,
  bedClock: string,
  wakeClock: string
): { sleepStart: string; sleepEnd: string; durationMin: number } {
  const [bh, bm] = bedClock.split(":").map(Number);
  const [wh, wm] = wakeClock.split(":").map(Number);
  const prevNight = bh * 60 + bm > wh * 60 + wm;

  const wake = new Date(`${wakeDateISO}T${wakeClock}:00`); // parsed as local time
  const bed = new Date(`${wakeDateISO}T${bedClock}:00`);
  if (prevNight) bed.setDate(bed.getDate() - 1);

  const durationMin = Math.max(0, Math.round((wake.getTime() - bed.getTime()) / 60000));
  return { sleepStart: bed.toISOString(), sleepEnd: wake.toISOString(), durationMin };
}
