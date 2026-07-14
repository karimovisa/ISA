import type { FeatureKey } from "./features";

export type FeatureEntitlement = {
  enabled: boolean;
  limit: number | null; // null = unlimited
  used: number;
  remaining: number | null; // null = unlimited
};

/** The resolved permission snapshot for one user (from my_entitlements RPC). */
export type Entitlements = {
  plan: string;
  status: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
  features: Partial<Record<FeatureKey, FeatureEntitlement>> & Record<string, FeatureEntitlement>;
};
