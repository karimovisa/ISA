// ISA — Click Merchant webhook (legacy single-endpoint URL, kept working).
// The verified logic now lives in the provider-based Payment Layer
// (@/lib/payments/providers/click). This route delegates by Click's `action`
// field so an existing merchant configured with one callback URL keeps working;
// new setups should use /api/payments/click/prepare and /complete.
import { handleClickByAction } from "@/lib/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  return handleClickByAction(req);
}
