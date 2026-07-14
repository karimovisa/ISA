// ISA — Life Intelligence Engine · Event Taxonomy
// One registry: every event type ISA understands, keyed by name, each carrying
// intrinsic metadata. This is the ONLY place to touch when adding a module —
// add a SourceModule member (types.ts) and its event types here.
//
// baseWeight  = intrinsic significance (0..1) BEFORE personalization. A cold
//               event with no history falls back to this, honestly flagged.
// valenceHint = default direction; overridden by the event's real outcome.

import type { SourceModule, Valence } from "./types";

export type EventTypeDef = {
  module: SourceModule;
  category: string;
  baseWeight: number;
  valenceHint: Valence;
};

export const LIFE_EVENT_TYPES = {
  // ── Tasks ──
  TaskCreated: { module: "tasks", category: "intent", baseWeight: 0.15, valenceHint: "neutral" },
  TaskCompleted: { module: "tasks", category: "follow-through", baseWeight: 0.3, valenceHint: "positive" },
  TaskFailed: { module: "tasks", category: "follow-through", baseWeight: 0.4, valenceHint: "negative" },
  TaskDelayed: { module: "tasks", category: "follow-through", baseWeight: 0.3, valenceHint: "negative" },
  DayCleared: { module: "tasks", category: "milestone", baseWeight: 0.5, valenceHint: "positive" },

  // ── Money ──
  IncomeReceived: { module: "money", category: "cash-flow", baseWeight: 0.4, valenceHint: "positive" },
  ExpenseCreated: { module: "money", category: "spending", baseWeight: 0.2, valenceHint: "neutral" },
  BudgetExceeded: { module: "money", category: "pressure", baseWeight: 0.55, valenceHint: "negative" },
  SavingGoalProgress: { module: "money", category: "goal-funding", baseWeight: 0.4, valenceHint: "positive" },
  SpendingSpike: { module: "money", category: "spending", baseWeight: 0.5, valenceHint: "negative" },
  RecurringPaymentPaid: { module: "money", category: "obligation", baseWeight: 0.2, valenceHint: "neutral" },

  // ── Goals ──
  GoalCreated: { module: "goals", category: "direction", baseWeight: 0.4, valenceHint: "positive" },
  GoalProgressUpdated: { module: "goals", category: "momentum", baseWeight: 0.35, valenceHint: "positive" },
  GoalCompleted: { module: "goals", category: "milestone", baseWeight: 0.85, valenceHint: "positive" },
  GoalStalled: { module: "goals", category: "drift", baseWeight: 0.5, valenceHint: "negative" },
  GoalAbandoned: { module: "goals", category: "milestone", baseWeight: 0.6, valenceHint: "ambiguous" },

  // ── Projects (goals-at-scale) ──
  ProjectCreated: { module: "projects", category: "direction", baseWeight: 0.35, valenceHint: "positive" },
  ProjectTaskCompleted: { module: "projects", category: "momentum", baseWeight: 0.25, valenceHint: "positive" },
  ProjectCompleted: { module: "projects", category: "milestone", baseWeight: 0.8, valenceHint: "positive" },
  ProjectStatusChanged: { module: "projects", category: "lifecycle", baseWeight: 0.3, valenceHint: "neutral" },
  ProjectArchived: { module: "projects", category: "lifecycle", baseWeight: 0.3, valenceHint: "neutral" },
  ProjectStepAdded: { module: "projects", category: "momentum", baseWeight: 0.2, valenceHint: "neutral" },
  ProjectGoalLinked: { module: "projects", category: "connection", baseWeight: 0.35, valenceHint: "positive" },
  ProjectGoalUnlinked: { module: "projects", category: "connection", baseWeight: 0.2, valenceHint: "neutral" },
  ProjectIdeaLinked: { module: "projects", category: "connection", baseWeight: 0.3, valenceHint: "positive" },
  ProjectNoteAdded: { module: "projects", category: "note", baseWeight: 0.2, valenceHint: "neutral" },
  ProjectDeadlineChanged: { module: "projects", category: "lifecycle", baseWeight: 0.25, valenceHint: "neutral" },

  // ── Habits ──
  HabitCompleted: { module: "habits", category: "consistency", baseWeight: 0.2, valenceHint: "positive" },
  HabitMissed: { module: "habits", category: "consistency", baseWeight: 0.3, valenceHint: "negative" },
  StreakChanged: { module: "habits", category: "consistency", baseWeight: 0.3, valenceHint: "neutral" },
  StreakBroken: { module: "habits", category: "consistency", baseWeight: 0.45, valenceHint: "negative" },

  // ── Focus ──
  FocusSessionCompleted: { module: "focus", category: "deep-work", baseWeight: 0.3, valenceHint: "positive" },
  FocusInterrupted: { module: "focus", category: "deep-work", baseWeight: 0.3, valenceHint: "negative" },
  DeepWorkStreak: { module: "focus", category: "milestone", baseWeight: 0.5, valenceHint: "positive" },

  // ── Journal / Notes ──
  JournalCreated: { module: "journal", category: "reflection", baseWeight: 0.3, valenceHint: "positive" },
  ReflectionAdded: { module: "journal", category: "reflection", baseWeight: 0.3, valenceHint: "positive" },
  NoteCaptured: { module: "ideas", category: "thought", baseWeight: 0.15, valenceHint: "neutral" },
  NotePromoted: { module: "ideas", category: "thought", baseWeight: 0.4, valenceHint: "positive" },
  IdeaStatusChanged: { module: "ideas", category: "lifecycle", baseWeight: 0.25, valenceHint: "neutral" },
  IdeaFavorited: { module: "ideas", category: "signal", baseWeight: 0.2, valenceHint: "positive" },
  IdeaArchived: { module: "ideas", category: "lifecycle", baseWeight: 0.2, valenceHint: "neutral" },
  IdeaRestored: { module: "ideas", category: "lifecycle", baseWeight: 0.2, valenceHint: "positive" },
  IdeaConvertedToGoal: { module: "ideas", category: "evolution", baseWeight: 0.55, valenceHint: "positive" },
  IdeaConvertedToProject: { module: "ideas", category: "evolution", baseWeight: 0.55, valenceHint: "positive" },
  IdeaConvertedToTask: { module: "ideas", category: "evolution", baseWeight: 0.4, valenceHint: "positive" },
  IdeaLinkedToGoal: { module: "ideas", category: "connection", baseWeight: 0.35, valenceHint: "positive" },
  IdeaLinkedToProject: { module: "ideas", category: "connection", baseWeight: 0.35, valenceHint: "positive" },

  // ── Calendar ──
  EventCreated: { module: "calendar", category: "commitment", baseWeight: 0.2, valenceHint: "neutral" },
  ImportantDateReached: { module: "calendar", category: "milestone", baseWeight: 0.55, valenceHint: "neutral" },

  // ── Prayer ──
  PrayerCompleted: { module: "prayer", category: "practice", baseWeight: 0.25, valenceHint: "positive" },
  PrayerMissed: { module: "prayer", category: "practice", baseWeight: 0.35, valenceHint: "negative" },
  PrayerLate: { module: "prayer", category: "practice", baseWeight: 0.3, valenceHint: "neutral" },
  PerfectPrayerDay: { module: "prayer", category: "milestone", baseWeight: 0.5, valenceHint: "positive" },
  PerfectPrayerWeek: { module: "prayer", category: "milestone", baseWeight: 0.7, valenceHint: "positive" },
  PrayerStreakStarted: { module: "prayer", category: "consistency", baseWeight: 0.3, valenceHint: "positive" },
  PrayerStreakBroken: { module: "prayer", category: "consistency", baseWeight: 0.35, valenceHint: "negative" },
  PrayerReminderEnabled: { module: "prayer", category: "settings", baseWeight: 0.15, valenceHint: "neutral" },
  PrayerReminderDisabled: { module: "prayer", category: "settings", baseWeight: 0.15, valenceHint: "neutral" },

  // ── Energy / well-being (the substrate everything runs on) ──
  SleepLogged: { module: "energy", category: "recovery", baseWeight: 0.25, valenceHint: "neutral" },
  EnergyScored: { module: "energy", category: "capacity", baseWeight: 0.25, valenceHint: "neutral" },
  MoodLogged: { module: "energy", category: "emotion", baseWeight: 0.25, valenceHint: "neutral" },
  LowEnergyDay: { module: "energy", category: "capacity", baseWeight: 0.45, valenceHint: "negative" },
  RecoveryDay: { module: "energy", category: "recovery", baseWeight: 0.4, valenceHint: "positive" },

  // ── Health / physical ──
  RunLogged: { module: "health", category: "activity", baseWeight: 0.3, valenceHint: "positive" },
  ActivityStreak: { module: "health", category: "milestone", baseWeight: 0.5, valenceHint: "positive" },
  InactivityGap: { module: "health", category: "activity", baseWeight: 0.4, valenceHint: "negative" },

  // ── System / meta (feeds the learning loop; produces no user noise) ──
  WeeklyReviewGenerated: { module: "system", category: "reflection", baseWeight: 0.4, valenceHint: "neutral" },
  DataExported: { module: "system", category: "ownership", baseWeight: 0.2, valenceHint: "neutral" },
} as const satisfies Record<string, EventTypeDef>;

/** The set of event names ISA understands. Used to validate every capture. */
export type LifeEventType = keyof typeof LIFE_EVENT_TYPES;

/** Milestone types are pivotal in a life's story once they carry real weight —
 *  they short-circuit the magnitude→importance bands. */
export const MILESTONE_TYPES: ReadonlySet<LifeEventType> = new Set<LifeEventType>([
  "GoalCompleted",
  "GoalAbandoned",
  "ProjectCompleted",
  "PerfectPrayerWeek",
  "StreakBroken",
  "DayCleared",
  "DeepWorkStreak",
  "ActivityStreak",
  "ImportantDateReached",
]);

export function isKnownEventType(type: string): type is LifeEventType {
  return Object.prototype.hasOwnProperty.call(LIFE_EVENT_TYPES, type);
}
