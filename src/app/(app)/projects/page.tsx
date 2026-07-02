"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Pencil, Trash2, FolderKanban } from "lucide-react";
import { useCollection } from "@/hooks/useCollection";
import { GlassCard } from "@/components/ui/GlassCard";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { PageHeader, AddButton } from "@/components/ui/PageHeader";
import {
  Modal,
  fieldClass,
  labelClass,
  primaryBtnClass,
} from "@/components/ui/Modal";
import type { Project, ProjectStatus } from "@/lib/types";

const STATUS: { value: ProjectStatus; label: string; color: string }[] = [
  { value: "planning", label: "Planning", color: "text-amber-300 bg-amber-300/10" },
  { value: "active", label: "Active", color: "text-emerald-300 bg-emerald-300/10" },
  { value: "paused", label: "Paused", color: "text-muted bg-white/10" },
  { value: "done", label: "Done", color: "text-accent bg-accent/15" },
];

type Draft = {
  title: string;
  status: ProjectStatus;
  percentage: number;
  tasks_total: number;
  tasks_done: number;
};

const empty: Draft = {
  title: "",
  status: "planning",
  percentage: 0,
  tasks_total: 0,
  tasks_done: 0,
};

export default function ProjectsPage() {
  const { data, loading, add, update, remove } =
    useCollection<Project>("projects");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [draft, setDraft] = useState<Draft>(empty);

  const openNew = () => {
    setEditing(null);
    setDraft(empty);
    setOpen(true);
  };
  const openEdit = (p: Project) => {
    setEditing(p);
    setDraft({
      title: p.title,
      status: p.status,
      percentage: p.percentage,
      tasks_total: p.tasks_total,
      tasks_done: p.tasks_done,
    });
    setOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      title: draft.title.trim(),
      status: draft.status,
      percentage: Number(draft.percentage),
      tasks_total: Number(draft.tasks_total),
      tasks_done: Number(draft.tasks_done),
    };
    if (editing) await update(editing.id, payload);
    else await add(payload);
    setOpen(false);
  };

  const statusMeta = (s: ProjectStatus) =>
    STATUS.find((x) => x.value === s) ?? STATUS[0];

  return (
    <div>
      <PageHeader
        title="Projects"
        subtitle="What you are building right now."
        action={<AddButton onClick={openNew} label="New project" />}
      />

      {loading ? (
        <SkeletonGrid />
      ) : data.length === 0 ? (
        <EmptyState onAdd={openNew} />
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {data.map((p, i) => {
            const meta = statusMeta(p.status);
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.06 }}
              >
                <GlassCard hover className="group p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold tracking-tight">
                        {p.title}
                      </h3>
                      <span
                        className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.color}`}
                      >
                        {meta.label}
                      </span>
                    </div>
                    <div className="flex shrink-0 gap-1 opacity-0 transition group-hover:opacity-100">
                      <IconBtn onClick={() => openEdit(p)}>
                        <Pencil size={15} />
                      </IconBtn>
                      <IconBtn onClick={() => remove(p.id)} danger>
                        <Trash2 size={15} />
                      </IconBtn>
                    </div>
                  </div>

                  <div className="mt-5 flex items-center justify-between text-sm">
                    <span className="text-muted">
                      {p.tasks_done}/{p.tasks_total} tasks
                    </span>
                    <span className="font-semibold tabular-nums">
                      {p.percentage}%
                    </span>
                  </div>
                  <div className="mt-3">
                    <ProgressBar value={p.percentage} />
                  </div>
                </GlassCard>
              </motion.div>
            );
          })}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Edit project" : "New project"}
      >
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className={labelClass}>Title</label>
            <input
              required
              autoFocus
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="e.g. Life OS"
              className={fieldClass}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Status</label>
              <select
                value={draft.status}
                onChange={(e) =>
                  setDraft({ ...draft, status: e.target.value as ProjectStatus })
                }
                className={fieldClass}
              >
                {STATUS.map((s) => (
                  <option key={s.value} value={s.value} className="bg-bg">
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
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
              <label className={labelClass}>Tasks done</label>
              <input
                type="number"
                min={0}
                value={draft.tasks_done}
                onChange={(e) =>
                  setDraft({ ...draft, tasks_done: Number(e.target.value) })
                }
                className={fieldClass}
              />
            </div>
            <div>
              <label className={labelClass}>Tasks total</label>
              <input
                type="number"
                min={0}
                value={draft.tasks_total}
                onChange={(e) =>
                  setDraft({ ...draft, tasks_total: Number(e.target.value) })
                }
                className={fieldClass}
              />
            </div>
          </div>
          <button type="submit" className={primaryBtnClass}>
            {editing ? "Save changes" : "Create project"}
          </button>
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
      <FolderKanban className="mb-4 text-muted" size={32} />
      <p className="text-sm text-muted">No projects yet.</p>
      <button
        onClick={onAdd}
        className="mt-4 text-sm font-medium text-accent hover:underline"
      >
        Add your first project
      </button>
    </GlassCard>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="glass h-40 animate-pulse rounded-3xl" />
      ))}
    </div>
  );
}
