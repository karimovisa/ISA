import {
  adminClient,
  validAccessToken,
  fetchActivities,
  isRun,
} from "@/lib/strava";

export async function POST(request: Request) {
  const jwt = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!jwt) return Response.json({ error: "unauthorized" }, { status: 401 });

  const admin = adminClient();
  const {
    data: { user },
  } = await admin.auth.getUser(jwt);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { data: conn } = await admin
    .from("strava_connections")
    .select("*")
    .eq("user_id", user.id)
    .single();
  if (!conn) return Response.json({ error: "not_connected" }, { status: 400 });

  try {
    const token = await validAccessToken(admin, conn);
    // First sync pulls the last ~year; later syncs only fetch new activity.
    const afterUnix = conn.last_sync
      ? Math.floor(new Date(conn.last_sync).getTime() / 1000)
      : Math.floor(Date.now() / 1000) - 365 * 86_400;

    const activities = await fetchActivities(token, afterUnix);
    const runs = activities.filter(isRun);

    if (runs.length > 0) {
      const rows = runs.map((a) => ({
        id: a.id,
        user_id: user.id,
        name: a.name,
        distance_m: a.distance,
        moving_time_s: a.moving_time,
        elapsed_time_s: a.elapsed_time,
        total_elevation: a.total_elevation_gain,
        average_speed: a.average_speed,
        start_date: a.start_date,
      }));
      await admin.from("strava_activities").upsert(rows);
    }

    await admin
      .from("strava_connections")
      .update({ last_sync: new Date().toISOString() })
      .eq("user_id", user.id);

    return Response.json({ imported: runs.length });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "sync_failed" },
      { status: 500 }
    );
  }
}
