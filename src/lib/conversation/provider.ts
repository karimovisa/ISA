// ISA — Conversation Layer · Provider (client side, §19 future-ready)
// The client never holds a model key. It either speaks with ISA's own
// deterministic words, or asks the server route to phrase ISA's findings with
// whatever LLM the deployment has configured (Claude / GPT / Gemini / local).
// The provider is chosen server-side by env, so ISA's architecture is never
// coupled to one model — swapping providers is a server config change.

import { supabase } from "@/lib/supabase/client";
import type { GenerationRequest, ProviderName } from "./types";

/** Is a natural-language model available? (A server route + key.) We optimistically
 *  try the server and fall back to ISA's deterministic voice on any failure, so
 *  this is a hint, not a gate. */
export const REMOTE_ENDPOINT = "/api/ask";

/**
 * Ask the server to phrase ISA's findings. Returns the model's text, or "" on any
 * failure (the caller then uses ISA's deterministic draft). Never throws.
 * The request carries ONLY ISA's computed facts — never a raw data query.
 */
export async function speakViaServer(
  req: GenerationRequest
): Promise<{ text: string; provider: ProviderName | null }> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return { text: "", provider: null };

    const res = await fetch(REMOTE_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify(req),
    });
    if (!res.ok) return { text: "", provider: null };

    const text = (await res.text()).trim();
    const provider = (res.headers.get("x-isa-provider") as ProviderName | null) ?? null;
    return { text, provider };
  } catch {
    return { text: "", provider: null };
  }
}
