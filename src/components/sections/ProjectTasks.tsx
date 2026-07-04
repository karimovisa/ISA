"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Plus, X } from "lucide-react";
import type { ProjectTask } from "@/lib/types";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * B + C hybrid task list. Collapsed: shows the single next step with a quick
 * check. Expanded: a full Linear-style checklist with inline add.
 */
export function ProjectTasks({
  tasks,
  onAdd,
  onToggle,
  onRemove,
}: {
  tasks: ProjectTask[];
  onAdd: (title: string) => void;
  onToggle: (task: ProjectTask) => void;
  onRemove: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState("");

  const next = tasks.find((t) => !t.done) ?? null;
  const doneCount = tasks.filter((t) => t.done).length;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = draft.trim();
    if (!v) return;
    onAdd(v);
    setDraft("");
  };

  return (
    <div className="mt-4 border-t border-line pt-4">
      {/* Collapsed: the next step */}
      <div className="flex items-center gap-3">
        {next ? (
          <>
            <CheckCircle done={false} onClick={() => onToggle(next)} />
            <div className="min-w-0 flex-1">
              <div className="text-[0.65rem] uppercase tracking-wider text-muted">
                Next step
              </div>
              <div className="truncate text-sm text-fg/90">{next.title}</div>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted">
            <Check size={15} className="text-fg/70" />
            {tasks.length ? "All steps complete" : "No steps yet"}
          </div>
        )}

        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted transition hover:text-fg"
        >
          {tasks.length > 0 && (
            <span className="tabular-nums">
              {doneCount}/{tasks.length}
            </span>
          )}
          <motion.span animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown size={15} />
          </motion.span>
        </button>
      </div>

      {/* Expanded: full checklist */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="overflow-hidden"
          >
            <ul className="mt-3 space-y-1">
              {tasks.map((t) => (
                <li key={t.id} className="group/task flex items-center gap-3 py-1">
                  <CheckCircle done={t.done} onClick={() => onToggle(t)} />
                  <span
                    className={`flex-1 text-sm transition-colors ${
                      t.done ? "text-muted line-through" : "text-fg/90"
                    }`}
                  >
                    {t.title}
                  </span>
                  <button
                    onClick={() => onRemove(t.id)}
                    className="rounded p-1 text-muted opacity-0 transition hover:text-red-400 group-hover/task:opacity-100"
                    aria-label="Remove step"
                  >
                    <X size={13} />
                  </button>
                </li>
              ))}
            </ul>

            <form onSubmit={submit} className="mt-2 flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full border border-dashed border-line text-muted">
                <Plus size={11} />
              </span>
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Add a step…"
                className="flex-1 bg-transparent py-1 text-sm text-fg/90 placeholder:text-muted/60"
              />
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CheckCircle({ done, onClick }: { done: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={done ? "Mark incomplete" : "Mark complete"}
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
        done
          ? "border-white bg-white text-black"
          : "border-white/30 text-transparent hover:border-white/60"
      }`}
    >
      <motion.span
        initial={false}
        animate={{ scale: done ? 1 : 0, opacity: done ? 1 : 0 }}
        transition={{ duration: 0.18, ease: EASE }}
      >
        <Check size={12} strokeWidth={3} />
      </motion.span>
    </button>
  );
}
