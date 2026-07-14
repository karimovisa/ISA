// ISA — Life Intelligence Engine · Capture (Layer 1)
// The one doorway an action passes through to become a Life Event. Two pieces:
//   buildLifeEvent()  — PURE: input → a normalized event row (testable, no I/O).
//   captureLifeEvent() — RESILIENT: persists it, and NEVER throws. An event
//                        capture failing must not break the user action it
//                        accompanies (creating a task must succeed even if its
//                        event doesn't). Silence over disruption.

import { supabase } from "@/lib/supabase/client";
import type {
  Actor,
  EventLinks,
  NewLifeEvent,
  TimeContext,
  UserStateSnapshot,
} from "./types";
import { LIFE_EVENT_TYPES, isKnownEventType, type LifeEventType } from "./taxonomy";
import { assessEvent, type LifeEventContext } from "./intelligence";

const isDev = process.env.NODE_ENV !== "production";

/** What a caller supplies. The Engine fills in meaning, timing, and signals. */
export type CaptureInput = {
  type: LifeEventType;
  actor?: Actor; // default "user"
  occurredAt?: Date | string; // default now — pass the real time for backfills (Strava)
  category?: string; // default from the taxonomy
  payload?: Record<string, unknown>;
  links?: EventLinks;
  emotionalImpact?: number | null; // -1..1 felt tone, when known
  userState?: UserStateSnapshot | null;
  location?: string | null;
  provenance?: string; // e.g. "manual entry", "Strava sync"
  context?: LifeEventContext; // baselines/streaks/outcome for magnitude & valence
};

const pad = (n: number) => String(n).padStart(2, "0");

/** Derive the time lenses for a moment, in the user's LOCAL calendar terms —
 *  matching the app's existing local-date convention (UTC+5 device time). */
export function deriveTimeContext(d: Date): TimeContext {
  const hour = d.getHours();
  const dayOfWeek = d.getDay();
  const partOfDay =
    hour < 6 ? "night" : hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  return {
    localDate: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    dayOfWeek,
    hour,
    partOfDay,
    isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
  };
}

/** Validate before touching the DB. Returns problems ([] = ok). Never throws. */
export function validateCaptureInput(input: CaptureInput): string[] {
  const errors: string[] = [];
  if (!input || !isKnownEventType(input.type)) {
    errors.push(`unknown event_type "${input?.type}"`);
    return errors; // nothing else is trustworthy without a valid type
  }
  if (
    input.emotionalImpact != null &&
    (input.emotionalImpact < -1 || input.emotionalImpact > 1)
  ) {
    errors.push("emotionalImpact must be within [-1, 1]");
  }
  if (input.occurredAt != null && Number.isNaN(new Date(input.occurredAt).getTime())) {
    errors.push("occurredAt is not a valid date");
  }
  return errors;
}

/** PURE: assemble a normalized, fully-assessed event. id + created_at are the
 *  DB's job. Assumes the input already validated. */
export function buildLifeEvent(userId: string, input: CaptureInput): NewLifeEvent {
  const def = LIFE_EVENT_TYPES[input.type];
  const occurred = input.occurredAt ? new Date(input.occurredAt) : new Date();
  const timeContext = deriveTimeContext(occurred);
  const links = input.links ?? {};
  const assessment = assessEvent(input.type, def, links, timeContext, input.context);

  return {
    user_id: userId,
    event_type: input.type,
    source_module: def.module,
    actor: input.actor ?? "user",
    occurred_at: occurred.toISOString(),
    category: input.category ?? def.category,
    importance: assessment.importance,
    magnitude: assessment.magnitude,
    valence: assessment.valence,
    emotional_impact: input.emotionalImpact ?? null,
    links,
    payload: input.payload ?? {},
    metadata: {
      location: input.location ?? null,
      timeContext,
      userState: input.userState ?? null,
    },
    provenance: input.provenance ?? "manual entry",
    intelligence: assessment.intelligence,
    reasons: assessment.reasons,
  };
}

/**
 * Persist a Life Event. Fire-and-forget from the caller's perspective:
 * resolves to the built event, or null if anything went wrong (unknown type,
 * signed-out, DB error). It swallows every failure so the host action is safe.
 */
export async function captureLifeEvent(input: CaptureInput): Promise<NewLifeEvent | null> {
  try {
    const errors = validateCaptureInput(input);
    if (errors.length) {
      if (isDev) console.warn("[life-events] skipped:", errors.join("; "));
      return null;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const event = buildLifeEvent(user.id, input);
    const { error } = await supabase.from("life_events").insert(event);
    if (error) {
      if (isDev) console.warn("[life-events] insert failed:", error.message);
      return null;
    }
    return event;
  } catch (e) {
    if (isDev) console.warn("[life-events] capture threw:", e);
    return null; // never break the user action this event accompanies
  }
}
