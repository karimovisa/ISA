// ISA — Entitlements · the single source of truth for permissions.
// Never write `plan === "pro"` in a component — use canUse()/useEntitlements().
import { supabase } from "@/lib/supabase/client";
import type { Entitlements } from "./types";
import type { FeatureKey } from "./features";

export * from "./features";
export * from "./types";
export * from "./billing";

/** Lazily guarantee a subscription row (default free/active) for the user. */
export async function ensureSubscription(): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("subscriptions")
    .upsert({ user_id: user.id }, { onConflict: "user_id", ignoreDuplicates: true });
}

/** Resolve the user's full permission snapshot (server-computed). */
export async function loadEntitlements(): Promise<Entitlements | null> {
  const { data, error } = await supabase.rpc("my_entitlements");
  if (error || !data) return null;
  return data as Entitlements;
}

// ── Pure helpers over an Entitlements snapshot ──
export function canUse(ent: Entitlements | null, key: FeatureKey | string): boolean {
  return ent?.features?.[key]?.enabled === true;
}
export function featureEnabled(ent: Entitlements | null, key: FeatureKey | string): boolean {
  return canUse(ent, key);
}
export function remainingUsage(ent: Entitlements | null, key: FeatureKey | string): number | null {
  const f = ent?.features?.[key];
  return f ? f.remaining : 0;
}
export function currentPlan(ent: Entitlements | null): string {
  return ent?.plan ?? "free";
}
export function subscriptionStatus(ent: Entitlements | null): string {
  return ent?.status ?? "active";
}

/** Consume one unit of a usage-limited feature — SERVER-ENFORCED (atomic).
 *  Returns false if the feature is off or the limit is spent. */
export async function useFeature(key: FeatureKey | string): Promise<boolean> {
  const { data, error } = await supabase.rpc("use_feature", { fk: key });
  return !error && data === true;
}
