// ISA — Life Coverage. Not a productivity score: it answers "how much of my life
// does ISA actually see?". The engine's insights are only as good as its inputs,
// so this makes the gaps honest and shows what each missing area would unlock.

export type CoverageKey =
  | "goals" | "habits" | "focus" | "journal" | "money" | "sleep" | "mood" | "running";

export type CoverageArea = {
  key: CoverageKey;
  label: string; // an i18n key
  covered: boolean;
  href: string;
  /** What ISA can understand once this area has data — an i18n key. */
  unlocks: string;
};

export type Coverage = {
  pct: number;
  covered: number;
  total: number;
  areas: CoverageArea[];
  missing: CoverageArea[];
};

/** Counts the caller already has loaded — no extra reads. */
export type CoverageInput = {
  goals: number;
  habits: number;
  focusSessions: number;
  journalEntries: number;
  transactions: number;
  sleepLogs: number;
  moodLogs: number;
  runs: number;
};

const AREAS: { key: CoverageKey; label: string; href: string; unlocks: string; of: keyof CoverageInput }[] = [
  { key: "goals", label: "Goals", href: "/goals", of: "goals", unlocks: "What you're aiming at — everything else is measured against it." },
  { key: "habits", label: "Habits", href: "/habits", of: "habits", unlocks: "Your consistency, streaks and which days you tend to slip." },
  { key: "focus", label: "Focus", href: "/focus", of: "focusSessions", unlocks: "When your deep work actually happens — and what protects it." },
  { key: "journal", label: "Journal", href: "/journal", of: "journalEntries", unlocks: "The why behind the numbers, in your own words." },
  { key: "money", label: "Money", href: "/money", of: "transactions", unlocks: "Where your money goes and how it affects your goals." },
  { key: "sleep", label: "Sleep", href: "/", of: "sleepLogs", unlocks: "The root cause behind most good and bad days." },
  { key: "mood", label: "Mood", href: "/journal", of: "moodLogs", unlocks: "How you actually felt — the link between life and output." },
  { key: "running", label: "Running", href: "/progress", of: "runs", unlocks: "How movement changes your energy and mood." },
];

export function computeCoverage(input: CoverageInput): Coverage {
  const areas: CoverageArea[] = AREAS.map((a) => ({
    key: a.key,
    label: a.label,
    href: a.href,
    unlocks: a.unlocks,
    covered: (input[a.of] ?? 0) > 0,
  }));
  const covered = areas.filter((a) => a.covered).length;
  return {
    pct: Math.round((covered / areas.length) * 100),
    covered,
    total: areas.length,
    areas,
    missing: areas.filter((a) => !a.covered),
  };
}

/** How much ISA can be trusted at this coverage — honest, never overstated. */
export function coverageVerdict(pct: number): string {
  if (pct >= 85) return "ISA sees the whole picture — its patterns and predictions are at their strongest.";
  if (pct >= 60) return "ISA understands most of your life. Filling the gaps sharpens its insights.";
  if (pct >= 35) return "ISA is still learning you. More areas mean fewer guesses.";
  return "ISA barely knows you yet. Each area you add makes its insights real rather than generic.";
}
