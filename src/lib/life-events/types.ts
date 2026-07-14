// ISA — Life Intelligence Engine · Event System (Layers 1–2)
// The normalized, immutable, provenance-bearing record of one meaningful life
// action. This is the single source of truth every higher layer reasons over.
// See docs/ISA_LIFE_INTELLIGENCE_ENGINE.md §5.
//
// Design law: rich schema, minimal logic. The fields are the contract that lets
// future Analytics / Recommendation / Prediction engines exist — but no such
// engine is built here. Nothing in this module is consumed by the UI yet.

/** Every module that can produce a Life Event. Extending ISA with a new module
 *  = adding a member here + its event types in taxonomy.ts. Nothing else. */
export type SourceModule =
  | "tasks"
  | "money"
  | "goals"
  | "projects"
  | "habits"
  | "focus"
  | "journal"
  | "calendar"
  | "prayer"
  | "energy" // sleep / mood / energy — the well-being substrate
  | "health" // running / physical activity
  | "ideas"
  | "system"; // recurring jobs, syncs, meta-events

/** Who caused the event. Absence-aware reasoning treats these differently
 *  (a missed user action ≠ a system no-op). LIE §5.2. */
export type Actor = "user" | "system" | "recurring";

/** Direction relative to the person's goals and values. LIE §5.2. */
export type Valence = "positive" | "neutral" | "negative" | "ambiguous";

/** Attention & memory weight, judged relative to the individual. LIE §5.3. */
export type Importance = "trivial" | "notable" | "significant" | "pivotal";

/** How sure the Engine is about a computed value. Honesty is structural:
 *  a low-confidence magnitude is never dressed up as certain. */
export type Confidence = "low" | "high";

/** The event graph (LIE §5.4). Soft references by entity id — never hard FKs,
 *  so the append-only log stays honest even if the linked entity is deleted. */
export type EventLinks = {
  goalIds?: string[];
  habitIds?: string[];
  taskIds?: string[];
  transactionIds?: string[];
  financeGoalIds?: string[];
  noteIds?: string[]; // ideas / journal entries
  eventIds?: string[]; // prior related life_events (causal / explanatory chain)
};

/** Derived time lenses for one moment (user-local). Feeds Context Layers (§6). */
export type TimeContext = {
  localDate: string; // YYYY-MM-DD, user-local (matches the app's local-date convention)
  dayOfWeek: number; // 0=Sun … 6=Sat
  hour: number; // 0..23
  partOfDay: "morning" | "afternoon" | "evening" | "night";
  isWeekend: boolean;
};

/** The person's capacity at the moment the event happened, when known.
 *  Every field is nullable — absence is information, not failure (§5.1). */
export type UserStateSnapshot = {
  energyScore?: number | null; // 0..100 (daily_energy_scores)
  mood?: number | null; // 1..5 (mood_logs)
  sleepHours?: number | null; // last night's sleep
};

export type EventMetadata = {
  location?: string | null; // optional, coarse; privacy-respecting
  timeContext: TimeContext;
  userState?: UserStateSnapshot | null;
};

/** Signals the event CARRIES for later intelligence layers. They are hooks —
 *  tags and a relevance score — not the output of any engine (none exists yet).
 *  LIE §11 (generators consume these downstream). */
export type EventIntelligence = {
  aiRelevance: number; // 0..1 — is this worth surfacing to higher layers later?
  patternSignals: string[]; // tags a future pattern-detector can group on
  recommendationSignals: string[]; // hints a future recommender can act on
  predictionSignals: string[]; // hints a future predictor can use
};

/** A full Life Event as stored. `id` and `created_at` are assigned by the DB. */
export type LifeEvent = {
  // ── Core identity (§5.2) ──
  id: string;
  user_id: string;
  event_type: string; // a LifeEventType key (kept as text at the storage boundary)
  source_module: SourceModule;
  actor: Actor;
  occurred_at: string; // when it happened in the person's life (ISO)
  created_at: string; // when ISA recorded it (ISO, DB default)

  // ── Meaning (§5.2–5.3) ──
  category: string;
  importance: Importance;
  magnitude: number; // 0..1, size relative to this person's baseline
  valence: Valence;
  emotional_impact: number | null; // -1..1 felt tone, or null when honestly unknown

  // ── Relationships — the graph (§5.4) ──
  links: EventLinks;

  // ── Context (§6) ──
  payload: Record<string, unknown>; // domain-specific facts
  metadata: EventMetadata;
  provenance: string; // raw source, for explainability

  // ── Future intelligence (§11) — carried, not yet consumed ──
  intelligence: EventIntelligence;

  // ── Explainability (Honesty / Reasoning Transparency) ──
  reasons: string[]; // why importance/magnitude/valence came out as they did
};

/** What we hand Supabase on insert — the DB fills id + created_at. */
export type NewLifeEvent = Omit<LifeEvent, "id" | "created_at">;
