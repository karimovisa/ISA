import { adminClient, sendToSub } from "@/lib/webpush";

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    auth !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = adminClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: enabled } = await admin
    .from("notification_settings")
    .select("user_id")
    .eq("push_enabled", true);

  let sent = 0;
  for (const row of enabled ?? []) {
    const uid = row.user_id as string;

    // Skip users who already journaled today.
    const { count } = await admin
      .from("journal_entries")
      .select("id", { count: "exact", head: true })
      .eq("user_id", uid)
      .eq("entry_date", today);
    if (count && count > 0) continue;

    const { data: u } = await admin.auth.admin.getUserById(uid);
    const name =
      ((u.user?.user_metadata?.full_name as string | undefined) || "")
        .trim()
        .split(/\s+/)[0] || "there";

    const { data: subs } = await admin
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", uid);

    for (const s of subs ?? []) {
      const ok = await sendToSub(admin, s, {
        title: "ISA",
        body: `${name}, you haven't journaled today — give it 2 minutes.`,
        url: "/journal",
      });
      if (ok) sent++;
    }
  }
  return Response.json({ sent });
}
