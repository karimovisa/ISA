"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type Lang = "en" | "uz" | "ru";
export const LANGS: Lang[] = ["en", "uz", "ru"];

/**
 * English text IS the key. This map holds Uzbek overrides; anything missing
 * simply falls back to English, so untranslated strings never break.
 * Use `{name}` placeholders with t("...", { name }).
 */
const UZ: Record<string, string> = {
  // ── Navigation ──
  Dashboard: "Boshqaruv",
  Goals: "Maqsadlar",
  Money: "Moliya",
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

  // ── Money ──
  "Where it comes from, where it goes, and what it's building toward.":
    "Qayerdan kelayotgani, qayerga ketayotgani va nimaga xizmat qilayotgani.",
  Income: "Kirim",
  Expense: "Chiqim",
  Balance: "Qoldiq",
  "This month's income": "Bu oy kirimi",
  "This month's expenses": "Bu oy chiqimi",
  "Saving rate": "Jamg'arish darajasi",
  "Financial health score": "Moliyaviy salomatlik bali",
  Excellent: "A'lo",
  Good: "Yaxshi",
  "Needs work": "Yaxshilash kerak",
  "At risk": "Xavfli holat",
  Insights: "Tavsiyalar",
  "Add a few transactions to see insights here.":
    "Tavsiyalarni ko'rish uchun bir nechta tranzaksiya qo'shing.",
  "Spending by category": "Kategoriya bo'yicha xarajatlar",
  "Recurring payments": "Doimiy to'lovlar",
  "Recent transactions": "So'nggi tranzaksiyalar",
  "No transactions yet": "Hali tranzaksiya yo'q",
  "Add your first income or expense to get started.":
    "Boshlash uchun birinchi kirim yoki chiqimingizni qo'shing.",
  "Add a transaction": "Tranzaksiya qo'shish",
  "No savings goals yet": "Hali jamg'arma maqsadi yo'q",
  "Name what you're saving for and track it here.":
    "Nima uchun jamg'arayotganingizni nomlang va shu yerda kuzating.",
  "No recurring payments": "Doimiy to'lovlar yo'q",
  "Track subscriptions and bills so they never surprise you.":
    "Obuna va to'lovlaringizni kuzatib, ular sizni hech qachon ajablantirmasin.",
  "Goal name": "Maqsad nomi",
  "Target amount": "Maqsad summasi",
  "Saved so far": "Hozirgacha jamg'arilgan",
  "Target date (optional)": "Maqsad sanasi (ixtiyoriy)",
  "Create goal": "Maqsad yaratish",
  "Save changes": "O'zgarishlarni saqlash",
  Amount: "Summa",
  Category: "Kategoriya",
  Date: "Sana",
  "Note (optional)": "Izoh (ixtiyoriy)",
  "New expense": "Yangi chiqim",
  "New income": "Yangi kirim",
  "Add payment": "To'lov qo'shish",
  "Day of month": "Oyning kuni",
  "due today": "bugun",
  "in {n}d": "{n} kundan keyin",
  "this month": "bu oy",
  "Quick add": "Tez qo'shish",
  "Add expense": "Chiqim qo'shish",
  "Above your average": "O'rtachadan yuqori",
  "Recurring expense": "Takroriy chiqim",
  Coffee: "Qahva",
  Food: "Ovqat",
  Fuel: "Yoqilg'i",
  Taxi: "Taksi",
  Shopping: "Xarid",
  Education: "Ta'lim",

  // ── Onboarding ──
  Skip: "O'tkazib yuborish",
  Back: "Orqaga",
  Done: "Tayyor",
  "Welcome to ISA": "ISA'ga xush kelibsiz",
  "Your Personal Life Operating System. Let's take a quick tour so nothing stays hidden.":
    "Shaxsiy hayot operatsion tizimingiz. Hech narsa yashirin qolmasligi uchun qisqa sayohat qilaylik.",
  "Start tour": "Sayohatni boshlash",
  "Skip for now": "Hozircha o'tkazib yuborish",
  "Your navigation": "Navigatsiyangiz",
  "Every part of ISA is one tap away from here.":
    "ISA'ning har bir qismi shu yerdan bir bosishda.",
  "Your day at a glance — momentum, sleep, to-dos and a daily quote.":
    "Kuningiz bir qarashda — sur'at, uyqu, vazifalar va kunlik iqtibos.",
  "Check in each day and build streaks. A missed day breaks the streak.":
    "Har kuni belgilang va ketma-ketlik tuzing. Qoldirilgan kun ketma-ketlikni uzadi.",
  "Track income, expenses and savings goals — with one-tap quick-add.":
    "Kirim, chiqim va jamg'arma maqsadlarini kuzating — bir bosishli tez qo'shish bilan.",
  "Follow the five daily prayers and keep your record.":
    "Besh mahal namozni kuzatib boring va yozuvingizni saqlang.",
  "A distraction-free timer that logs your deep-work sessions for you.":
    "Chuqur ish sessiyalaringizni o'zi yozib boradigan xalaqitsiz taymer.",
  "Theme, language, notifications, reminders and your data live here.":
    "Mavzu, til, bildirishnomalar, eslatmalar va ma'lumotlaringiz shu yerda.",
  "On your phone, Money, Prayer, Settings and more open from this Menu.":
    "Telefonda Pul, Namoz, Sozlamalar va boshqalar shu Menyudan ochiladi.",
  "No projects yet — add one on the Projects page to track progress here.":
    "Hali loyiha yo'q — Loyihalar sahifasida qo'shsangiz, natijasi shu yerda ko'rinadi.",

  // ── Dashboard / daily brief (these were falling back to English) ──
  "Today's Focus": "Bugungi diqqat",
  Insight: "Tahlil",
  Completed: "Bajarilgan",
  Tomorrow: "Ertaga",
  Upcoming: "Kelayotgan",
  Overdue: "Muddati o'tgan",
  Recent: "So'nggi",
  "Journal not written yet": "Kundalik hali yozilmagan",
  "Journal pending": "Kundalik kutilmoqda",
  "Journaled ✓": "Kundalik yozildi ✓",
  "Journaled today": "Bugun kundalik yozildi",
  "Spending is over income this month": "Bu oy xarajat daromaddan oshdi",
  "Budget is on track": "Byudjet rejada",
  "{title} due in {n} days": "{title} — {n} kundan keyin muddati tugaydi",
  "All of today's tasks are done": "Bugungi barcha vazifalar bajarildi",
  "Add a task or two to start your day.": "Kuningizni boshlash uchun bir-ikki vazifa qo'shing.",
  "tasks remaining": "vazifa qoldi",
  "on track": "rejada",
  "over budget": "byudjetdan oshgan",
  "{n}% overall": "umumiy {n}%",

  // ── Ask ISA ──
  "Ask ISA": "ISA'dan so'rang",
  "Ask your life a question — or add something in a sentence.":
    "Hayotingiz haqida so'rang — yoki bir jumlada qo'shing.",

  // ── Common actions / states ──
  "Load more": "Ko'proq yuklash",
  Generate: "Yaratish",
  Undo: "Qaytarish",
  Yes: "Ha",
  "Got it": "Tushundim",
  Help: "Yordam",
  Reviews: "Hisobotlar",
  Health: "Salomatlik",
  Month: "Oy",
  Year: "Yil",
  "This year": "Shu yil",
  "min read": "daqiqa o'qish",
  "No matches": "Topilmadi",
  "No entries match your search.": "Qidiruvingizga mos yozuv topilmadi.",
  Learned: "O'rgandim",
};

/** Russian overrides. Anything missing falls back to English, exactly like UZ. */
const RU: Record<string, string> = {
  // ── Navigation ──
  Dashboard: "Главная",
  Goals: "Цели",
  Money: "Деньги",
  Projects: "Проекты",
  Ideas: "Идеи",
  Progress: "Прогресс",
  Journal: "Дневник",
  Focus: "Фокус",
  Habits: "Привычки",
  Calendar: "Календарь",
  Pray: "Намаз",
  Prayer: "Намаз",
  Settings: "Настройки",
  Menu: "Меню",
  "Sign out": "Выйти",
  "Sign in": "Войти",
  Search: "Поиск",
  "Ask ISA": "Спросить ISA",

  // ── Greetings ──
  "Good morning": "Доброе утро",
  "Good afternoon": "Добрый день",
  "Good evening": "Добрый вечер",
  "Good night": "Доброй ночи",
  Welcome: "Добро пожаловать",
  "Welcome to ISA": "Добро пожаловать в ISA",
  "Welcome back. Sign in to your space.": "С возвращением. Войдите в своё пространство.",
  "Your personal operating system.": "Ваша личная операционная система.",
  "Create your personal operating system.": "Создайте свою личную операционную систему.",

  // ── Dashboard / daily brief ──
  "Today's Focus": "Фокус дня",
  "Today's to-do": "Задачи на сегодня",
  Insight: "Инсайт",
  Completed: "Выполнено",
  Today: "Сегодня",
  Tomorrow: "Завтра",
  Upcoming: "Предстоящее",
  Overdue: "Просрочено",
  Recent: "Недавнее",
  "Journal not written yet": "Дневник ещё не заполнен",
  "Journal pending": "Дневник ожидает",
  "Journaled ✓": "Дневник записан ✓",
  "Journaled today": "Дневник записан сегодня",
  "Spending is over income this month": "В этом месяце расходы превысили доход",
  "Budget is on track": "Бюджет в норме",
  "{title} due in {n} days": "{title} — срок через {n} дн.",
  "All of today's tasks are done": "Все задачи на сегодня выполнены",
  "Add a task or two to start your day.": "Добавьте пару задач, чтобы начать день.",
  "Add a task…": "Добавить задачу…",
  "tasks remaining": "задач осталось",
  "on track": "в графике",
  "over budget": "перерасход",
  "{n}% overall": "всего {n}%",
  "this month": "в этом месяце",
  "due today": "сегодня",
  "in {n}d": "через {n} дн.",

  // ── Common ──
  Cancel: "Отмена",
  Save: "Сохранить",
  Saved: "Сохранено",
  "Saving…": "Сохранение…",
  "Save entry": "Сохранить запись",
  "Save changes": "Сохранить изменения",
  "Please wait…": "Подождите…",
  "Load more": "Показать ещё",
  Generate: "Сгенерировать",
  Undo: "Отменить",
  Yes: "Да",
  No: "Нет",
  "Got it": "Понятно",
  Next: "Далее",
  Back: "Назад",
  Skip: "Пропустить",
  Done: "Готово",
  Help: "Помощь",
  Reviews: "Отчёты",
  Health: "Здоровье",
  Month: "Месяц",
  Year: "Год",
  "This year": "Этот год",
  "No matches": "Ничего не найдено",
  "Email": "Эл. почта",
  Password: "Пароль",
  "Create account": "Создать аккаунт",
  "Already have an account?": "Уже есть аккаунт?",
  "No account yet?": "Ещё нет аккаунта?",
  "Create one": "Создать",

  // ── Money ──
  Balance: "Баланс",
  Amount: "Сумма",
  Category: "Категория",
  Date: "Дата",
  "Note (optional)": "Заметка (необязательно)",
  Transactions: "Транзакции",
  "Add Expense": "Добавить расход",
  "Add transaction": "Добавить транзакцию",
  "Quick add": "Быстрое добавление",
  "Saved so far": "Накоплено",
  "Target amount": "Целевая сумма",
  "Target date (optional)": "Целевая дата (необязательно)",
  "Create goal": "Создать цель",
  "Recurring payments": "Регулярные платежи",
  "Search transactions…": "Поиск транзакций…",
  Coffee: "Кофе",
  Food: "Еда",
  Fuel: "Топливо",
  Taxi: "Такси",
  Shopping: "Покупки",
  Education: "Образование",

  // ── Journal ──
  Learned: "Чему научился",
  "What did I learn? (optional)": "Чему я научился? (необязательно)",
  "What will I do tomorrow? (optional)": "Что я сделаю завтра? (необязательно)",
  "Write about your day — what happened, what's on your mind, anything…":
    "Напишите о своём дне — что случилось, о чём думаете, что угодно…",
  "Write freely…": "Пишите свободно…",
  "Journal entry saved ✓": "Запись сохранена ✓",
  "Search entries, dates, words…": "Поиск по записям, датам, словам…",
  "No entries match your search.": "По вашему запросу записей не найдено.",

  // ── Focus ──
  "Focus hours": "Часы фокуса",
  "min this week": "мин на этой неделе",
  "Too short to count as a focus session.": "Слишком коротко, чтобы засчитать сессию.",
  "Saved as an interrupted session.": "Сохранено как прерванная сессия.",
  "Couldn't save your focus session.": "Не удалось сохранить сессию фокуса.",

  // ── Errors ──
  "Couldn't save — please try again.": "Не удалось сохранить — попробуйте снова.",
  "Couldn't save.": "Не удалось сохранить.",
  "Couldn't delete — please try again.": "Не удалось удалить — попробуйте снова.",
  "Couldn't update — please try again.": "Не удалось обновить — попробуйте снова.",
  "Couldn't save your entry — please try again.": "Не удалось сохранить запись — попробуйте снова.",
};

const DICTS: Record<Lang, Record<string, string>> = { en: {}, uz: UZ, ru: RU };

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
      if (saved && (LANGS as string[]).includes(saved)) setLangState(saved as Lang);
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
    let s = DICTS[lang]?.[key] ?? key;
    if (vars)
      for (const k of Object.keys(vars))
        s = s.replace(new RegExp(`\\{${k}\\}`, "g"), String(vars[k]));
    return s;
  };

  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

export const useT = () => useContext(Ctx);
