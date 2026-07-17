// ISA — Progressive disclosure. A new account doesn't meet all of ISA at once:
// modules surface over the first week, each explaining WHY it just became useful.
//
// Guided, never locked. Every gated module offers "open it anyway" — ISA advises,
// the human decides. Accounts older than the last unlock day (i.e. every existing
// user) see everything automatically; no special-casing needed.

export type ModuleKey =
  | "goals" | "habits" | "focus" | "journal" | "ideas"
  | "running" | "prayer" | "money" | "calendar" | "projects" | "progress";

/** Day the module appears on (0 = from the first minute). */
export const UNLOCK_DAY: Record<ModuleKey, number> = {
  goals: 0, habits: 0, focus: 0,
  journal: 1, ideas: 1,
  running: 2, prayer: 2,
  money: 3,
  calendar: 4,
  projects: 5,
  progress: 6,
};

/** Why this module is worth opening now — shown on the unlock card. */
export const UNLOCK_WHY: Record<ModuleKey, string> = {
  goals: "Set the direction — everything else measures against it.",
  habits: "The small daily actions that compound into the goals.",
  focus: "Deep work is where the goals actually move.",
  journal: "ISA now has a few days of actions — your words explain the why behind them.",
  ideas: "Somewhere to catch a thought before it fades.",
  running: "ISA can now start connecting movement to your energy and mood.",
  prayer: "Your day already has a shape — this anchors it.",
  money: "ISA now knows your rhythm, so it can begin understanding your spending.",
  calendar: "With habits and goals in place, ISA can see how your time collides with them.",
  projects: "Bigger than a goal? Projects hold the steps, notes and links.",
  progress: "There's finally enough history to show how you're actually changing.",
};

const OVERRIDE_KEY = "isa_unlocked_early";

const readOverrides = (): string[] => {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(OVERRIDE_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
};

/** Open a module ahead of schedule — the user's call, remembered locally. */
export function unlockEarly(key: ModuleKey): void {
  if (typeof window === "undefined") return;
  const next = [...new Set([...readOverrides(), key])];
  window.localStorage.setItem(OVERRIDE_KEY, JSON.stringify(next));
}

/** Whole days since the account was created. */
export function accountAgeDays(createdAt: string | undefined | null): number {
  if (!createdAt) return 999; // unknown → never gate
  const ms = Date.now() - new Date(createdAt).getTime();
  if (Number.isNaN(ms)) return 999;
  return Math.max(0, Math.floor(ms / 86_400_000));
}

export function isUnlocked(key: ModuleKey, ageDays: number, overrides: string[]): boolean {
  return ageDays >= UNLOCK_DAY[key] || overrides.includes(key);
}

/** Modules that became available exactly today — for the "🔓 unlocked" nudge. */
export function unlockedOn(ageDays: number): ModuleKey[] {
  return (Object.keys(UNLOCK_DAY) as ModuleKey[]).filter((k) => UNLOCK_DAY[k] === ageDays);
}

/** The next module still ahead, if any. */
export function nextUnlock(ageDays: number, overrides: string[]): { key: ModuleKey; inDays: number } | null {
  const pending = (Object.keys(UNLOCK_DAY) as ModuleKey[])
    .filter((k) => !isUnlocked(k, ageDays, overrides))
    .sort((a, b) => UNLOCK_DAY[a] - UNLOCK_DAY[b]);
  const k = pending[0];
  return k ? { key: k, inDays: UNLOCK_DAY[k] - ageDays } : null;
}

export const readUnlockOverrides = readOverrides;

/** Map a route to its module, so nav and pages can gate consistently. */
export const ROUTE_MODULE: Record<string, ModuleKey> = {
  "/goals": "goals",
  "/habits": "habits",
  "/focus": "focus",
  "/journal": "journal",
  "/ideas": "ideas",
  "/money": "money",
  "/calendar": "calendar",
  "/projects": "projects",
  "/progress": "progress",
  "/pray": "prayer",
};
