// ISA — Conversation Layer · Entity extraction (deterministic)
// Pulls structured values out of a raw message with regex + keyword tables.
// No LLM, no guessing — if a value isn't clearly present, it's simply absent.

import { todayISO } from "@/lib/datetime";
import type { ExtractedEntities } from "./types";
import type { IntelModule } from "@/lib/intelligence";

// Both languages — the app is used in Uzbek, so the engine must understand it.
const MODULE_WORDS: [IntelModule, RegExp][] = [
  ["money", /\b(money|spend|spending|expense|budget|saving|income|finance|pul|xarajat|sarf|byudjet|daromad|jamg)/i],
  ["goals", /\b(goals?|maqsad)/i],
  ["projects", /\b(projects?|loyiha)/i],
  ["habits", /\b(habits?|odat)/i],
  ["focus", /\b(focus|deep work|concentrat|fokus|diqqat)/i],
  ["journal", /\b(journal|reflect|diary|kundalik|jurnal)/i],
  ["prayer", /\b(prayer|pray|salah|namoz|ibodat)/i],
  ["running", /\b(run|running|jog|km|kilomet|yugur|chaqirim)/i],
  ["calendar", /\b(calendar|schedule|events?|kalendar|jadval)/i],
  ["ideas", /\b(idea|ideas|note|notes|g'oya|goya|fikr)/i],
  ["progress", /\b(progress|ascent|overview|taraqqiyot|natija)/i],
  ["energy", /\b(energy|sleep|mood|rest|recover|uyqu|kayfiyat|dam|energiya)/i],
];

/** Parse a money amount, honoring k/m suffixes and thousands separators. */
function parseAmount(text: string): number | undefined {
  const m = text.match(/(\d[\d\s.,]*)\s*(k|m|mln|million|thousand|ming|million|so'?m|som)?/i);
  if (!m) return undefined;
  // Only treat as an amount when the message is money-flavored (en + uz).
  if (
    !/(spent|spend|paid|cost|save|saved|income|earn|expense|budget|money|\$|so'?m|som|sarfla|to'?la|xarajat|pul|daromad|oldim|sotib)/i.test(
      text
    )
  )
    return undefined;
  const raw = Number(m[1].replace(/[\s,]/g, ""));
  if (Number.isNaN(raw)) return undefined;
  const suffix = (m[2] ?? "").toLowerCase();
  if (suffix === "k" || suffix === "thousand" || suffix === "ming") return raw * 1_000;
  if (suffix === "m" || suffix === "mln" || suffix === "million") return raw * 1_000_000;
  return raw;
}

function parseDistanceKm(text: string): number | undefined {
  const m = text.match(/(\d+(?:\.\d+)?)\s*(km|kilomet\w*|chaqirim)\b/i);
  if (m) return Number(m[1]);
  if (/\b(ran|run|jog|yugur)/i.test(text)) {
    const bare = text.match(/(\d+(?:\.\d+)?)\s*(?:k)\b/i);
    if (bare) return Number(bare[1]);
  }
  return undefined;
}

/** Is this a PLAN rather than something already done? "ertaga", "tomorrow". */
function parseFuture(text: string): boolean {
  return /\b(ertaga|tomorrow|keyin|kelasi|next week|haftaga|rejalashtir|qilaman|yuguraman|boraman)\b/i.test(text);
}

function parseTime(text: string): string | undefined {
  const m = text.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
  if (!m) return undefined;
  let h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  const ap = (m[3] ?? "").toLowerCase();
  if (ap === "pm" && h < 12) h += 12;
  if (ap === "am" && h === 12) h = 0;
  if (h > 23 || min > 59) return undefined;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function parseModule(text: string): IntelModule | undefined {
  for (const [mod, re] of MODULE_WORDS) if (re.test(text)) return mod;
  return undefined;
}

/** Best-effort title after a create verb: "create a goal to save 3M" → "save 3M". */
function parseTitle(text: string): string | undefined {
  const m = text.match(/\b(?:goal|habit|project|reminder)\s+(?:to|for|called|named)?\s*(.+)$/i);
  if (m) return m[1].replace(/[?.!]+$/, "").trim() || undefined;
  const remind = text.match(/\bremind me to\s+(.+?)(?:\s+every\b|\s+at\b|$)/i);
  if (remind) return remind[1].trim() || undefined;
  return undefined;
}

const CATEGORY_WORDS = [
  "food",
  "transport",
  "education",
  "health",
  "shopping",
  "entertainment",
  "bills",
  "rent",
  "groceries",
  "coffee",
  "dining",
];

function parseCategory(text: string): string | undefined {
  const lower = text.toLowerCase();
  const hit = CATEGORY_WORDS.find((c) => lower.includes(c));
  return hit ? hit[0].toUpperCase() + hit.slice(1) : undefined;
}

export function extractEntities(message: string): ExtractedEntities {
  const text = message.trim();
  const e: ExtractedEntities = {};
  const amount = parseAmount(text);
  if (amount != null) e.amount = amount;
  const distance = parseDistanceKm(text);
  if (distance != null) e.distanceKm = distance;
  const time = parseTime(text);
  if (time) e.timeOfDay = time;
  const mod = parseModule(text);
  if (mod) e.module = mod;
  const cat = parseCategory(text);
  if (cat) e.category = cat;
  const title = parseTitle(text);
  if (title) e.title = title;
  if (/\bevery ?day\b|\bdaily\b|\beach day\b|har kuni|kunda/i.test(text)) e.everyDay = true;
  if (/\btoday\b|bugun/i.test(text)) e.date = todayISO();
  if (parseFuture(text)) {
    e.future = true;
    if (/\b(ertaga|tomorrow)\b/i.test(text)) {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      e.date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }
  }

  // A topic for search/reflection: the noun-ish tail after a wh-word or "about".
  const about = text.match(/\babout\s+([a-z0-9 ]{3,40})/i);
  if (about) e.topic = about[1].trim();
  return e;
}
