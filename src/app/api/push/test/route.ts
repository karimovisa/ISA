import { adminClient, sendToSub } from "@/lib/webpush";

export async function POST(request: Request) {
  const jwt = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!jwt) return Response.json({ error: "unauthorized" }, { status: 401 });

  const admin = adminClient();
  const {
    data: { user },
  } = await admin.auth.getUser(jwt);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const name =
    ((user.user_metadata?.full_name as string | undefined) || "")
      .trim()
      .split(/\s+/)[0] || "there";

  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("*")
    .eq("user_id", user.id);

  let sent = 0;
  for (const s of subs ?? []) {
    const ok = await sendToSub(admin, s, {
      title: "ISA",
      body: `${name}, this is your ISA reminder — notifications are on.`,
      url: "/",
    });
    if (ok) sent++;
  }
  return Response.json({ sent });
}
