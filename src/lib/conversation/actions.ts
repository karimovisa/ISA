// ISA — Conversation Layer · Action Engine (§8 actions, §10 safe writes, §11–13 templates)
// ISA detects the intent and hands back a filled TEMPLATE — the user confirms or
// taps a chip rather than building the record by hand. Only after that explicit
// confirmation does ISA write, through the real module table AND the Event Engine.
//
//   detect → template → (user confirms) → module table → captureLifeEvent → refresh
//
// The LLM never reaches this file. ISA does every write, validated and RLS-scoped.

import { supabase } from "@/lib/supabase/client";
import { captureLifeEvent } from "@/lib/life-events";
import { formatSom, EXPENSE_CATEGORIES } from "@/lib/money";
import { todayISO } from "@/lib/datetime";
import { invalidateContext } from "@/lib/intelligence";
import type {
  ActionField, ActionKind, ActionProposal, ActionResult, ActionValues, FieldOption, IntentResult,
} from "./types";

const tomorrowISO = (): string => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// ── Reusable quick-pick chips (§12 template-first) ──
const dateChips = (): FieldOption[] => [
  { value: todayISO(), label: "Today" },
  { value: tomorrowISO(), label: "Tomorrow" },
];
const timeChips: FieldOption[] = [
  { value: "08:00", label: "Morning" },
  { value: "14:00", label: "Afternoon" },
  { value: "19:00", label: "Evening" },
];
const repeatChips: FieldOption[] = [
  { value: "all", label: "Every day" },
  { value: "weekdays", label: "Weekdays" },
];
const priorityChips: FieldOption[] = [
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
];
const categoryChips = (): FieldOption[] =>
  (EXPENSE_CATEGORIES as readonly string[]).map((c) => ({ value: c, label: c }));

const field = (f: ActionField): ActionField => f;

/** Build a filled template from a create/log intent — or null when nothing is writable. */
export function detectAction(message: string, intent: IntentResult): ActionProposal | null {
  const e = intent.entities;
  const text = message.toLowerCase();

  // Money — expense vs income.
  const isIncome = /\b(earned|income|received|got paid|salary|daromad|kirim|oldim maosh|maosh)\b/.test(text);
  if (e.amount != null && (isIncome || /\b(spent|paid|cost|expense|buy|bought|sarfladim|to'?ladim|xarajat|chiqim|sotib oldim)\b/.test(text))) {
    return {
      kind: isIncome ? "log_income" : "log_expense",
      headline: isIncome ? "Income detected" : "Expense detected",
      module: "money",
      confirmLabel: "Save",
      warnings: e.category ? [] : ["No category detected — pick one below."],
      // A clear expense with a known category is safe to log instantly (Undo
      // stays available). Income, or a missing category, drops to "confirm".
      confidence: isIncome ? 0.9 : e.category ? 0.96 : 0.72,
      form: [
        field({ key: "amount", label: "Amount", type: "number", value: String(e.amount), suffix: "so'm", required: true }),
        field({
          key: "category",
          label: "Category",
          type: "choice",
          value: e.category ?? (isIncome ? "Income" : "Other"),
          options: isIncome ? [{ value: "Income", label: "Income" }] : categoryChips(),
        }),
        field({ key: "date", label: "Date", type: "date", value: e.date ?? todayISO(), options: dateChips() }),
      ],
    };
  }

  // A PLAN, not a log. "Ertaga 5 km yuguraman" is tomorrow's task — never a
  // finished run.
  if (e.future && (e.distanceKm != null || intent.primary === "create" || intent.primary === "planning")) {
    const title = e.title ?? (e.distanceKm != null ? `${e.distanceKm} km yugurish` : message.trim().replace(/[?.!]+$/, ""));
    if (title)
      return taskTemplate(title, e.date ?? tomorrowISO());
  }

  // A recurring reminder. One-off reminders aren't offered: the schema repeats
  // weekly by design, so promising a single ping would be a lie.
  if (/\bremind me\b|\beslat/.test(text)) {
    const title = e.title ?? "Reminder";
    return {
      kind: "set_reminder",
      headline: "Reminder detected",
      module: "habits",
      confirmLabel: "Create",
      warnings: ["Reminders repeat — pick the days below."],
      confidence: 0.72,
      form: [
        field({ key: "title", label: "Title", type: "text", value: title, required: true }),
        field({ key: "time", label: "Time", type: "time", value: e.timeOfDay ?? "08:00", options: timeChips }),
        field({ key: "repeat", label: "Repeat", type: "choice", value: "all", options: repeatChips }),
      ],
    };
  }

  // Running (already done).
  if (e.distanceKm != null)
    return {
      kind: "log_run",
      headline: "Run detected",
      module: "running",
      confirmLabel: "Save",
      warnings: [],
      confidence: 0.88,
      form: [
        field({ key: "km", label: "Distance", type: "number", value: String(e.distanceKm), suffix: "km", required: true }),
        field({ key: "date", label: "Date", type: "date", value: e.date ?? todayISO(), options: dateChips() }),
      ],
    };

  // Goal.
  if (intent.primary === "create" && /\bgoal\b|\bmaqsad\b/.test(text)) {
    const title = e.title ?? message.replace(/.*(goal|maqsad)\s*/i, "").trim();
    if (!title) return null;
    return goalTemplate(title);
  }

  // Habit.
  if (intent.primary === "create" && /\bhabit\b|\bodat\b/.test(text)) {
    const title = e.title ?? "";
    if (!title) return null;
    return habitTemplate(title);
  }

  return null;
}

// ── Template builders (shared by detection AND clarification selection) ──

function taskTemplate(title: string, date: string): ActionProposal {
  return {
    kind: "create_task",
    headline: "Task detected",
    module: "tasks",
    confirmLabel: "Create",
    warnings: [],
    confidence: 0.8,
    form: [
      field({ key: "title", label: "Title", type: "text", value: title, required: true }),
      field({ key: "date", label: "When", type: "date", value: date, options: dateChips() }),
      field({ key: "priority", label: "Priority", type: "choice", value: "normal", options: priorityChips }),
    ],
  };
}

function goalTemplate(title: string): ActionProposal {
  return {
    kind: "create_goal",
    headline: "Goal detected",
    module: "goals",
    confirmLabel: "Create",
    warnings: [],
    confidence: 0.78,
    form: [
      field({ key: "title", label: "Title", type: "text", value: title, required: true }),
      field({ key: "deadline", label: "Deadline", type: "date", value: "", options: [] }),
    ],
  };
}

function habitTemplate(title: string): ActionProposal {
  return {
    kind: "create_habit",
    headline: "Habit detected",
    module: "habits",
    confirmLabel: "Create",
    warnings: [],
    confidence: 0.78,
    form: [
      field({ key: "name", label: "Name", type: "text", value: title, required: true }),
      field({ key: "repeat", label: "Frequency", type: "choice", value: "all", options: repeatChips }),
    ],
  };
}

/** Build a template from a clarification choice the user tapped. The title is
 *  already extracted, so this never re-parses free text. */
export function buildProposalFor(kind: ActionKind, title: string): ActionProposal | null {
  const t = title.trim();
  if (!t) return null;
  switch (kind) {
    case "create_task":
      return taskTemplate(t, todayISO());
    case "create_goal":
      return goalTemplate(t);
    case "create_habit":
      return habitTemplate(t);
    default:
      return null;
  }
}

/** The default (pre-filled) values of a template — used to act immediately when
 *  confidence is high enough that no confirmation is needed. */
export function defaultValues(p: ActionProposal): ActionValues {
  return Object.fromEntries(p.form.map((f) => [f.key, f.value]));
}

/** Reverse a just-performed action (only records with an id can be undone). */
export async function undoAction(kind: ActionKind, createdId: string | null): Promise<boolean> {
  if (!createdId) return false;
  const table: Partial<Record<ActionKind, string>> = {
    log_expense: "transactions",
    log_income: "transactions",
    create_task: "todos",
    create_goal: "goals",
    create_habit: "habits",
    set_reminder: "reminders",
  };
  const t = table[kind];
  if (!t) return false;
  const { error } = await supabase.from(t).delete().eq("id", createdId);
  if (!error) invalidateContext();
  return !error;
}

// ─────────────────────────── EXECUTION ───────────────────────────

const uid = async (): Promise<string | null> => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
};

const daysOf = (repeat: string): number[] => (repeat === "weekdays" ? [1, 2, 3, 4, 5] : [0, 1, 2, 3, 4, 5, 6]);

/** Execute a confirmed template with the values the user settled on. */
export async function executeAction(p: ActionProposal, values: ActionValues): Promise<ActionResult> {
  try {
    const userId = await uid();
    if (!userId) return fail(p, "You're signed out — please sign in and try again.");

    switch (p.kind) {
      case "log_expense":
      case "log_income":
        return await writeTransaction(userId, p, values);
      case "log_run":
        return await writeRun(p, values);
      case "create_task":
        return await writeTask(userId, p, values);
      case "create_goal":
        return await writeGoal(userId, p, values);
      case "create_habit":
        return await writeHabit(userId, p, values);
      case "set_reminder":
        return await writeReminder(userId, p, values);
    }
  } catch (err) {
    return fail(p, err instanceof Error ? err.message : "Something went wrong.");
  }
}

function fail(p: ActionProposal, error: string): ActionResult {
  return { ok: false, kind: p.kind, message: error, createdId: null, eventCaptured: false, error };
}

async function writeTransaction(userId: string, p: ActionProposal, v: ActionValues): Promise<ActionResult> {
  const amount = Number(v.amount);
  if (!Number.isFinite(amount) || amount <= 0) return fail(p, "Enter a valid amount.");
  const type = p.kind === "log_income" ? "income" : "expense";
  const { data, error } = await supabase
    .from("transactions")
    .insert({ user_id: userId, type, amount, category: v.category, note: null, date: v.date })
    .select("id")
    .single();
  if (error || !data) return fail(p, "Couldn't save that transaction.");

  const event = await captureLifeEvent({
    type: type === "expense" ? "ExpenseCreated" : "IncomeReceived",
    category: v.category,
    occurredAt: v.date,
    payload: { amount, category: v.category },
    links: { transactionIds: [String(data.id)] },
    context: { metricValue: amount, outcome: type === "income" ? "progress" : "informational" },
    provenance: "conversation",
  });
  invalidateContext();
  return {
    ok: true,
    kind: p.kind,
    message: `${formatSom(amount)} · ${v.category} ✓`,
    createdId: String(data.id),
    eventCaptured: event != null,
    error: null,
  };
}

async function writeRun(p: ActionProposal, v: ActionValues): Promise<ActionResult> {
  const km = Number(v.km);
  if (!Number.isFinite(km) || km <= 0) return fail(p, "Enter a valid distance.");
  // Manual runs live as a Life Event (Strava owns the synced table); Memory,
  // Insights and the Intelligence Layer all read from it.
  const event = await captureLifeEvent({
    type: "RunLogged",
    occurredAt: v.date,
    payload: { distance_m: Math.round(km * 1000), km, source: "manual" },
    context: { metricValue: km, outcome: "consistency" },
    provenance: "conversation",
  });
  invalidateContext();
  return {
    ok: event != null,
    kind: p.kind,
    message: event ? `${km} km ✓` : "Couldn't log that run.",
    createdId: null,
    eventCaptured: event != null,
    error: event ? null : "capture failed",
  };
}

async function writeTask(userId: string, p: ActionProposal, v: ActionValues): Promise<ActionResult> {
  const title = v.title?.trim();
  if (!title) return fail(p, "Give the task a title.");
  const { data, error } = await supabase
    .from("todos")
    .insert({ user_id: userId, title, date: v.date, done: false, priority: v.priority || "normal" })
    .select("id")
    .single();
  if (error || !data) return fail(p, "Couldn't add that task.");

  const event = await captureLifeEvent({
    type: "TaskCreated",
    occurredAt: v.date,
    payload: { title, date: v.date },
    context: { outcome: "informational" },
    provenance: "conversation",
  });
  invalidateContext();
  return {
    ok: true,
    kind: p.kind,
    message: `${title} ✓`,
    createdId: String(data.id),
    eventCaptured: event != null,
    error: null,
  };
}

async function writeGoal(userId: string, p: ActionProposal, v: ActionValues): Promise<ActionResult> {
  const title = v.title?.trim();
  if (!title) return fail(p, "Give the goal a title.");
  const { data, error } = await supabase
    .from("goals")
    .insert({ user_id: userId, title, percentage: 0, deadline: v.deadline || null })
    .select("id")
    .single();
  if (error || !data) return fail(p, "Couldn't create that goal.");

  const event = await captureLifeEvent({
    type: "GoalCreated",
    payload: { title },
    links: { goalIds: [String(data.id)] },
    context: { linkedToActiveGoal: true, outcome: "progress" },
    provenance: "conversation",
  });
  invalidateContext();
  return {
    ok: true,
    kind: p.kind,
    message: `${title} ✓`,
    createdId: String(data.id),
    eventCaptured: event != null,
    error: null,
  };
}

async function writeHabit(userId: string, p: ActionProposal, v: ActionValues): Promise<ActionResult> {
  const name = v.name?.trim();
  if (!name) return fail(p, "Give the habit a name.");
  const weekdays = v.repeat === "weekdays";
  const { data, error } = await supabase
    .from("habits")
    .insert({
      user_id: userId,
      name,
      frequency_type: weekdays ? "weekdays" : "daily",
      frequency_config: weekdays ? { days: [1, 2, 3, 4, 5] } : {},
      is_active: true,
    })
    .select("id")
    .single();
  if (error || !data) return fail(p, "Couldn't create that habit.");
  invalidateContext();
  return { ok: true, kind: p.kind, message: `${name} ✓`, createdId: String(data.id), eventCaptured: false, error: null };
}

async function writeReminder(userId: string, p: ActionProposal, v: ActionValues): Promise<ActionResult> {
  const title = v.title?.trim();
  if (!title) return fail(p, "Give the reminder a title.");
  const { data, error } = await supabase
    .from("reminders")
    .insert({
      user_id: userId,
      kind: "custom",
      title,
      remind_time: v.time,
      days: daysOf(v.repeat),
      enabled: true,
    })
    .select("id")
    .single();
  if (error || !data) return fail(p, "Couldn't set that reminder.");
  invalidateContext();
  return {
    ok: true,
    kind: p.kind,
    message: `${title} · ${v.time} ✓`,
    createdId: String(data.id),
    eventCaptured: false,
    error: null,
  };
}
