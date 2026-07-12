export type Goal = {
  id: string;
  user_id: string;
  title: string;
  percentage: number;
  deadline: string | null;
  motivation: string | null;
  created_at: string;
};

export type ProjectStatus = "planning" | "active" | "paused" | "done";

export type Project = {
  id: string;
  user_id: string;
  title: string;
  status: ProjectStatus;
  percentage: number;
  tasks_total: number;
  tasks_done: number;
  created_at: string;
};

export type ProjectTask = {
  id: string;
  user_id: string;
  project_id: string;
  title: string;
  done: boolean;
  created_at: string;
};

export type Idea = {
  id: string;
  user_id: string;
  content: string;
  tag: string | null;
  created_at: string;
};

export type JournalEntry = {
  id: string;
  user_id: string;
  entry_date: string;
  did_today: string | null;
  learned: string | null;
  tomorrow: string | null;
  created_at: string;
};

export type FocusSession = {
  id: string;
  user_id: string;
  label: string;
  duration_seconds: number;
  created_at: string;
};

export type SleepLog = {
  id: string;
  user_id: string;
  date: string;
  sleep_start: string | null;
  sleep_end: string | null;
  duration_hours: number;
  quality: number | null;
  created_at: string;
};

export type EnergyScore = {
  user_id: string;
  date: string;
  score: number;
  created_at: string;
};

export type StravaActivityRow = {
  id: number;
  user_id: string;
  name: string;
  distance_m: number;
  moving_time_s: number;
  elapsed_time_s: number;
  total_elevation: number;
  average_speed: number;
  start_date: string;
  created_at: string;
};

export type WeeklyReview = {
  id: string;
  user_id: string;
  week_start_date: string;
  goals_completed: number;
  journal_entries_count: number;
  focus_sessions_count: number;
  focus_total_minutes: number;
  avg_energy_score: number | null;
  most_active_day: string | null;
  avg_mood_score: number | null;
  seen_at: string | null;
  created_at: string;
};

export type Habit = {
  id: string;
  user_id: string;
  name: string;
  icon: string | null;
  is_active: boolean;
  created_at: string;
};

export type HabitLog = {
  id: string;
  habit_id: string;
  user_id: string;
  date: string;
  completed: boolean;
};

export type MoodLog = {
  id: string;
  user_id: string;
  date: string;
  mood_score: number;
  note: string | null;
  created_at: string;
};

export type Todo = {
  id: string;
  user_id: string;
  title: string;
  done: boolean;
  date: string;
  created_at: string;
};

export type Reminder = {
  id: string;
  user_id: string;
  kind: "custom" | "habit" | "todo" | "recurring";
  habit_id: string | null;
  recurring_payment_id: string | null;
  title: string;
  body: string | null;
  remind_time: string; // "HH:MM:SS" local (UTC+5)
  days: number[]; // 0=Sun … 6=Sat, ignored when day_of_month is set
  day_of_month: number | null; // 1-31, monthly recurrence (recurring payments)
  enabled: boolean;
  last_sent_date: string | null;
  created_at: string;
};

export type PrayerName = "bomdod" | "peshin" | "asr" | "shom" | "xufton";

export type PrayerPreferences = {
  user_id: string;
  wants_to_pray: boolean | null;
  notifications_enabled: boolean;
  activated: boolean;
  created_at: string;
  updated_at: string;
};

export type PrayerTimes = {
  id: string;
  city: string;
  date: string;
  bomdod: string;
  quyosh: string;
  peshin: string;
  asr: string;
  shom: string;
  xufton: string;
};

export type PrayerStatus = "vaqtida" | "kechikkan" | "qazo";

export type PrayerLog = {
  id: string;
  user_id: string;
  date: string;
  prayer_name: PrayerName;
  ticked_at: string | null;
  status: PrayerStatus;
};

export type RunLog = {
  id: string;
  user_id: string;
  log_date: string;
  distance_km: number;
  duration_s: number;
  created_at: string;
};

// ── Money / Finance ──

export type TxType = "income" | "expense";

export type Transaction = {
  id: string;
  user_id: string;
  type: TxType;
  amount: number;
  category: string;
  note: string | null;
  date: string;
  created_at: string;
};

export type FinanceGoal = {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  target_date: string | null;
  is_active: boolean;
  created_at: string;
};

export type RecurringPayment = {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  category: string;
  day_of_month: number;
  is_active: boolean;
  created_at: string;
};
