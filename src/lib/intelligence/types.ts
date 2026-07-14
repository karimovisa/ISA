// ISA — Intelligence Layer · Shared contract
// The vocabulary every engine in this subsystem speaks. Nothing here calls a
// model or the network; these are the shapes that carry DECISIONS, COACHING,
// PRIORITIES, PREDICTIONS and SCORES — each one traceable back to real Events,
// Memories, Patterns and Reviews via its Explanation.
//
// Design law (mirrors the AI Foundation): rich, explainable shapes; honesty is
// structural. A value we cannot support with evidence is null, never faked.

/** The product's module surface. Superset of the Event Engine's SourceModule
 *  with the two view-only
 *  surfaces (dashboard, progress) and the user-facing name for health ("running"). */
export type IntelModule =
  | "dashboard"
  | "goals"
  | "projects"
  | "habits"
  | "focus"
  | "journal"
  | "money"
  | "prayer"
  | "running"
  | "calendar"
  | "ideas"
  | "progress"
  | "energy"
  | "tasks";

/** A 0..1 certainty. Used everywhere so callers never guess the scale. */
export type Confidence = number;

/** Attention tier for anything the user might act on. */
export type Priority = "critical" | "high" | "medium" | "low";

/** Directional risk for a forecast. */
export type Risk = "low" | "moderate" | "high";

/** Which way a value is moving over its recent history. */
export type Trend = "rising" | "steady" | "falling" | "unknown";

// ─────────────────────────── EXPLAINABILITY ───────────────────────────

/** One concrete thing an output points back to. The bridge from a decision to
 *  the raw record in the Foundation that justifies it. */
export type EvidenceRef = {
  kind: "event" | "memory" | "insight" | "review" | "score" | "pattern";
  id?: string; // the Foundation row id when there is one
  label: string; // human-readable ("3× your usual run distance")
  detail?: string;
};

/** What KIND of statement an output is — the user must always know whether they
 *  are hearing a fact, a repeated pattern, an unconfirmed inference, or a
 *  proposed action (AI Behavior Rules §6). */
export type ClaimType = "fact" | "pattern" | "assumption" | "recommendation";

/** Attached to EVERY intelligence output. Answers: Why? From which Events,
 *  Memories and Patterns? How confident? When last computed? (Explainability §16) */
export type Explanation = {
  why: string;
  claim: ClaimType;
  evidence: EvidenceRef[];
  confidence: Confidence;
  basedOn: {
    events: number;
    memories: number;
    insights: number;
    patterns: string[];
  };
  lastUpdated: string; // ISO
};

/** A deep link into the app plus the label for its button. */
export type ActionLink = { label: string; deepLink: string };

// ─────────────────────────── RECOMMENDATIONS ───────────────────────────

export type Recommendation = {
  id: string; // deterministic + stable, so dismiss/complete state survives refreshes
  module: IntelModule;
  title: string;
  body: string;
  priority: Priority;
  importance: number; // 0..1
  confidence: Confidence;
  reason: string;
  explanation: Explanation;
  action: ActionLink | null;
  expiresAt: string | null; // ISO; null = no natural expiry
  createdAt: string; // ISO
  category: string; // domain/subject bucket, used by the Decision Engine to dedup
  signals: string[]; // tags the Decision Engine groups & de-conflicts on
};

/** The user's saved verdict on a recommendation — the feedback loop input. */
export type RecommendationState = {
  id: string;
  dismissedAt: string | null;
  completedAt: string | null;
};

// ─────────────────────────── PREDICTIONS ───────────────────────────

export type PredictionKind =
  | "goal_completion"
  | "savings_forecast"
  | "expense_forecast"
  | "burnout_risk"
  | "habit_failure"
  | "running_consistency"
  | "mood_forecast"
  | "focus_forecast"
  | "prayer_consistency"
  | "sleep_trend"
  | "project_completion"
  | "learning_consistency";

export type Prediction = {
  id: string;
  kind: PredictionKind;
  module: IntelModule;
  title: string;
  outlook: string; // the human forecast sentence
  probability: number | null; // 0..1 when quantifiable; null when honestly unknown
  confidence: Confidence;
  risk: Risk;
  horizon: string; // "next 7 days", "this month", "by the deadline"
  reason: string;
  explanation: Explanation;
  historicalComparison: string | null; // "you did this at 60% last month"
};

// ─────────────────────────── COACH ───────────────────────────

export type CoachMoment =
  | "morning"
  | "daily"
  | "evening"
  | "weekly"
  | "monthly"
  | "achievement"
  | "recovery"
  | "milestone";

export type CoachTone =
  | "encourage"
  | "teach"
  | "explain"
  | "motivate"
  | "suggest"
  | "celebrate"
  | "recover";

export type CoachMessage = {
  id: string;
  module: IntelModule;
  moment: CoachMoment;
  tone: CoachTone;
  headline: string;
  message: string;
  suggestion: string | null;
  action: ActionLink | null;
  explanation: Explanation;
};

// ─────────────────────────── PRIORITIZATION ───────────────────────────

export type PriorityKind =
  | "goal"
  | "project"
  | "habit"
  | "task"
  | "risk_area"
  | "impact_action"
  | "recommendation"
  | "financial"
  | "health";

export type PriorityItem = {
  kind: PriorityKind;
  rank: number; // 1 = most important
  module: IntelModule;
  title: string;
  score: number; // 0..1 ranking score
  reason: string;
  explanation: Explanation;
  action: ActionLink | null;
};

// ─────────────────────────── SCORING ───────────────────────────

export type ScoreKey =
  | "life_balance"
  | "focus_health"
  | "financial_health"
  | "goal_health"
  | "habit_health"
  | "project_health"
  | "consistency"
  | "momentum"
  | "recovery";

export type ScoreComponent = {
  label: string;
  value: number; // 0..100, the component's own sub-score
  weight: number; // 0..1, contribution to the parent (weights sum to ~1)
  detail: string;
};

export type Score = {
  key: ScoreKey;
  label: string;
  value: number; // 0..100
  components: ScoreComponent[];
  trend: Trend;
  reason: string;
  confidence: Confidence;
  explanation: Explanation;
};

// ─────────────────────────── PERSONALIZATION ───────────────────────────

export type Rhythm = {
  label: string;
  peakHours: number[]; // hours 0..23, busiest first
  activeDays: number[]; // 0=Sun..6=Sat
  confidence: Confidence;
  sample: number; // events the rhythm was learned from
};

export type MotivationStyle = "progress" | "streak" | "reflection" | "unknown";
export type PlanningStyle = "morning" | "evening" | "adhoc" | "unknown";

export type PersonalizationProfile = {
  activeHours: number[]; // hours the person tends to act, busiest first
  quietHours: number[]; // hours to avoid interrupting
  preferredModules: { module: IntelModule; weight: number }[];
  rhythms: Record<string, Rhythm>;
  motivationStyle: MotivationStyle;
  planningStyle: PlanningStyle;
  sample: number;
  updatedAt: string; // ISO
  explanation: Explanation;
};

// ─────────────────────────── CROSS-MODULE ───────────────────────────

/** An evidence-backed link between two behaviours. Never causal unless the
 *  Foundation's correlation insight vouched for it — we say "linked", not "causes". */
export type CrossModuleLink = {
  id: string;
  from: IntelModule;
  to: IntelModule;
  relation: string; // "moves with", "linked to"
  strength: number; // 0..1
  detail: string;
  explanation: Explanation;
};

// ─────────────────────────── NOTIFICATIONS ───────────────────────────

export type NotificationPlan = {
  id: string;
  title: string;
  body: string;
  module: IntelModule;
  deliverAt: string; // ISO — the intelligent send time
  priority: Priority;
  suppressed: boolean; // true = held back (spam / low value / quiet hours)
  mergedFrom: string[]; // ids folded into this one
  reason: string;
};

// ─────────────────────────── ADAPTIVE DASHBOARD ───────────────────────────

export type DashboardSlot = {
  module: IntelModule;
  weight: number; // 0..1 relevance right now
  reason: string;
};

// ─────────────────────────── PERIODIC BRIEFS ───────────────────────────

export type DailyBrief = {
  date: string; // YYYY-MM-DD (local)
  greeting: string;
  headline: string;
  priorities: PriorityItem[];
  risks: PriorityItem[];
  opportunities: Recommendation[];
  suggestedActions: Recommendation[];
  wins: string[];
  recovery: CoachMessage | null;
  tomorrow: string[];
  coach: CoachMessage | null;
  explanation: Explanation;
};

export type WeeklyBrief = {
  periodKey: string; // ISO week-ish label
  biggestWin: string | null;
  biggestChallenge: string | null;
  mostImproved: string | null;
  leastConsistent: string | null;
  behaviorChanges: string[];
  summaries: Record<string, string>; // goals/habits/focus/money/health
  recommendationSummary: string;
  scores: Score[];
  explanation: Explanation;
};

export type MonthlyBrief = {
  periodKey: string; // YYYY-MM
  growth: string[];
  declines: string[];
  plateaus: string[];
  breakthroughs: string[];
  behaviorChanges: string[];
  balance: Score | null;
  trends: Record<string, string>;
  explanation: Explanation;
};

// ─────────────────────────── SEMANTIC SEARCH ───────────────────────────

export type SemanticIntent =
  | "happiest"
  | "saddest"
  | "most_productive"
  | "least_productive"
  | "expenses"
  | "streak_breakers"
  | "focus_boosters"
  | "timeline"
  | "general";

export type SemanticResult = {
  title: string;
  detail: string;
  occurredAt: string | null; // ISO
  module: IntelModule | null;
  ref: EvidenceRef;
};

export type SemanticAnswer = {
  query: string;
  intent: SemanticIntent;
  headline: string;
  results: SemanticResult[];
  explanation: Explanation;
};

// ─────────────────────────── IDENTITY LAYER (apex, §6.1) ───────────────────────────

/** The families of identity memory the layer reads/writes. Declared identity is
 *  the most permanent memory ISA holds (LIE §7.3). */
export type IdentityKind = "aspiration" | "value" | "principle" | "mission" | "trait";

/** One declared or cautiously-inferred piece of who the person is / wants to be. */
export type IdentityItem = {
  kind: IdentityKind;
  key: string; // stable subject key ("healthy-father", "no-debt")
  label: string; // "a healthy father", "no debt"
  declared: boolean; // true = the user said it; false = ISA inferred it (never imposed)
  conflictTags: string[]; // signals a candidate would violate ("watch:money:spending")
  supportTags: string[]; // signals a candidate would advance
  source: EvidenceRef;
};

/** The aspirational self (declared) vs the descriptive self (inferred). The gap
 *  between them is the most useful thing ISA can reason about (LIE §6.1). */
export type IdentityProfile = {
  aspirations: IdentityItem[];
  values: IdentityItem[];
  principles: IdentityItem[];
  mission: IdentityItem | null;
  traits: IdentityItem[]; // descriptive, inferred — labelled as such, never used to shame
  declaredCount: number;
  updatedAt: string;
};

/** The verdict of checking a candidate against the Identity Layer. Identity
 *  outranks optimization: a conflict is a veto, not a penalty. */
export type IdentityAlignment = {
  status: "supports" | "neutral" | "conflicts";
  weight: number; // 0..1 boost applied when it supports an identity/value
  note: string | null; // the identity-framed "because", when there is one
  evidence: EvidenceRef[];
};

// ─────────────────────────── DECISION ENGINE (Layer 8, §12) ───────────────────────────

/** Anything a generator (recommendations/predictions/coach/insights) produces
 *  and hands to the Decision Engine to compete for the user's scarce attention. */
export type CandidateKind = "recommendation" | "prediction" | "coach" | "insight";

export type Candidate = {
  id: string;
  kind: CandidateKind;
  module: IntelModule;
  title: string;
  importance: number; // 0..1 — life-significance of the underlying pattern (§5.3)
  confidence: Confidence;
  timeliness: number; // 0..1 — is NOW the moment it can change something
  actionability: number; // 0..1 — is there a clear, doable next step
  novelty: number; // 0..1 — does the user already know this
  costOfSilence: number; // 0..1 — what grows if ISA says nothing
  identity: IdentityAlignment;
  expiresAt: string | null;
  payload: Recommendation | Prediction | CoachMessage; // the thing that surfaces if chosen
};

/** The Decision Engine's global verdict for one candidate. */
export type DecisionOutcome = "surface" | "hold" | "defer" | "discard";

export type DecisionVerdict = {
  id: string;
  outcome: DecisionOutcome;
  priority: number; // 0..1 composite score
  reason: string;
};

/** What the Decision Engine returns: the few things that earned attention, the
 *  rest held for a review, and the arbitration trace (Explainability). */
export type DecisionResult = {
  surfaced: Candidate[]; // the one / few, ranked
  held: Candidate[]; // true & aligned, but saved for a review rather than pushed
  verdicts: DecisionVerdict[];
  budget: number; // interruptions allowed this cycle
  spent: number;
  explanation: Explanation;
};
