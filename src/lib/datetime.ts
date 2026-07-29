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

export function formatDate(date: Date, lang = "en"): string {
  return date.toLocaleDateString(DATE_LOCALE[lang] ?? "en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
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
