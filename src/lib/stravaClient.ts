"use client";

import { supabase } from "@/lib/supabase/client";

/** Kick off the Strava OAuth flow: store a nonce, then redirect to Strava. */
export async function connectStrava() {
  // Client ID is public (it appears in the OAuth URL) — hardcode as a fallback
  // so the flow never breaks on a missing/empty env var.
  const clientId = process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID || "262625";
  if (!clientId) {
    alert("Strava is not configured (missing NEXT_PUBLIC_STRAVA_CLIENT_ID).");
    return;
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const nonce = crypto.randomUUID();
  await supabase.from("strava_oauth_states").insert({ nonce, user_id: user.id });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${window.location.origin}/api/strava/callback`,
    response_type: "code",
    approval_prompt: "auto",
    scope: "activity:read_all",
    state: nonce,
  });
  window.location.href = `https://www.strava.com/oauth/authorize?${params}`;
}

/** Ask the server to pull new runs from Strava. Returns imported count. */
export async function syncStrava(): Promise<{ imported?: number; error?: string }> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return { error: "unauthorized" };

  const res = await fetch("/api/strava/sync", {
    method: "POST",
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  return res.json();
}
