// ISA — Click Merchant · Prepare endpoint (production)
// URL: https://islom-os.vercel.app/api/payments/click/prepare
// Receives Click's action=0 callback. All verification, amount/user checks,
// idempotency and logging happen inside the Click provider — server-side only.

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
  return provider.handle("prepare", req);
}
