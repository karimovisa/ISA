"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Plus, Trash2, ListTodo } from "lucide-react";
import { useCollection } from "@/hooks/useCollection";
import { GlassCard } from "@/components/ui/GlassCard";
import { todayISO } from "@/lib/datetime";
import type { Todo } from "@/lib/types";

export function TodoList() {
  const todos = useCollection<Todo>("todos", {
    orderBy: "created_at",
    ascending: true,
  });
  const [draft, setDraft] = useState("");

  const today = todayISO();
  const items = todos.data.filter((t) => t.date === today);
  const doneCount = items.filter((t) => t.done).length;
  const pct = items.length ? Math.round((doneCount / items.length) * 100) : 0;
  // undone rise to the top, done sink to the bottom (stable)
  const sorted = [...items].sort((a, b) => Number(a.done) - Number(b.done));

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = draft.trim();
    if (!v) return;
    setDraft("");
    await todos.add({ title: v, date: today, done: false });
  };

  return (
    <GlassCard className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListTodo size={18} className="text-muted" />
          <h3 className="text-sm font-medium">Today&apos;s to-do</h3>
        </div>
        {items.length > 0 && (
          <span className="text-xs tabular-nums text-muted">
            {doneCount}/{items.length}
          </span>
        )}
      </div>

      {items.length > 0 && (
        <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
          <motion.div
            className="h-full rounded-full bg-fg"
            initial={false}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
      )}

      <ul className="space-y-1">
        <AnimatePresence initial={false}>
          {sorted.map((t) => (
            <motion.li
              key={t.id}
              layout
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="group flex items-center gap-3 py-1.5"
            >
              <button
                onClick={() => todos.update(t.id, { done: !t.done })}
                aria-label={t.done ? "Mark undone" : "Mark done"}
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                  t.done
                    ? "border-fg bg-fg text-[color:var(--color-bg)]"
                    : "border-white/30 text-transparent hover:border-white/60"
                }`}
              >
                <Check size={12} strokeWidth={3} />
              </button>
              <span
                className={`flex-1 text-sm transition-colors ${
                  t.done ? "text-muted line-through" : "text-fg/90"
                }`}
              >
                {t.title}
              </span>
              <button
                onClick={() => todos.remove(t.id)}
                className="rounded p-1 text-muted opacity-0 transition hover:text-red-400 group-hover:opacity-100"
                aria-label="Delete"
              >
                <Trash2 size={13} />
              </button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      <form onSubmit={add} className="mt-2 flex items-center gap-2">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-dashed border-line text-muted">
          <Plus size={11} />
        </span>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a task…"
          className="flex-1 bg-transparent py-1 text-sm text-fg/90 placeholder:text-muted/60"
        />
      </form>
    </GlassCard>
  );
}
