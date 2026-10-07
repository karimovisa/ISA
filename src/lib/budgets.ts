// ISA — Category budgets ("envelopes"). An optional layer over transactions: a
// limit per expense category for the current week or month. Setup is the reason
// people abandon budgets, so ISA proposes the limits itself from what the person
// actually spends — accepting is one tap. Pure functions; BudgetCard renders.

import type { Transaction } from "@/lib/types";

export type BudgetPeriod = "week" | "month";

export type Budget = {
  id: string;
  user_id: string;
  category: string;
  amount: number;
  period: BudgetPeriod;
  created_at: string;
  updated_at: string;
};

export type BudgetStatus = "ok" | "warn" | "over";

export type BudgetLine = {
  budget: Budget;
  spent: number;
  left: number;
  pct: number; // 0..∞ (can exceed 100)
  status: BudgetStatus;
};

/** Spending at or above this share of the limit gets a gentle heads-up. */
const WARN_AT = 0.8;
/** Need this much history before ISA proposes limits. */
const MIN_HISTORY_DAYS = 14;

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** The current budget window: Monday–Sunday, or the calendar month. */
export function budgetWindow(period: BudgetPeriod, now = new Date()): { from: string; to: string; daysLeft: number } {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === "week") {
    const offset = (today.getDay() + 6) % 7; // Monday = 0
    const start = new Date(today);
    start.setDate(today.getDate() - offset);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { from: ymd(start), to: ymd(end), daysLeft: 6 - offset + 1 };
  }
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  return {
    from: ymd(new Date(today.getFullYear(), today.getMonth(), 1)),
    to: ymd(end),
    daysLeft: end.getDate() - today.getDate() + 1,
  };
}

/** Each budget's spend in its current window. */
export function budgetLines(budgets: Budget[], txns: Transaction[], now = new Date()): BudgetLine[] {
  return budgets.map((budget) => {
    const w = budgetWindow(budget.period, now);
    const spent = txns
      .filter((t) => t.type === "expense" && t.category === budget.category && t.date >= w.from && t.date <= w.to)
      .reduce((s, t) => s + Number(t.amount), 0);
    const pct = budget.amount > 0 ? spent / budget.amount : 0;
    return {
      budget,
      spent,
      left: budget.amount - spent,
      pct,
      status: pct >= 1 ? "over" : pct >= WARN_AT ? "warn" : "ok",
    };
  });
}

/** Round a limit up to a friendly number (nearest 10k, or 50k above 500k). */
function friendly(n: number): number {
  const step = n >= 500_000 ? 50_000 : 10_000;
  return Math.max(step, Math.ceil(n / step) * step);
}

/**
 * Propose a limit per expense category from real spending: the average per week
 * (last 4 full weeks) or per month (last 2 full months), rounded up so the first
 * budget is achievable rather than punishing. Empty until there is enough history.
 */
export function suggestBudgets(
  txns: Transaction[],
  period: BudgetPeriod,
  now = new Date()
): { category: string; amount: number }[] {
  const expenses = txns.filter((t) => t.type === "expense");
  if (!expenses.length) return [];
  const first = expenses.reduce((m, t) => (t.date < m ? t.date : m), expenses[0].date);
  const historyDays = (now.getTime() - new Date(`${first}T00:00:00`).getTime()) / 86_400_000;
  if (historyDays < MIN_HISTORY_DAYS) return [];

  // Full periods only — the current, unfinished one would drag averages down.
  const current = budgetWindow(period, now);
  let from: Date;
  let units: number;
  if (period === "week") {
    from = new Date(`${current.from}T00:00:00`);
    from.setDate(from.getDate() - 28);
    units = 4;
  } else {
    from = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    units = 2;
  }
  // With less history than the look-back, average over what exists.
  const firstDate = new Date(`${first}T00:00:00`);
  if (firstDate > from) {
    const span = (new Date(`${current.from}T00:00:00`).getTime() - firstDate.getTime()) / 86_400_000;
    units = Math.max(1, span / (period === "week" ? 7 : 30));
    from = firstDate;
  }

  const totals = new Map<string, number>();
  for (const t of expenses) {
    if (t.date < ymd(from) || t.date >= current.from) continue;
    totals.set(t.category, (totals.get(t.category) ?? 0) + Number(t.amount));
  }
  return [...totals.entries()]
    .map(([category, sum]) => ({ category, amount: friendly(sum / units) }))
    .sort((a, b) => b.amount - a.amount);
}
