// ISA — Payment Layer · Service (provider-agnostic, server-side)
// The shared operations every provider uses: record a payment, transition its
// state, log attempts/events, and activate the subscription. Adding a new
// provider means calling THESE — the subscription logic never changes. All writes
// go through the service role (adminClient), so nothing trusts the client.

import { adminClient } from "@/lib/webpush";
import type {
  ActivationResult,
  Currency,
  PaymentRecord,
  PaymentState,
  ProviderId,
} from "./types";

const db = () => adminClient();

/** Does this id correspond to a real user? (every user has a subscriptions row) */
export async function userExists(userId: string): Promise<boolean> {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return false;
  const { data, error } = await db().from("subscriptions").select("user_id").eq("user_id", userId).maybeSingle();
  return !error && !!data;
}

/** The ledger row for a provider transaction, or null. */
export async function findPayment(provider: ProviderId, providerTransId: string): Promise<PaymentRecord | null> {
  const { data } = await db()
    .from("payments")
    .select("*")
    .eq("provider", provider)
    .eq("provider_trans_id", providerTransId)
    .maybeSingle();
  return (data as PaymentRecord) ?? null;
}

/** Create (or reuse) the payment row for a provider transaction — idempotent on
 *  (provider, provider_trans_id). Returns the current row. */
export async function upsertPreparing(input: {
  userId: string;
  provider: ProviderId;
  providerTransId: string;
  merchantPrepareId: string;
  amount: number;
  currency: Currency;
  plan: string;
  signTime: string | null;
  ip: string | null;
  raw: Record<string, unknown>;
}): Promise<PaymentRecord | null> {
  const existing = await findPayment(input.provider, input.providerTransId);
  if (existing) return existing;
  const { data, error } = await db()
    .from("payments")
    .insert({
      user_id: input.userId,
      provider: input.provider,
      provider_trans_id: input.providerTransId,
      merchant_prepare_id: input.merchantPrepareId,
      amount: input.amount,
      currency: input.currency,
      plan_key: input.plan,
      state: "preparing",
      sign_time: input.signTime,
      ip: input.ip,
      raw: input.raw,
    })
    .select("*")
    .single();
  if (error) {
    // A concurrent insert may have won the unique race — re-read.
    return await findPayment(input.provider, input.providerTransId);
  }
  return (data as PaymentRecord) ?? null;
}

/** Move a payment to a new state (logs the transition). */
export async function setState(
  id: string,
  state: PaymentState,
  patch: Partial<Pick<PaymentRecord, "error_code" | "paid_at" | "merchant_prepare_id">> = {}
): Promise<void> {
  await db().from("payments").update({ state, ...patch }).eq("id", id);
  await logEvent({ paymentId: id, event: "state_change", message: state, data: { state, ...patch } });
}

/** Record one raw provider callback (audit). */
export async function logAttempt(input: {
  paymentId: string | null;
  provider: ProviderId;
  providerTransId: string | null;
  action: string;
  success: boolean;
  errorCode: number | null;
  request: Record<string, unknown>;
  response: Record<string, unknown>;
  ip: string | null;
}): Promise<void> {
  await db().from("payment_attempts").insert({
    payment_id: input.paymentId,
    provider: input.provider,
    provider_trans_id: input.providerTransId,
    action: input.action,
    success: input.success,
    error_code: input.errorCode,
    request: input.request,
    response: input.response,
    ip: input.ip,
  });
}

/** Append a free-form event to the payment log. */
export async function logEvent(input: {
  paymentId?: string | null;
  provider?: ProviderId;
  providerTransId?: string | null;
  event: string;
  message?: string;
  data?: Record<string, unknown>;
  ip?: string | null;
}): Promise<void> {
  await db().from("payment_logs").insert({
    payment_id: input.paymentId ?? null,
    provider: input.provider ?? null,
    provider_trans_id: input.providerTransId ?? null,
    event: input.event,
    message: input.message ?? null,
    data: input.data ?? {},
    ip: input.ip ?? null,
  });
}

/** Activate (or renew) Pro through the shared RPC. Idempotent per provider
 *  transaction — the subscription system is reused, not reimplemented. */
export async function activate(input: {
  userId: string;
  provider: ProviderId;
  transactionId: string;
  amount: number;
  currency: Currency;
  plan: string;
  invoiceId?: string | null;
  periodMonths?: number;
}): Promise<ActivationResult> {
  const { data, error } = await db().rpc("activate_pro", {
    p_user: input.userId,
    p_provider: input.provider,
    p_txn: input.transactionId,
    p_amount: input.amount,
    p_currency: input.currency,
    p_plan: input.plan,
    p_invoice: input.invoiceId ?? null,
    p_period_months: input.periodMonths ?? 1,
  });
  if (error) return { ok: false, duplicate: false, error: error.message };
  const r = (data ?? {}) as { ok?: boolean; duplicate?: boolean; kind?: ActivationResult["kind"]; period_end?: string };
  return { ok: r.ok ?? true, duplicate: r.duplicate ?? false, kind: r.kind, periodEnd: r.period_end };
}
