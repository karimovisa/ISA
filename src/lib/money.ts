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

/**
 * 0-100 financial health score:
 *   - up to 40 pts for this month's saving rate
 *   - up to 30 pts for spending control (fewer categories spiking vs last month)
 *   - up to 30 pts for average progress across active goals (neutral 15 if none)
 */
export function healthScore(
  txns: Transaction[],
  goals: FinanceGoal[]
): number {
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

  return Math.round(Math.max(0, Math.min(100, savingPts + controlPts + goalPts)));
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
    out.push("No transactions logged yet this month — add income and expenses to see insights here.");
    return out;
  }

  const curCats = categoryBreakdown(txns, thisMonth, "expense");
  const prevCats = categoryBreakdown(txns, lastMonth, "expense");
  const prevMap = new Map(prevCats.map((c) => [c.category, c.total]));
  for (const c of curCats) {
    const prev = prevMap.get(c.category) ?? 0;
    if (prev <= 0) continue;
    const pct = Math.round(((c.total - prev) / prev) * 100);
    if (pct >= 15) out.push(`Your ${c.category} expenses increased ${pct}% this month.`);
    else if (pct <= -20) out.push(`Your ${c.category} spending is down ${Math.abs(pct)}% this month — nice.`);
  }

  if (cur.income > 0 && cur.savingRate < 10) {
    out.push("Your saving rate is low this month — worth a look at discretionary categories like Shopping or Entertainment.");
  }

  for (const g of goals.filter((g) => g.is_active)) {
    const remaining = g.target_amount - g.current_amount;
    if (remaining <= 0) continue;
    if (g.target_date) {
      const days = Math.max(
        1,
        Math.ceil(
          (new Date(g.target_date).getTime() - Date.now()) / 86_400_000
        )
      );
      const months = Math.max(1, Math.round(days / 30));
      const perMonth = remaining / months;
      out.push(`Save ${formatSom(perMonth)}/month to reach "${g.name}" on time.`);
    } else if (cur.balance > 0) {
      const months = Math.ceil(remaining / cur.balance);
      out.push(`At this month's saving pace, you'll reach "${g.name}" in about ${months} month${months === 1 ? "" : "s"}.`);
    }
  }

  return out.slice(0, 4);
}
