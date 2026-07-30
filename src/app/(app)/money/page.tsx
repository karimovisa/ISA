"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Wallet, Sparkles, Pencil, Trash2, Copy, Plus,
  ArrowDownCircle, ArrowUpCircle, ArrowUpRight, ArrowDownRight, Search, Lock,
  Coffee, UtensilsCrossed, Fuel, Car, ShoppingBag, GraduationCap,
} from "lucide-react";
import { useCollection } from "@/hooks/useCollection";
import { supabase } from "@/lib/supabase/client";
import { GlassCard } from "@/components/ui/GlassCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal, fieldClass, labelClass, primaryBtnClass } from "@/components/ui/Modal";
import { ConfirmDialog, type ConfirmRequest } from "@/components/ui/ConfirmDialog";
import { PressButton } from "@/components/ui/PressButton";
import { MoneyGoals } from "@/components/sections/MoneyGoals";
import { MoneyRecurring } from "@/components/sections/MoneyRecurring";
import { MoneySheet, INCOME, EXPENSE } from "@/components/sections/MoneySheet";
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
  const [confirmReq, setConfirmReq] = useState<ConfirmRequest | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

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
      <PageHeader title="Money" subtitle="Know where your money goes." />

      {/* Balance hero — Apple Wallet feel */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }} className="mb-5">
        <div className="relative overflow-hidden rounded-[28px] border border-line bg-[var(--color-card)] p-6 sm:p-7">
          <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full" style={{ background: "radial-gradient(circle, var(--color-accent), transparent 70%)", opacity: 0.12, filter: "blur(42px)" }} />
          <div className="relative">
            <p className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted"><Wallet size={13} /> {t("Current Balance")}</p>
            <div className="mt-2 truncate text-[42px] font-bold leading-none tabular-nums sm:text-5xl" style={balance < 0 ? { color: EXPENSE } : undefined}>{formatSom(animatedBalance)}</div>
            <div className="mt-3.5 flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="inline-flex items-center gap-1 text-sm">
                {summary.balance >= 0 ? <ArrowUpRight size={15} style={{ color: INCOME }} /> : <ArrowDownRight size={15} style={{ color: EXPENSE }} />}
                <span className="font-medium tabular-nums" style={{ color: summary.balance >= 0 ? INCOME : EXPENSE }}>{summary.balance >= 0 ? "+" : "−"}{formatSom(Math.abs(summary.balance))}</span>
                <span className="text-muted">{t("this month")}</span>
              </span>
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
                style={
                  health.score >= 70
                    ? { background: `color-mix(in srgb, ${INCOME} 15%, transparent)`, color: INCOME }
                    : health.score >= 40
                      ? { background: "color-mix(in srgb, var(--color-accent) 15%, transparent)", color: "var(--color-accent)" }
                      : { background: `color-mix(in srgb, ${EXPENSE} 15%, transparent)`, color: EXPENSE }
                }
              >
                {t("Savings Health")} {health.score}/100 · {t(health.label)}
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Metrics — this month */}
      <div className="mb-5 grid grid-cols-3 gap-3">
        <Metric label="Income" value={formatSom(summary.income)} color={INCOME} />
        <Metric label="Expenses" value={formatSom(summary.expense)} color={EXPENSE} />
        <Metric label="Saving rate" value={`${Math.max(-100, Math.round(summary.savingRate))}%`} />
      </div>

      {/* Quick Insight — AI, one sentence, right at the top */}
      <div className="mb-6 flex items-start gap-3 rounded-[28px] border border-line bg-[var(--color-card)] p-5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.04]"><Sparkles size={16} className="text-accent" /></span>
        <p className="pt-1.5 text-[15px] leading-relaxed text-fg/90">{insights[0] ?? t("Add a few transactions to see insights here.")}</p>
      </div>

      {/* Savings goals — what the money is FOR */}
      <div className="mb-6"><MoneyGoals monthlyNet={summary.balance} /></div>

      {/* Quick add — bigger, 2-column, icons above (frequency-ordered) */}
      <div className="mb-6">
        <h2 className="mb-3 text-lg font-semibold tracking-tight">{t("Quick add")}</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {orderedPresets.map((p) => (
            <PressButton
              key={p.label}
              onClick={() => openQuick(p)}
              className="flex flex-col items-center justify-center gap-2.5 rounded-[24px] border border-line bg-[var(--color-card)] py-6 text-sm font-medium text-fg transition hover:-translate-y-0.5 hover:border-white/10"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.04]"><p.Icon size={22} className="text-accent" /></span>
              {t(p.label)}
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
                    <button onClick={() => setConfirmReq({ title: t("Delete this transaction?"), confirmLabel: t("Delete"), danger: true, onConfirm: () => txns.remove(tx.id) })} className="rounded-lg p-1.5 text-muted transition hover:text-red-400"><Trash2 size={14} /></button>
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

      <ConfirmDialog request={confirmReq} onClose={() => setConfirmReq(null)} />

      {/* Thumb-reachable add — in the bottom zone, opens the money sheet */}
      <button
        onClick={() => setSheetOpen(true)}
        aria-label={t("Add")}
        className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] left-1/2 z-40 flex h-16 w-16 -translate-x-1/2 items-center justify-center rounded-full text-white shadow-[0_14px_34px_-8px_rgba(0,0,0,0.75)] transition hover:brightness-110 active:scale-95 md:bottom-8"
        style={{ background: "var(--color-accent)" }}
      >
        <Plus size={28} strokeWidth={2.4} />
      </button>

      <MoneySheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onIncome={() => openNew("income")}
        onExpense={() => openNew("expense")}
        onGoal={() => window.dispatchEvent(new CustomEvent("isa:add-savings-goal"))}
        onRecurring={() => window.dispatchEvent(new CustomEvent("isa:add-recurring"))}
      />
    </div>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color?: string }) {
  const { t } = useT();
  return (
    <div className="rounded-[22px] border border-line bg-[var(--color-card)] p-4">
      <p className="text-xs text-muted">{t(label)}</p>
      <p className="mt-1 truncate text-lg font-bold tabular-nums sm:text-xl" style={color ? { color } : undefined}>{value}</p>
    </div>
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
