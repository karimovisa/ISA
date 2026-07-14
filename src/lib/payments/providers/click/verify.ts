// ISA — Payment Layer · Click provider · Signature verification
// Rebuilds Click's MD5 sign_string from the secret key and compares it in
// constant time. The base-string composition follows the official Click Merchant
// spec (Complete adds merchant_prepare_id). Preserved verbatim from the verified
// existing implementation.

import crypto from "crypto";
import { CLICK_ACTION, type ClickParams } from "./protocol";

/** The signed base string for a callback, per the Click Merchant spec. */
export function signBase(p: ClickParams, secret: string): string {
  const prepareId = p.action === CLICK_ACTION.COMPLETE ? p.merchant_prepare_id : "";
  return `${p.click_trans_id}${p.service_id}${secret}${p.merchant_trans_id}${prepareId}${p.amount}${p.action}${p.sign_time}`;
}

const md5 = (s: string): string => crypto.createHash("md5").update(s).digest("hex");

/** Constant-time comparison to avoid timing side-channels on the signature. */
function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/** True when the request's sign_string matches our computed MD5. */
export function verifySign(p: ClickParams, secret: string): boolean {
  if (!p.sign_string) return false;
  return safeEqual(md5(signBase(p, secret)).toLowerCase(), p.sign_string.toLowerCase());
}
