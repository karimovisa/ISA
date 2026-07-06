import { adminClient, sendToSub } from "@/lib/webpush";
import type { SupabaseClient } from "@supabase/supabase-js";

type Payload = { title: string; body: string; url?: string };

// User's timezone offset (UTC+5) — reminder times are local wall-clock.
const TZ_OFFSET_MIN = 300;

function localNow() {
  const local = new Date(Date.now() + TZ_OFFSET_MIN * 60_000);
  return {
    date: local.toISOString().slice(0, 10),
    minutes: local.getUTCHours() * 60 + local.getUTCMinutes(),
    dow: local.getUTCDay(),
  };
}

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
 * User-scheduled reminders (`reminders` table). Called every 5 minutes by
 * Supabase pg_cron. A reminder fires when its local time has passed within
 * the last 15 min, today matches its `days`, and it hasn't fired today.
 */
const PRAYER_LABELS_UZ: Record<string, string> = {
  bomdod: "Bomdod",
  peshin: "Peshin",
  asr: "Asr",
  shom: "Shom",
  xufton: "Xufton",
};

/** Push when a prayer's start time matches the current minute. */
async function sendPrayerNotifications(
  admin: SupabaseClient,
  now: ReturnType<typeof localNow>
): Promise<number> {
  const { data: times } = await admin
    .from("prayer_times")
    .select("*")
    .eq("city", "sirdaryo")
    .eq("date", now.date)
    .maybeSingle();
  if (!times) return 0;

  const due = (["bomdod", "peshin", "asr", "shom", "xufton"] as const).filter(
    (n) => {
      const [h, m] = String(times[n]).split(":").map(Number);
      return h * 60 + m === now.minutes;
    }
  );
  if (due.length === 0) return 0;

  const { data: users } = await admin
    .from("prayer_preferences")
    .select("user_id")
    .eq("notifications_enabled", true)
    .eq("activated", true);

  let sent = 0;
  for (const u of users ?? []) {
    const uid = u.user_id as string;
    const name = await firstName(admin, uid);
    const { data: subs } = await admin
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", uid);
    for (const prayer of due) {
      const body = `${name} ${PRAYER_LABELS_UZ[prayer]} kirdi. O'qib qo'ying qazo bo'lib qolmasin-a!`;
      for (const s of subs ?? []) {
        const ok = await sendToSub(admin, s, {
          title: "Namoz vaqti",
          body,
          url: "/pray",
        });
        if (ok) sent++;
      }
    }
  }
  return sent;
}

async function handleCustom(admin: SupabaseClient) {
  const now = localNow();
  let sentAlarms = 0;
  const prayerSent = await sendPrayerNotifications(admin, now);

  // Focus alarms: timer finished while the app was closed → one push, then
  // the row is deleted (the app logs the session when reopened).
  const { data: alarms } = await admin
    .from("focus_alarms")
    .select("*")
    .lte("end_at", new Date().toISOString());
  for (const a of alarms ?? []) {
    const uid = a.user_id as string;
    await admin.from("focus_alarms").delete().eq("user_id", uid);
    const { data: ns } = await admin
      .from("notification_settings")
      .select("push_enabled")
      .eq("user_id", uid)
      .maybeSingle();
    if (!ns?.push_enabled) continue;
    const name = await firstName(admin, uid);
    const min = Math.round(((a.duration_s as number) ?? 0) / 60);
    const { data: subs } = await admin
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", uid);
    for (const s of subs ?? []) {
      const ok = await sendToSub(admin, s, {
        title: "Focus complete ✓",
        body: `${name}, ${min} min of “${(a.label as string) || "Focus"}” done. Open ISA to log it.`,
        url: "/focus",
      });
      if (ok) sentAlarms++;
    }
  }

  const { data: reminders } = await admin
    .from("reminders")
    .select("*")
    .eq("enabled", true)
    .or(`last_sent_date.is.null,last_sent_date.lt.${now.date}`);

  let sent = 0;
  for (const r of reminders ?? []) {
    const [h, m] = String(r.remind_time).split(":").map(Number);
    const rMin = h * 60 + m;
    if (!(rMin <= now.minutes && now.minutes - rMin < 15)) continue;
    const days = (r.days as number[] | null) ?? [];
    if (days.length > 0 && !days.includes(now.dow)) continue;

    const uid = r.user_id as string;
    const { data: ns } = await admin
      .from("notification_settings")
      .select("push_enabled")
      .eq("user_id", uid)
      .maybeSingle();
    if (!ns?.push_enabled) continue;

    const markSent = () =>
      admin.from("reminders").update({ last_sent_date: now.date }).eq("id", r.id);

    const name = await firstName(admin, uid);
    let body: string;
    let url = "/";

    if (r.kind === "habit" && r.habit_id) {
      const { data: habit } = await admin
        .from("habits")
        .select("name,is_active")
        .eq("id", r.habit_id)
        .maybeSingle();
      if (!habit?.is_active) continue;
      const { count } = await admin
        .from("habit_logs")
        .select("id", { count: "exact", head: true })
        .eq("habit_id", r.habit_id)
        .eq("date", now.date)
        .eq("completed", true);
      if (count && count > 0) {
        await markSent(); // already done today — stay quiet
        continue;
      }
      body = (r.body as string) || `${name}, time for “${habit.name}” — keep the streak alive.`;
      url = "/habits";
    } else if (r.kind === "todo") {
      const { data: todos } = await admin
        .from("todos")
        .select("title")
        .eq("user_id", uid)
        .eq("date", now.date)
        .eq("done", false);
      if (!todos || todos.length === 0) {
        await markSent(); // list is clear — stay quiet
        continue;
      }
      const names = todos.slice(0, 3).map((t) => t.title as string).join(", ");
      const more = todos.length > 3 ? ` +${todos.length - 3} more` : "";
      body =
        (r.body as string) ||
        `${name}, ${todos.length} task${todos.length === 1 ? "" : "s"} left today: ${names}${more}.`;
    } else {
      body = (r.body as string) || `${name}, don't forget: ${r.title}.`;
    }

    const { data: subs } = await admin
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", uid);
    for (const s of subs ?? []) {
      const ok = await sendToSub(admin, s, {
        title: (r.title as string) || "ISA",
        body,
        url,
      });
      if (ok) sent++;
    }
    await markSent();
  }
  return Response.json({ type: "custom", sent, alarms: sentAlarms, prayers: prayerSent });
}

/**
 * Push dispatcher. `type` selects which reminders to send:
 *   journal | habits | daily (journal + habits) | weekly | custom
 * Vercel cron calls `daily`/`weekly`; Supabase pg_cron calls `custom` every 5 min.
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const type = new URL(request.url).searchParams.get("type") ?? "daily";
  const admin = adminClient();
  if (type === "custom") return handleCustom(admin);
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
