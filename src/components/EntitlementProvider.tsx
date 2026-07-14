"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  loadEntitlements,
  ensureSubscription,
  canUse as _canUse,
  remainingUsage as _remaining,
} from "@/lib/entitlements";
import type { Entitlements, FeatureKey } from "@/lib/entitlements";

type EntitlementCtx = {
  entitlements: Entitlements | null;
  loading: boolean;
  plan: string;
  status: string;
  canUse: (key: FeatureKey | string) => boolean;
  remaining: (key: FeatureKey | string) => number | null;
  refresh: () => Promise<void>;
};

const Ctx = createContext<EntitlementCtx | null>(null);

export function EntitlementProvider({ children }: { children: React.ReactNode }) {
  const [ent, setEnt] = useState<Entitlements | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setEnt(await loadEntitlements());
    setLoading(false);
  }, []);

  useEffect(() => {
    (async () => {
      await ensureSubscription();
      await refresh();
    })();
  }, [refresh]);

  const value: EntitlementCtx = {
    entitlements: ent,
    loading,
    plan: ent?.plan ?? "free",
    status: ent?.status ?? "active",
    canUse: (k) => _canUse(ent, k),
    remaining: (k) => _remaining(ent, k),
    refresh,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** The one hook every component uses. Falls back to a safe free/loading state
 *  when called outside the provider (never throws). */
export function useEntitlements(): EntitlementCtx {
  return (
    useContext(Ctx) ?? {
      entitlements: null,
      loading: true,
      plan: "free",
      status: "active",
      canUse: () => false,
      remaining: () => 0,
      refresh: async () => {},
    }
  );
}
