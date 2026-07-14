// ISA — Memory Engine · Types
// The structured, permanent knowledge derived from life_events. Read only
// through the API in ./index — never query the tables directly.

export type MemoryImportance = "critical" | "high" | "medium" | "low" | "temporary";
export type MemoryStatus = "active" | "archived" | "permanent";

/** Known memory types. Extensible — the string union stays open on purpose so
 *  future modules add types without touching this file. */
export type MemoryType =
  | "goal"
  | "project"
  | "habit"
  | "finance_goal"
  | "behavior"
  | "milestone"
  | "preference"
  | (string & {});

/** A consolidated, subject-centric memory. Many events about one subject
 *  evolve THIS single row (occurrence_count grows; it is never duplicated). */
export type MemoryRecord = {
  id: string;
  user_id: string;
  memory_type: MemoryType;
  subject_key: string;
  title: string;
  summary: string;
  importance: MemoryImportance;
  importance_score: number; // 0..1, for ranking
  status: MemoryStatus;
  tags: string[];
  occurrence_count: number;
  magnitude_avg: number;
  first_event_at: string | null;
  last_event_at: string | null;
  source_module: string;
  links: Record<string, unknown>;
  data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

/** A knowledge-graph edge between two memories. */
export type MemoryRelationship = {
  id: string;
  user_id: string;
  from_memory: string;
  to_memory: string;
  rel_type: string;
  weight: number;
  created_at: string;
};

/** A chronological Life Timeline anchor (a pivotal moment). */
export type TimelineEntry = {
  id: string;
  user_id: string;
  event_id: string;
  occurred_at: string;
  title: string;
  category: string;
  importance: string;
  memory_id: string | null;
  data: Record<string, unknown>;
  created_at: string;
};

/** Filter accepted by retrieve() and search(). */
export type MemoryFilter = {
  type?: MemoryType | MemoryType[];
  tag?: string;
  module?: string;
  importance?: MemoryImportance;
  minScore?: number;
  status?: MemoryStatus;
  goalId?: string;
  projectId?: string;
  from?: string; // ISO date — matches on last_event_at
  to?: string;
  limit?: number;
};

/** A related memory plus the edge that connects it. */
export type RelatedMemory = {
  memory: MemoryRecord;
  rel_type: string;
  weight: number;
};

/** Compact, ranked snapshot for future AI features (reviews, coach, search). */
export type MemoryContext = {
  important: MemoryRecord[];
  recentTimeline: TimelineEntry[];
  topConnections: { from: string; to: string; rel_type: string; weight: number }[];
  summary: MemorySummary;
};

export type MemorySummary = {
  total: number;
  byType: Record<string, number>;
  byImportance: Record<string, number>;
  topTags: { tag: string; count: number }[];
  criticalCount: number;
};

/** Input for remember() — manual/system memories (preferences, custom notes). */
export type RememberInput = {
  memory_type?: MemoryType; // default "preference"
  subject_key: string; // stable key so repeats consolidate
  title: string;
  summary?: string;
  importance?: MemoryImportance;
  tags?: string[];
  data?: Record<string, unknown>;
};
