import type { Transaction, FinanceGoal, RecurringPayment } from "@/lib/types";

export const EXPENSE_CATEGORIES = [
  "Food",
  "Transport",
  "Education",
  "Shopping",
  "Family",
  "Entertainment",
  "Other",
] as const;

export const INCOME_CATEGORIES = [
  "Salary",
  "Business",
  "Gift",
  "Other",
] as const;

/** e.g. 14000000 → "14,000,000 so'm" */
export function formatSom(amount: number): string {
  const rounded = Math.round(amount);
  return `${rounded.toLocaleString("en-US")} so'm`;
}

/** "YYYY-MM" for a "YYYY-MM-DD" date string, in the string's own calendar terms
 *  (no timezone conversion — dates are already local calendar dates). */
export function monthKeyOf(dateStr: string): string {
  return dateStr.slice(0, 7);
}

export function currentMonthKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function previousMonthKey(d = new Date()): string {
  const prev = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  return currentMonthKey(prev);
}

export type MonthSummary = {
  income: number;
  expense: number;
  balance: number;
  savingRate: number; // 0-100, can be negative if overspent
};

export function summarizeMonth(
  txns: Transaction[],
  monthKey: string
): MonthSummary {
  let income = 0;
  let expense = 0;
  for (const t of txns) {
    if (monthKeyOf(t.date) !== monthKey) continue;
    if (t.type === "income") income += t.amount;
    else expense += t.amount;
  }
  const savingRate = income > 0 ? ((income - expense) / income) * 100 : 0;
  return { income, expense, balance: income - expense, savingRate };
}

/** All-time balance across every transaction. */
export function overallBalance(txns: Transaction[]): number {
  return txns.reduce(
    (sum, t) => sum + (t.type === "income" ? t.amount : -t.amount),
    0
  );
}

export function categoryBreakdown(
  txns: Transaction[],
  monthKey: string,
  type: "income" | "expense" = "expense"
): { category: string; total: number }[] {
  const map = new Map<string, number>();
  for (const t of txns) {
    if (t.type !== type || monthKeyOf(t.date) !== monthKey) continue;
    map.set(t.category, (map.get(t.category) ?? 0) + t.amount);
  }
  return [...map.entries()]
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);
}

export function upcomingRecurring(
  payments: RecurringPayment[],
  today = new Date()
): (RecurringPayment & { daysUntil: number })[] {
  const day = today.getDate();
  return payments
    .filter((p) => p.is_active)
    .map((p) => {
      let daysUntil = p.day_of_month - day;
      if (daysUntil < 0) {
        const daysInMonth = new Date(
          today.getFullYear(),
          today.getMonth() + 1,
          0
        ).getDate();
        daysUntil += daysInMonth;
      }
      return { ...p, daysUntil };
    })
    .sort((a, b) => a.daysUntil - b.daysUntil);
}

export function categoryAverage(
  txns: Transaction[],
  category: string,
  excludeId?: string
): number {
  const amounts = txns
    .filter(
      (t) => t.type === "expense" && t.category === category && t.id !== excludeId
    )
    .map((t) => t.amount);
  if (!amounts.length) return 0;
  return amounts.reduce((a, b) => a + b, 0) / amounts.length;
}

/** Short rule-based tag shown under a transaction card, or null for nothing. */
export function transactionTag(txns: Transaction[], tx: Transaction): string | null {
  if (tx.type !== "expense") return null;
  const avg = categoryAverage(txns, tx.category, tx.id);
  if (avg > 0 && tx.amount >= avg * 1.3) return "Above your average";
  const similarElsewhere = txns.some(
    (o) =>
      o.id !== tx.id &&
      o.type === "expense" &&
      o.category === tx.category &&
      monthKeyOf(o.date) !== monthKeyOf(tx.date) &&
      Math.abs(o.amount - tx.amount) / Math.max(o.amount, tx.amount) < 0.15
  );
  if (similarElsewhere) return "Recurring expense";
  return null;
}

function daysAgoISO(n: number, from = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

/** This 7-day window vs the previous 7-day window, expense-only. Null if
 *  there's no prior-week spending to meaningfully compare against. */
export function weekComparison(
  txns: Transaction[],
  today = new Date()
): { pct: number; thisWeek: number; lastWeek: number } | null {
  const end0 = daysAgoISO(0, today);
  const start0 = daysAgoISO(6, today);
  const end1 = daysAgoISO(7, today);
  const start1 = daysAgoISO(13, today);
  const inRange = (d: string, a: string, b: string) => d >= a && d <= b;
  const thisWeek = txns
    .filter((t) => t.type === "expense" && inRange(t.date, start0, end0))
    .reduce((s, t) => s + t.amount, 0);
  const lastWeek = txns
    .filter((t) => t.type === "expense" && inRange(t.date, start1, end1))
    .reduce((s, t) => s + t.amount, 0);
  if (lastWeek <= 0) return null;
  return { pct: Math.round(((thisWeek - lastWeek) / lastWeek) * 100), thisWeek, lastWeek };
}

export type HealthScore = {
  score: number;
  label: string;
  savingPts: number;
  controlPts: number;
  goalPts: number;
  suggestions: string[];
};

/**
 * 0-100 financial health score:
 *   - up to 40 pts for this month's saving rate
 *   - up to 30 pts for spending control (fewer categories spiking vs last month)
 *   - up to 30 pts for average progress across active goals (neutral 15 if none)
 */
export function healthScore(txns: Transaction[], goals: FinanceGoal[]): HealthScore {
  const thisMonth = currentMonthKey();
  const lastMonth = previousMonthKey();
  const { savingRate } = summarizeMonth(txns, thisMonth);

  const savingPts = Math.max(0, Math.min(40, (savingRate / 30) * 40));

  const curCats = categoryBreakdown(txns, thisMonth, "expense");
  const prevCats = categoryBreakdown(txns, lastMonth, "expense");
  const prevMap = new Map(prevCats.map((c) => [c.category, c.total]));
  const spikes = curCats.filter((c) => {
    const prev = prevMap.get(c.category) ?? 0;
    return prev > 0 && (c.total - prev) / prev >= 0.2;
  }).length;
  const controlPts = Math.max(0, 30 - spikes * 10);

  const active = goals.filter((g) => g.is_active);
  const goalPts = active.length
    ? (active.reduce(
        (sum, g) =>
          sum + Math.min(1, g.current_amount / Math.max(1, g.target_amount)),
        0
      ) /
        active.length) *
      30
    : 15;

  const score = Math.round(
    Math.max(0, Math.min(100, savingPts + controlPts + goalPts))
  );
  const label =
    score >= 80 ? "Excellent" : score >= 60 ? "Good" : score >= 40 ? "Needs work" : "At risk";

  const suggestions: string[] = [];
  if (savingPts < 25)
    suggestions.push("Increase your saving rate — aim for at least 20% of income.");
  if (controlPts < 20)
    suggestions.push("A category spiked over 20% vs last month — worth a look.");
  if (goalPts < 15)
    suggestions.push("Add or fund a savings goal to give your money direction.");
  if (suggestions.length === 0)
    suggestions.push("You're on a healthy pace — keep it up.");

  return {
    score,
    label,
    savingPts: Math.round(savingPts),
    controlPts: Math.round(controlPts),
    goalPts: Math.round(goalPts),
    suggestions: suggestions.slice(0, 2),
  };
}

/** How long until a goal is reached, and a one-line motivation message. */
export function goalEta(
  goal: FinanceGoal,
  monthlyNet: number
): { months: number | null; text: string } {
  const remaining = goal.target_amount - goal.current_amount;
  if (remaining <= 0) return { months: 0, text: "Goal reached! 🎉" };
  if (goal.target_date) {
    const days = Math.max(
      1,
      Math.ceil((new Date(goal.target_date).getTime() - Date.now()) / 86_400_000)
    );
    const months = Math.max(1, Math.round(days / 30));
    const perMonth = remaining / months;
    return {
      months,
      text: `Save ${formatSom(perMonth)}/month to reach this on time.`,
    };
  }
  if (monthlyNet > 0) {
    const months = Math.ceil(remaining / monthlyNet);
    return {
      months,
      text: `At this pace, you'll get there in about ${months} month${months === 1 ? "" : "s"}.`,
    };
  }
  return { months: null, text: "Save a bit each month to start making progress." };
}

/** Rule-based "assistant" insights — plain math over the user's own data,
 *  not a live model call. Framed as short, actionable one-liners. */
export function generateInsights(
  txns: Transaction[],
  goals: FinanceGoal[]
): string[] {
  const thisMonth = currentMonthKey();
  const lastMonth = previousMonthKey();
  const cur = summarizeMonth(txns, thisMonth);
  const out: string[] = [];

  const hasThisMonth = txns.some((t) => monthKeyOf(t.date) === thisMonth);
  if (!hasThisMonth) {
    return [
      "No transactions logged yet this month — add income and expenses to see insights here.",
    ];
  }

  const week = weekComparison(txns);
  if (week) {
    if (week.pct <= -10)
      out.push(`You spent ${Math.abs(week.pct)}% less than last week — nice.`);
    else if (week.pct >= 15)
      out.push(`You spent ${week.pct}% more than last week.`);
  }

  const curCats = categoryBreakdown(txns, thisMonth, "expense");
  const prevCats = categoryBreakdown(txns, lastMonth, "expense");
  const prevMap = new Map(prevCats.map((c) => [c.category, c.total]));
  for (const c of curCats) {
    const prev = prevMap.get(c.category) ?? 0;
    if (prev <= 0) continue;
    const pct = Math.round(((c.total - prev) / prev) * 100);
    if (pct >= 15) out.push(`Your ${c.category} expenses increased ${pct}% this month.`);
    else if (pct <= -20)
      out.push(`Your ${c.category} spending is down ${Math.abs(pct)}% this month.`);
  }

  if (curCats.length > 0) {
    const top = curCats[0];
    const saved = Math.round(top.total * 0.1);
    if (saved > 0)
      out.push(
        `If you reduce ${top.category} spending by 10%, you'll save ${formatSom(saved)} this month.`
      );
  }

  if (cur.income > 0 && cur.savingRate < 10) {
    out.push(
      "Your saving rate is low this month — worth a look at discretionary categories."
    );
  }

  for (const g of goals.filter((g) => g.is_active)) {
    if (g.current_amount >= g.target_amount) continue;
    out.push(`${goalEta(g, cur.balance).text.replace(/^/, "")} — "${g.name}".`);
  }

  return out.slice(0, 5);
}

