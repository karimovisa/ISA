// ISA — Intelligence Layer · Identity Layer (LIE §6.1, the apex)
// "Events tell ISA what you did. The Identity Layer tells ISA who you are doing
//  it for." This is the highest-priority context and the deepest constraint:
// identity outranks optimization. A recommendation that contradicts a declared
// value is VETOED, however optimal it looks.
//
// Declared-first, inferred-cautiously, never imposed (LIE §6.1 rules). Declared
// identity is the most permanent memory ISA holds, so it lives in the Memory
// Engine as identity-family memories — read here, written via declareIdentity().

import { remember, retrieve } from "@/lib/memory";
import type { MemoryRecord } from "@/lib/memory";
import { invalidateContext } from "./context";
import { memoryEvidence } from "./explain";
import type {
  IdentityAlignment,
  IdentityItem,
  IdentityKind,
  IdentityProfile,
} from "./types";

/** The memory_type values that carry identity. Kept in sync with declareIdentity. */
const IDENTITY_TYPES: IdentityKind[] = ["aspiration", "value", "principle", "mission", "trait"];

const asStringArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

function toItem(m: MemoryRecord, declaredDefault: boolean): IdentityItem {
  const data = m.data ?? {};
  const declared = typeof data.declared === "boolean" ? (data.declared as boolean) : declaredDefault;
  return {
    kind: (m.memory_type as IdentityKind) ?? "value",
    key: m.subject_key,
    label: m.title,
    declared,
    conflictTags: asStringArray(data.conflictTags),
    supportTags: asStringArray(data.supportTags),
    source: memoryEvidence(m),
  };
}

/** Build the Identity profile from the person's identity-family memories.
 *  When nothing is declared, the profile is honestly empty — the Identity Layer
 *  stays neutral rather than inventing a self for the user. */
export function buildIdentity(memories: MemoryRecord[]): IdentityProfile {
  const items = memories
    .filter((m) => IDENTITY_TYPES.includes(m.memory_type as IdentityKind))
    .map((m) => toItem(m, m.memory_type !== "trait"));

  const missionItem = items.find((i) => i.kind === "mission") ?? null;
  return {
    aspirations: items.filter((i) => i.kind === "aspiration"),
    values: items.filter((i) => i.kind === "value"),
    principles: items.filter((i) => i.kind === "principle"),
    mission: missionItem,
    traits: items.filter((i) => i.kind === "trait"),
    declaredCount: items.filter((i) => i.declared && i.kind !== "trait").length,
    updatedAt: new Date().toISOString(),
  };
}

/** Load the Identity profile directly (used outside the shared context). */
export async function loadIdentity(): Promise<IdentityProfile> {
  const mems = await retrieve({ type: IDENTITY_TYPES, limit: 100 });
  return buildIdentity(mems);
}

/** All the "watch:*" / advance tags a candidate might carry, checked against
 *  the declared identity. A neutral profile never blocks and never fabricates. */
export function checkAlignment(
  identity: IdentityProfile,
  signals: string[],
  advancesGoal: boolean
): IdentityAlignment {
  const declared = [...identity.aspirations, ...identity.values, ...identity.principles].filter(
    (i) => i.declared
  );
  if (declared.length === 0) {
    // No declared identity yet — stay honestly neutral (never impose a self).
    return { status: "neutral", weight: 0, note: null, evidence: [] };
  }

  const sig = new Set(signals);
  for (const item of declared) {
    if (item.conflictTags.some((t) => sig.has(t))) {
      return {
        status: "conflicts",
        weight: 0,
        note: `This pulls against "${item.label}", which you said you're building toward.`,
        evidence: [item.source],
      };
    }
  }
  for (const item of declared) {
    if (item.supportTags.some((t) => sig.has(t)) || (advancesGoal && item.kind === "aspiration")) {
      return {
        status: "supports",
        weight: 0.25,
        note: `This moves you toward "${item.label}".`,
        evidence: [item.source],
      };
    }
  }
  return { status: "neutral", weight: 0, note: null, evidence: [] };
}

/** Declare (or evolve) one piece of identity. Writes an identity-family memory
 *  so it becomes permanent knowledge. This is how a future onboarding/settings
 *  flow populates the Identity Layer — the layer itself never imposes identity. */
export async function declareIdentity(input: {
  kind: IdentityKind;
  key: string;
  label: string;
  conflictTags?: string[];
  supportTags?: string[];
}): Promise<boolean> {
  const ok = await remember({
    memory_type: input.kind,
    subject_key: input.key,
    title: input.label,
    summary: input.label,
    importance: input.kind === "mission" ? "critical" : "high",
    tags: ["identity", input.kind],
    data: {
      declared: true,
      conflictTags: input.conflictTags ?? [],
      supportTags: input.supportTags ?? [],
    },
  });
  if (ok) invalidateContext();
  return ok !== null;
}
