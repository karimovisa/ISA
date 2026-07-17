"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Pencil, Trash2, Wallet } from "lucide-react";
import { useCollection } from "@/hooks/useCollection";
import { GlassCard } from "@/components/ui/GlassCard";
import { AscentProgress } from "@/components/ui/AscentProgress";
import { AddButton } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  Modal,
  fieldClass,
  labelClass,
  primaryBtnClass,
} from "@/components/ui/Modal";
import { PressButton } from "@/components/ui/PressButton";
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

export function MoneyGoals({ monthlyNet = 0 }: { monthlyNet?: number }) {
  const { t } = useT();
  const { data, loading, add, update, remove } =
    useCollection<FinanceGoal>("finance_goals");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FinanceGoal | null>(null);
  const [draft, setDraft] = useState<Draft>(empty);

  const active = data.filter((g) => g.is_active);

  const openNew = () => {
    setEditing(null);
    setDraft(empty);
    setOpen(true);
  };

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
            const pct = s.pct;
            const tone = s.status === "ahead" ? "text-emerald-300 bg-emerald-300/10" : s.status === "behind" ? "text-amber-300 bg-amber-300/10" : "text-muted bg-white/10";
            return (
              <motion.div
                key={g.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
              >
                <GlassCard hover className="group p-5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-medium">{g.name}</h3>
                    <div className="flex shrink-0 gap-1 opacity-0 transition group-hover:opacity-100">
                      <button
                        onClick={() => openEdit(g)}
                        className="rounded-lg p-1.5 text-muted transition hover:text-fg"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete goal "${g.name}"?`)) remove(g.id);
                        }}
                        className="rounded-lg p-1.5 text-muted transition hover:text-red-400"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {formatSom(g.current_amount)} / {formatSom(g.target_amount)}
                  </p>
                  <div className="mt-3">
                    <AscentProgress value={pct} />
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${tone}`}>{t(s.label)}</span>
                    {s.requiredMonthly != null && s.status !== "done" && (
                      <span className="text-[10px] text-muted">{formatSom(s.requiredMonthly)}/mo</span>
                    )}
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted">{s.prediction}</p>
                </GlassCard>
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
    </div>
  );
}
