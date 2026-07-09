import type { PrayerName, PrayerStatus, PrayerTimes } from "@/lib/types";

export const PRAYERS: PrayerName[] = [
  "bomdod",
  "peshin",
  "asr",
  "shom",
  "xufton",
];

export const PRAYER_LABELS: Record<PrayerName, string> = {
  bomdod: "Bomdod",
  peshin: "Peshin",
  asr: "Asr",
  shom: "Shom",
  xufton: "Xufton",
};

/**
 * Manual per-prayer offset (in minutes), added on top of the scraped/
 * calculated start time. namozvaqti.uz reports the fiqh-earliest start of
 * each window, but a given jome masjid's jamoat (congregation) azon can be
 * called later — e.g. Peshin's azon at this user's masjid is ~13:00 even
 * though the window technically opens at 12:35, a 25 min gap. Adjust the
 * numbers below if your masjid's timing differs or changes.
 */
export const PRAYER_OFFSET_MIN: Record<PrayerName, number> = {
  bomdod: 0,
  peshin: 25,
  asr: 0,
  shom: 0,
  xufton: 0,
};

/** "HH:MM[:SS]" → minutes since midnight. */
export function toMin(t: string): number {
  const [h, m] = t.split(":");
  return Number(h) * 60 + Number(m);
}

const RAW_FIELD: Record<PrayerName, keyof PrayerTimes> = {
  bomdod: "bomdod",
  peshin: "peshin",
  asr: "asr",
  shom: "shom",
  xufton: "xufton",
};

/** The masjid-adjusted start minute for a prayer (raw scraped time + offset). */
export function adjustedStart(name: PrayerName, t: PrayerTimes): number {
  return toMin(t[RAW_FIELD[name]]) + PRAYER_OFFSET_MIN[name];
}

/** Adjusted start time formatted as "HH:MM", for display. */
export function displayTime(name: PrayerName, t: PrayerTimes): string {
  const min = ((adjustedStart(name, t) % 1440) + 1440) % 1440;
  const h = Math.floor(min / 60).toString().padStart(2, "0");
  const m = (min % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

/** Window [start,end) in minutes for each prayer, using masjid-adjusted
 *  start times throughout. Xufton runs past midnight (end > 1440), using
 *  the next day's bomdod (≈ today's bomdod) as the edge. */
export function windowOf(
  name: PrayerName,
  t: PrayerTimes
): { start: number; end: number } {
  switch (name) {
    case "bomdod":
      return { start: adjustedStart("bomdod", t), end: toMin(t.quyosh) };
    case "peshin":
      return { start: adjustedStart("peshin", t), end: adjustedStart("asr", t) };
    case "asr":
      return { start: adjustedStart("asr", t), end: adjustedStart("shom", t) };
    case "shom":
      return { start: adjustedStart("shom", t), end: adjustedStart("xufton", t) };
    case "xufton":
      return { start: adjustedStart("xufton", t), end: adjustedStart("bomdod", t) + 1440 };
  }
}

/** vaqtida if ticked in the first half of the window, else kechikkan. */
export function statusAt(
  win: { start: number; end: number },
  tickMin: number
): PrayerStatus {
  const half = win.start + (win.end - win.start) / 2;
  return tickMin <= half ? "vaqtida" : "kechikkan";
}

export type PrayerState = "past-done" | "past-missed" | "current" | "future";

/**
 * State of a prayer for the active day, given "now" in minutes since the
 * active day's midnight (may exceed 1440 when we've crossed midnight).
 */
export function prayerState(
  name: PrayerName,
  t: PrayerTimes,
  nowMin: number,
  ticked: boolean
): PrayerState {
  const w = windowOf(name, t);
  if (ticked) return "past-done";
  if (nowMin >= w.end) return "past-missed"; // qazo
  if (nowMin >= w.start) return "current";
  return "future";
}

export const STATUS_TONE: Record<PrayerStatus, string> = {
  vaqtida: "text-emerald-400",
  kechikkan: "text-amber-400",
  qazo: "text-red-400",
};

// DB stores Uzbek enum values; the UI shows these English labels.
export const STATUS_LABEL: Record<PrayerStatus, string> = {
  vaqtida: "on time",
  kechikkan: "late",
  qazo: "missed",
};

/** The next prayer to start, and minutes until it, given "now" in active-day
 *  minutes. After Isha, points to tomorrow's Fajr. */
export function nextPrayer(
  t: PrayerTimes,
  nowMin: number
): { name: PrayerName; inMin: number } {
  for (const name of PRAYERS) {
    const start = windowOf(name, t).start;
    if (start > nowMin) return { name, inMin: start - nowMin };
  }
  return { name: "bomdod", inMin: toMin(t.bomdod) + 1440 - nowMin };
}

export function fmtCountdown(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
