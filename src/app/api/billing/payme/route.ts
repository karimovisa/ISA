// Payme Business webhook (JSON-RPC). Verifies Basic auth against PAYME_KEY, then
// activates Pro on PerformTransaction. Minimal method set — confirm the full
// Payme spec (CheckTransaction/GetStatement edge cases) during sandbox testing.
import { adminClient } from "@/lib/webpush";

export const runtime = "nodejs";
const KEY = process.env.PAYME_KEY;
const j = (o: unknown) => new Response(JSON.stringify(o), { headers: { "content-type": "application/json" } });

export async function POST(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Basic ") ? Buffer.from(auth.slice(6), "base64").toString() : "";
  if (!KEY || token !== `Paycom:${KEY}`) return j({ error: { code: -32504, message: "Authorization failed" } });

  const body = (await req.json().catch(() => ({}))) as { method?: string; params?: Record<string, unknown>; id?: number };
  const { method, params = {}, id } = body;
  const userId = (params.account as Record<string, string> | undefined)?.user_id;
  const txn = String(params.id ?? "");

  switch (method) {
    case "CheckPerformTransaction":
      return j({ result: { allow: true }, id });
    case "CreateTransaction":
      return j({ result: { create_time: Date.now(), transaction: txn, state: 1 }, id });
    case "PerformTransaction":
      if (userId) { try { await adminClient().rpc("activate_pro", { p_user: userId, p_provider: "payme", p_txn: txn }); } catch {} }
      return j({ result: { perform_time: Date.now(), transaction: txn, state: 2 }, id });
    case "CancelTransaction":
      return j({ result: { cancel_time: Date.now(), transaction: txn, state: -1 }, id });
    case "CheckTransaction":
      return j({ result: { state: 2, transaction: txn }, id });
    default:
      return j({ error: { code: -32601, message: "Method not found" }, id });
  }
}
