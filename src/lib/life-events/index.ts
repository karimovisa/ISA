// ISA — Life Intelligence Engine · Event System
// Public API. Import from "@/lib/life-events".
//
// The normalized, append-only memory every future intelligence layer reads.
// Today it captures and weighs events. It builds NOTHING on top yet — no
// pattern detection, no recommendations, no predictions, no UI. Those are
// later Roadmap phases that will consume the signals stamped here.

export type {
  LifeEvent,
  NewLifeEvent,
  SourceModule,
  Actor,
  Valence,
  Importance,
  Confidence,
  EventLinks,
  EventMetadata,
  EventIntelligence,
  TimeContext,
  UserStateSnapshot,
} from "./types";

export { LIFE_EVENT_TYPES, MILESTONE_TYPES, isKnownEventType } from "./taxonomy";
export type { EventTypeDef, LifeEventType } from "./taxonomy";

export {
  calculateMagnitude,
  calculateValence,
  deriveImportance,
  aiRelevance,
  assessEvent,
} from "./intelligence";
export type { Scored, EventOutcome, LifeEventContext, EventAssessment } from "./intelligence";

export {
  captureLifeEvent,
  buildLifeEvent,
  validateCaptureInput,
  deriveTimeContext,
} from "./capture";
export type { CaptureInput } from "./capture";
