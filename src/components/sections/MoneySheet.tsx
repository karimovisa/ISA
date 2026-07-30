"use client";

// ISA — Money bottom sheet. The one place the most-used money actions live, right
// in the thumb zone. Slides up from the bottom, big rounded targets, income green
// / expense red / accent. Replaces the old top action buttons entirely.

import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpCircle, ArrowDownCircle, Target, Repeat2, Camera } from "lucide-react";
import { useT } from "@/lib/i18n";

export const INCOME = "#44D19E";
export const EXPENSE = "#FF8A8A";

export function MoneySheet({
  open, onClose, onIncome, onExpense, onGoal, onRecurring,
}: {
  open: boolean;
  onClose: () => void;
  onIncome: () => void;
  onExpense: () => void;
  onGoal: () => void;
  onRecurring: () => void;
}) {
  const { t } = useT();
  const items = [
    { key: "income", label: t("Add Income"), Icon: ArrowUpCircle, color: INCOME, onClick: onIncome },
    { key: "expense", label: t("Add Expense"), Icon: ArrowDownCircle, color: EXPENSE, onClick: onExpense },
    { key: "goal", label: t("Savings Goal"), Icon: Target, color: "var(--color-accent)", onClick: onGoal },
    { key: "recurring", label: t("Recurring Payment"), Icon: Repeat2, color: "var(--color-fg)", onClick: onRecurring },
  ];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            className="glass relative z-10 w-full rounded-t-[28px] p-4 sm:max-w-md sm:rounded-[28px]"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 34, stiffness: 340 }}
            style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/15" />
            <div className="space-y-2">
              {items.map((it) => (
                <button
                  key={it.key}
                  onClick={() => { onClose(); it.onClick(); }}
                  className="flex w-full items-center gap-3.5 rounded-2xl border border-line bg-white/[0.02] p-3.5 text-left transition hover:bg-white/[0.06] active:scale-[0.99]"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ background: `color-mix(in srgb, ${it.color} 16%, transparent)` }}>
                    <it.Icon size={21} style={{ color: it.color }} />
                  </span>
                  <span className="text-[15px] font-medium">{it.label}</span>
                </button>
              ))}
              {/* Future — Scan Receipt (no OCR backend yet) */}
              <div className="flex w-full items-center gap-3.5 rounded-2xl border border-line bg-white/[0.01] p-3.5 opacity-45">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.04]"><Camera size={21} className="text-muted" /></span>
                <span className="text-[15px] font-medium text-muted">{t("Scan Receipt")}</span>
                <span className="ml-auto rounded-full bg-white/[0.05] px-2 py-0.5 text-[10px] text-muted">{t("soon")}</span>
              </div>
            </div>
            <button onClick={onClose} className="mt-2 w-full rounded-2xl py-3 text-center text-sm font-medium text-muted transition hover:text-fg">
              {t("Cancel")}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
