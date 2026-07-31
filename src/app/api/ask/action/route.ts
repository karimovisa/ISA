// ISA — Conversation Layer · /api/ask/action (Gemini action extraction, server-only)
// Reads a free-form message into a create-action (task/goal/habit) ISA can
// pre-fill. Gemini only PROPOSES here — no reads or writes on the user's life;
// the client turns this into a template the user must confirm before anything is
// written. Auth-gated so the model key can't be used as an open proxy.

import { adminClient } from "@/lib/strava";
import { extractAction } from "@/lib/conversation/llm";

export const dynamic = "force-dynamic";

const NONE = { kind: "none", title: "" } as const;

export async function POST(request: Request) {
  const jwt = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!jwt) return new Response("unauthorized", { status: 401 });

  const {
    data: { user },
  } = await adminClient().auth.getUser(jwt);
  if (!user) return new Response("unauthorized", { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response("bad request", { status: 400 });
  }
  const message = (body as { message?: unknown } | null)?.message;
  if (typeof message !== "string" || !message.trim() || message.length > 2000) {
    return new Response("bad request", { status: 400 });
  }

  try {
    const action = await extractAction(message);
    return Response.json(action ?? NONE);
  } catch {
    // Any model failure → "no action"; the client keeps ISA's deterministic read.
    return Response.json(NONE);
  }
}
