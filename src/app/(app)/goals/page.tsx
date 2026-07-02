"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Pencil, Trash2, Target, Plus, Minus } from "lucide-react";
import { useCollection } from "@/hooks/useCollection";
import { GlassCard } from "@/components/ui/GlassCard";
import { AscentProgress } from "@/components/ui/AscentProgress";
import { PageHeader, AddButton } from "@/components/ui/PageHeader";
import {
  Modal,
  fieldClass,
  labelClass,
  primaryBtnClass,
} from "@/components/ui/Modal";
import { PressButton } from "@/components/ui/PressButton";
import { formatDeadline } from "@/lib/datetime";
import type { Goal } from "@/lib/types";

type Draft = {
  title: string;
  percentage: number;
  deadline: string;
  motivation: string;
};

const empty: Draft = { title: "", percentage: 0, deadline: "", motivation: "" };

/** Days until a deadline (negative = overdue), or null when unset. */
function daysLeft(deadline: string | null): number | null {
  if (!deadline) return null;
  const d = new Date(deadline);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  const ms =
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() -
    new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round(ms / 86_400_000);
}

function deadlineTone(days: number | null): string {
  if (days === null) return "text-muted";
  if (days < 0) return "text-red-300";
  if (days <= 30) return "text-amber-300";
  return "text-muted";
}

export default function GoalsPage() {
  const { data, loading, add, update, remove } = useCollection<Goal>("goals");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [draft, setDraft] = useState<Draft>(empty);

  const openNew = () => {
    setEditing(null);
    setDraft(empty);
    setOpen(true);
  };

  const openEdit = (g: Goal) => {
    setEditing(g);
    setDraft({
      title: g.title,
      percentage: g.percentage,
      deadline: g.deadline ?? "",
      motivation: g.motivation ?? "",
    });
    setOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      title: draft.title.trim(),
      percentage: Number(draft.percentage),
      deadline: draft.deadline || null,
      motivation: draft.motivation.trim() || null,
    };
    if (editing) await update(editing.id, payload);
    else await add(payload);
    setOpen(false);
  };

  return (
    <div>
      <PageHeader
        title="Goals"
        subtitle="The mountains you are climbing. One percent at a time."
        action={<AddButton onClick={openNew} label="New goal" />}
      />

      {loading ? (
        <SkeletonGrid />
      ) : data.length === 0 ? (
        <EmptyState onAdd={openNew} />
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {data.map((g, i) => {
            const days = daysLeft(g.deadline);
            return (
              <motion.div
                key={g.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.06 }}
              >
                <GlassCard hover className="group p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold tracking-tight">
                        {g.title}
                      </h3>
                      <p className={`mt-0.5 text-xs ${deadlineTone(days)}`}>
                        {formatDeadline(g.deadline)}
                        {days !== null &&
                          (days < 0
                            ? ` · ${Math.abs(days)} days overdue`
                            : days === 0
                              ? " · today"
                              : ` · ${days} days left`)}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1 opacity-0 transition group-hover:opacity-100">
                      <IconBtn onClick={() => openEdit(g)}>
                        <Pencil size={15} />
                      </IconBtn>
                      <IconBtn onClick={() => remove(g.id)} danger>
                        <Trash2 size={15} />
                      </IconBtn>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-3xl font-bold tabular-nums">
                      {g.percentage}%
                    </span>
                    <div className="flex items-center gap-1">
                      <IconBtn
                        onClick={() =>
                          update(g.id, {
                            percentage: Math.max(0, g.percentage - 5),
                          })
                        }
                      >
                        <Minus size={15} />
                      </IconBtn>
                      <IconBtn
                        onClick={() =>
                          update(g.id, {
                            percentage: Math.min(100, g.percentage + 5),
                          })
                        }
                      >
                        <Plus size={15} />
                      </IconBtn>
                    </div>
                  </div>
                  <AscentProgress value={g.percentage} />

                  {g.motivation && (
                    <p className="mt-3 text-sm italic text-muted">
                      “{g.motivation}”
                    </p>
                  )}
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
            <label className={labelClass}>Title</label>
            <input
              required
              autoFocus
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="e.g. IELTS 7.0"
              className={fieldClass}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Progress %</label>
              <input
                type="number"
                min={0}
                max={100}
                value={draft.percentage}
                onChange={(e) =>
                  setDraft({ ...draft, percentage: Number(e.target.value) })
                }
                className={fieldClass}
              />
            </div>
            <div>
              <label className={labelClass}>Deadline</label>
              <input
                type="date"
                value={draft.deadline}
                onChange={(e) =>
                  setDraft({ ...draft, deadline: e.target.value })
                }
                className={fieldClass}
              />
            </div>
          </div>
          <div>
            <label className={labelClass}>Motivation</label>
            <input
              value={draft.motivation}
              onChange={(e) =>
                setDraft({ ...draft, motivation: e.target.value })
              }
              placeholder="Why this matters"
              className={fieldClass}
            />
          </div>
          <PressButton type="submit" className={primaryBtnClass}>
            {editing ? "Save changes" : "Create goal"}
          </PressButton>
        </form>
      </Modal>
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg p-2 text-muted transition hover:bg-white/5 ${
        danger ? "hover:text-red-400" : "hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <GlassCard className="flex flex-col items-center justify-center py-20 text-center">
      <Target className="mb-4 text-muted" size={32} />
      <p className="text-sm text-muted">No goals yet.</p>
      <button
        onClick={onAdd}
        className="mt-4 text-sm font-medium text-accent hover:underline"
      >
        Add your first goal
      </button>
    </GlassCard>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="glass h-44 animate-pulse rounded-3xl" />
      ))}
    </div>
  );
}
