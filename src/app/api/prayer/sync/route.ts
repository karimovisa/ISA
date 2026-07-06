import { adminClient } from "@/lib/webpush";

export const runtime = "nodejs";

const CITY = "sirdaryo";
// Guliston (Sirdaryo region centre) — used for the Aladhan fallback.
const LAT = 40.4897;
const LNG = 68.7842;

type Row = {
  city: string;
  date: string;
  bomdod: string;
  quyosh: string;
  peshin: string;
  asr: string;
  shom: string;
  xufton: string;
};

const clean = (t: string) => {
  const m = t.match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return `${m[1].padStart(2, "0")}:${m[2]}:00`;
};

/** Full current month (and next, near month end) from the Aladhan calendar. */
async function fromAladhan(): Promise<Row[]> {
  const now = new Date(Date.now() + 5 * 3600_000); // +05
  const months = [{ y: now.getUTCFullYear(), m: now.getUTCMonth() + 1 }];
  if (now.getUTCDate() >= 25) {
    const nx = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    months.push({ y: nx.getUTCFullYear(), m: nx.getUTCMonth() + 1 });
  }
  const rows: Row[] = [];
  for (const { y, m } of months) {
    const url = `https://api.aladhan.com/v1/calendar/${y}/${m}?latitude=${LAT}&longitude=${LNG}&method=3`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) continue;
    const json = (await res.json()) as {
      data: {
        timings: Record<string, string>;
        date: { gregorian: { date: string } };
      }[];
    };
    for (const d of json.data ?? []) {
      const [dd, mm, yyyy] = d.date.gregorian.date.split("-");
      const t = d.timings;
      const b = clean(t.Fajr),
        q = clean(t.Sunrise),
        p = clean(t.Dhuhr),
        a = clean(t.Asr),
        s = clean(t.Maghrib),
        x = clean(t.Isha);
      if (b && q && p && a && s && x)
        rows.push({
          city: CITY,
          date: `${yyyy}-${mm}-${dd}`,
          bomdod: b,
          quyosh: q,
          peshin: p,
          asr: a,
          shom: s,
          xufton: x,
        });
    }
  }
  return rows;
}

/** Today's exact times from namozvaqti.uz (label-anchored, tolerant of tags). */
async function scrapeToday(): Promise<Row | null> {
  try {
    const res = await fetch(`https://namozvaqti.uz/shahar/${CITY}`, {
      cache: "no-store",
      headers: { "User-Agent": "Mozilla/5.0 ISA/1.0" },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const grab = (label: string) => {
      const re = new RegExp(`${label}[\\s\\S]{0,160}?(\\d{1,2}:\\d{2})`, "i");
      return clean(html.match(re)?.[1] ?? "");
    };
    const bomdod = grab("Bomdod");
    const quyosh = grab("Quyosh");
    const peshin = grab("Peshin");
    const asr = grab("Asr");
    const shom = grab("Shom");
    const xufton = grab("Xufton");
    if (!(bomdod && quyosh && peshin && asr && shom && xufton)) return null;
    const now = new Date(Date.now() + 5 * 3600_000);
    const date = now.toISOString().slice(0, 10);
    return { city: CITY, date, bomdod, quyosh, peshin, asr, shom, xufton };
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = adminClient();
  const rows = await fromAladhan();

  // Override today with the exact namozvaqti.uz values when the scrape works.
  const scraped = await scrapeToday();
  let source = "aladhan";
  if (scraped) {
    source = "scrape+aladhan";
    const i = rows.findIndex((r) => r.date === scraped.date);
    if (i >= 0) rows[i] = scraped;
    else rows.push(scraped);
  }

  if (rows.length === 0)
    return Response.json({ error: "no data" }, { status: 502 });

  const { error } = await admin
    .from("prayer_times")
    .upsert(rows, { onConflict: "city,date" });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ source, upserted: rows.length });
}
