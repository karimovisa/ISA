import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const TOKEN_URL = "https://www.strava.com/oauth/token";
const API_BASE = "https://www.strava.com/api/v3";

export const STRAVA_SCOPE = "activity:read_all";

/** Server-only Supabase client using the service role key (bypasses RLS). */
export function adminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase admin env not configured");
  return createClient(url, key, { auth: { persistSession: false } });
}

type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_at: number; // unix seconds
  athlete?: { id: number };
};

/** Exchange an OAuth code for tokens (authorization_code grant). */
export async function exchangeCode(code: string): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Strava token exchange failed: ${res.status}`);
  return res.json();
}

type Connection = {
  user_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
};

/** Returns a valid access token, refreshing + persisting it when expired. */
export async function validAccessToken(
  admin: SupabaseClient,
  conn: Connection
): Promise<string> {
  const expiresMs = new Date(conn.expires_at).getTime();
  if (expiresMs - Date.now() > 120_000) return conn.access_token;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: conn.refresh_token,
    }),
  });
  if (!res.ok) throw new Error(`Strava token refresh failed: ${res.status}`);
  const t: TokenResponse = await res.json();

  await admin
    .from("strava_connections")
    .update({
      access_token: t.access_token,
      refresh_token: t.refresh_token,
      expires_at: new Date(t.expires_at * 1000).toISOString(),
    })
    .eq("user_id", conn.user_id);

  return t.access_token;
}

export type StravaActivity = {
  id: number;
  name: string;
  type: string;
  sport_type: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  total_elevation_gain: number;
  average_speed: number;
  start_date: string;
};

/** Fetch recent activities (paginated), newest first. */
export async function fetchActivities(
  accessToken: string,
  afterUnix?: number,
  maxPages = 4
): Promise<StravaActivity[]> {
  const out: StravaActivity[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const url = new URL(`${API_BASE}/athlete/activities`);
    url.searchParams.set("per_page", "100");
    url.searchParams.set("page", String(page));
    if (afterUnix) url.searchParams.set("after", String(afterUnix));
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error(`Strava activities failed: ${res.status}`);
    const batch: StravaActivity[] = await res.json();
    out.push(...batch);
    if (batch.length < 100) break;
  }
  return out;
}

/** Keep runs only (Run, TrailRun, VirtualRun). */
export function isRun(a: StravaActivity): boolean {
  const t = a.sport_type || a.type;
  return t === "Run" || t === "TrailRun" || t === "VirtualRun";
}
