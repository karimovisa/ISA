"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  Sparkles,
  Pencil,
  Trash2,
  ArrowDownCircle,
  ArrowUpCircle,
  ArrowUpRight,
  ArrowDownRight,
  Coffee,
  UtensilsCrossed,
  Fuel,
  Car,
  ShoppingBag,
  GraduationCap,
} from "lucide-react";
import { useCollection } from "@/hooks/useCollection";
import { GlassCard } from "@/components/ui/GlassCard";
import { PageHeader, AddButton } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  Modal,
  fieldClass,
  labelClass,
  primaryBtnClass,
} from "@/components/ui/Modal";
import { PressButton } from "@/components/ui/PressButton";
import { MoneyGoals } from "@/components/sections/MoneyGoals";
import { MoneyRecurring } from "@/components/sections/MoneyRecurring";
import { todayISO } from "@/lib/datetime";
import { useT } from "@/lib/i18n";
import { useCountUp } from "@/lib/useCountUp";
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  currentMonthKey,
  summarizeMonth,
  overallBalance,
  categoryBreakdown,
  healthScore,
  generateInsights,
  transactionTag,
  formatSom,
} from "@/lib/money";
import type { Transaction, FinanceGoal, TxType } from "@/lib/types";

// One-tap expense presets → mapped to a real expense category on insert.
const QUICK_PRESETS = [
  { label: "Coffee", Icon: Coffee, category: "Food" },
  { label: "Food", Icon: UtensilsCrossed, category: "Food" },
  { label: "Fuel", Icon: Fuel, category: "Transport" },
  { label: "Taxi", Icon: Car, category: "Transport" },
  { label: "Shopping", Icon: ShoppingBag, category: "Shopping" },
  { label: "Education", Icon: GraduationCap, category: "Education" },
] as const;

type QuickPreset = (typeof QUICK_PRESETS)[number];

type Draft = {
  type: TxType;
  amount: string;
  category: string;
  note: string;
  date: string;
};

function emptyDraft(type: TxType = "expense"): Draft {
  return {
    type,
    amount: "",
    category: type === "expense" ? EXPENSE_CATEGORIES[0] : INCOME_CATEGORIES[0],
    note: "",
    date: todayISO(),
  };
}

export default function MoneyPage() {
  const { t } = useT();
  const txns = useCollection<Transaction>("transactions", {
    orderBy: "date",
    ascending: false,
  });
  const goals = useCollection<FinanceGoal>("finance_goals");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  // Quick-add: single-field modal driven by a tapped preset.
  const [quick, setQuick] = useState<QuickPreset | null>(null);
  const [quickAmount, setQuickAmount] = useState("");

  const thisMonth = currentMonthKey();
  const summary = useMemo(
    () => summarizeMonth(txns.data, thisMonth),
    [txns.data, thisMonth]
  );
  const balance = useMemo(() => overallBalance(txns.data), [txns.data]);
  const breakdown = useMemo(
    () => categoryBreakdown(txns.data, thisMonth, "expense"),
    [txns.data, thisMonth]
  );
  const maxCategory = breakdown[0]?.total ?? 0;
  const score = useMemo(
    () => healthScore(txns.data, goals.data),
    [txns.data, goals.data]
  );
  const insights = useMemo(
    () => generateInsights(txns.data, goals.data),
    [txns.data, goals.data]
  );
  const animatedBalance = useCountUp(balance);

  const saveQuick = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quick) return;
    const amount = Number(quickAmount) || 0;
    if (amount <= 0) return;
    await txns.add({
      type: "expense",
      amount,
      category: quick.category,
      note: quick.label,
      date: todayISO(),
    });
    setQuick(null);
    setQuickAmount("");
  };

  const openNew = (type: TxType) => {
    setEditing(null);
    setDraft(emptyDraft(type));
    setOpen(true);
  };

  const openEdit = (tx: Transaction) => {
    setEditing(tx);
    setDraft({
      type: tx.type,
      amount: String(tx.amount),
      category: tx.category,
      note: tx.note ?? "",
      date: tx.date,
    });
    setOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      type: draft.type,
      amount: Number(draft.amount) || 0,
      category: draft.category,
      note: draft.note.trim() || null,
      date: draft.date,
    };
    if (payload.amount <= 0) return;
    if (editing) await txns.update(editing.id, payload);
    else await txns.add(payload);
    setOpen(false);
  };

  const categories =
    draft.type === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  return (
    <div>
      <PageHeader
        title="Money"
        subtitle="Where it comes from, where it goes, and what it's building toward."
        action={
          <div className="flex gap-2">
            <AddButton onClick={() => openNew("income")} label="Income" />
            <AddButton onClick={() => openNew("expense")} label="Expense" />
          </div>
        }
      />

      {/* ── Hero: balance ── */}
      <GlassCard className="relative mb-4 overflow-hidden bg-gradient-to-br from-accent/15 via-transparent to-transparent p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted">
              <Wallet size={13} /> {t("Balance")}
            </p>
            <div
              className={`mt-1.5 truncate text-4xl font-bold tabular-nums sm:text-5xl ${
                balance >= 0 ? "text-fg" : "text-red-300"
              }`}
            >
              {formatSom(animatedBalance)}
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-sm">
              {summary.balance >= 0 ? (
                <ArrowUpRight size={16} className="text-emerald-400" />
              ) : (
                <ArrowDownRight size={16} className="text-red-400" />
              )}
              <span
                className={`font-medium tabular-nums ${
                  summary.balance >= 0 ? "text-emerald-300" : "text-red-300"
                }`}
              >
                {summary.balance >= 0 ? "+" : "−"}
                {formatSom(Math.abs(summary.balance))}
              </span>
              <span className="text-muted">{t("this month")}</span>
            </div>
          </div>
          <div
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${
              score.score >= 70
                ? "bg-emerald-400/15 text-emerald-300"
                : score.score >= 40
                  ? "bg-amber-400/15 text-amber-300"
                  : "bg-red-400/15 text-red-300"
            }`}
          >
            {score.score}/100 · {t(score.label)}
          </div>
        </div>
      </GlassCard>

      {/* ── Secondary stats ── */}
      <div className="mb-6 grid grid-cols-3 gap-3 sm:gap-4">
        <StatCard
          icon={TrendingUp}
          label="This month's income"
          value={formatSom(summary.income)}
          tone="text-emerald-300"
        />
        <StatCard
          icon={TrendingDown}
          label="This month's expenses"
          value={formatSom(summary.expense)}
          tone="text-red-300"
        />
        <StatCard
          icon={PiggyBank}
          label="Saving rate"
          value={`${Math.round(summary.savingRate)}%`}
          tone={summary.savingRate >= 0 ? "text-fg" : "text-red-300"}
        />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Financial health score */}
        <GlassCard className="p-6">
          <h3 className="mb-1 text-sm font-medium text-muted">
            {t("Financial health score")}
          </h3>
          <div className="mt-3 flex items-end gap-2">
            <span className="text-5xl font-bold tabular-nums">{score.score}</span>
            <span className="mb-1 text-lg text-muted">
              /100 · {t(score.label)}
            </span>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/5">
            <motion.div
              className={`h-full rounded-full ${
                score.score >= 70
                  ? "bg-emerald-400"
                  : score.score >= 40
                    ? "bg-amber-400"
                    : "bg-red-400"
              }`}
              initial={{ width: 0 }}
              animate={{ width: `${score.score}%` }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
          <ul className="mt-4 space-y-1.5">
            {score.suggestions.map((s, i) => (
              <li key={i} className="text-xs leading-relaxed text-muted">
                {s}
              </li>
            ))}
          </ul>
        </GlassCard>

        {/* AI insights */}
        <GlassCard className="p-6 lg:col-span-2">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles size={16} className="text-accent" />
            <h3 className="text-sm font-medium text-muted">
              {t("Insights")}
            </h3>
          </div>
          {insights.length === 0 ? (
            <p className="text-sm text-muted">
              {t("Add a few transactions to see insights here.")}
            </p>
          ) : (
            <ul className="space-y-2.5">
              {insights.map((line, i) => (
                <li key={i} className="text-sm leading-relaxed">
                  {line}
                </li>
              ))}
            </ul>
          )}
        </GlassCard>
      </div>

      {/* Category breakdown */}
      {breakdown.length > 0 && (
        <GlassCard className="mb-6 p-6">
          <h3 className="mb-4 text-sm font-medium text-muted">
            {t("Spending by category")}
          </h3>
          <div className="space-y-3">
            {breakdown.map((c) => (
              <div key={c.category}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span>{c.category}</span>
                  <span className="tabular-nums text-muted">
                    {formatSom(c.total)}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{
                      width: `${Math.max(4, (c.total / Math.max(1, maxCategory)) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      <div className="mb-8">
        <MoneyGoals monthlyNet={summary.balance} />
      </div>

      <div className="mb-8">
        <MoneyRecurring />
      </div>

      {/* Quick add — one-tap common expenses */}
      <div className="mb-8">
        <h2 className="mb-3 text-lg font-semibold tracking-tight">
          {t("Quick add")}
        </h2>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {QUICK_PRESETS.map((p) => (
            <PressButton
              key={p.label}
              onClick={() => {
                setQuick(p);
                setQuickAmount("");
              }}
              className="glass flex flex-col items-center gap-2 rounded-2xl py-4 text-xs font-medium text-fg transition hover:bg-white/[0.06]"
            >
              <p.Icon size={22} className="text-accent" />
              {t(p.label)}
            </PressButton>
          ))}
        </div>
      </div>

      {/* Recent transactions */}
      <div>
        <h2 className="mb-4 text-lg font-semibold tracking-tight">
          {t("Recent transactions")}
        </h2>
        {txns.loading ? (
          <div className="glass h-40 animate-pulse rounded-3xl" />
        ) : txns.data.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="No transactions yet"
            description="Add your first income or expense to get started."
            actionLabel="Add a transaction"
            onAction={() => openNew("expense")}
          />
        ) : (
          <GlassCard className="divide-y divide-white/5 p-0">
            {txns.data.slice(0, 20).map((tx) => {
              const tag = transactionTag(txns.data, tx);
              return (
              <div
                key={tx.id}
                className="group flex items-center gap-3 px-5 py-3.5"
              >
                {tx.type === "income" ? (
                  <ArrowUpCircle size={18} className="shrink-0 text-emerald-400" />
                ) : (
                  <ArrowDownCircle size={18} className="shrink-0 text-red-400" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {tx.note || tx.category}
                  </p>
                  <p className="text-xs text-muted">
                    {tx.category} · {tx.date}
                  </p>
                  {tag && (
                    <span className="mt-1 inline-block rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium text-muted">
                      {t(tag)}
                    </span>
                  )}
                </div>
                <span
                  className={`shrink-0 text-sm font-semibold tabular-nums ${
                    tx.type === "income" ? "text-emerald-300" : "text-red-300"
                  }`}
                >
                  {tx.type === "income" ? "+" : "-"}
                  {formatSom(tx.amount)}
                </span>
                <div className="flex shrink-0 gap-1 opacity-0 transition group-hover:opacity-100">
                  <button
                    onClick={() => openEdit(tx)}
                    className="rounded-lg p-1.5 text-muted transition hover:text-fg"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm("Delete this transaction?")) txns.remove(tx.id);
                    }}
                    className="rounded-lg p-1.5 text-muted transition hover:text-red-400"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              );
            })}
          </GlassCard>
        )}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={
          editing
            ? "Edit transaction"
            : draft.type === "income"
              ? "New income"
              : "New expense"
        }
      >
        <form onSubmit={save} className="space-y-4">
          <div className="flex gap-2 rounded-xl bg-white/[0.03] p-1">
            {(["expense", "income"] as TxType[]).map((ty) => (
              <button
                key={ty}
                type="button"
                onClick={() =>
                  setDraft((d) => ({
                    ...d,
                    type: ty,
                    category:
                      ty === "expense"
                        ? EXPENSE_CATEGORIES[0]
                        : INCOME_CATEGORIES[0],
                  }))
                }
                className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
                  draft.type === ty
                    ? ty === "income"
                      ? "bg-emerald-400/15 text-emerald-300"
                      : "bg-red-400/15 text-red-300"
                    : "text-muted hover:text-fg"
                }`}
              >
                {t(ty === "income" ? "Income" : "Expense")}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>{t("Amount")}</label>
              <input
                required
                autoFocus
                type="number"
                min={1}
                value={draft.amount}
                onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
                className={fieldClass}
              />
            </div>
            <div>
              <label className={labelClass}>{t("Date")}</label>
              <input
                type="date"
                value={draft.date}
                onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                className={fieldClass}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>{t("Category")}</label>
            <select
              value={draft.category}
              onChange={(e) => setDraft({ ...draft, category: e.target.value })}
              className={fieldClass}
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>{t("Note (optional)")}</label>
            <input
              value={draft.note}
              onChange={(e) => setDraft({ ...draft, note: e.target.value })}
              placeholder="e.g. Lunch with Aziz"
              className={fieldClass}
            />
          </div>

          <PressButton type="submit" className={primaryBtnClass}>
            {editing ? t("Save changes") : t("Add transaction")}
          </PressButton>
        </form>
      </Modal>

      {/* Quick-add: single amount field */}
      <Modal
        open={quick !== null}
        onClose={() => setQuick(null)}
        title={quick ? `${t("Add")} · ${t(quick.label)}` : t("Quick add")}
      >
        <form onSubmit={saveQuick} className="space-y-4">
          <div>
            <label className={labelClass}>{t("Amount")}</label>
            <input
              required
              autoFocus
              type="number"
              min={1}
              value={quickAmount}
              onChange={(e) => setQuickAmount(e.target.value)}
              className={fieldClass}
            />
          </div>
          <PressButton type="submit" className={primaryBtnClass}>
            {t("Add expense")}
          </PressButton>
        </form>
      </Modal>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
  tone: string;
}) {
  const { t } = useT();
  return (
    <GlassCard className="p-4 sm:p-5">
      <Icon size={16} className="mb-2 text-muted" />
      <p className="text-xs text-muted">{t(label)}</p>
      <p className={`mt-0.5 truncate text-lg font-bold tabular-nums sm:text-xl ${tone}`}>
        {value}
      </p>
    </GlassCard>
  );
}
