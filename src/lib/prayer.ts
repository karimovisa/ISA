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

/** "HH:MM[:SS]" → minutes since midnight. */
export function toMin(t: string): number {
  const [h, m] = t.split(":");
  return Number(h) * 60 + Number(m);
}

/** Window [start,end) in minutes for each prayer. Xufton runs past midnight
 *  (end > 1440), using the next day's bomdod (≈ today's bomdod) as the edge. */
export function windowOf(
  name: PrayerName,
  t: PrayerTimes
): { start: number; end: number } {
  switch (name) {
    case "bomdod":
      return { start: toMin(t.bomdod), end: toMin(t.quyosh) };
    case "peshin":
      return { start: toMin(t.peshin), end: toMin(t.asr) };
    case "asr":
      return { start: toMin(t.asr), end: toMin(t.shom) };
    case "shom":
      return { start: toMin(t.shom), end: toMin(t.xufton) };
    case "xufton":
      return { start: toMin(t.xufton), end: toMin(t.bomdod) + 1440 };
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
