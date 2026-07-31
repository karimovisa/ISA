"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Pencil, Trash2, Wallet, Target, Plus } from "lucide-react";
import { useCollection } from "@/hooks/useCollection";
import { AddButton } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  Modal,
  fieldClass,
  labelClass,
  primaryBtnClass,
} from "@/components/ui/Modal";
import { PressButton } from "@/components/ui/PressButton";
import { ConfirmDialog, type ConfirmRequest } from "@/components/ui/ConfirmDialog";
import { formatSom, financeGoalStatus } from "@/lib/money";
import { useT } from "@/lib/i18n";
import { captureLifeEvent } from "@/lib/life-events";
import type { FinanceGoal } from "@/lib/types";

type Draft = {
  name: string;
  target_amount: string;
  current_amount: string;
  target_date: string;
};

const empty: Draft = {
  name: "",
  target_amount: "",
  current_amount: "0",
  target_date: "",
};

const CARD = "rounded-[28px] border border-line bg-[var(--color-card)]";
const ACCENT_SOFT = "color-mix(in srgb, var(--color-accent) 15%, transparent)";
const GREEN = "#86A97F";
const fmtMonth = (d: string | number) => new Date(d).toLocaleDateString([], { month: "short", year: "numeric" });
const addMonths = (base: number, m: number) => { const d = new Date(base); d.setMonth(d.getMonth() + m); return d.getTime(); };

export function MoneyGoals({ monthlyNet = 0 }: { monthlyNet?: number }) {
  const { t } = useT();
  const { data, loading, add, update, remove } =
    useCollection<FinanceGoal>("finance_goals");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FinanceGoal | null>(null);
  const [draft, setDraft] = useState<Draft>(empty);
  const [confirmReq, setConfirmReq] = useState<ConfirmRequest | null>(null);
  // Direct contribution: add an amount straight to a goal, no full edit.
  const [contrib, setContrib] = useState<FinanceGoal | null>(null);
  const [amt, setAmt] = useState("");

  const active = data.filter((g) => g.is_active);

  const openNew = () => {
    setEditing(null);
    setDraft(empty);
    setOpen(true);
  };

  // The Money page's bottom sheet opens this modal via a global event.
  useEffect(() => {
    const h = () => { setEditing(null); setDraft(empty); setOpen(true); };
    window.addEventListener("isa:add-savings-goal", h);
    return () => window.removeEventListener("isa:add-savings-goal", h);
  }, []);

  const openEdit = (g: FinanceGoal) => {
    setEditing(g);
    setDraft({
      name: g.name,
      target_amount: String(g.target_amount),
      current_amount: String(g.current_amount),
      target_date: g.target_date ?? "",
    });
    setOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: draft.name.trim(),
      target_amount: Number(draft.target_amount) || 0,
      current_amount: Number(draft.current_amount) || 0,
      target_date: draft.target_date || null,
      is_active: true,
    };
    if (!payload.name || payload.target_amount <= 0) return;
    if (editing) {
      await update(editing.id, payload);
      if (payload.current_amount > editing.current_amount) {
        const reached = payload.current_amount >= payload.target_amount;
        void captureLifeEvent({
          type: "SavingGoalProgress",
          payload: {
            name: payload.name,
            added: payload.current_amount - editing.current_amount,
            reached,
          },
          links: { financeGoalIds: [editing.id] },
          context: { linkedToActiveGoal: true, outcome: reached ? "achievement" : "progress" },
        });
      }
    } else await add(payload);
    setOpen(false);
  };

  const addMoney = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contrib) return;
    const a = Number(amt) || 0;
    if (a <= 0) return;
    const newAmount = contrib.current_amount + a;
    await update(contrib.id, { current_amount: newAmount });
    const reached = newAmount >= contrib.target_amount;
    void captureLifeEvent({
      type: "SavingGoalProgress",
      payload: { name: contrib.name, added: a, reached },
      links: { financeGoalIds: [contrib.id] },
      context: { linkedToActiveGoal: true, outcome: reached ? "achievement" : "progress" },
    });
    setContrib(null);
    setAmt("");
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">{t("Goals")}</h2>
        <AddButton onClick={openNew} label="New goal" />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="glass h-40 animate-pulse rounded-3xl" />
          ))}
        </div>
      ) : active.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No savings goals yet"
          description="Name what you're saving for and track it here."
          learns="Saving for a phone or a trip? ISA works out the pace you're on and when you'll actually get there."
          actionLabel="Add your first goal"
          onAction={openNew}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {active.map((g, i) => {
            const s = financeGoalStatus(g, monthlyNet);
            const pct = Math.min(100, Math.max(0, s.pct));
            const remaining = Math.max(0, g.target_amount - g.current_amount);
            const done = pct >= 100;
            const finish = done
              ? { text: t("Reached"), good: true }
              : g.target_date
                ? { text: fmtMonth(g.target_date), good: false }
                : monthlyNet > 0
                  ? { text: `~${fmtMonth(addMonths(Date.now(), Math.max(1, Math.ceil(remaining / monthlyNet))))}`, good: false }
                  : { text: "—", good: false };
            return (
              <motion.div
                key={g.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
              >
                <div className={`${CARD} group p-5 transition hover:-translate-y-0.5 hover:border-white/10`}>
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl" style={{ background: ACCENT_SOFT }}>
                      <Target size={18} className="text-accent" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-semibold">{g.name}</h3>
                      <p className="truncate text-xs tabular-nums text-muted">{formatSom(g.current_amount)} / {formatSom(g.target_amount)}</p>
                    </div>
                    <span className="shrink-0 text-lg font-bold tabular-nums" style={done ? { color: GREEN } : undefined}>{pct}%</span>
                  </div>
                  <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/[0.06]">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: done ? GREEN : "var(--color-accent)" }}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                    />
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2 text-xs">
                    <span className="text-muted">{t("Remaining")} <span className="tabular-nums text-fg/85">{formatSom(remaining)}</span></span>
                    <span className={finish.good ? "font-medium" : "text-muted"} style={finish.good ? { color: GREEN } : undefined}>{finish.text}</span>
                  </div>
                  {!done && (
                    <button
                      onClick={() => { setContrib(g); setAmt(""); }}
                      className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-line bg-white/[0.03] py-2 text-sm font-medium text-fg transition hover:bg-white/[0.06] active:scale-[0.99]"
                    >
                      <Plus size={15} /> {t("Add money")}
                    </button>
                  )}
                  <div className="mt-2 flex items-center justify-end gap-1 opacity-0 transition group-hover:opacity-100">
                    <button onClick={() => openEdit(g)} className="rounded-lg p-1.5 text-muted transition hover:text-fg"><Pencil size={14} /></button>
                    <button
                      onClick={() => setConfirmReq({ title: t('Delete "{name}"?', { name: g.name }), confirmLabel: t("Delete"), danger: true, onConfirm: () => remove(g.id) })}
                      className="rounded-lg p-1.5 text-muted transition hover:text-red-400"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Edit goal" : "New goal"}
      >
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className={labelClass}>{t("Goal name")}</label>
            <input
              required
              autoFocus
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="e.g. MacBook Pro"
              className={fieldClass}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>{t("Target amount")}</label>
              <input
                required
                type="number"
                min={1}
                value={draft.target_amount}
                onChange={(e) =>
                  setDraft({ ...draft, target_amount: e.target.value })
                }
                className={fieldClass}
              />
            </div>
            <div>
              <label className={labelClass}>{t("Saved so far")}</label>
              <input
                type="number"
                min={0}
                value={draft.current_amount}
                onChange={(e) =>
                  setDraft({ ...draft, current_amount: e.target.value })
                }
                className={fieldClass}
              />
            </div>
          </div>
          <div>
            <label className={labelClass}>{t("Target date (optional)")}</label>
            <input
              type="date"
              value={draft.target_date}
              onChange={(e) =>
                setDraft({ ...draft, target_date: e.target.value })
              }
              className={fieldClass}
            />
          </div>
          <PressButton type="submit" className={primaryBtnClass}>
            {editing ? t("Save changes") : t("Create goal")}
          </PressButton>
        </form>
      </Modal>

      {/* Direct contribution — add an amount straight to a goal */}
      <Modal
        open={!!contrib}
        onClose={() => setContrib(null)}
        title={contrib ? t("Add to {name}", { name: contrib.name }) : ""}
      >
        {contrib && (
          <form onSubmit={addMoney} className="space-y-4">
            <p className="text-sm tabular-nums text-muted">
              {formatSom(contrib.current_amount)} / {formatSom(contrib.target_amount)}
            </p>
            <div>
              <label className={labelClass}>{t("Amount")}</label>
              <input
                required
                autoFocus
                type="number"
                min={1}
                value={amt}
                onChange={(e) => setAmt(e.target.value)}
                placeholder="100000"
                className={fieldClass}
              />
            </div>
            <PressButton type="submit" className={primaryBtnClass}>
              {t("Add money")}
            </PressButton>
          </form>
        )}
      </Modal>

      <ConfirmDialog request={confirmReq} onClose={() => setConfirmReq(null)} />
    </div>
  );
}
