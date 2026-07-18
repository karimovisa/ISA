"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Wallet, TrendingUp, TrendingDown, PiggyBank, Sparkles, Pencil, Trash2, Copy,
  ArrowDownCircle, ArrowUpCircle, ArrowUpRight, ArrowDownRight, Search, Lock,
  Coffee, UtensilsCrossed, Fuel, Car, ShoppingBag, GraduationCap,
} from "lucide-react";
import { useCollection } from "@/hooks/useCollection";
import { supabase } from "@/lib/supabase/client";
import { GlassCard } from "@/components/ui/GlassCard";
import { PageHeader, AddButton } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal, fieldClass, labelClass, primaryBtnClass } from "@/components/ui/Modal";
import { PressButton } from "@/components/ui/PressButton";
import { MoneyGoals } from "@/components/sections/MoneyGoals";
import { MoneyRecurring } from "@/components/sections/MoneyRecurring";
import { todayISO } from "@/lib/datetime";
import { useT } from "@/lib/i18n";
import { useCountUp } from "@/lib/useCountUp";
import { useEntitlements } from "@/components/EntitlementProvider";
import { captureLifeEvent } from "@/lib/life-events";
import {
  EXPENSE_CATEGORIES, INCOME_CATEGORIES, currentMonthKey, summarizeMonth,
  overallBalance, healthWithReasons, generateInsights, transactionTag, formatSom,
  suggestCategory, recentCategories, spendAnalytics,
} from "@/lib/money";
import type { Transaction, FinanceGoal, TxType } from "@/lib/types";

const QUICK_PRESETS = [
  { label: "Coffee", Icon: Coffee, category: "Food" },
  { label: "Food", Icon: UtensilsCrossed, category: "Food" },
  { label: "Fuel", Icon: Fuel, category: "Transport" },
  { label: "Taxi", Icon: Car, category: "Transport" },
  { label: "Shopping", Icon: ShoppingBag, category: "Shopping" },
  { label: "Education", Icon: GraduationCap, category: "Education" },
] as const;
type Preset = (typeof QUICK_PRESETS)[number];
type Draft = { type: TxType; amount: string; category: string; note: string; date: string; goalId: string };
const emptyDraft = (type: TxType = "expense"): Draft => ({ type, amount: "", category: type === "expense" ? EXPENSE_CATEGORIES[0] : INCOME_CATEGORIES[0], note: "", date: todayISO(), goalId: "" });

export default function MoneyPage() {
  const { t } = useT();
  const { canUse } = useEntitlements();
  const txns = useCollection<Transaction>("transactions", { orderBy: "date", ascending: false });
  const fgoals = useCollection<FinanceGoal>("finance_goals");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [catTouched, setCatTouched] = useState(false);
  const [freq, setFreq] = useState<Record<string, number>>({});
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | TxType>("all");

  useEffect(() => { try { setFreq(JSON.parse(localStorage.getItem("isa_money_freq") || "{}")); } catch {} }, []);

  const thisMonth = currentMonthKey();
  const summary = useMemo(() => summarizeMonth(txns.data, thisMonth), [txns.data, thisMonth]);
  const balance = useMemo(() => overallBalance(txns.data), [txns.data]);
  const health = useMemo(() => healthWithReasons(txns.data, fgoals.data), [txns.data, fgoals.data]);
  const insights = useMemo(() => generateInsights(txns.data, fgoals.data), [txns.data, fgoals.data]);
  const analytics = useMemo(() => spendAnalytics(txns.data), [txns.data]);
  const animatedBalance = useCountUp(balance);
  const activeGoals = fgoals.data.filter((g) => g.is_active);

  const orderedPresets = useMemo(() => [...QUICK_PRESETS].sort((a, b) => (freq[b.label] ?? 0) - (freq[a.label] ?? 0)), [freq]);
  const recentExp = useMemo(() => recentCategories(txns.data, draft.type, 4), [txns.data, draft.type]);

  // Smart category — suggest from the note unless the user picked one.
  useEffect(() => {
    if (catTouched || !draft.note) return;
    const s = suggestCategory(draft.note);
    if (s && s !== draft.category) setDraft((d) => ({ ...d, category: s }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.note]);

  const openQuick = (p: Preset) => {
    const next = { ...freq, [p.label]: (freq[p.label] ?? 0) + 1 };
    setFreq(next); localStorage.setItem("isa_money_freq", JSON.stringify(next));
    setEditing(null); setCatTouched(true);
    setDraft({ ...emptyDraft("expense"), category: p.category, note: p.label }); setOpen(true);
  };
  const openNew = (type: TxType) => { setEditing(null); setCatTouched(false); setDraft(emptyDraft(type)); setOpen(true); };
  const openEdit = (tx: Transaction) => {
    setEditing(tx); setCatTouched(true);
    setDraft({ type: tx.type, amount: String(tx.amount), category: tx.category, note: tx.note ?? "", date: tx.date, goalId: tx.goal_id ?? "" });
    setOpen(true);
  };
  const duplicate = (tx: Transaction) => {
    setEditing(null); setCatTouched(true);
    setDraft({ type: tx.type, amount: String(tx.amount), category: tx.category, note: tx.note ?? "", date: todayISO(), goalId: tx.goal_id ?? "" });
    setOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(draft.amount) || 0;
    if (amount <= 0) return;
    const payload = { type: draft.type, amount, category: draft.category, note: draft.note.trim() || null, date: draft.date, goal_id: draft.goalId || null };
    if (editing) await txns.update(editing.id, payload);
    else {
      await txns.add(payload as Partial<Transaction>);
      // Goal auto-connection: income linked to a savings goal contributes to it.
      if (draft.type === "income" && draft.goalId) {
        const g = fgoals.data.find((x) => x.id === draft.goalId);
        if (g) { await supabase.from("finance_goals").update({ current_amount: g.current_amount + amount }).eq("id", g.id); fgoals.refresh(); }
      }
      void captureLifeEvent({
        type: draft.type === "income" ? "IncomeReceived" : "ExpenseCreated",
        occurredAt: draft.date, payload: { amount, category: draft.category, note: draft.note.trim() || null },
        links: draft.goalId ? { financeGoalIds: [draft.goalId] } : undefined,
        context: { metricValue: amount, outcome: draft.type === "income" ? "progress" : "informational", linkedToActiveGoal: !!draft.goalId },
      });
    }
    setOpen(false);
  };

  const categories = draft.type === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  const catList = [...recentExp, ...categories.filter((c) => !recentExp.includes(c))];

  const filtered = txns.data.filter((tx) => {
    if (typeFilter !== "all" && tx.type !== typeFilter) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return `${tx.note ?? ""} ${tx.category} ${tx.amount}`.toLowerCase().includes(q);
  });

  return (
    <div>
      <PageHeader title="Money" subtitle="Where it goes, whether it's wise, and what to do next."
        action={<div className="flex gap-2"><AddButton onClick={() => openNew("income")} label="Income" /><AddButton onClick={() => openNew("expense")} label="Expense" /></div>} />

      {/* Hero */}
      <GlassCard className="relative mb-4 overflow-hidden bg-gradient-to-br from-accent/15 via-transparent to-transparent p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted"><Wallet size={13} /> {t("Net balance")}</p>
            <div className={`mt-1.5 truncate text-4xl font-bold tabular-nums sm:text-5xl ${balance >= 0 ? "text-fg" : "text-red-300"}`}>{formatSom(animatedBalance)}</div>
            <div className="mt-2 flex items-center gap-1.5 text-sm">
              {summary.balance >= 0 ? <ArrowUpRight size={16} className="text-emerald-400" /> : <ArrowDownRight size={16} className="text-red-400" />}
              <span className={`font-medium tabular-nums ${summary.balance >= 0 ? "text-emerald-300" : "text-red-300"}`}>{summary.balance >= 0 ? "+" : "−"}{formatSom(Math.abs(summary.balance))}</span>
              <span className="text-muted">{t("this month")}</span>
            </div>
          </div>
          <div className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${health.score >= 70 ? "bg-emerald-400/15 text-emerald-300" : health.score >= 40 ? "bg-amber-400/15 text-amber-300" : "bg-red-400/15 text-red-300"}`}>{health.score}/100 · {t(health.label)}</div>
        </div>
      </GlassCard>

      {/* Stats */}
      <div className="mb-4 grid grid-cols-3 gap-3">
        <Stat icon={TrendingUp} label="Income" value={formatSom(summary.income)} tone="text-emerald-300" />
        <Stat icon={TrendingDown} label="Expenses" value={formatSom(summary.expense)} tone="text-red-300" />
        <Stat icon={PiggyBank} label="Saving rate" value={`${Math.max(-100, Math.round(summary.savingRate))}%`} tone={summary.savingRate >= 0 ? "text-fg" : "text-red-300"} />
      </div>

      {/* Savings goals — high up: this is what the money is FOR. */}
      <div className="mb-6"><MoneyGoals monthlyNet={summary.balance} /></div>

      {/* ONE AI insight + health why */}
      <GlassCard className="mb-6 p-5">
        <div className="flex items-center gap-2"><Sparkles size={15} className="text-accent" /><h3 className="text-sm font-medium">{t("Insight")}</h3></div>
        <p className="mt-2 text-sm text-fg/90">{insights[0] ?? t("Add a few transactions to see insights here.")}</p>
        {health.reasons.length > 0 && (
          <p className="mt-2 text-xs text-muted">{t("Health")} {health.score}/100 · {health.reasons.join(" · ")}</p>
        )}
      </GlassCard>

      {/* Quick add — frequency-ordered */}
      <div className="mb-6">
        <h2 className="mb-3 text-lg font-semibold tracking-tight">{t("Quick add")}</h2>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {orderedPresets.map((p) => (
            <PressButton key={p.label} onClick={() => openQuick(p)} className="glass flex flex-col items-center gap-2 rounded-2xl py-4 text-xs font-medium text-fg transition hover:bg-white/[0.06]">
              <p.Icon size={22} className="text-accent" />{t(p.label)}
            </PressButton>
          ))}
        </div>
      </div>

      {/* Analytics */}
      <GlassCard className="mb-6 p-6">
        <h3 className="mb-4 text-sm font-medium text-muted">{t("Spending analytics")}</h3>
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <Mini label="Largest" value={analytics.largest ? analytics.largest.category : "—"} />
          <Mini label="Daily avg" value={formatSom(analytics.dailyAvg)} />
          <Mini label="Highest day" value={analytics.highestDay ? formatSom(analytics.highestDay.total) : "—"} />
          <Mini label="vs last month" value={analytics.monthPct == null ? "—" : `${analytics.monthPct > 0 ? "+" : ""}${analytics.monthPct}%`} tone={analytics.monthPct != null && analytics.monthPct > 0 ? "text-red-300" : "text-emerald-300"} />
        </div>
      </GlassCard>

      <div className="mb-6"><MoneyRecurring /></div>

      {/* Transactions + search/filter */}
      <div>
        <h2 className="mb-3 text-lg font-semibold tracking-tight">{t("Transactions")}</h2>
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-line bg-white/[0.02] px-3 py-2">
            <Search size={15} className="text-muted" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("Search transactions…")} className="min-w-0 flex-1 bg-transparent text-sm text-fg placeholder:text-muted/60" />
          </div>
          <div className="flex gap-1 rounded-xl bg-white/[0.03] p-1">
            {(["all", "income", "expense"] as const).map((f) => (
              <button key={f} onClick={() => setTypeFilter(f)} className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition ${typeFilter === f ? "bg-white/10 text-fg" : "text-muted hover:text-fg"}`}>{t(f)}</button>
            ))}
          </div>
        </div>
        {txns.loading ? <div className="glass h-40 animate-pulse rounded-3xl" /> : filtered.length === 0 ? (
          <EmptyState icon={Wallet} title="No transactions" description="Add your first income or expense — or tap a Quick add above."
            learns="ISA will begin learning where your money goes, what a normal week costs you, and how spending affects your goals."
            actionLabel="Add a transaction" onAction={() => openNew("expense")} />
        ) : (
          <GlassCard className="divide-y divide-white/5 p-0">
            {filtered.slice(0, 30).map((tx) => {
              const tag = transactionTag(txns.data, tx);
              return (
                <div key={tx.id} className="group flex items-center gap-3 px-5 py-3.5">
                  {tx.type === "income" ? <ArrowUpCircle size={18} className="shrink-0 text-emerald-400" /> : <ArrowDownCircle size={18} className="shrink-0 text-red-400" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{tx.note || tx.category}</p>
                    <p className="text-xs text-muted">{tx.category} · {tx.date}</p>
                    {tag && <span className="mt-1 inline-block rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium text-muted">{t(tag)}</span>}
                  </div>
                  <span className={`shrink-0 text-sm font-semibold tabular-nums ${tx.type === "income" ? "text-emerald-300" : "text-red-300"}`}>{tx.type === "income" ? "+" : "-"}{formatSom(tx.amount)}</span>
                  <div className="flex shrink-0 gap-1 opacity-0 transition group-hover:opacity-100">
                    <button onClick={() => duplicate(tx)} className="rounded-lg p-1.5 text-muted transition hover:text-fg" aria-label="Duplicate"><Copy size={14} /></button>
                    <button onClick={() => openEdit(tx)} className="rounded-lg p-1.5 text-muted transition hover:text-fg"><Pencil size={14} /></button>
                    <button onClick={() => { if (confirm("Delete this transaction?")) txns.remove(tx.id); }} className="rounded-lg p-1.5 text-muted transition hover:text-red-400"><Trash2 size={14} /></button>
                  </div>
                </div>
              );
            })}
          </GlassCard>
        )}
      </div>

      {/* Pro coach */}
      <GlassCard className="mt-6 flex items-start gap-3 p-5">
        <Sparkles size={16} className="mt-0.5 shrink-0 text-accent" />
        <div className="flex-1">
          <div className="flex items-center gap-2"><h3 className="text-sm font-medium">{t("AI Financial Coach")}</h3>{!canUse("ai_coach") && <Lock size={13} className="text-muted" />}</div>
          <p className="mt-1 text-xs leading-relaxed text-muted">{canUse("ai_coach") ? t("Personalized recommendations, monthly review, and predictions are unlocking as ISA learns your finances.") : t("Personalized coaching, monthly review (PDF), and predictions (end-of-month balance, goal ETA) are a Pro feature.")}</p>
        </div>
      </GlassCard>

      {/* Modal */}
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit transaction" : draft.type === "income" ? "New income" : "New expense"}>
        <form onSubmit={save} className="space-y-4">
          <div className="flex gap-2 rounded-xl bg-white/[0.03] p-1">
            {(["expense", "income"] as TxType[]).map((ty) => (
              <button key={ty} type="button" onClick={() => { setCatTouched(true); setDraft((d) => ({ ...d, type: ty, category: ty === "expense" ? EXPENSE_CATEGORIES[0] : INCOME_CATEGORIES[0] })); }}
                className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${draft.type === ty ? (ty === "income" ? "bg-emerald-400/15 text-emerald-300" : "bg-red-400/15 text-red-300") : "text-muted hover:text-fg"}`}>{t(ty === "income" ? "Income" : "Expense")}</button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={labelClass}>{t("Amount")}</label><input required autoFocus type="number" min={1} value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} className={fieldClass} /></div>
            <div><label className={labelClass}>{t("Date")}</label><input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} className={fieldClass} /></div>
          </div>
          <div>
            <label className={labelClass}>{t("Category")}</label>
            <select value={draft.category} onChange={(e) => { setCatTouched(true); setDraft({ ...draft, category: e.target.value }); }} className={fieldClass}>
              {catList.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>{t("Note (optional)")}</label>
            <input value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} placeholder="e.g. Lunch with Aziz — auto-picks a category" className={fieldClass} />
          </div>
          {activeGoals.length > 0 && (
            <div>
              <label className={labelClass}>{t("Link a money goal (optional)")}</label>
              <select value={draft.goalId} onChange={(e) => setDraft({ ...draft, goalId: e.target.value })} className={fieldClass}>
                <option value="">None</option>
                {activeGoals.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
              {draft.type === "income" && draft.goalId && <p className="mt-1 text-xs text-muted">{t("This income will be added to the goal automatically.")}</p>}
            </div>
          )}
          <PressButton type="submit" className={primaryBtnClass}>{editing ? t("Save changes") : t("Add transaction")}</PressButton>
        </form>
      </Modal>
    </div>
  );
}

function Stat({ icon: Icon, label, value, tone }: { icon: React.ComponentType<{ size?: number; className?: string }>; label: string; value: string; tone: string }) {
  const { t } = useT();
  return (
    <GlassCard className="p-4 sm:p-5">
      <Icon size={16} className="mb-2 text-muted" />
      <p className="text-xs text-muted">{t(label)}</p>
      <p className={`mt-0.5 truncate text-lg font-bold tabular-nums sm:text-xl ${tone}`}>{value}</p>
    </GlassCard>
  );
}
function Mini({ label, value, tone }: { label: string; value: string; tone?: string }) {
  const { t } = useT();
  return (
    <div>
      <p className="text-xs text-muted">{t(label)}</p>
      <p className={`mt-0.5 truncate font-semibold tabular-nums ${tone ?? "text-fg"}`}>{value}</p>
    </div>
  );
}
