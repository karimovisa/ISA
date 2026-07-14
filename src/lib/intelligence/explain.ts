// ISA — Intelligence Layer · Explainability Engine (§16)
// Every output in this layer carries an Explanation. This module is the ONLY
// way to build one, so "Why? / From what? / How confident? / When?" is answered
// uniformly and nothing can ship a mysterious result.

import type { MemoryRecord, TimelineEntry } from "@/lib/memory";
import type { Insight } from "@/lib/insights";
import type { ClaimType, EvidenceRef, Explanation } from "./types";

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export const memoryEvidence = (m: MemoryRecord): EvidenceRef => ({
  kind: "memory",
  id: m.id,
  label: m.title,
  detail: m.summary || undefined,
});

export const insightEvidence = (i: Insight): EvidenceRef => ({
  kind: "insight",
  id: i.id,
  label: i.title,
  detail: i.detail || undefined,
});

export const timelineEvidence = (t: TimelineEntry): EvidenceRef => ({
  kind: "event",
  id: t.event_id,
  label: t.title,
  detail: t.category,
});

export const patternEvidence = (label: string, detail?: string): EvidenceRef => ({
  kind: "pattern",
  label,
  detail,
});

/** Assemble an Explanation. Counts are derived from the evidence passed in so
 *  the "based on N events/memories/insights" line can never drift from reality. */
export function explain(params: {
  why: string;
  claim: ClaimType;
  evidence: EvidenceRef[];
  confidence: number;
  patterns?: string[];
  lastUpdated?: string;
}): Explanation {
  const { why, claim, evidence, confidence } = params;
  const count = (kind: EvidenceRef["kind"]) => evidence.filter((e) => e.kind === kind).length;
  return {
    why,
    claim,
    evidence,
    confidence: clamp01(confidence),
    basedOn: {
      events: count("event"),
      memories: count("memory"),
      insights: count("insight"),
      patterns: params.patterns ?? [],
    },
    lastUpdated: params.lastUpdated ?? new Date().toISOString(),
  };
}

/** Confidence that grows with sample size and saturates — the honest way to say
 *  "I've seen this enough times to trust it". n samples, k = half-trust point. */
export function sampleConfidence(n: number, k = 6): number {
  if (n <= 0) return 0;
  return clamp01(n / (n + k));
}

/** Blend several 0..1 confidences, weighting by how much each contributed. */
export function combineConfidence(parts: { value: number; weight: number }[]): number {
  const total = parts.reduce((s, p) => s + p.weight, 0);
  if (total <= 0) return 0;
  return clamp01(parts.reduce((s, p) => s + clamp01(p.value) * p.weight, 0) / total);
}
