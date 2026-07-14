// ISA — Payment Layer · Config (server-side)
// Pricing comes from the DB (public.pricing), never hardcoded. Provider
// credentials come from env. A safe launch-price fallback keeps the flow working
// even before the pricing row is seeded.

import { adminClient } from "@/lib/webpush";
import type { Currency, ProviderId } from "./types";

export const DEFAULT_CURRENCY: Currency = "UZS";
export const DEFAULT_PLAN = "pro";
export const DEFAULT_INTERVAL = "month";
const LAUNCH_PRICE_UZS = 20000; // matches the seeded pricing row; used only as a fallback

/** The expected charge for a plan — the number an incoming payment must match. */
export async function expectedAmount(
  plan: string = DEFAULT_PLAN,
  currency: Currency = DEFAULT_CURRENCY,
  interval: string = DEFAULT_INTERVAL
): Promise<number> {
  try {
    const { data } = await adminClient()
      .from("pricing")
      .select("amount")
      .eq("plan_key", plan)
      .eq("currency", currency)
      .eq("interval", interval)
      .eq("active", true)
      .maybeSingle();
    if (data && data.amount != null) return Number(data.amount);
  } catch {
    // fall through to the safe default
  }
  return LAUNCH_PRICE_UZS;
}

/** Click merchant credentials (server env). */
export function clickCredentials(): { secret: string | undefined; serviceId: string | undefined } {
  return {
    secret: process.env.CLICK_SECRET_KEY,
    serviceId: process.env.NEXT_PUBLIC_CLICK_SERVICE_ID,
  };
}

/** Which providers are wired up right now (credentials present). */
export function providerConfigured(id: ProviderId): boolean {
  if (id === "click") {
    const { secret, serviceId } = clickCredentials();
    return Boolean(secret && serviceId);
  }
  return false; // payme / stripe / apple / google — future
}
