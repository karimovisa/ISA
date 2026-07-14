// ISA — Payment Layer · Click provider · Protocol
// The exact Click Merchant API error codes and wire shapes. These follow the
// official Click Merchant (Prepare/Complete) specification — do not invent codes.

/** Official Click Merchant API result codes. */
export const CLICK = {
  SUCCESS: 0,
  SIGN_FAILED: -1,
  BAD_AMOUNT: -2,
  ACTION_NOT_FOUND: -3,
  ALREADY_PAID: -4,
  USER_NOT_FOUND: -5,
  TRANSACTION_NOT_FOUND: -6,
  UPDATE_FAILED: -7,
  BAD_REQUEST: -8,
  CANCELLED: -9,
} as const;

export const CLICK_ACTION = { PREPARE: "0", COMPLETE: "1" } as const;

/** The parameters Click posts (form-encoded) on every callback. */
export type ClickParams = {
  click_trans_id: string;
  service_id: string;
  click_paydoc_id: string;
  merchant_trans_id: string;
  merchant_prepare_id: string;
  amount: string;
  action: string;
  error: string;
  error_note: string;
  sign_time: string;
  sign_string: string;
};

const S = (v: FormDataEntryValue | null): string => (v == null ? "" : String(v));

/** Read Click's form body into a typed, string-only param object. */
export function parseClickForm(form: FormData): ClickParams {
  return {
    click_trans_id: S(form.get("click_trans_id")),
    service_id: S(form.get("service_id")),
    click_paydoc_id: S(form.get("click_paydoc_id")),
    merchant_trans_id: S(form.get("merchant_trans_id")),
    merchant_prepare_id: S(form.get("merchant_prepare_id")),
    amount: S(form.get("amount")),
    action: S(form.get("action")),
    error: S(form.get("error")),
    error_note: S(form.get("error_note")),
    sign_time: S(form.get("sign_time")),
    sign_string: S(form.get("sign_string")),
  };
}

/** JSON response in the exact shape Click expects. */
export function clickResponse(body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status: 200, // Click reads the error code from the body, not the HTTP status
    headers: { "content-type": "application/json" },
  });
}

/** Build a Click reply carrying a result code and the echoed transaction ids. */
export function clickReply(
  error: number,
  note: string,
  p: ClickParams,
  extra: Record<string, unknown> = {}
): Response {
  return clickResponse({
    error,
    error_note: note,
    click_trans_id: p.click_trans_id,
    merchant_trans_id: p.merchant_trans_id,
    ...extra,
  });
}
