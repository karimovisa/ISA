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
  kind: "custom" | "habit" | "todo";
  habit_id: string | null;
  title: string;
  body: string | null;
  remind_time: string; // "HH:MM:SS" local (UTC+5)
  days: number[]; // 0=Sun … 6=Sat
  enabled: boolean;
  last_sent_date: string | null;
  created_at: string;
};

export type RunLog = {
  id: string;
  user_id: string;
  log_date: string;
  distance_km: number;
  duration_s: number;
  created_at: string;
};
