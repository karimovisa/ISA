import { adminClient, sendToSub } from "@/lib/webpush";
import type { SupabaseClient } from "@supabase/supabase-js";

type Payload = { title: string; body: string; url?: string };

/** First name from user_metadata.full_name, falling back to "there". */
async function firstName(admin: SupabaseClient, uid: string): Promise<string> {
  const { data: u } = await admin.auth.admin.getUserById(uid);
  return (
    ((u.user?.user_metadata?.full_name as string | undefined) || "")
      .trim()
      .split(/\s+/)[0] || "there"
  );
}

/** Journal nudge — only if the user hasn't journaled today. */
async function journalPayload(
  admin: SupabaseClient,
  uid: string,
  today: string
): Promise<Payload | null> {
  const { count } = await admin
    .from("journal_entries")
    .select("id", { count: "exact", head: true })
    .eq("user_id", uid)
    .eq("entry_date", today);
  if (count && count > 0) return null;
  const name = await firstName(admin, uid);
  return {
    title: "ISA",
    body: `${name}, you haven't journaled today — give it 2 minutes.`,
    url: "/journal",
  };
}

/** Habit nudge — only for active habits not yet completed today. */
async function habitsPayload(
  admin: SupabaseClient,
  uid: string,
  today: string
): Promise<Payload | null> {
  const { data: habits } = await admin
    .from("habits")
    .select("id,name")
    .eq("user_id", uid)
    .eq("is_active", true);
  if (!habits || habits.length === 0) return null;

  const { data: logs } = await admin
    .from("habit_logs")
    .select("habit_id")
    .eq("user_id", uid)
    .eq("date", today)
    .eq("completed", true);
  const done = new Set((logs ?? []).map((l) => l.habit_id as string));
  const left = habits.filter((h) => !done.has(h.id as string));
  if (left.length === 0) return null;

  const name = await firstName(admin, uid);
  const names = left
    .slice(0, 3)
    .map((h) => h.name as string)
    .join(", ");
  const more = left.length > 3 ? ` +${left.length - 3} more` : "";
  const noun = left.length === 1 ? "habit" : "habits";
  return {
    title: "Keep your streak",
    body: `${name}, ${left.length} ${noun} left today: ${names}${more}.`,
    url: "/habits",
  };
}

/** Weekly-review nudge — only if there's an unseen review from the last ~8 days. */
async function weeklyPayload(
  admin: SupabaseClient,
  uid: string
): Promise<Payload | null> {
  const since = new Date();
  since.setDate(since.getDate() - 8);
  const { data: reviews } = await admin
    .from("weekly_reviews")
    .select("id,week_start_date")
    .eq("user_id", uid)
    .is("seen_at", null)
    .gte("week_start_date", since.toISOString().slice(0, 10))
    .order("week_start_date", { ascending: false })
    .limit(1);
  if (!reviews || reviews.length === 0) return null;
  const name = await firstName(admin, uid);
  return {
    title: "Weekly review",
    body: `${name}, your weekly review is ready — see how your week went.`,
    url: "/",
  };
}

/**
 * Push dispatcher. `type` selects which reminders to send:
 *   journal | habits | daily (journal + habits) | weekly
 * Cron calls `daily` every evening and `weekly` on Sundays.
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const type = new URL(request.url).searchParams.get("type") ?? "daily";
  const admin = adminClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: enabled } = await admin
    .from("notification_settings")
    .select("user_id")
    .eq("push_enabled", true);

  let sent = 0;
  for (const row of enabled ?? []) {
    const uid = row.user_id as string;

    const payloads: Payload[] = [];
    if (type === "journal" || type === "daily") {
      const p = await journalPayload(admin, uid, today);
      if (p) payloads.push(p);
    }
    if (type === "habits" || type === "daily") {
      const p = await habitsPayload(admin, uid, today);
      if (p) payloads.push(p);
    }
    if (type === "weekly") {
      const p = await weeklyPayload(admin, uid);
      if (p) payloads.push(p);
    }
    if (payloads.length === 0) continue;

    const { data: subs } = await admin
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", uid);

    for (const s of subs ?? []) {
      for (const payload of payloads) {
        const ok = await sendToSub(admin, s, payload);
        if (ok) sent++;
      }
    }
  }
  return Response.json({ type, sent });
}
