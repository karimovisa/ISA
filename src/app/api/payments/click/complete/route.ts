// ISA — Click Merchant · Complete endpoint (production)
// URL: https://islom-os.vercel.app/api/payments/click/complete
// Receives Click's action=1 callback. On a verified, non-cancelled, correctly-
// priced payment it activates/renews Pro through the shared subscription RPC —
// idempotently. Pro is never activated on failure or cancellation.

import { getProvider } from "@/lib/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  const provider = getProvider("click");
  if (!provider) {
    return new Response(JSON.stringify({ error: -8, error_note: "Provider unavailable" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
  return provider.handle("complete", req);
}
