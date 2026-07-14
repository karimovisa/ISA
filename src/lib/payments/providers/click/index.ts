// ISA — Payment Layer · Click provider
// Implements the official Click Merchant Prepare/Complete protocol on top of the
// shared, provider-agnostic services (payment ledger + subscription activation).
// Every callback is signature-verified, amount-checked, user-checked, logged, and
// idempotent. Pro is NEVER activated on a failed or cancelled payment.

import { clickCredentials, expectedAmount, DEFAULT_CURRENCY, DEFAULT_PLAN } from "@/lib/payments/config";
import {
  activate,
  findPayment,
  logAttempt,
  logEvent,
  setState,
  upsertPreparing,
  userExists,
} from "@/lib/payments/service";
import type { CallbackKind, PaymentProvider } from "@/lib/payments/types";
import { CLICK, CLICK_ACTION, clickReply, parseClickForm, type ClickParams } from "./protocol";
import { verifySign } from "./verify";

const PROVIDER = "click" as const;

function clientIp(req: Request): string | null {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || null;
}

/** Amount comparison in whole so'm (Click sends UZS, e.g. "20000.00"). */
function amountMatches(sent: string, expected: number): boolean {
  const n = Number(sent.replace(/\s/g, ""));
  return Number.isFinite(n) && Math.round(n) === Math.round(expected);
}

/** Log the callback attempt, then return the reply (single exit per branch). */
async function reply(
  action: string,
  p: ClickParams,
  paymentId: string | null,
  error: number,
  note: string,
  ip: string | null,
  extra: Record<string, unknown> = {}
): Promise<Response> {
  await logAttempt({
    paymentId,
    provider: PROVIDER,
    providerTransId: p.click_trans_id || null,
    action,
    success: error === CLICK.SUCCESS,
    errorCode: error,
    request: { ...p, sign_string: "***" }, // never store the raw signature
    response: { error, error_note: note, ...extra },
    ip,
  });
  return clickReply(error, note, p, extra);
}

/** Shared credential + signature gate for both stages. Returns an error reply, or
 *  null when the request is authentic. */
async function authenticate(action: string, p: ClickParams, ip: string | null): Promise<Response | null> {
  const { secret, serviceId } = clickCredentials();
  if (!secret || !serviceId) return reply(action, p, null, CLICK.BAD_REQUEST, "Billing not configured", ip);
  if (p.service_id !== serviceId) return reply(action, p, null, CLICK.BAD_REQUEST, "Invalid service id", ip);
  if (!verifySign(p, secret)) return reply(action, p, null, CLICK.SIGN_FAILED, "SIGN CHECK FAILED", ip);
  return null;
}

async function prepare(req: Request): Promise<Response> {
  const ip = clientIp(req);
  const p = parseClickForm(await req.formData());
  const authErr = await authenticate("prepare", p, ip);
  if (authErr) return authErr;

  if (Number(p.error) < 0) return reply("prepare", p, null, CLICK.CANCELLED, "Transaction cancelled", ip);

  const expected = await expectedAmount(DEFAULT_PLAN, DEFAULT_CURRENCY);
  if (!amountMatches(p.amount, expected)) return reply("prepare", p, null, CLICK.BAD_AMOUNT, "Incorrect amount", ip);

  if (!(await userExists(p.merchant_trans_id)))
    return reply("prepare", p, null, CLICK.USER_NOT_FOUND, "User does not exist", ip);

  const payment = await upsertPreparing({
    userId: p.merchant_trans_id,
    provider: PROVIDER,
    providerTransId: p.click_trans_id,
    merchantPrepareId: p.click_trans_id, // echoed back; Complete re-sends it in its sign
    amount: expected,
    currency: DEFAULT_CURRENCY,
    plan: DEFAULT_PLAN,
    signTime: p.sign_time || null,
    ip,
    raw: { ...p, sign_string: "***" },
  });
  if (!payment) return reply("prepare", p, null, CLICK.UPDATE_FAILED, "Could not record payment", ip);

  return reply("prepare", p, payment.id, CLICK.SUCCESS, "Ok", ip, { merchant_prepare_id: p.click_trans_id });
}

async function complete(req: Request): Promise<Response> {
  const ip = clientIp(req);
  const p = parseClickForm(await req.formData());
  const authErr = await authenticate("complete", p, ip);
  if (authErr) return authErr;

  const payment = await findPayment(PROVIDER, p.click_trans_id);
  if (!payment) return reply("complete", p, null, CLICK.TRANSACTION_NOT_FOUND, "Transaction does not exist", ip);

  // Cancelled on Click's side — never activate.
  if (Number(p.error) < 0) {
    await setState(payment.id, "cancelled", { error_code: Number(p.error) });
    return reply("complete", p, payment.id, CLICK.CANCELLED, "Transaction cancelled", ip);
  }

  // Idempotency — already settled, don't activate twice.
  if (payment.state === "completed" || payment.state === "paid")
    return reply("complete", p, payment.id, CLICK.ALREADY_PAID, "Already paid", ip, { merchant_confirm_id: p.click_trans_id });

  const expected = await expectedAmount(payment.plan_key, payment.currency);
  if (!amountMatches(p.amount, expected)) return reply("complete", p, payment.id, CLICK.BAD_AMOUNT, "Incorrect amount", ip);

  const userId = payment.user_id ?? p.merchant_trans_id;
  const result = await activate({
    userId,
    provider: PROVIDER,
    transactionId: p.click_trans_id,
    amount: expected,
    currency: payment.currency,
    plan: payment.plan_key,
    invoiceId: payment.id,
  });
  if (!result.ok) {
    await setState(payment.id, "failed", { error_code: CLICK.UPDATE_FAILED });
    return reply("complete", p, payment.id, CLICK.UPDATE_FAILED, "Activation failed", ip);
  }

  await setState(payment.id, "completed", { paid_at: new Date().toISOString() });
  await logEvent({
    paymentId: payment.id,
    provider: PROVIDER,
    providerTransId: p.click_trans_id,
    event: "activation",
    message: result.duplicate ? "duplicate (idempotent)" : result.kind ?? "activation",
    data: { periodEnd: result.periodEnd, duplicate: result.duplicate },
    ip,
  });

  return reply("complete", p, payment.id, CLICK.SUCCESS, "Ok", ip, { merchant_confirm_id: p.click_trans_id });
}

export const clickProvider: PaymentProvider = {
  id: PROVIDER,
  displayName: "Click",
  configured() {
    const { secret, serviceId } = clickCredentials();
    return Boolean(secret && serviceId);
  },
  handle(kind: CallbackKind, req: Request): Promise<Response> {
    return kind === "prepare" ? prepare(req) : complete(req);
  },
};

/** Handle a raw callback by Click's `action` field — for the single-endpoint
 *  (legacy) route that receives both stages on one URL. */
export async function handleClickByAction(req: Request): Promise<Response> {
  // Peek the action without consuming the stream twice: clone for the read.
  const action = String((await req.clone().formData()).get("action") ?? "");
  if (action === CLICK_ACTION.PREPARE) return prepare(req);
  if (action === CLICK_ACTION.COMPLETE) return complete(req);
  const p = parseClickForm(await req.formData());
  return clickReply(CLICK.ACTION_NOT_FOUND, "Action not found", p);
}
