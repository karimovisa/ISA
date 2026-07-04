import { adminClient } from "@/lib/webpush";

export async function POST(request: Request) {
  const jwt = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!jwt) return Response.json({ error: "unauthorized" }, { status: 401 });

  const admin = adminClient();
  const {
    data: { user },
  } = await admin.auth.getUser(jwt);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const sub = await request.json();
  if (!sub?.endpoint || !sub?.keys)
    return Response.json({ error: "bad_subscription" }, { status: 400 });

  await admin.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint: sub.endpoint,
      keys_p256dh: sub.keys.p256dh,
      keys_auth: sub.keys.auth,
    },
    { onConflict: "endpoint" }
  );
  await admin
    .from("notification_settings")
    .upsert({ user_id: user.id, push_enabled: true });

  return Response.json({ ok: true });
}
