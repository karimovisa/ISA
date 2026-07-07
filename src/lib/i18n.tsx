"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type Lang = "en" | "uz";

/**
 * English text IS the key. This map holds Uzbek overrides; anything missing
 * simply falls back to English, so untranslated strings never break.
 * Use `{name}` placeholders with t("...", { name }).
 */
const UZ: Record<string, string> = {
  // ── Navigation ──
  Dashboard: "Boshqaruv",
  Goals: "Maqsadlar",
  Projects: "Loyihalar",
  Ideas: "G'oyalar",
  Progress: "Natijalar",
  Journal: "Kundalik",
  Focus: "Diqqat",
  Habits: "Odatlar",
  Calendar: "Kalendar",
  Pray: "Namoz",
  Prayer: "Namoz",
  Settings: "Sozlamalar",
  Menu: "Menyu",
  "Sign out": "Chiqish",
  Search: "Qidiruv",

  // ── Greetings ──
  "Good morning": "Xayrli tong",
  "Good afternoon": "Xayrli kun",
  "Good evening": "Xayrli kech",
  "Good night": "Xayrli tun",
  Welcome: "Xush kelibsiz",
  "You are getting closer to your goals.":
    "Maqsadlaringga yaqinlashib borayapsan.",

  // ── Page subtitles ──
  "Catch the sparks before they fade.":
    "Uchqunlarni o'chib ketmasdan ilib qol.",
  "Your days, colored by mood.": "Kunlaring — kayfiyat ranglarida.",
  "The mountains you are climbing. One percent at a time.":
    "Chiqayotgan cho'qqilaring. Har safar bir foizdan.",
  "Write your day. Clear your head.": "Kuningni yoz. Fikringni tinitib ol.",
  "One thing. Full attention. Nothing else.":
    "Bitta ish. To'liq diqqat. Boshqa hech narsa.",
  "Check in each day. A missed day breaks the streak.":
    "Har kuni belgila. Qoldirilgan kun ketma-ketlikni uzadi.",
  "Five daily prayers — keep track.": "Besh mahal namoz — kuzatib bor.",
  "Your space, your rules.": "O'z makoning, o'z qoidalaring.",
  "What you are building right now.": "Ayni damda nima qurayotganing.",
  "The numbers behind the momentum. Last 7 days.":
    "Sur'at ortidagi raqamlar. Oxirgi 7 kun.",

  // ── Empty states ──
  "No goals yet": "Hali maqsad yo'q",
  "Name your first summit and start the climb.":
    "Birinchi cho'qqingni belgila va yuksalishni boshla.",
  "Add your first goal": "Birinchi maqsadingni qo'sh",
  "No projects yet": "Hali loyiha yo'q",
  "Break a goal into a project you can actually ship.":
    "Maqsadni yakunlab bo'ladigan loyihaga ajrat.",
  "Add your first project": "Birinchi loyihangni qo'sh",
  "Your vault is empty": "Xazinang bo'sh",
  "Drop the next thought before it slips away.":
    "Keyingi fikringni yo'qolib ketmasdan yozib qo'y.",
  "Capture your first idea": "Birinchi g'oyangni yozib ol",
  "No habits yet": "Hali odat yo'q",
  "Pick one small thing to repeat every day.":
    "Har kuni takrorlaydigan bitta kichik ishni tanla.",
  "Add your first habit": "Birinchi odatingni qo'sh",

  // ── Common actions ──
  Save: "Saqlash",
  "Save entry": "Yozuvni saqlash",
  Saved: "Saqlandi",
  "Saving…": "Saqlanmoqda…",
  Cancel: "Bekor qilish",
  Delete: "O'chirish",
  Edit: "Tahrirlash",
  Add: "Qo'shish",
  Create: "Yaratish",
  "New goal": "Yangi maqsad",
  "New project": "Yangi loyiha",
  "New idea": "Yangi idea",
  "New habit": "Yangi odat",
  "New to-do": "Yangi vazifa",
  "Create habit": "Odat yaratish",
  Today: "Bugun",
  "Today's to-do": "Bugungi vazifalar",
  "Add a task…": "Vazifa qo'shing…",
  "What did I do today?": "Bugun nima qildim?",
  "What did I learn?": "Nima o'rgandim?",
  "What will I do tomorrow?": "Ertaga nima qilaman?",
  "What did I learn? (optional)": "Nima o'rgandim? (ixtiyoriy)",
  "What will I do tomorrow? (optional)": "Ertaga nima qilaman? (ixtiyoriy)",
  "Write about your day — what happened, what's on your mind, anything…":
    "Kuning haqida yoz — nima bo'ldi, nima o'yingda, istagan narsang…",
  "Write freely…": "Erkin yoz…",
  "Saved entries": "Saqlangan yozuvlar",

  // ── Dashboard ──
  "Journaling streak": "Kundalik ketma-ketligi",
  "Focus this week": "Bu hafta diqqat",
  "Next deadline": "Keyingi muddat",
  "set a deadline": "muddat belgilang",
  day: "kun",
  days: "kun",
  min: "daq",
  "The ascent": "Yuksalish",
  "Your overall progress toward the summit":
    "Cho'qqi sari umumiy natijang",
  "Capture an idea before it fades…":
    "G'oyani o'chib ketmasdan yozib qoling…",
  "in your vault": "xazinangda",
  "{n}% overall progress": "{n}% umumiy natija",
  "{n} active": "{n} ta faol",
  "weekly momentum": "haftalik sur'at",

  // ── Settings ──
  Theme: "Mavzu",
  "Pick the palette for your space.": "Makoning uchun rang tanla.",
  Language: "Til",
  "Choose your language.": "Tilingizni tanlang.",
  Active: "Faol",
  "Export your data": "Ma'lumotlaringni yuklab ol",
  "Gentle reminders for journaling, habits, and your weekly review — even when ISA is closed.":
    "Kundalik, odatlar va haftalik sharh uchun eslatmalar — ISA yopiq bo'lsa ham.",
  "Push notifications": "Push bildirishnomalar",
  "Enable notifications": "Bildirishnomalarni yoqish",
  "Enabling…": "Yoqilmoqda…",
  Enabled: "Yoqilgan",
  "Send test": "Sinov yuborish",
  "Backup & restore": "Zaxira va tiklash",
  "Download JSON": "JSON yuklab olish",
  Restore: "Tiklash",
  Reminders: "Eslatmalar",

  // ── Prayer ──
  Next: "Keyingi",
  today: "bugun",
  Activate: "Faollashtirish",
  now: "hozir",
  missed: "qazo",
  "on time": "vaqtida",
  late: "kechikkan",
  Statistics: "Statistika",
  "Last 7 days": "Oxirgi 7 kun",
  "Last 30 days": "Oxirgi 30 kun",

  // ── Login ──
  "Sign in": "Kirish",
  "Create account": "Hisob yaratish",
  "Please wait…": "Kuting…",
  "Welcome back. Sign in to your space.":
    "Xush kelibsiz. Makoningizga kiring.",
  "Create your personal operating system.":
    "Shaxsiy operatsion tizimingizni yarating.",
  Email: "Email",
  Password: "Parol",
  "First name": "Ism",
  "No account yet?": "Hali hisob yo'qmi?",
  "Create one": "Yarating",
  "Already have an account?": "Hisobingiz bormi?",
  "Your personal operating system.": "Shaxsiy operatsion tizimingiz.",
  "One quiet place for everything that moves you forward — built like an ascent: you climb a little every day.":
    "Sizni oldinga suradigan hamma narsa uchun bitta tinch makon — yuksalishdek qurilgan: har kuni sal-pal yuqoriga chiqasiz.",
  "Goals as summits — every climb tracked in percent.":
    "Maqsadlar — cho'qqilar, har biri foizda kuzatiladi.",
  "Focus timer that logs your deep-work sessions itself.":
    "Chuqur ish sessiyalaringizni o'zi yozib boradigan diqqat taymeri.",
  "Daily habits with streaks and a 7-day grid.":
    "Ketma-ketlik va 7 kunlik jadval bilan kunlik odatlar.",
  "A two-minute journal with mood, mapped on a calendar.":
    "Kayfiyatli, kalendarga tushadigan ikki daqiqalik kundalik.",
  "Keep showing up, and ISA gives back":
    "Muntazam kel — ISA evaziga qaytaradi",
  "Streaks that build momentum": "Sur'at to'playdigan ketma-ketliklar",
  "An Energy Score from your sleep": "Uyqungizdan Energiya bahosi",
  "A weekly review every Sunday": "Har yakshanba haftalik sharh",
  "The Ascent — progress as altitude": "Yuksalish — natija balandlikda",

  // ── Prayer extra ──
  "Prayer is locked": "Namoz bo'limi yopiq",
  "If you pray, activate this section to start tracking.":
    "Namoz o'qisangiz, kuzatuvni boshlash uchun bu bo'limni faollashtiring.",
  "Get prayer reminders?": "Namoz eslatmalari kelsinmi?",
  "You'll get a notification when each prayer begins.":
    "Har namoz kirganда bildirishnoma keladi.",
  "Yes, remind me": "Ha, eslatib turing",
  No: "Yo'q",
  "Times not loaded yet": "Vaqtlar hali yuklanmagan",
  "Prayer times refresh automatically every day. Check back in a moment.":
    "Namoz vaqtlari har kuni avtomatik yangilanadi. Birozdan keyin qayta qarang.",
  "done": "o'qildi",
};

const Ctx = createContext<{
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}>({ lang: "en", setLang: () => {}, t: (k) => k });

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("isa_lang");
      if (saved === "uz" || saved === "en") setLangState(saved);
    } catch {}
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem("isa_lang", l);
    } catch {}
    if (typeof document !== "undefined") document.documentElement.lang = l;
  };

  const t = (key: string, vars?: Record<string, string | number>) => {
    let s = lang === "uz" ? UZ[key] ?? key : key;
    if (vars)
      for (const k of Object.keys(vars))
        s = s.replace(new RegExp(`\\{${k}\\}`, "g"), String(vars[k]));
    return s;
  };

  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

export const useT = () => useContext(Ctx);
