// ISA — Payment Layer · Provider registry (server-side)
// The single lookup for payment providers. Click is registered today; Payme,
// Stripe, Apple Pay and Google Pay register here when built — no other file, and
// no subscription logic, changes.

import { clickProvider } from "./providers/click";
import type { PaymentProvider, ProviderId } from "./types";

const REGISTRY: Partial<Record<ProviderId, PaymentProvider>> = {
  click: clickProvider,
  // payme:  paymeProvider,
  // stripe: stripeProvider,
  // apple:  appleProvider,
  // google: googleProvider,
};

/** Resolve a provider by id, or null if it isn't implemented yet. */
export function getProvider(id: ProviderId): PaymentProvider | null {
  return REGISTRY[id] ?? null;
}

/** Every implemented provider and whether its credentials are configured. */
export function listProviders(): { id: ProviderId; displayName: string; configured: boolean }[] {
  return Object.values(REGISTRY)
    .filter((p): p is PaymentProvider => Boolean(p))
    .map((p) => ({ id: p.id, displayName: p.displayName, configured: p.configured() }));
}
