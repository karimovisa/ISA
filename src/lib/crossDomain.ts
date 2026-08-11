// ISA — Cross-domain findings engine (v1). READ-ONLY: it receives rows ISA has
// already fetched and computes threshold-gated, interpreted findings that link
// two life domains. It NEVER fetches, writes, or mutates anything. The engine
// produces the interpretation ([signal] + [direction] + [cross-domain link]);
// Gemini only phrases it. Every finding must clear a confidence bar or it is
// suppressed — never assert a pattern from 1–2 points.
//
// Alignment note (verified against compute_energy_score + SleepCard): a night is
// stored on the WAKE day, and energy(D) is derived from sleep(D). So "a night's
// sleep → the next day's habits" is the SAME stored date D — no extra +1 shift.

export type XDData = {
  sleep: { date: string; hours: number }[];     // duration_hours, wake-day dated
  energy: { date: string; score: number }[];
  completions: string[];                          // one date per completed habit log
  food: { date: string; amount: number }[];       // Food-category expenses
  activeDates: string[];                          // distinct dates with any life_event (login proxy)
};

export type FindingKind = "sleep_habits" | "energy_habits" | "gap_habits" | "energy_food";
export type Finding = { kind: FindingKind; text: string; score: number };

const MIN_OVERLAP = 7;      // days of overlapping data required
const MIN_REPEATS = 3;      // times the condition must recur
const MIN_DROP = 0.20;      // relative effect for the habit findings
const MIN_FOOD_DIFF = 0.25; // relative effect for the spend finding

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

function quantile(values: number[], q: number): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const i = (s.length - 1) * q;
  const lo = Math.floor(i), hi = Math.ceil(i);
  return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (i - lo);
}
function countByDay(dates: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const d of dates) m.set(d, (m.get(d) ?? 0) + 1);
  return m;
}
function sumByDay(rows: { date: string; amount: number }[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.date, (m.get(r.date) ?? 0) + r.amount);
  return m;
}

/** Split a per-day metric by a "low" condition (bottom quantile) vs the rest,
 *  and return the relative drop — or null if any threshold fails. */
function lowVsRest(
  days: { date: string; cond: number }[],
  metricOf: (date: string) => number,
  lowQ: number
): { drop: number; nLow: number; threshold: number } | null {
  if (days.length < MIN_OVERLAP) return null;
  const threshold = quantile(days.map((d) => d.cond), lowQ);
  const low: number[] = []; const rest: number[] = [];
  for (const d of days) (d.cond <= threshold ? low : rest).push(metricOf(d.date));
  if (low.length < MIN_REPEATS || rest.length < 1) return null;
  const mRest = mean(rest);
  if (mRest <= 0) return null;
  return { drop: (mRest - mean(low)) / mRest, nLow: low.length, threshold };
}

function gapFinding(activeDates: string[], completionsByDay: Map<string, number>): Finding | null {
  const active = [...new Set(activeDates)].sort();
  if (active.length < MIN_OVERLAP + 3) return null;
  const baseline = mean(active.map((d) => completionsByDay.get(d) ?? 0));
  if (baseline <= 0) return null;
  const DAY = 86_400_000;
  const postGap: number[] = []; let gaps = 0;
  for (let i = 1; i < active.length; i++) {
    const prev = new Date(`${active[i - 1]}T00:00:00`).getTime();
    const cur = new Date(`${active[i]}T00:00:00`).getTime();
    if (Math.round((cur - prev) / DAY) - 1 >= 3) {
      gaps++;
      for (let k = 0; k < 3 && i + k < active.length; k++) postGap.push(completionsByDay.get(active[i + k]) ?? 0);
    }
  }
  if (gaps < MIN_REPEATS || !postGap.length) return null;
  const drop = (baseline - mean(postGap)) / baseline;
  if (drop < MIN_DROP) return null;
  return { kind: "gap_habits", score: drop,
    text: `After breaks of 3+ days away, your first days back run about ${Math.round(drop * 100)}% below your usual habit pace.` };
}

/** The v1 findings: at most 2, ranked by effect size, each already interpreted.
 *  Pure — no I/O, no mutation. */
export function crossDomainFindings(d: XDData): Finding[] {
  const completionsByDay = countByDay(d.completions);
  const foodByDay = sumByDay(d.food);
  const found: Finding[] = [];

  // X1a — poor sleep → fewer habits (same stored-date; night dated to wake day)
  const s = lowVsRest(d.sleep.map((x) => ({ date: x.date, cond: x.hours })), (dt) => completionsByDay.get(dt) ?? 0, 0.35);
  if (s && s.drop >= MIN_DROP) found.push({ kind: "sleep_habits", score: s.drop,
    text: `After your shorter-sleep nights (under ${s.threshold.toFixed(1)}h), you complete about ${Math.round(s.drop * 100)}% fewer habits (${s.nLow} such days).` });

  // X1b — low energy → fewer habits
  const e = lowVsRest(d.energy.map((x) => ({ date: x.date, cond: x.score })), (dt) => completionsByDay.get(dt) ?? 0, 0.33);
  if (e && e.drop >= MIN_DROP) found.push({ kind: "energy_habits", score: e.drop,
    text: `On your low-energy days, you complete about ${Math.round(e.drop * 100)}% fewer habits (${e.nLow} such days).` });

  // Sleep and energy are one family (energy ≈ 75% sleep-derived): keep the stronger only.
  const fam = found.filter((f) => f.kind === "sleep_habits" || f.kind === "energy_habits");
  if (fam.length === 2) {
    const weaker = fam[0].score < fam[1].score ? fam[0] : fam[1];
    found.splice(found.indexOf(weaker), 1);
  }

  // X3 — low energy → higher food spend (same day)
  const edays = d.energy.map((x) => ({ date: x.date, cond: x.score }));
  if (edays.length >= MIN_OVERLAP) {
    const threshold = quantile(edays.map((x) => x.cond), 0.33);
    const low: number[] = []; const rest: number[] = [];
    for (const x of edays) (x.cond <= threshold ? low : rest).push(foodByDay.get(x.date) ?? 0);
    const nLowWithSpend = low.filter((v) => v > 0).length;
    const mRest = mean(rest);
    if (low.length >= MIN_REPEATS && nLowWithSpend >= MIN_REPEATS && mRest > 0) {
      const diff = (mean(low) - mRest) / mRest;
      if (diff >= MIN_FOOD_DIFF) found.push({ kind: "energy_food", score: diff,
        text: `On your low-energy days, you spend about ${Math.round(diff * 100)}% more on food.` });
    }
  }

  // X2 — time away → habits fall after return
  const gap = gapFinding(d.activeDates, completionsByDay);
  if (gap) found.push(gap);

  return found.sort((a, b) => b.score - a.score).slice(0, 2);
}
