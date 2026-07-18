"use client";

import { useState } from "react";
import { Pencil, Trash2, Repeat2 } from "lucide-react";
import { useCollection } from "@/hooks/useCollection";
import { supabase } from "@/lib/supabase/client";
import { GlassCard } from "@/components/ui/GlassCard";
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
import { EXPENSE_CATEGORIES, formatSom, upcomingRecurring } from "@/lib/money";
import { toast } from "@/lib/toast";
import { useT } from "@/lib/i18n";
import type { RecurringPayment } from "@/lib/types";

type Draft = { name: string; amount: string; category: string; day_of_month: string };
const empty: Draft = {
  name: "",
  amount: "",
  category: EXPENSE_CATEGORIES[0],
  day_of_month: "1",
};

export function MoneyRecurring() {
  const { t } = useT();
  const { data, loading, remove, refresh } =
    useCollection<RecurringPayment>("recurring_payments");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringPayment | null>(null);
  const [draft, setDraft] = useState<Draft>(empty);
  const [saving, setSaving] = useState(false);
  const [confirmReq, setConfirmReq] = useState<ConfirmRequest | null>(null);

  const list = upcomingRecurring(data.filter((p) => p.is_active));

  const openNew = () => {
    setEditing(null);
    setDraft(empty);
    setOpen(true);
  };

  const openEdit = (p: RecurringPayment) => {
    setEditing(p);
    setDraft({
      name: p.name,
      amount: String(p.amount),
      category: p.category,
      day_of_month: String(p.day_of_month),
    });
    setOpen(true);
  };

  // Also keeps a linked `reminders` row in sync, so the payment surfaces
  // through the existing push-notification cron on its due day each month.
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: draft.name.trim(),
      amount: Number(draft.amount) || 0,
      category: draft.category,
      day_of_month: Math.min(31, Math.max(1, Number(draft.day_of_month) || 1)),
      is_active: true,
    };
    if (!payload.name || payload.amount <= 0 || saving) return;
    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return;
    }

    let paymentId = editing?.id;
    if (editing) {
      const { error } = await supabase
        .from("recurring_payments")
        .update(payload)
        .eq("id", editing.id);
      if (error) {
        toast("Couldn't save — please try again.", "error");
        setSaving(false);
        return;
      }
    } else {
      const { data: inserted, error } = await supabase
        .from("recurring_payments")
        .insert({ ...payload, user_id: user.id })
        .select()
        .single();
      if (error || !inserted) {
        toast("Couldn't save — please try again.", "error");
        setSaving(false);
        return;
      }
      paymentId = inserted.id;
    }

    const { data: existingReminder } = await supabase
      .from("reminders")
      .select("id")
      .eq("recurring_payment_id", paymentId)
      .maybeSingle();

    const reminderFields = {
      user_id: user.id,
      kind: "recurring" as const,
      recurring_payment_id: paymentId,
      title: payload.name,
      body: `"${payload.name}" (${formatSom(payload.amount)}) is due today.`,
      remind_time: "09:00",
      days: [],
      day_of_month: payload.day_of_month,
      enabled: true,
    };
    if (existingReminder) {
      await supabase
        .from("reminders")
        .update(reminderFields)
        .eq("id", existingReminder.id);
    } else {
      await supabase.from("reminders").insert(reminderFields);
    }

    await refresh();
    setSaving(false);
    setOpen(false);
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">
          {t("Recurring payments")}
        </h2>
        <AddButton onClick={openNew} label="New recurring" />
      </div>

      {loading ? (
        <div className="glass h-32 animate-pulse rounded-3xl" />
      ) : list.length === 0 ? (
        <EmptyState
          icon={Repeat2}
          title="No recurring payments"
          description="Track subscriptions and bills so they never surprise you."
          actionLabel="Add one"
          onAction={openNew}
        />
      ) : (
        <GlassCard className="divide-y divide-white/5 p-0">
          {list.map((p) => (
            <div
              key={p.id}
              className="group flex items-center gap-3 px-5 py-3.5"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{p.name}</p>
                <p className="text-xs text-muted">
                  {p.category} · {t("day")} {p.day_of_month}
                </p>
              </div>
              <span
                className={`shrink-0 text-xs font-medium ${
                  p.daysUntil <= 3 ? "text-amber-300" : "text-muted"
                }`}
              >
                {p.daysUntil === 0
                  ? t("due today")
                  : t("in {n}d", { n: p.daysUntil })}
              </span>
              <span className="shrink-0 text-sm font-semibold tabular-nums">
                {formatSom(p.amount)}
              </span>
              <div className="flex shrink-0 gap-1 opacity-0 transition group-hover:opacity-100">
                <button
                  onClick={() => openEdit(p)}
                  className="rounded-lg p-1.5 text-muted transition hover:text-fg"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() =>
                    setConfirmReq({
                      title: t('Delete "{name}"?', { name: p.name }),
                      confirmLabel: t("Delete"),
                      danger: true,
                      onConfirm: () => remove(p.id),
                    })
                  }
                  className="rounded-lg p-1.5 text-muted transition hover:text-red-400"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </GlassCard>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Edit recurring payment" : "New recurring payment"}
      >
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className={labelClass}>{t("Name")}</label>
            <input
              required
              autoFocus
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="e.g. Netflix"
              className={fieldClass}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>{t("Amount")}</label>
              <input
                required
                type="number"
                min={1}
                value={draft.amount}
                onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
                className={fieldClass}
              />
            </div>
            <div>
              <label className={labelClass}>{t("Day of month")}</label>
              <input
                type="number"
                min={1}
                max={31}
                value={draft.day_of_month}
                onChange={(e) =>
                  setDraft({ ...draft, day_of_month: e.target.value })
                }
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
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <PressButton type="submit" disabled={saving} className={primaryBtnClass}>
            {saving ? t("Saving…") : editing ? t("Save changes") : t("Add payment")}
          </PressButton>
        </form>
      </Modal>

      <ConfirmDialog request={confirmReq} onClose={() => setConfirmReq(null)} />
    </div>
  );
}
