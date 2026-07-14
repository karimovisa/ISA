// ISA — Payment Layer · Shared contract (provider-agnostic)
// The app never couples to a payment vendor. Click is the first provider; Payme,
// Stripe, Apple Pay and Google Pay slot in behind the same interface WITHOUT any
// change to the Subscription or Feature-Gating systems (those live in
// subscriptions-schema.sql + @/lib/entitlements and are reused, not rebuilt).

export type ProviderId = "click" | "payme" | "stripe" | "apple" | "google";

export type Currency = "UZS" | "USD" | "EUR" | "GBP";

/** The full payment lifecycle. Every transition is logged (payment_logs). */
export type PaymentState =
  | "pending"
  | "preparing"
  | "paid"
  | "completed"
  | "cancelled"
  | "expired"
  | "failed"
  | "refunded";

/** Provider callback stages. Click uses prepare/complete; other providers map
 *  their own webhook stages onto these or extend the union per provider. */
export type CallbackKind = "prepare" | "complete";

/** One row of the payment ledger (public.payments). */
export type PaymentRecord = {
  id: string;
  user_id: string | null;
  provider: ProviderId;
  provider_trans_id: string;
  merchant_prepare_id: string | null;
  plan_key: string;
  amount: number;
  currency: Currency;
  state: PaymentState;
  error_code: number | null;
  sign_time: string | null;
  ip: string | null;
  created_at: string;
  updated_at: string;
  paid_at: string | null;
};

/** The result of activating/renewing a subscription (from the activate_pro RPC). */
export type ActivationResult = {
  ok: boolean;
  duplicate: boolean;
  kind?: "activation" | "renewal" | "extension" | "refund";
  periodEnd?: string;
  error?: string;
};

/**
 * A payment provider. Each implements its own wire protocol inside handle(); the
 * shared Subscription/Billing/Logging services are called the same way by every
 * provider, so adding one never touches subscription logic.
 */
export interface PaymentProvider {
  id: ProviderId;
  displayName: string;
  /** True when the provider's server credentials are configured. */
  configured(): boolean;
  /** Handle one raw callback request and return the provider-shaped Response. */
  handle(kind: CallbackKind, req: Request): Promise<Response>;
}
