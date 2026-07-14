// ISA — Contextual help content, keyed by the page's (lowercased) title so
// PageHeader can look it up automatically — no per-page wiring.
//
// The guides are held per-language rather than pushed through t(): they are long
// prose, and keeping each language's text together keeps it readable and
// translatable. Anything missing falls back to English.

export type HelpStep = { title: string; body: string };
export type HelpLang = "en" | "uz" | "ru";

const EN: Record<string, HelpStep[]> = {
  dashboard: [
    { title: "Your daily command center", body: "The dashboard answers one question: what should I do today?" },
    { title: "AI Daily Brief", body: "Today's Focus shows your top task, journal status, budget and next deadline — plus a live insight." },
    { title: "Quick capture", body: "Add a task, expense, note or journal in one tap from the grid." },
    { title: "Overview cards", body: "Goals, Money, Focus and Habits at a glance — tap any to open it." },
  ],
  "ask isa": [
    { title: "Talk to ISA", body: "Ask about your own life — ISA answers from your real data, never from guesswork." },
    { title: "Add things by writing", body: "\"I spent 50,000 on food\" or \"I ran 7 km\" — ISA understands and offers to record it." },
    { title: "Plans become tasks", body: "\"Tomorrow I'll run 5 km\" becomes a to-do for tomorrow, not a finished run." },
    { title: "You always confirm", body: "ISA never writes anything to your life without asking you first." },
  ],
  goals: [
    { title: "Create a goal", body: "Give it a title, deadline and motivation. Progress is automatic — no manual %." },
    { title: "Add milestones", body: "Break the goal into steps; checking them off moves the progress bar." },
    { title: "Pace & prediction", body: "ISA shows if you're ahead/behind and forecasts your finish date." },
    { title: "Next step", body: "Each card surfaces the single next milestone to work on." },
  ],
  habits: [
    { title: "Track daily", body: "Tap a habit to complete it for today. Completed ones sink to the bottom." },
    { title: "Targets & frequency", body: "Set a target (20 pages, 5 km…) and how often — daily or chosen days." },
    { title: "Streaks & stats", body: "Tap a habit's name for streaks, completion rate and history." },
    { title: "AI learning", body: "ISA learns your consistency and, on Pro, your best days and streak risk." },
  ],
  journal: [
    { title: "Write your day", body: "The main box is free-write; the two below are optional reflection." },
    { title: "Mood colors", body: "Pick a mood — it colors this day on the Calendar to reveal patterns." },
    { title: "History & search", body: "Past entries appear below; search by word, date or mood." },
    { title: "AI memory", body: "Each entry feeds ISA's understanding of what matters to you." },
  ],
  focus: [
    { title: "Set your session", body: "Say what you're working on, optionally link a goal or project, pick a duration." },
    { title: "Deep focus mode", body: "Starting the timer hides everything but your task and the clock." },
    { title: "Finish with a note", body: "Log what you accomplished — it becomes part of your memory." },
    { title: "Stats", body: "Track focus today/this week, longest session and your focus streak." },
  ],
  money: [
    { title: "Log fast", body: "Add income/expense in under 3 seconds; the note auto-suggests a category." },
    { title: "Savings goals", body: "Saving for a phone or a trip? Create a goal and ISA tracks the pace and finish date." },
    { title: "Health score", body: "See your financial health and why it changed vs last month." },
    { title: "AI coach", body: "On Pro, ISA gives personalized financial guidance and forecasts." },
  ],
  projects: [
    { title: "Your execution hub", body: "Projects hold steps, linked goals and notes in one place." },
    { title: "Steps drive progress", body: "Add and complete steps — progress updates automatically." },
    { title: "Health", body: "A health signal (Excellent → Stalled) reflects activity and deadlines." },
    { title: "Connect", body: "Link goals and keep lightweight notes per project." },
  ],
  "idea vault": [
    { title: "Capture sparks", body: "Drop an idea before it fades; add a tag if useful." },
    { title: "Give it a lifecycle", body: "Move ideas New → Active → In Progress → Implemented." },
    { title: "Evolve", body: "Convert an idea into a Goal, Project or Task — the original stays." },
    { title: "Find anything", body: "Search and filter by status, favorite or keyword." },
  ],
  prayer: [
    { title: "Track the five", body: "Tap the current prayer to mark it — undo within a few seconds." },
    { title: "On time vs late", body: "Green = on time, yellow = late, red = missed. No guilt, just clarity." },
    { title: "Streaks", body: "See current streak, longest and perfect days." },
    { title: "Reminders", body: "Enable notifications so a prayer never quietly slips by." },
  ],
  calendar: [
    { title: "A visual mood timeline", body: "Each day is colored by that day's mood from your journal." },
    { title: "Life events", body: "An accent dot marks days with milestones and important events." },
    { title: "Day summary", body: "Tap any day to see mood, focus, habits, prayers, money and events." },
    { title: "Month & year", body: "Month summary shows totals; switch to Year for the whole picture." },
  ],
  progress: [
    { title: "Am I improving?", body: "The Life Overview and momentum score show your current state." },
    { title: "Goals & charts", body: "Per-goal pace/prediction plus focus and project charts." },
    { title: "Reviews", body: "Weekly review is free; monthly & yearly reviews come with Pro." },
    { title: "Deep analytics", body: "On Pro, ISA finds cross-domain correlations and patterns." },
  ],
  settings: [
    { title: "Subscription", body: "Your plan and Pro intelligence — see exactly what is ready." },
    { title: "Appearance & Navigation", body: "Pick a theme and drag to reorder your bottom navigation." },
    { title: "AI & Notifications", body: "See which AI features are ready, and enable push reminders." },
    { title: "Reminders & Backup", body: "Manage reminders; export or restore your whole Life OS as a file." },
    { title: "Privacy & Support", body: "Your data stays yours. Clear cache, and reach support anytime." },
  ],
};

const UZ: Record<string, HelpStep[]> = {
  dashboard: [
    { title: "Kunlik boshqaruv markazingiz", body: "Boshqaruv paneli bitta savolga javob beradi: bugun nima qilishim kerak?" },
    { title: "AI kunlik xulosa", body: "\"Bugungi diqqat\" asosiy vazifangiz, kundalik holati, byudjet va yaqin muddatni ko'rsatadi — jonli tahlil bilan." },
    { title: "Tez qo'shish", body: "Vazifa, xarajat, g'oya yoki kundalikni bitta bosishda qo'shing." },
    { title: "Umumiy kartalar", body: "Maqsadlar, Moliya, Diqqat va Odatlar bir qarashda — bosib oching." },
  ],
  "ask isa": [
    { title: "ISA bilan gaplashing", body: "O'z hayotingiz haqida so'rang — ISA taxmin qilmaydi, faqat haqiqiy ma'lumotingizdan javob beradi." },
    { title: "Yozib qo'shing", body: "\"50 000 ovqatga sarfladim\" yoki \"7 km yugurdim\" — ISA tushunadi va yozib qo'yishni taklif qiladi." },
    { title: "Rejalar vazifaga aylanadi", body: "\"Ertaga 5 km yuguraman\" — bu bajarilgan yugurish emas, ertangi vazifa bo'ladi." },
    { title: "Har doim siz tasdiqlaysiz", body: "ISA sizdan so'ramasdan hayotingizga hech narsa yozmaydi." },
  ],
  goals: [
    { title: "Maqsad yarating", body: "Nom, muddat va sabab bering. Foiz o'zi hisoblanadi — qo'lda kiritmaysiz." },
    { title: "Bosqichlar qo'shing", body: "Maqsadni qadamlarga bo'ling; belgilaganingizda progress siljiydi." },
    { title: "Sur'at va bashorat", body: "ISA oldindamisiz yoki ortdami — ko'rsatadi va tugash sanasini bashorat qiladi." },
    { title: "Keyingi qadam", body: "Har bir karta aynan keyingi bitta bosqichni ko'rsatadi." },
  ],
  habits: [
    { title: "Har kuni belgilang", body: "Odatni bosib bugun bajarilgan deb belgilang. Bajarilganlari pastga tushadi." },
    { title: "Maqsad va takrorlanish", body: "Maqsad qo'ying (20 bet, 5 km…) va qanchalik tez-tez — har kuni yoki tanlangan kunlar." },
    { title: "Ketma-ketlik va statistika", body: "Odat nomini bosing — ketma-ketlik, bajarilish foizi va tarix ko'rinadi." },
    { title: "AI o'rganadi", body: "ISA barqarorligingizni o'rganadi; Pro'da eng yaxshi kunlaringiz va uzilish xavfini ko'rsatadi." },
  ],
  journal: [
    { title: "Kuningizni yozing", body: "Asosiy maydon — erkin yozuv; pastdagi ikkitasi ixtiyoriy mulohaza." },
    { title: "Kayfiyat ranglari", body: "Kayfiyat tanlang — u Kalendarda shu kunni bo'yaydi va naqshlarni ochadi." },
    { title: "Tarix va qidiruv", body: "Oldingi yozuvlar pastda; so'z, sana yoki kayfiyat bo'yicha qidiring." },
    { title: "AI xotirasi", body: "Har bir yozuv ISA'ning siz uchun muhim narsalarni tushunishiga xizmat qiladi." },
  ],
  focus: [
    { title: "Sessiyani sozlang", body: "Nima ustida ishlashingizni yozing, xohlasangiz maqsad/loyihaga bog'lang, davomiylikni tanlang." },
    { title: "Chuqur diqqat rejimi", body: "Taymer boshlanganda vazifangiz va soatdan boshqa hamma narsa yashiriladi." },
    { title: "Izoh bilan tugating", body: "Nimaga erishganingizni yozing — u xotirangizning bir qismiga aylanadi." },
    { title: "Statistika", body: "Bugungi/haftalik diqqat, eng uzun sessiya va ketma-ketligingizni kuzating." },
  ],
  money: [
    { title: "Tez yozing", body: "Kirim/chiqimni 3 soniyada qo'shing; izohdan kategoriya o'zi taklif qilinadi." },
    { title: "Jamg'arma maqsadlari", body: "Telefon yoki sayohatga pul yig'yapsizmi? Maqsad yarating — ISA sur'at va tugash sanasini hisoblaydi." },
    { title: "Moliyaviy salomatlik", body: "Moliyaviy holatingizni va u o'tgan oyga nisbatan nega o'zgarganini ko'ring." },
    { title: "AI murabbiy", body: "Pro'da ISA shaxsiy moliyaviy maslahat va bashorat beradi." },
  ],
  projects: [
    { title: "Bajarish markazingiz", body: "Loyihalar qadamlar, bog'langan maqsadlar va izohlarni bir joyda saqlaydi." },
    { title: "Qadamlar progressni suradi", body: "Qadam qo'shing va bajaring — progress o'zi yangilanadi." },
    { title: "Salomatlik", body: "Salomatlik belgisi (A'lo → To'xtagan) faollik va muddatlarni aks ettiradi." },
    { title: "Bog'lang", body: "Maqsadlarni bog'lang va har bir loyihaga qisqa izohlar yozing." },
  ],
  "idea vault": [
    { title: "Uchqunni ilib oling", body: "G'oya o'chib ketmasdan yozib qo'ying; kerak bo'lsa teg qo'shing." },
    { title: "Hayot siklini bering", body: "G'oyalarni Yangi → Faol → Jarayonda → Amalga oshirilgan tomon suring." },
    { title: "Rivojlantiring", body: "G'oyani Maqsad, Loyiha yoki Vazifaga aylantiring — asli saqlanib qoladi." },
    { title: "Hammasini toping", body: "Holat, sevimli yoki kalit so'z bo'yicha qidiring va filtrlang." },
  ],
  prayer: [
    { title: "Besh mahalni kuzating", body: "Joriy namozni bosib belgilang — bir necha soniya ichida bekor qilsa bo'ladi." },
    { title: "Vaqtida yoki kech", body: "Yashil = vaqtida, sariq = kech, qizil = qoldirilgan. Ayblash yo'q, faqat aniqlik." },
    { title: "Ketma-ketlik", body: "Joriy va eng uzun ketma-ketlik hamda mukammal kunlarni ko'ring." },
    { title: "Eslatmalar", body: "Bildirishnomani yoqing — namoz sezdirmay o'tib ketmasin." },
  ],
  calendar: [
    { title: "Kayfiyat vaqt chizig'i", body: "Har bir kun kundalikdagi o'sha kungi kayfiyat bilan bo'yaladi." },
    { title: "Hayot voqealari", body: "Rangli nuqta muhim voqea va bosqichlar bo'lgan kunlarni belgilaydi." },
    { title: "Kun xulosasi", body: "Istalgan kunni bosing — kayfiyat, diqqat, odat, namoz, pul va voqealar ko'rinadi." },
    { title: "Oy va yil", body: "Oy xulosasi jamini ko'rsatadi; to'liq manzara uchun Yilga o'ting." },
  ],
  progress: [
    { title: "Men o'syapmanmi?", body: "Hayot ko'rinishi va sur'at ballari hozirgi holatingizni ko'rsatadi." },
    { title: "Maqsadlar va grafiklar", body: "Har bir maqsad sur'ati/bashorati hamda diqqat va loyiha grafiklari." },
    { title: "Hisobotlar", body: "Haftalik hisobot bepul; oylik va yillik hisobot Pro bilan keladi." },
    { title: "Chuqur tahlil", body: "Pro'da ISA sohalararo bog'liqlik va naqshlarni topadi." },
  ],
  settings: [
    { title: "Obuna", body: "Tarifingiz va Pro imkoniyatlari — nimalar tayyor ekanini aniq ko'rasiz." },
    { title: "Ko'rinish va navigatsiya", body: "Mavzu tanlang va pastki menyuni sudrab tartiblang." },
    { title: "AI va bildirishnomalar", body: "Qaysi AI imkoniyatlari tayyorligini ko'ring va eslatmalarni yoqing." },
    { title: "Eslatmalar va zaxira", body: "Eslatmalarni boshqaring; butun Life OS'ni fayl sifatida yuklab oling yoki tiklang." },
    { title: "Maxfiylik va yordam", body: "Ma'lumotingiz — sizniki. Keshni tozalang va istalgan vaqtda yordam so'rang." },
  ],
};

const RU: Record<string, HelpStep[]> = {
  dashboard: [
    { title: "Ваш центр управления днём", body: "Главный экран отвечает на один вопрос: что мне делать сегодня?" },
    { title: "Дневная AI-сводка", body: "«Фокус дня» показывает главную задачу, статус дневника, бюджет и ближайший дедлайн — плюс живой инсайт." },
    { title: "Быстрое добавление", body: "Добавьте задачу, расход, заметку или запись в дневник одним касанием." },
    { title: "Обзорные карточки", body: "Цели, Деньги, Фокус и Привычки — с одного взгляда. Нажмите, чтобы открыть." },
  ],
  "ask isa": [
    { title: "Говорите с ISA", body: "Спрашивайте о своей жизни — ISA отвечает по вашим реальным данным, а не догадками." },
    { title: "Добавляйте текстом", body: "«Потратил 50 000 на еду» или «Пробежал 7 км» — ISA поймёт и предложит записать." },
    { title: "Планы становятся задачами", body: "«Завтра пробегу 5 км» станет задачей на завтра, а не завершённой пробежкой." },
    { title: "Вы всегда подтверждаете", body: "ISA ничего не запишет в вашу жизнь, не спросив вас." },
  ],
  goals: [
    { title: "Создайте цель", body: "Дайте название, срок и мотивацию. Прогресс считается сам — вручную % не нужен." },
    { title: "Добавьте этапы", body: "Разбейте цель на шаги; отмечая их, вы двигаете полосу прогресса." },
    { title: "Темп и прогноз", body: "ISA покажет, идёте вы с опережением или отстаёте, и спрогнозирует дату финиша." },
    { title: "Следующий шаг", body: "Каждая карточка показывает ровно один следующий этап." },
  ],
  habits: [
    { title: "Отмечайте ежедневно", body: "Нажмите на привычку, чтобы выполнить её сегодня. Выполненные уходят вниз." },
    { title: "Цель и частота", body: "Задайте цель (20 страниц, 5 км…) и частоту — ежедневно или по выбранным дням." },
    { title: "Серии и статистика", body: "Нажмите на название привычки — увидите серии, процент выполнения и историю." },
    { title: "AI учится", body: "ISA изучает вашу регулярность; на Pro покажет лучшие дни и риск срыва серии." },
  ],
  journal: [
    { title: "Опишите свой день", body: "Главное поле — свободная запись; два ниже — необязательная рефлексия." },
    { title: "Цвета настроения", body: "Выберите настроение — оно окрасит день в Календаре и раскроет закономерности." },
    { title: "История и поиск", body: "Прошлые записи ниже; ищите по слову, дате или настроению." },
    { title: "Память AI", body: "Каждая запись помогает ISA понять, что для вас важно." },
  ],
  focus: [
    { title: "Настройте сессию", body: "Укажите, над чем работаете, при желании привяжите цель или проект, выберите длительность." },
    { title: "Режим глубокого фокуса", body: "После старта таймера скрывается всё, кроме задачи и часов." },
    { title: "Завершите заметкой", body: "Запишите, чего достигли — это станет частью вашей памяти." },
    { title: "Статистика", body: "Фокус за сегодня/неделю, самая долгая сессия и ваша серия." },
  ],
  money: [
    { title: "Записывайте быстро", body: "Добавьте доход/расход меньше чем за 3 секунды; категория подсказывается по заметке." },
    { title: "Цели накопления", body: "Копите на телефон или поездку? Создайте цель — ISA посчитает темп и дату достижения." },
    { title: "Финансовое здоровье", body: "Посмотрите своё финансовое состояние и почему оно изменилось к прошлому месяцу." },
    { title: "AI-коуч", body: "На Pro ISA даёт персональные финансовые советы и прогнозы." },
  ],
  projects: [
    { title: "Центр исполнения", body: "Проекты держат шаги, связанные цели и заметки в одном месте." },
    { title: "Шаги двигают прогресс", body: "Добавляйте и закрывайте шаги — прогресс обновляется сам." },
    { title: "Здоровье", body: "Индикатор (Отлично → Застой) отражает активность и сроки." },
    { title: "Связывайте", body: "Привязывайте цели и ведите короткие заметки по проекту." },
  ],
  "idea vault": [
    { title: "Ловите искру", body: "Запишите идею, пока она не угасла; добавьте тег при необходимости." },
    { title: "Дайте ей жизненный цикл", body: "Ведите идеи: Новая → Активная → В работе → Реализована." },
    { title: "Развивайте", body: "Превратите идею в Цель, Проект или Задачу — оригинал сохранится." },
    { title: "Найдите что угодно", body: "Ищите и фильтруйте по статусу, избранному или ключевому слову." },
  ],
  prayer: [
    { title: "Отмечайте пять намазов", body: "Нажмите текущий намаз, чтобы отметить — отменить можно за пару секунд." },
    { title: "Вовремя или поздно", body: "Зелёный = вовремя, жёлтый = поздно, красный = пропущен. Без вины, только ясность." },
    { title: "Серии", body: "Текущая и самая длинная серия, а также идеальные дни." },
    { title: "Напоминания", body: "Включите уведомления, чтобы намаз не прошёл незаметно." },
  ],
  calendar: [
    { title: "Визуальная лента настроения", body: "Каждый день окрашен настроением из вашего дневника." },
    { title: "События жизни", body: "Точка отмечает дни с важными событиями и вехами." },
    { title: "Сводка дня", body: "Нажмите на день — увидите настроение, фокус, привычки, намазы, деньги и события." },
    { title: "Месяц и год", body: "Сводка месяца показывает итоги; переключитесь на Год для полной картины." },
  ],
  progress: [
    { title: "Я расту?", body: "Обзор жизни и балл динамики показывают ваше текущее состояние." },
    { title: "Цели и графики", body: "Темп/прогноз по каждой цели плюс графики фокуса и проектов." },
    { title: "Отчёты", body: "Недельный отчёт бесплатно; месячный и годовой — на Pro." },
    { title: "Глубокая аналитика", body: "На Pro ISA находит связи между сферами жизни и закономерности." },
  ],
  settings: [
    { title: "Подписка", body: "Ваш тариф и интеллект Pro — видно, что именно готово." },
    { title: "Вид и навигация", body: "Выберите тему и перетащите пункты нижнего меню." },
    { title: "AI и уведомления", body: "Посмотрите, какие AI-функции готовы, и включите push-напоминания." },
    { title: "Напоминания и резервная копия", body: "Управляйте напоминаниями; выгрузите или восстановите весь Life OS файлом." },
    { title: "Приватность и поддержка", body: "Данные остаются вашими. Очистите кэш и обратитесь в поддержку в любой момент." },
  ],
};

const BY_LANG: Record<HelpLang, Record<string, HelpStep[]>> = { en: EN, uz: UZ, ru: RU };

/** English is the canonical key set — PageHeader checks against it. */
export const HELP = EN;

/** The guide for a page in the user's language (falls back to English). */
export function helpFor(key: string, lang: HelpLang): HelpStep[] {
  return BY_LANG[lang]?.[key] ?? EN[key] ?? [];
}

export function hasHelp(key: string): boolean {
  return key in EN;
}

const FINAL: Record<HelpLang, HelpStep> = {
  en: {
    title: "💡 To Get the Best From ISA",
    body: "ISA becomes smarter as you use it. Every goal, habit, journal entry, focus session, expense, project, prayer, mood, idea and run helps ISA understand you better. The more complete your Life OS becomes, the more personalized your insights, coaching and predictions become.",
  },
  uz: {
    title: "💡 ISA'dan eng yaxshisini olish uchun",
    body: "ISA siz foydalangan sari aqlliroq bo'ladi. Har bir maqsad, odat, kundalik yozuvi, diqqat sessiyasi, xarajat, loyiha, namoz, kayfiyat, g'oya va yugurish ISA'ga sizni yaxshiroq tushunishga yordam beradi. Life OS'ingiz qanchalik to'liq bo'lsa, tahlil, murabbiylik va bashoratlar shunchalik shaxsiy bo'ladi.",
  },
  ru: {
    title: "💡 Чтобы получить максимум от ISA",
    body: "ISA становится умнее по мере использования. Каждая цель, привычка, запись в дневнике, сессия фокуса, расход, проект, намаз, настроение, идея и пробежка помогают ISA понять вас лучше. Чем полнее ваш Life OS, тем персональнее становятся инсайты, коучинг и прогнозы.",
  },
};

export function helpFinal(lang: HelpLang): HelpStep {
  return FINAL[lang] ?? FINAL.en;
}

/** Kept for compatibility with existing imports. */
export const HELP_FINAL = FINAL.en;
