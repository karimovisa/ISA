import { adminClient, exchangeCode } from "@/lib/strava";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const back = (status: string) =>
    Response.redirect(new URL(`/progress?strava=${status}`, url.origin));

  if (error || !code || !state) return back("denied");

  try {
    const admin = adminClient();

    // Resolve the nonce → user, then consume it.
    const { data: st } = await admin
      .from("strava_oauth_states")
      .select("user_id")
      .eq("nonce", state)
      .single();
    if (!st) return back("expired");
    await admin.from("strava_oauth_states").delete().eq("nonce", state);

    const token = await exchangeCode(code);

    await admin.from("strava_connections").upsert({
      user_id: st.user_id,
      athlete_id: token.athlete?.id ?? null,
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      expires_at: new Date(token.expires_at * 1000).toISOString(),
      scope: url.searchParams.get("scope"),
    });

    return back("connected");
  } catch {
    return back("failed");
  }
}
