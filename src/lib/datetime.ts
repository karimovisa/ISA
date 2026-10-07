export function greetingFor(date = new Date()): string {
  const h = date.getHours();
  if (h < 5) return "Good night";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Map the app language to a real BCP-47 locale so the weekday/month names match
// the chosen language — never the device's system locale (which was leaking
// Russian weekday names into an Uzbek UI).
const DATE_LOCALE: Record<string, string> = { en: "en-US", uz: "uz-UZ", ru: "ru-RU" };

// Browsers ship no Uzbek month/weekday names (Chrome renders "M10 7, Wed"), so
// Uzbek is spelled out here; English and Russian use Intl.
const UZ_MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
const UZ_WEEKDAYS = ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export type DateStyle =
  | "weekdayDayMonth" // Wednesday, October 7 · Chorshanba, 7-oktabr
  | "dayMonth" //        October 7 · 7-oktabr
  | "dayMonthShort" //   Oct 7 · 7-okt
  | "monthYear"; //      October 2026 · Oktabr 2026

/** A date in the app's language — never the device locale, never Chrome's
 *  placeholder Uzbek. */
export function formatLocalDate(date: Date, lang: string, style: DateStyle): string {
  if (lang === "uz") {
    const day = date.getDate();
    const month = UZ_MONTHS[date.getMonth()];
    switch (style) {
      case "weekdayDayMonth": return `${UZ_WEEKDAYS[date.getDay()]}, ${day}-${month}`;
      case "dayMonth": return `${day}-${month}`;
      case "dayMonthShort": return `${day}-${month.slice(0, 3)}`;
      case "monthYear": return `${cap(month)} ${date.getFullYear()}`;
    }
  }
  const opts: Record<DateStyle, Intl.DateTimeFormatOptions> = {
    weekdayDayMonth: { weekday: "long", month: "long", day: "numeric" },
    dayMonth: { month: "long", day: "numeric" },
    dayMonthShort: { month: "short", day: "numeric" },
    monthYear: { month: "long", year: "numeric" },
  };
  const out = date.toLocaleDateString(DATE_LOCALE[lang] ?? "en-US", opts[style]);
  return style === "monthYear" ? cap(out) : out;
}

export function formatDate(date: Date, lang = "en"): string {
  return formatLocalDate(date, lang, "weekdayDayMonth");
}

export function formatDeadline(value: string | null): string {
  if (!value) return "No deadline";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString([], { month: "short", year: "numeric" });
}

export function todayISO(): string {
  // Local calendar date (not UTC) so "today" matches the user's timezone.
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}
