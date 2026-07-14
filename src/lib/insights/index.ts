// ISA — Pattern & Insight Engine · Public API (analysis layer, read-only).
// Insights are generated server-side (pg_cron nightly + generate_my_insights
// RPC) from the Memory Engine. Future subsystems (Recommendations, Predictions,
// Daily Brief, Reviews, Coach) consume these — they don't recompute.

import { supabase } from "@/lib/supabase/client";

export type InsightType =
  | "recurring"
  | "consistency"
  | "positive_trend"
  | "negative_trend"
  | "emerging"
  | "correlation"
  | "anomaly"
  | "milestone"
  | (string & {});

export type InsightValence = "positive" | "neutral" | "negative";

export type Insight = {
  id: string;
  user_id: string;
  insight_type: InsightType;
  subject_key: string;
  title: string;
  detail: string;
  valence: InsightValence;
  confidence: number; // 0..1
  importance_score: number; // 0..1
  evidence: Record<string, unknown>;
  source: string;
  status: "active" | "dismissed" | "archived";
  created_at: string;
};

export type InsightFilter = {
  type?: InsightType | InsightType[];
  valence?: InsightValence;
  minConfidence?: number;
  minImportance?: number;
  source?: string; // "auto" (basic) | "advanced" (Pro)
  limit?: number;
};

const T = "ai_insights";

/** Filtered retrieval, highest-importance first. */
export async function retrieveInsights(f: InsightFilter = {}): Promise<Insight[]> {
  let q = supabase.from(T).select("*").eq("status", "active");
  if (f.type) q = Array.isArray(f.type) ? q.in("insight_type", f.type) : q.eq("insight_type", f.type);
  if (f.valence) q = q.eq("valence", f.valence);
  if (f.minConfidence != null) q = q.gte("confidence", f.minConfidence);
  if (f.minImportance != null) q = q.gte("importance_score", f.minImportance);
  if (f.source) q = q.eq("source", f.source);
  const { data } = await q.order("importance_score", { ascending: false }).limit(f.limit ?? 100);
  return (data as Insight[]) ?? [];
}

export function retrieveByType(type: InsightType | InsightType[], limit = 50): Promise<Insight[]> {
  return retrieveInsights({ type, limit });
}

/** The few insights worth the most attention (high importance + confidence). */
export function retrieveTopInsights(limit = 10): Promise<Insight[]> {
  return retrieveInsights({ minConfidence: 0.5, limit });
}

/** Group active insights by type — handy for reviews / dashboards later. */
export async function insightsByType(): Promise<Record<string, Insight[]>> {
  const all = await retrieveInsights({ limit: 500 });
  const out: Record<string, Insight[]> = {};
  for (const i of all) (out[i.insight_type] ??= []).push(i);
  return out;
}

/** Mark an insight as dismissed (feedback signal for later subsystems). */
export async function dismissInsight(id: string): Promise<boolean> {
  const { error } = await supabase.from(T).update({ status: "dismissed" } as never).eq("id", id);
  return !error;
}

/** Trigger an immediate regeneration for the signed-in user (else nightly). */
export async function generateInsights(): Promise<boolean> {
  const { error } = await supabase.rpc("generate_my_insights");
  return !error;
}
