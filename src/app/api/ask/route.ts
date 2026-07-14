// ISA — Conversation Layer · /api/ask (the LLM step, server-only)
// The ONLY place a model runs. It receives ISA's already-computed findings (never
// a raw data query) and returns natural-language phrasing. It performs no reads
// or writes on the user's life — so there is nothing here to leak. Auth-gated to
// stop the model key being used as an open proxy; the phrasing itself is
// subscription-gated client-side before the request is ever made.

import { adminClient } from "@/lib/strava";
import { generate, resolveProvider } from "@/lib/conversation/llm";
import type { GenerationRequest, ProviderMessage } from "@/lib/conversation/types";

export const dynamic = "force-dynamic";

function isValidBody(b: unknown): b is GenerationRequest {
  if (!b || typeof b !== "object") return false;
  const r = b as Record<string, unknown>;
  if (typeof r.system !== "string" || !Array.isArray(r.messages)) return false;
  return (r.messages as ProviderMessage[]).every(
    (m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string"
  );
}

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
  if (!isValidBody(body)) return new Response("bad request", { status: 400 });

  // Cap the payload so a client can't smuggle a huge prompt through the proxy.
  const size = body.system.length + body.messages.reduce((n, m) => n + m.content.length, 0);
  if (size > 24_000) return new Response("payload too large", { status: 413 });

  const provider = resolveProvider(body.provider);
  try {
    const text = await generate(body);
    return new Response(text, {
      status: 200,
      headers: { "content-type": "text/plain; charset=utf-8", "x-isa-provider": provider ?? "deterministic" },
    });
  } catch {
    // Any model failure → empty body; the client speaks ISA's deterministic voice.
    return new Response("", {
      status: 200,
      headers: { "content-type": "text/plain; charset=utf-8", "x-isa-provider": "deterministic" },
    });
  }
}
