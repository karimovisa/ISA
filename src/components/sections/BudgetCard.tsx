"use client";

// ISA — Category budgets on the Money page. Optional: nobody sees limits until
// they want them. When there's enough history ISA proposes limits from real
// spending (one tap to accept), so the person never has to invent numbers.

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { PiggyBank, Pencil, X, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useCollection } from "@/hooks/useCollection";
import { GlassCard } from "@/components/ui/GlassCard";
import { Modal, fieldClass, labelClass, primaryBtnClass } from "@/components/ui/Modal";
import { EXPENSE_CATEGORIES, formatSom } from "@/lib/money";
import {
  budgetLines, budgetWindow, suggestBudgets, type Budget, type BudgetPeriod,
} from "@/lib/budgets";
import { toast } from "@/lib/toast";
import { useT } from "@/lib/i18n";
import type { Transaction } from "@/lib/types";

const DISMISS_KEY = "isa_budget_invite_dismissed";
const TONE = { ok: "var(--color-accent)", warn: "#D9A55B", over: "#C97B6B" } as const;

export function BudgetCard({ txns }: { txns: Transaction[] }) {
  const { t } = useT();
  const budgets = useCollection<Budget>("budgets", { orderBy: "created_at", ascending: true });
  const [editing, setEditing] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try { return typeof window === "undefined" || !!localStorage.getItem(DISMISS_KEY); } catch { return false; }
  });
  const [chosen, setChosen] = useState<BudgetPeriod>("month");

  // Every budget shares one period (a single "weekly / monthly" choice).
  const period: BudgetPeriod = budgets.data[0]?.period ?? chosen;
  const lines = useMemo(() => budgetLines(budgets.data, txns), [budgets.data, txns]);
  const suggestions = useMemo(() => suggestBudgets(txns, period), [txns, period]);
  const win = budgetWindow(period);

  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* ignore */ }
  };

  /** Replace the user's budgets with `limits` (empty amount = no budget). */
  const save = async (next: BudgetPeriod, limits: Record<string, number>) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const keep = Object.entries(limits).filter(([, a]) => a > 0);
    const drop = budgets.data.filter((b) => !(limits[b.category] > 0)).map((b) => b.id);
    const now = new Date().toISOString();
    const [up, del] = await Promise.all([
      keep.length
        ? supabase.from("budgets").upsert(
            keep.map(([category, amount]) => ({ user_id: user.id, category, amount, period: next, updated_at: now })),
            { onConflict: "user_id,category" }
          )
        : Promise.resolve({ error: null }),
      drop.length ? supabase.from("budgets").delete().in("id", drop) : Promise.resolve({ error: null }),
    ]);
    if (up.error || del.error) toast(t("Couldn't save — please try again."), "error");
    setChosen(next);
    await budgets.refresh();
  };

  const acceptSuggestions = () =>
    save(period, Object.fromEntries(suggestions.map((s) => [s.category, s.amount])));

  if (budgets.loading) return null;
  const hasBudgets = budgets.data.length > 0;
  // Optional by design: once waved away, the invite never comes back on its own.
  if (!hasBudgets && dismissed) return null;

  return (
    <>
      <GlassCard className="mb-6 p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/[0.04]">
              <PiggyBank size={15} className="text-accent" />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold">{t("Budget")}</h3>
              <p className="text-[11px] text-muted">
                {hasBudgets
                  ? t(period === "week" ? "This week · {n} days left" : "This month · {n} days left", { n: win.daysLeft })
                  : t("Split your money by category")}
              </p>
            </div>
          </div>
          {hasBudgets ? (
            <button onClick={() => setEditing(true)} aria-label={t("Edit")}
              className="rounded-lg p-1.5 text-muted transition hover:bg-white/[0.06] hover:text-fg">
              <Pencil size={14} />
            </button>
          ) : (
            <button onClick={dismiss} aria-label={t("Not now")}
              className="rounded-lg p-1.5 text-muted transition hover:bg-white/[0.06] hover:text-fg">
              <X size={14} />
            </button>
          )}
        </div>

        {hasBudgets ? (
          <ul className="space-y-3.5">
            {lines.map((l) => (
              <li key={l.budget.id}>
                <div className="mb-1 flex items-baseline justify-between gap-3">
                  <span className="text-sm">{t(l.budget.category)}</span>
                  <span className="text-xs tabular-nums text-muted">
                    {formatSom(l.spent)} / {formatSom(l.budget.amount)}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: TONE[l.status] }}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, Math.round(l.pct * 100))}%` }}
                    transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                  />
                </div>
                <p className="mt-1 text-[11px]" style={{ color: l.status === "ok" ? "var(--color-muted)" : TONE[l.status] }}>
                  {l.status === "over"
                    ? t("{amount} over the limit", { amount: formatSom(-l.left) })
                    : t("{amount} left", { amount: formatSom(l.left) })}
                </p>
              </li>
            ))}
          </ul>
        ) : suggestions.length > 0 ? (
          <div>
            <p className="mb-3 flex items-start gap-1.5 text-sm leading-relaxed text-fg/90">
              <Sparkles size={14} className="mt-0.5 shrink-0 text-accent" />
              {t(period === "week"
                ? "Based on what you spend, ISA suggests these weekly limits:"
                : "Based on what you spend, ISA suggests these monthly limits:")}
            </p>
            <ul className="mb-4 space-y-1.5">
              {suggestions.slice(0, 5).map((s) => (
                <li key={s.category} className="flex justify-between text-sm">
                  <span className="text-muted">{t(s.category)}</span>
                  <span className="tabular-nums">{formatSom(s.amount)}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => void acceptSuggestions()} className={primaryBtnClass}>{t("Use these limits")}</button>
              <button onClick={() => setEditing(true)} className="rounded-xl px-3 py-2 text-sm text-muted transition hover:text-fg">
                {t("Adjust")}
              </button>
              <PeriodToggle value={period} onChange={setChosen} className="ml-auto" />
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">{t("Set a limit for food, transport and more — ISA tracks it for you.")}</p>
            <button onClick={() => setEditing(true)} className={primaryBtnClass}>{t("Set up")}</button>
          </div>
        )}
      </GlassCard>

      {editing && (
        <BudgetEditor
          initialPeriod={period}
          current={Object.fromEntries(budgets.data.map((b) => [b.category, b.amount]))}
          suggestions={Object.fromEntries(suggestions.map((s) => [s.category, s.amount]))}
          onClose={() => setEditing(false)}
          onSave={async (p, limits) => { await save(p, limits); setEditing(false); }}
        />
      )}
    </>
  );
}

function PeriodToggle({ value, onChange, className = "" }: {
  value: BudgetPeriod; onChange: (p: BudgetPeriod) => void; className?: string;
}) {
  const { t } = useT();
  return (
    <div role="tablist" className={`flex rounded-full border border-line p-0.5 ${className}`}>
      {(["week", "month"] as BudgetPeriod[]).map((p) => (
        <button key={p} role="tab" aria-selected={value === p} onClick={() => onChange(p)}
          className={`rounded-full px-3 py-1 text-xs transition ${value === p ? "bg-white/10 font-semibold text-fg" : "text-muted hover:text-fg"}`}>
          {t(p === "week" ? "Weekly" : "Monthly")}
        </button>
      ))}
    </div>
  );
}

function BudgetEditor({ initialPeriod, current, suggestions, onClose, onSave }: {
  initialPeriod: BudgetPeriod;
  current: Record<string, number>;
  suggestions: Record<string, number>;
  onClose: () => void;
  onSave: (period: BudgetPeriod, limits: Record<string, number>) => Promise<void>;
}) {
  const { t } = useT();
  const [period, setPeriod] = useState(initialPeriod);
  const [busy, setBusy] = useState(false);
  // Start from existing limits; with none yet, from ISA's suggestions.
  const hasCurrent = Object.keys(current).length > 0;
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      EXPENSE_CATEGORIES.map((c) => {
        const v = hasCurrent ? current[c] : suggestions[c];
        return [c, v ? String(v) : ""];
      })
    )
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const limits = Object.fromEntries(
      Object.entries(values).map(([c, v]) => [c, Math.round(Number(v.replace(/\s/g, "")) || 0)])
    );
    await onSave(period, limits);
    setBusy(false);
  };

  return (
    <Modal open onClose={onClose} title={t("Budget")}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <p className={labelClass}>{t("Period")}</p>
          <PeriodToggle value={period} onChange={setPeriod} />
        </div>
        <p className="text-xs text-muted">{t("Leave a category empty to not limit it.")}</p>
        <div className="space-y-2.5">
          {EXPENSE_CATEGORIES.map((c) => (
            <label key={c} className="flex items-center gap-3">
              <span className="w-28 shrink-0 text-sm">{t(c)}</span>
              <input
                inputMode="numeric"
                value={values[c]}
                onChange={(e) => setValues((v) => ({ ...v, [c]: e.target.value.replace(/[^\d\s]/g, "") }))}
                placeholder={suggestions[c] ? String(suggestions[c]) : "—"}
                className={fieldClass}
              />
            </label>
          ))}
        </div>
        <button type="submit" disabled={busy} className={`${primaryBtnClass} w-full`}>{t("Save")}</button>
      </form>
    </Modal>
  );
}
