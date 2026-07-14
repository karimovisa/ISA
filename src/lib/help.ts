// ISA — Contextual help content. Keyed by the page's (lowercased) title so
// PageHeader can look it up automatically — no per-page wiring.
export type HelpStep = { title: string; body: string };

export const HELP: Record<string, HelpStep[]> = {
  dashboard: [
    { title: "Your daily command center", body: "The dashboard answers one question: what should I do today?" },
    { title: "AI Daily Brief", body: "Today's Focus shows your top task, journal status, budget and next deadline — plus a live insight." },
    { title: "Quick capture", body: "Add a task, expense, note or journal in one tap from the grid." },
    { title: "Overview cards", body: "Goals, Money, Focus and Habits at a glance — tap any to open it." },
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
    { title: "Health score", body: "See your financial health and why it changed vs last month." },
    { title: "Goals & analytics", body: "Link income to a savings goal; see largest category and trends." },
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
    { title: "Subscription", body: "Your plan, founding status, and Pro intelligence — features read 'Ready', never 'Locked'." },
    { title: "Appearance & Navigation", body: "Pick a theme and drag to reorder your bottom navigation." },
    { title: "AI & Notifications", body: "See which AI features are ready, and enable push reminders." },
    { title: "Reminders & Backup", body: "Manage reminders; export or restore your whole Life OS as a file." },
    { title: "Privacy & Support", body: "Your data stays yours. Clear cache, and reach support anytime." },
  ],
};

export const HELP_FINAL: HelpStep = {
  title: "💡 To Get the Best From ISA",
  body: "ISA becomes smarter as you use it. Every goal, habit, journal entry, focus session, expense, project, prayer, mood, idea, run and calendar activity helps ISA understand you better. The more complete your Life OS becomes, the more personalized your AI insights, coaching and predictions become.",
};
