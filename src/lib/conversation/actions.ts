// ISA — Conversation Layer · Action Engine (§8, §10 safe writes)
// Turns "I spent 50,000" into a CONFIRMABLE proposal, and — only after the user
// confirms — performs the write through the real module table AND the Event
// Engine, then refreshes the Intelligence Layer. The LLM never reaches this file;
// ISA does every write, validated, reversible in the module UI, RLS-scoped.
//
//   detect → validate → (confirm) → module table → captureLifeEvent → refresh
//
// Never bypasses a module. Never auto-executes. A capture failure never loses
// the user's row (the Event Engine swallows its own errors).

import { supabase } from "@/lib/supabase/client";
import { captureLifeEvent } from "@/lib/life-events";
import { formatSom } from "@/lib/money";
import { todayISO } from "@/lib/datetime";
import { invalidateContext } from "@/lib/intelligence";
import type { ExtractedEntities } from "./types";
import type { ActionProposal, ActionResult, IntentResult } from "./types";

/** Build a proposal from a create/log intent — or null when nothing is writable. */
export function detectAction(message: string, intent: IntentResult): ActionProposal | null {
  const e = intent.entities;
  const text = message.toLowerCase();

  // Money — expense vs income.
  if (e.amount != null && /\b(spent|paid|cost|expense|buy|bought)\b/.test(text)) {
    return expenseProposal(e, "expense");
  }
  if (e.amount != null && /\b(earned|income|received|got paid|salary)\b/.test(text)) {
    return expenseProposal(e, "income");
  }

  // A PLAN, not a log. "Ertaga 5 km yuguraman" is a to-do for tomorrow — it must
  // NOT be recorded as a run that already happened.
  if (e.future && (e.distanceKm != null || intent.primary === "create" || intent.primary === "planning")) {
    const title =
      e.title ?? (e.distanceKm != null ? `${e.distanceKm} km yugurish` : message.trim().replace(/[?.!]+$/, ""));
    if (title) {
      return {
        kind: "create_task",
        summary: `"${title}" — ${e.date ?? todayISO()} uchun vazifa qo'shaymi?`,
        fields: { title, date: e.date ?? todayISO() },
        module: "tasks",
        confirmLabel: "Vazifa qo'shish",
        warnings: [],
      };
    }
  }

  // Running (already done).
  if (e.distanceKm != null) {
    return {
      kind: "log_run",
      summary: `${e.distanceKm} km yugurishni yozib qo'yaymi?`,
      fields: { distanceKm: e.distanceKm, date: e.date ?? todayISO() },
      module: "running",
      confirmLabel: "Yozish",
      warnings: [],
    };
  }

  // Reminder → a daily habit + its reminder.
  if (/\bremind me\b/.test(text) || (intent.primary === "create" && e.timeOfDay && e.everyDay)) {
    const title = e.title ?? "Reminder";
    return {
      kind: "set_reminder",
      summary: `Create a ${e.everyDay ? "daily " : ""}reminder "${title}"${e.timeOfDay ? ` at ${e.timeOfDay}` : ""}?`,
      fields: { title, time: e.timeOfDay ?? "08:00", everyDay: e.everyDay ?? true },
      module: "habits",
      confirmLabel: "Set reminder",
      warnings: e.timeOfDay ? [] : ["No time detected — defaulting to 08:00."],
    };
  }

  // Goal.
  if (intent.primary === "create" && /\bgoal\b/.test(text)) {
    const title = e.title ?? message.replace(/.*goal\s*/i, "").trim();
    if (!title) return null;
    return {
      kind: "create_goal",
      summary: `Create the goal "${title}"?`,
      fields: { title, amount: e.amount ?? null },
      module: "goals",
      confirmLabel: "Create goal",
      warnings: [],
    };
  }

  // Habit.
  if (intent.primary === "create" && /\bhabit\b/.test(text)) {
    const title = e.title ?? "";
    if (!title) return null;
    return {
      kind: "create_habit",
      summary: `Create the habit "${title}"${e.everyDay ? " (daily)" : ""}?`,
      fields: { title, everyDay: e.everyDay ?? true },
      module: "habits",
      confirmLabel: "Create habit",
      warnings: [],
    };
  }

  return null;
}

function expenseProposal(e: ExtractedEntities, kind: "expense" | "income"): ActionProposal {
  const category = e.category ?? (kind === "income" ? "Income" : "Other");
  return {
    kind: kind === "expense" ? "log_expense" : "log_income",
    summary: `Log ${formatSom(e.amount ?? 0)} ${kind === "expense" ? "spent on" : "received as"} ${category}${e.date ? " today" : ""}?`,
    fields: { amount: e.amount ?? 0, category, date: e.date ?? todayISO(), type: kind },
    module: "money",
    confirmLabel: kind === "expense" ? "Log expense" : "Log income",
    warnings: e.category ? [] : ["No category detected — using a default you can change later."],
  };
}

// ─────────────────────────── EXECUTION ───────────────────────────

const uid = async (): Promise<string | null> => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
};

/** Execute a confirmed proposal. Writes the module row, captures the Life Event,
 *  refreshes intelligence. Returns a facts-only message (no invented numbers). */
export async function executeAction(p: ActionProposal): Promise<ActionResult> {
  try {
    const userId = await uid();
    if (!userId) return fail(p, "You're signed out — please sign in and try again.");

    switch (p.kind) {
      case "log_expense":
      case "log_income":
        return await writeTransaction(userId, p);
      case "log_run":
        return await writeRun(p);
      case "create_task":
        return await writeTask(userId, p);
      case "create_goal":
        return await writeGoal(userId, p);
      case "create_habit":
        return await writeHabit(userId, p);
      case "set_reminder":
        return await writeReminder(userId, p);
    }
  } catch (err) {
    return fail(p, err instanceof Error ? err.message : "Something went wrong.");
  }
}

function fail(p: ActionProposal, error: string): ActionResult {
  return { ok: false, kind: p.kind, message: error, createdId: null, eventCaptured: false, error };
}

async function writeTransaction(userId: string, p: ActionProposal): Promise<ActionResult> {
  const amount = Number(p.fields.amount);
  const type = p.fields.type as "expense" | "income";
  const category = String(p.fields.category);
  const date = String(p.fields.date);
  const { data, error } = await supabase
    .from("transactions")
    .insert({ user_id: userId, type, amount, category, note: null, date })
    .select("id")
    .single();
  if (error || !data) return fail(p, "Couldn't save that transaction.");

  const event = await captureLifeEvent({
    type: type === "expense" ? "ExpenseCreated" : "IncomeReceived",
    category,
    payload: { amount, category },
    links: { transactionIds: [String(data.id)] },
    context: { metricValue: amount, outcome: type === "income" ? "progress" : "informational" },
    provenance: "conversation",
  });
  invalidateContext();
  return {
    ok: true,
    kind: p.kind,
    message: `Logged ${formatSom(amount)} ${type === "expense" ? "spent on" : "received as"} ${category}.`,
    createdId: String(data.id),
    eventCaptured: event != null,
    error: null,
  };
}

/** A planned action becomes a real to-do in the Tasks module. */
async function writeTask(userId: string, p: ActionProposal): Promise<ActionResult> {
  const title = String(p.fields.title);
  const date = String(p.fields.date);
  const { data, error } = await supabase
    .from("todos")
    .insert({ user_id: userId, title, date, done: false, priority: "normal" })
    .select("id")
    .single();
  if (error || !data) return fail(p, "Vazifa qo'shilmadi.");

  const event = await captureLifeEvent({
    type: "TaskCreated",
    payload: { title, date },
    context: { outcome: "informational" },
    provenance: "conversation",
  });
  invalidateContext();
  return {
    ok: true,
    kind: p.kind,
    message: `"${title}" vazifa qo'shildi (${date}).`,
    createdId: String(data.id),
    eventCaptured: event != null,
    error: null,
  };
}

async function writeRun(p: ActionProposal): Promise<ActionResult> {
  const km = Number(p.fields.distanceKm);
  // Manual runs live as a Life Event (Strava owns the synced activity table);
  // Memory, Insights and the Intelligence Layer all read from it.
  const event = await captureLifeEvent({
    type: "RunLogged",
    payload: { distance_m: Math.round(km * 1000), km, source: "manual" },
    context: { metricValue: km, outcome: "consistency" },
    provenance: "conversation",
  });
  invalidateContext();
  return {
    ok: event != null,
    kind: p.kind,
    message: event ? `Logged a ${km} km run.` : "Couldn't log that run.",
    createdId: null,
    eventCaptured: event != null,
    error: event ? null : "capture failed",
  };
}

async function writeGoal(userId: string, p: ActionProposal): Promise<ActionResult> {
  const title = String(p.fields.title);
  const { data, error } = await supabase
    .from("goals")
    .insert({ user_id: userId, title, percentage: 0 })
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
    message: `Created the goal "${title}". You can set its target and deadline in Goals.`,
    createdId: String(data.id),
    eventCaptured: event != null,
    error: null,
  };
}

async function writeHabit(userId: string, p: ActionProposal): Promise<ActionResult> {
  const name = String(p.fields.title);
  const { data, error } = await supabase
    .from("habits")
    .insert({
      user_id: userId,
      name,
      frequency_type: "daily",
      frequency_config: {},
      is_active: true,
    })
    .select("id")
    .single();
  if (error || !data) return fail(p, "Couldn't create that habit.");
  invalidateContext();
  return {
    ok: true,
    kind: p.kind,
    message: `Created the habit "${name}".`,
    createdId: String(data.id),
    eventCaptured: false,
    error: null,
  };
}

async function writeReminder(userId: string, p: ActionProposal): Promise<ActionResult> {
  const title = String(p.fields.title);
  const time = String(p.fields.time);
  // A reminder is a daily habit + its notification row — mirrors the Habits UI.
  const { data: habit, error: hErr } = await supabase
    .from("habits")
    .insert({ user_id: userId, name: title, frequency_type: "daily", frequency_config: {}, is_active: true })
    .select("id")
    .single();
  if (hErr || !habit) return fail(p, "Couldn't create the reminder's habit.");

  const { error: rErr } = await supabase.from("reminders").insert({
    user_id: userId,
    kind: "habit",
    habit_id: habit.id,
    title,
    remind_time: time,
    days: [0, 1, 2, 3, 4, 5, 6],
    enabled: true,
  });
  invalidateContext();
  return {
    ok: true,
    kind: p.kind,
    message: rErr
      ? `Created the habit "${title}", but the reminder time couldn't be set.`
      : `Set a daily reminder for "${title}" at ${time}.`,
    createdId: String(habit.id),
    eventCaptured: false,
    error: rErr ? rErr.message : null,
  };
}
