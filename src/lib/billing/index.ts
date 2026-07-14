// ISA — Billing Service layer. Provider-agnostic: the app never imports a
// payment SDK directly. Add Stripe/Apple/Google later by adding an adapter —
// nothing else changes. Prices come from the DB (never hardcoded).
import { supabase } from "@/lib/supabase/client";

export type ProviderId = "click" | "payme";
export type Pricing = { plan_key: string; currency: string; interval: string; amount: number; is_launch: boolean };
export type AiReadyStats = { life_events: number; memories: number; connections: number; insights: number; timeline: number; patterns: number };

const CLICK_SERVICE = process.env.NEXT_PUBLIC_CLICK_SERVICE_ID;
const CLICK_MERCHANT = process.env.NEXT_PUBLIC_CLICK_MERCHANT_ID;
const PAYME_MERCHANT = process.env.NEXT_PUBLIC_PAYME_MERCHANT_ID;

export const PROVIDERS: { id: ProviderId; name: string }[] = [
  { id: "click", name: "Click" },
  { id: "payme", name: "Payme" },
];

export function providerConfigured(id: ProviderId): boolean {
  return id === "click" ? !!(CLICK_SERVICE && CLICK_MERCHANT) : !!PAYME_MERCHANT;
}

export function formatUzs(n: number): string {
  return `${Math.round(n).toLocaleString("en-US")} so'm`;
}

export async function getPricing(currency = "UZS", interval = "month"): Promise<Pricing | null> {
  const { data } = await supabase.from("pricing").select("*")
    .eq("plan_key", "pro").eq("currency", currency).eq("interval", interval).eq("active", true).maybeSingle();
  return (data as Pricing) ?? null;
}

/** Real numbers from the AI engine — never faked. */
export async function getAiReadyStats(): Promise<AiReadyStats | null> {
  const { data } = await supabase.rpc("ai_ready_stats");
  return (data as AiReadyStats) ?? null;
}

/** Provider checkout URL, or null when the provider isn't configured yet. */
export function checkoutUrl(id: ProviderId, userId: string, amountUzs: number): string | null {
  if (id === "click") {
    if (!providerConfigured("click")) return null;
    const p = new URLSearchParams({ service_id: CLICK_SERVICE!, merchant_id: CLICK_MERCHANT!, amount: String(amountUzs), transaction_param: userId });
    return `https://my.click.uz/services/pay?${p.toString()}`;
  }
  if (!providerConfigured("payme")) return null;
  const raw = `m=${PAYME_MERCHANT};ac.user_id=${userId};a=${amountUzs * 100}`; // tiyin
  const b64 = typeof window !== "undefined" ? btoa(raw) : Buffer.from(raw).toString("base64");
  return `https://checkout.paycom.uz/${b64}`;
}
