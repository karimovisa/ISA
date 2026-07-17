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

  // ── Progress page ──
  "Am I becoming a better version of myself?": "Men o'zimning yaxshiroq versiyamga aylanyapmanmi?",
  "Productivity Score": "Samaradorlik balli",
  "vs last week": "o'tgan haftaga nisbatan",
  Strongest: "Eng kuchli",
  "Needs improvement": "Yaxshilash kerak",
  Rest: "Dam olish",
  "Focus / week": "Haftalik diqqat",
  Momentum: "Sur'at",
  "Goal avg": "Maqsad o'rtacha",
  "Run / week": "Haftalik yugurish",
  Mood: "Kayfiyat",
  "Weekly activity": "Haftalik faollik",
  Average: "O'rtacha",
  Best: "Eng yaxshi",
  Quietest: "Eng sokin",
  Score: "Ball",
  "AI insights": "AI tahlillari",
  "Life Timeline": "Hayot xronologiyasi",
  "{n} days left": "{n} kun qoldi",
  "Need {n}% this week": "Bu hafta {n}% kerak",
  "On schedule": "Rejada",
  "Behind schedule": "Rejadan orqada",
  "Ahead of schedule": "Rejadan oldinda",
  "On track": "Yo'lida",
  "You focused {n}% more than last week.": "O'tgan haftaga nisbatan {n}% ko'proq diqqat qildingiz.",
  "You focused {n}% less than last week.": "O'tgan haftaga nisbatan {n}% kamroq diqqat qildingiz.",
  "Running is up {n}%.": "Yugurish {n}% ga oshdi.",
  "Running consistency decreased.": "Yugurish barqarorligi pasaydi.",
  "Your journaling is steady — that usually predicts a productive week.":
    "Kundalik yozishingiz barqaror — bu odatda samarali haftadan darak beradi.",
  "Momentum is improving.": "Sur'at yaxshilanmoqda.",
  "Momentum has softened this week.": "Bu hafta sur'at pasaydi.",
  "Not enough history yet — a couple more weeks and patterns appear.":
    "Hozircha ma'lumot kam — yana bir-ikki hafta, naqshlar ko'rinadi.",
  "Cross-domain correlations (sleep↔focus, mood↔productivity), predictions, and monthly/yearly reviews are a Pro feature.":
    "Sohalararo bog'liqliklar (uyqu↔diqqat, kayfiyat↔samaradorlik), bashoratlar va oylik/yillik hisobotlar — Pro imkoniyati.",

  // ── Habits: menu, archive, destructive confirm ──
  Archived: "Arxivlangan",
  "Archived.": "Arxivlandi.",
  "Restored.": "Tiklandi.",
  Confirm: "Tasdiqlash",
  Duplicate: "Nusxalash",
  Archive: "Arxivlash",
  "Edit habit": "Odatni tahrirlash",
  'Delete "{name}"?': '"{name}" o\'chirilsinmi?',
  "This removes the habit and its whole history. It can't be undone.":
    "Bu odat va uning butun tarixini o'chiradi. Qaytarib bo'lmaydi.",

  "This week": "Bu hafta",
  Improving: "Yaxshilanmoqda",
  Softening: "Pasaymoqda",
  Steady: "Barqaror",

  // ── Dashboard: Today's Mission ──
  "Today's Mission": "Bugungi vazifa",
  "{done} of {total} done": "{total} tadan {done} tasi bajarildi",
  "Complete today's habits": "Bugungi odatlarni bajaring",
  "Focus for 25 minutes": "25 daqiqa diqqat qiling",
  "Write today's journal": "Bugungi kundalikni yozing",
  "Clear today's tasks": "Bugungi vazifalarni yoping",
  "Log today's expenses": "Bugungi xarajatni yozing",
  "Log your sleep": "Uyqungizni yozing",
  "Record your mood": "Kayfiyatingizni belgilang",

  // ── Life Coverage / What ISA knows ──
  "Life Coverage": "Hayot qamrovi",
  "What ISA knows": "ISA nimani biladi",
  "Everything here comes from your own data — with its confidence shown.":
    "Bu yerdagi hamma narsa sizning ma'lumotingizdan — ishonch darajasi bilan.",
  "What ISA is still missing": "ISA'ga hali nima yetishmayapti",
  "Each one you add makes ISA's insights real rather than generic.":
    "Har birini qo'shsangiz, ISA tahlili umumiy emas, haqiqiy bo'ladi.",
  "What ISA has learned": "ISA nimani o'rgandi",
  "Reading your history…": "Tarixingiz o'qilmoqda…",
  "Nothing solid yet — ISA won't invent a pattern it hasn't seen. Keep using it for a week and real findings appear here.":
    "Hozircha aniq narsa yo'q — ISA ko'rmagan naqshni o'ylab topmaydi. Bir hafta foydalaning, haqiqiy natijalar shu yerda chiqadi.",
  "{n}% confidence": "{n}% ishonch",
  "Moderate confidence": "O'rtacha ishonch",
  "Low confidence — needs more data": "Past ishonch — ko'proq ma'lumot kerak",
  Sleep: "Uyqu",
  Running: "Yugurish",
  "ISA sees the whole picture — its patterns and predictions are at their strongest.":
    "ISA to'liq manzarani ko'ryapti — naqsh va bashoratlari eng kuchli holatda.",
  "ISA understands most of your life. Filling the gaps sharpens its insights.":
    "ISA hayotingizning ko'p qismini tushunadi. Bo'shliqlarni to'ldirsangiz, tahlili o'tkirlashadi.",
  "ISA is still learning you. More areas mean fewer guesses.":
    "ISA hali sizni o'rganyapti. Qancha soha ko'p bo'lsa, taxmin shuncha kam.",
  "ISA barely knows you yet. Each area you add makes its insights real rather than generic.":
    "ISA sizni deyarli bilmaydi. Har bir qo'shgan sohangiz tahlilni umumiy emas, haqiqiy qiladi.",
  "You're most active around {h}:00 — your {part}.": "Siz {h}:00 atrofida eng faolsiz — bu sizning {part}ingiz.",
  "You lean on {module} more than anything else.": "Siz eng ko'p {module} bo'limiga tayanasiz.",
  "You act early — mornings are when you move.": "Siz erta harakat qilasiz — tonglar sizning vaqtingiz.",
  "You act late — evenings are when you move.": "Siz kech harakat qilasiz — kechqurunlar sizning vaqtingiz.",
  "Your activity is spread through the day, not clustered.":
    "Faolligingiz kun bo'ylab tarqalgan, bir joyga to'planmagan.",
  morning: "tong",
  afternoon: "kunduz",
  evening: "kech",

  // ── Navigation editor / palette ──
  "Navigation order": "Navigatsiya tartibi",
  "Drag to reorder every page. The first {n} appear in your mobile bottom bar; the rest stay one search (⌘K) away.":
    "Har bir sahifani sudrab tartiblang. Birinchi {n} tasi pastki panelda chiqadi; qolgani qidiruvda (⌘K) qoladi.",
  "Bottom bar": "Pastki panel",
  "Jump to": "O'tish",
  "This removes the project and its steps. It can't be undone.":
    "Bu loyiha va uning qadamlarini o'chiradi. Qaytarib bo'lmaydi.",
  "Delete this idea?": "Bu g'oya o'chirilsinmi?",

  // ── Daily check-in ──
  "How did today go?": "Bugun qanday o'tdi?",
  "Takes five seconds.": "Besh soniya oladi.",
  "Good day": "Yaxshi kun",
  "It was okay": "O'rtacha",
  "Not my best": "Unchalik emas",
  "What got in the way?": "Nima xalaqit berdi?",
  "One tap — ISA uses it to explain your patterns later.":
    "Bir bosish — ISA keyinchalik naqshlaringizni shu bilan tushuntiradi.",
  Busy: "Bandlik",
  Tired: "Charchoq",
  Distracted: "Diqqat bo'lindi",
  Unwell: "Sog'lik",
  Other: "Boshqa",
  "Skip the reason": "Sababni o'tkazib yuborish",

  // ── Smart empty states: what ISA starts to understand ──
  "ISA will begin learning your consistency — which days you hold, which days you slip, and what your streaks depend on.":
    "ISA barqarorligingizni o'rgana boshlaydi — qaysi kunlar ushlab turasiz, qaysi kunlar qoldirasiz va ketma-ketligingiz nimaga bog'liq.",
  "ISA will begin learning where your money goes, what a normal week costs you, and how spending affects your goals.":
    "ISA pulingiz qayerga ketishini, oddiy hafta qanchaga tushishini va xarajat maqsadlaringizga qanday ta'sir qilishini o'rgana boshlaydi.",
  "Goals give ISA a direction to measure against. Without one, every other number is just activity — with one, ISA can tell you whether you're actually getting closer.":
    "Maqsad ISA'ga o'lchash uchun yo'nalish beradi. Usiz har qanday raqam — shunchaki faollik. U bilan esa ISA haqiqatan yaqinlashayotganingizni ayta oladi.",
  "Saving for a phone or a trip? ISA works out the pace you're on and when you'll actually get there.":
    "Telefon yoki sayohatga yig'yapsizmi? ISA sur'atingizni hisoblab, qachon yetib borishingizni aytadi.",
  "ISA will start noticing the themes you keep returning to — and can offer to turn a recurring one into a goal.":
    "ISA qayta-qayta qaytayotgan mavzularingizni sezishni boshlaydi — va takrorlanganini maqsadga aylantirishni taklif qiladi.",
  "ISA will track each project's pace against its deadline and tell you which one is quietly stalling.":
    "ISA har bir loyiha sur'atini muddatiga solishtiradi va qaysi biri sekin to'xtayotganini aytadi.",

  // ── Progressive unlock ──
  "Opens in {n} days": "{n} kundan keyin ochiladi",
  "Open it anyway": "Baribir hozir ochish",
  "Back to dashboard": "Boshqaruvga qaytish",
  "ISA introduces itself a piece at a time so nothing feels overwhelming — but this is your life, not a game. Open it whenever you want.":
    "ISA o'zini bo'lak-bo'lak tanishtiradi — cho'kib ketmasligingiz uchun. Lekin bu sizning hayotingiz, o'yin emas. Xohlagan payt oching.",
  "Set the direction — everything else measures against it.":
    "Yo'nalishni belgilang — qolgan hamma narsa shunga qarab o'lchanadi.",
  "The small daily actions that compound into the goals.":
    "Maqsadga aylanadigan kichik kundalik harakatlar.",
  "Deep work is where the goals actually move.": "Maqsad aslida chuqur ish bilan siljiydi.",
  "ISA now has a few days of actions — your words explain the why behind them.":
    "ISA'da endi bir necha kunlik harakat bor — sizning so'zlaringiz ularning sababini tushuntiradi.",
  "Somewhere to catch a thought before it fades.": "Fikr o'chib ketmasdan ilib olish uchun joy.",
  "ISA can now start connecting movement to your energy and mood.":
    "ISA endi harakatni energiya va kayfiyatingizga bog'lay boshlaydi.",
  "Your day already has a shape — this anchors it.": "Kuningiz allaqachon shaklga ega — bu uni mustahkamlaydi.",
  "ISA now knows your rhythm, so it can begin understanding your spending.":
    "ISA endi ritmingizni biladi, shuning uchun xarajatingizni tushuna boshlaydi.",
  "With habits and goals in place, ISA can see how your time collides with them.":
    "Odat va maqsadlar joyida — endi ISA vaqtingiz ular bilan qanday to'qnashishini ko'radi.",
  "Bigger than a goal? Projects hold the steps, notes and links.":
    "Maqsaddan kattami? Loyihalar qadamlar, izohlar va bog'lanishlarni saqlaydi.",
  "There's finally enough history to show how you're actually changing.":
    "Nihoyat qanday o'zgarayotganingizni ko'rsatish uchun yetarli tarix to'plandi.",

  // ── Ask ISA: detected templates ──
  "Task detected": "Vazifa aniqlandi",
  "Expense detected": "Xarajat aniqlandi",
  "Income detected": "Kirim aniqlandi",
  "Run detected": "Yugurish aniqlandi",
  "Goal detected": "Maqsad aniqlandi",
  "Habit detected": "Odat aniqlandi",
  "Reminder detected": "Eslatma aniqlandi",
  Title: "Sarlavha",
  When: "Qachon",
  Time: "Vaqt",
  Repeat: "Takrorlash",
  Frequency: "Takrorlanish",
  Priority: "Muhimlik",
  Deadline: "Muddat",
  Normal: "Oddiy",
  High: "Yuqori",
  "Every day": "Har kuni",
  Weekdays: "Ish kunlari",
  Morning: "Tong",
  Afternoon: "Kunduz",
  Evening: "Kech",
  Distance: "Masofa",
  "No category detected — pick one below.": "Kategoriya aniqlanmadi — pastdan tanlang.",
  "Reminders repeat — pick the days below.": "Eslatmalar takrorlanadi — pastdan kunlarni tanlang.",
  "Enter a valid amount.": "To'g'ri summa kiriting.",
  "Enter a valid distance.": "To'g'ri masofa kiriting.",
  "Give the task a title.": "Vazifaga sarlavha bering.",
  "Give the goal a title.": "Maqsadga sarlavha bering.",
  "Give the habit a name.": "Odatga nom bering.",
  "Give the reminder a title.": "Eslatmaga sarlavha bering.",
  "Couldn't add that task.": "Vazifa qo'shilmadi.",
  "Couldn't create that goal.": "Maqsad yaratilmadi.",
  "Couldn't create that habit.": "Odat yaratilmadi.",
  "Couldn't set that reminder.": "Eslatma o'rnatilmadi.",
  "Couldn't save that transaction.": "Tranzaksiya saqlanmadi.",
  "Couldn't log that run.": "Yugurish yozilmadi.",
  "You're signed out — please sign in and try again.": "Siz tizimdan chiqdingiz — qayta kiring.",
  "ISA'dan so'rang…": "ISA'dan so'rang…",

  // ── Quick capture ──
  "What would you like to add?": "Nima qo'shmoqchisiz?",
  "Just say it — ISA fills in the rest.": "Shunchaki ayting — qolganini ISA to'ldiradi.",
  Task: "Vazifa",
  Habit: "Odat",
  Goal: "Maqsad",
  Idea: "G'oya",
  Project: "Loyiha",
  Run: "Yugurish",

  // Weekday short labels (chart axis)
  Sun: "Yak",
  Mon: "Dush",
  Tue: "Sesh",
  Wed: "Chor",
  Thu: "Pay",
  Fri: "Jum",
  Sat: "Shan",
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

  // ── Progress page ──
  "Am I becoming a better version of myself?": "Становлюсь ли я лучшей версией себя?",
  "Productivity Score": "Балл продуктивности",
  "vs last week": "к прошлой неделе",
  Strongest: "Сильнее всего",
  "Needs improvement": "Нужно улучшить",
  Rest: "Отдых",
  "Focus / week": "Фокус за неделю",
  Momentum: "Динамика",
  "Goal avg": "Средний прогресс целей",
  "Run / week": "Бег за неделю",
  Mood: "Настроение",
  "Weekly activity": "Активность за неделю",
  Average: "Среднее",
  Best: "Лучший",
  Quietest: "Самый тихий",
  Score: "Балл",
  "AI insights": "AI-инсайты",
  "Life Timeline": "Лента жизни",
  "{n} days left": "осталось {n} дн.",
  "Need {n}% this week": "Нужно {n}% на этой неделе",
  "On schedule": "По плану",
  "Behind schedule": "Отстаёт",
  "Ahead of schedule": "Опережает план",
  "On track": "В графике",
  "No deadline": "Без срока",
  "No projects yet — add one on the Projects page to track progress here.":
    "Проектов пока нет — добавьте на странице «Проекты», и прогресс появится здесь.",
  "You focused {n}% more than last week.": "Вы сфокусировались на {n}% больше, чем на прошлой неделе.",
  "You focused {n}% less than last week.": "Вы сфокусировались на {n}% меньше, чем на прошлой неделе.",
  "Running is up {n}%.": "Бег вырос на {n}%.",
  "Running consistency decreased.": "Регулярность бега снизилась.",
  "Your journaling is steady — that usually predicts a productive week.":
    "Вы стабильно ведёте дневник — обычно это предвещает продуктивную неделю.",
  "Momentum is improving.": "Динамика улучшается.",
  "Momentum has softened this week.": "На этой неделе динамика ослабла.",
  "Not enough history yet — a couple more weeks and patterns appear.":
    "Пока мало данных — ещё пара недель, и закономерности проявятся.",
  "Cross-domain correlations (sleep↔focus, mood↔productivity), predictions, and monthly/yearly reviews are a Pro feature.":
    "Связи между сферами (сон↔фокус, настроение↔продуктивность), прогнозы и месячные/годовые отчёты — функция Pro.",

  // ── Habits: menu, archive, destructive confirm ──
  Archived: "В архиве",
  "Archived.": "Перенесено в архив.",
  Restore: "Восстановить",
  "Restored.": "Восстановлено.",
  Delete: "Удалить",
  Confirm: "Подтвердить",
  Edit: "Изменить",
  Duplicate: "Дублировать",
  Archive: "В архив",
  "Edit habit": "Изменить привычку",
  "New habit": "Новая привычка",
  'Delete "{name}"?': 'Удалить «{name}»?',
  "This removes the habit and its whole history. It can't be undone.":
    "Это удалит привычку и всю её историю. Отменить будет нельзя.",

  "This week": "На этой неделе",
  Improving: "Улучшается",
  Softening: "Ослабевает",
  Steady: "Стабильно",

  // ── Dashboard: Today's Mission ──
  "Today's Mission": "Миссия дня",
  "{done} of {total} done": "{done} из {total} выполнено",
  "Complete today's habits": "Выполните привычки на сегодня",
  "Focus for 25 minutes": "Сфокусируйтесь 25 минут",
  "Write today's journal": "Запишите дневник за сегодня",
  "Clear today's tasks": "Закройте задачи на сегодня",
  "Log today's expenses": "Запишите расходы за сегодня",
  "Log your sleep": "Отметьте сон",
  "Record your mood": "Отметьте настроение",

  // ── Life Coverage / What ISA knows ──
  "Life Coverage": "Охват жизни",
  "What ISA knows": "Что ISA знает",
  "Everything here comes from your own data — with its confidence shown.":
    "Всё здесь — из ваших данных, с указанием уверенности.",
  "What ISA is still missing": "Чего ISA пока не хватает",
  "Each one you add makes ISA's insights real rather than generic.":
    "Каждая добавленная область делает выводы ISA реальными, а не общими.",
  "What ISA has learned": "Что ISA узнала",
  "Reading your history…": "Читаю вашу историю…",
  "Nothing solid yet — ISA won't invent a pattern it hasn't seen. Keep using it for a week and real findings appear here.":
    "Пока ничего определённого — ISA не выдумывает закономерности. Попользуйтесь неделю, и здесь появятся реальные выводы.",
  "{n}% confidence": "уверенность {n}%",
  "Moderate confidence": "Средняя уверенность",
  "Low confidence — needs more data": "Низкая уверенность — нужно больше данных",
  Sleep: "Сон",
  Running: "Бег",
  "ISA sees the whole picture — its patterns and predictions are at their strongest.":
    "ISA видит всю картину — её закономерности и прогнозы максимально надёжны.",
  "ISA understands most of your life. Filling the gaps sharpens its insights.":
    "ISA понимает большую часть вашей жизни. Заполнение пробелов усилит выводы.",
  "ISA is still learning you. More areas mean fewer guesses.":
    "ISA ещё изучает вас. Чем больше областей, тем меньше догадок.",
  "ISA barely knows you yet. Each area you add makes its insights real rather than generic.":
    "ISA пока почти не знает вас. Каждая новая область делает выводы реальными, а не общими.",
  "You're most active around {h}:00 — your {part}.": "Вы активнее всего около {h}:00 — это ваше {part}.",
  "You lean on {module} more than anything else.": "Больше всего вы опираетесь на раздел «{module}».",
  "You act early — mornings are when you move.": "Вы действуете рано — утро ваше время.",
  "You act late — evenings are when you move.": "Вы действуете поздно — вечер ваше время.",
  "Your activity is spread through the day, not clustered.":
    "Ваша активность распределена по дню, а не сосредоточена.",
  morning: "утро",
  afternoon: "день",
  evening: "вечер",

  // ── Navigation editor / palette ──
  "Navigation order": "Порядок навигации",
  "Drag to reorder every page. The first {n} appear in your mobile bottom bar; the rest stay one search (⌘K) away.":
    "Перетащите, чтобы упорядочить все страницы. Первые {n} появятся в нижней панели; остальные — в поиске (⌘K).",
  "Bottom bar": "Нижняя панель",
  "Jump to": "Перейти",
  "This removes the project and its steps. It can't be undone.":
    "Это удалит проект и его шаги. Отменить будет нельзя.",
  "Delete this idea?": "Удалить эту идею?",

  // ── Daily check-in ──
  "How did today go?": "Как прошёл день?",
  "Takes five seconds.": "Займёт пять секунд.",
  "Good day": "Хороший день",
  "It was okay": "Нормально",
  "Not my best": "Не лучший",
  "What got in the way?": "Что помешало?",
  "One tap — ISA uses it to explain your patterns later.":
    "Одно касание — ISA потом объяснит этим ваши закономерности.",
  Busy: "Занятость",
  Tired: "Усталость",
  Distracted: "Отвлекался",
  Unwell: "Самочувствие",
  Other: "Другое",
  "Skip the reason": "Пропустить причину",

  // ── Smart empty states: what ISA starts to understand ──
  "ISA will begin learning your consistency — which days you hold, which days you slip, and what your streaks depend on.":
    "ISA начнёт изучать вашу регулярность — в какие дни вы держитесь, в какие срываетесь и от чего зависят ваши серии.",
  "ISA will begin learning where your money goes, what a normal week costs you, and how spending affects your goals.":
    "ISA начнёт понимать, куда уходят деньги, сколько стоит обычная неделя и как траты влияют на ваши цели.",
  "Goals give ISA a direction to measure against. Without one, every other number is just activity — with one, ISA can tell you whether you're actually getting closer.":
    "Цель даёт ISA направление для измерения. Без неё любые цифры — просто активность. С ней ISA скажет, приближаетесь ли вы на самом деле.",
  "Saving for a phone or a trip? ISA works out the pace you're on and when you'll actually get there.":
    "Копите на телефон или поездку? ISA рассчитает ваш темп и когда вы реально дойдёте до цели.",
  "ISA will start noticing the themes you keep returning to — and can offer to turn a recurring one into a goal.":
    "ISA начнёт замечать темы, к которым вы возвращаетесь, и предложит превратить повторяющуюся в цель.",
  "ISA will track each project's pace against its deadline and tell you which one is quietly stalling.":
    "ISA сравнит темп каждого проекта со сроком и скажет, какой из них тихо застывает.",

  // ── Progressive unlock ──
  "Opens in {n} days": "Откроется через {n} дн.",
  "Open it anyway": "Всё равно открыть",
  "Back to dashboard": "На главную",
  "ISA introduces itself a piece at a time so nothing feels overwhelming — but this is your life, not a game. Open it whenever you want.":
    "ISA открывается постепенно, чтобы не перегружать вас. Но это ваша жизнь, а не игра — открывайте когда захотите.",
  "Set the direction — everything else measures against it.":
    "Задайте направление — всё остальное измеряется относительно него.",
  "The small daily actions that compound into the goals.":
    "Маленькие ежедневные действия, которые складываются в цели.",
  "Deep work is where the goals actually move.": "Цели двигаются именно за счёт глубокой работы.",
  "ISA now has a few days of actions — your words explain the why behind them.":
    "У ISA уже есть несколько дней ваших действий — ваши слова объяснят их причину.",
  "Somewhere to catch a thought before it fades.": "Место, чтобы поймать мысль, пока она не угасла.",
  "ISA can now start connecting movement to your energy and mood.":
    "ISA сможет связать движение с вашей энергией и настроением.",
  "Your day already has a shape — this anchors it.": "У вашего дня уже есть форма — это его закрепит.",
  "ISA now knows your rhythm, so it can begin understanding your spending.":
    "ISA знает ваш ритм и теперь может начать понимать ваши траты.",
  "With habits and goals in place, ISA can see how your time collides with them.":
    "Привычки и цели на месте — теперь ISA видит, как с ними сталкивается ваше время.",
  "Bigger than a goal? Projects hold the steps, notes and links.":
    "Больше цели? Проекты хранят шаги, заметки и связи.",
  "There's finally enough history to show how you're actually changing.":
    "Наконец накопилось достаточно истории, чтобы показать, как вы меняетесь.",

  // ── Ask ISA: detected templates ──
  "Task detected": "Обнаружена задача",
  "Expense detected": "Обнаружен расход",
  "Income detected": "Обнаружен доход",
  "Run detected": "Обнаружена пробежка",
  "Goal detected": "Обнаружена цель",
  "Habit detected": "Обнаружена привычка",
  "Reminder detected": "Обнаружено напоминание",
  Create: "Создать",
  Title: "Название",
  When: "Когда",
  Time: "Время",
  Repeat: "Повтор",
  Frequency: "Частота",
  Priority: "Приоритет",
  Deadline: "Срок",
  Normal: "Обычный",
  High: "Высокий",
  "Every day": "Каждый день",
  Weekdays: "Будни",
  Morning: "Утро",
  Afternoon: "День",
  Evening: "Вечер",
  Distance: "Дистанция",
  Name: "Имя",
  "No category detected — pick one below.": "Категория не определена — выберите ниже.",
  "Reminders repeat — pick the days below.": "Напоминания повторяются — выберите дни ниже.",
  "Enter a valid amount.": "Введите корректную сумму.",
  "Enter a valid distance.": "Введите корректную дистанцию.",
  "Give the task a title.": "Дайте задаче название.",
  "Give the goal a title.": "Дайте цели название.",
  "Give the habit a name.": "Дайте привычке имя.",
  "Give the reminder a title.": "Дайте напоминанию название.",
  "Couldn't add that task.": "Не удалось добавить задачу.",
  "Couldn't create that goal.": "Не удалось создать цель.",
  "Couldn't create that habit.": "Не удалось создать привычку.",
  "Couldn't set that reminder.": "Не удалось установить напоминание.",
  "Couldn't save that transaction.": "Не удалось сохранить транзакцию.",
  "Couldn't log that run.": "Не удалось записать пробежку.",
  "You're signed out — please sign in and try again.": "Вы вышли из аккаунта — войдите снова.",

  // ── Quick capture ──
  "What would you like to add?": "Что хотите добавить?",
  "Just say it — ISA fills in the rest.": "Просто скажите — остальное заполнит ISA.",
  Task: "Задача",
  Habit: "Привычка",
  Goal: "Цель",
  Expense: "Расход",
  Idea: "Идея",
  Project: "Проект",
  Run: "Пробежка",

  // Weekday short labels (chart axis)
  Sun: "Вс",
  Mon: "Пн",
  Tue: "Вт",
  Wed: "Ср",
  Thu: "Чт",
  Fri: "Пт",
  Sat: "Сб",
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
