// ISA — Payment Layer · Public API (SERVER-SIDE)
// The provider-based payment surface. Import from "@/lib/payments" in server
// routes only — it reaches the service-role client. Client UI keeps using
// @/lib/billing (provider list, checkout URL) which is browser-safe.

export type * from "./types";
export { getProvider, listProviders } from "./registry";
export { providerConfigured, expectedAmount, DEFAULT_CURRENCY, DEFAULT_PLAN } from "./config";
export { clickProvider, handleClickByAction } from "./providers/click";
