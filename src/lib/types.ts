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

export type RunLog = {
  id: string;
  user_id: string;
  log_date: string;
  distance_km: number;
  created_at: string;
};
