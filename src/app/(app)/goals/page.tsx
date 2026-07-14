"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Target, MoreVertical, Pencil, Archive, Trash2, Plus, Check, X,
  ChevronDown, TrendingUp, Sparkles,
} from "lucide-react";
import { useCollection } from "@/hooks/useCollection";
import { GlassCard } from "@/components/ui/GlassCard";
import { AscentProgress } from "@/components/ui/AscentProgress";
import { PageHeader, AddButton } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal, fieldClass, labelClass, primaryBtnClass } from "@/components/ui/Modal";
import { PressButton } from "@/components/ui/PressButton";
import { captureLifeEvent } from "@/lib/life-events";
import { analyzeGoal, type GoalPace } from "@/lib/goals";
import type { Goal, GoalMilestone } from "@/lib/types";

type Draft = { title: string; deadline: string; motivation: string };
const empty: Draft = { title: "", deadline: "", motivation: "" };

const paceChip: Record<GoalPace, string> = {
  ahead: "text-emerald-300 bg-emerald-300/10",
  on_track: "text-fg bg-white/10",
  behind: "text-amber-300 bg-amber-300/10",
  no_deadline: "text-muted bg-white/5",
  done: "text-accent bg-accent/15",
};

export default function GoalsPage() {
  const goals = useCollection<Goal>("goals");
  const ms = useCollection<GoalMilestone>("goal_milestones", { orderBy: "position", ascending: true });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [draft, setDraft] = useState<Draft>(empty);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [stepDraft, setStepDraft] = useState("");

  const active = goals.data.filter((g) => !g.archived);
  const msFor = (gid: string) => ms.data.filter((m) => m.goal_id === gid);

  const openNew = () => { setEditing(null); setDraft(empty); setOpen(true); };
  const openEdit = (g: Goal) => {
    setEditing(g);
    setDraft({ title: g.title, deadline: g.deadline ?? "", motivation: g.motivation ?? "" });
    setOpen(true); setMenuFor(null);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { title: draft.title.trim(), deadline: draft.deadline || null, motivation: draft.motivation.trim() || null };
    if (editing) await goals.update(editing.id, payload);
    else {
      await goals.add(payload);
      void captureLifeEvent({ type: "GoalCreated", payload: { title: payload.title } });
    }
    setOpen(false);
  };

  // Recompute % from a projected milestone list, persist it, and feed the engine.
  const sync = (g: Goal, list: GoalMilestone[]) => {
    const pct = list.length ? Math.round((list.filter((m) => m.done).length / list.length) * 100) : 0;
    if (pct === g.percentage) return;
    goals.update(g.id, { percentage: pct });
    const reached = pct === 100 && g.percentage < 100;
    void captureLifeEvent({
      type: reached ? "GoalCompleted" : "GoalProgressUpdated",
      payload: { title: g.title, percentage: pct },
      links: { goalIds: [g.id] },
      context: { linkedToActiveGoal: true, outcome: reached ? "achievement" : "progress" },
    });
  };

  const addStep = async (g: Goal) => {
    const title = stepDraft.trim();
    if (!title) return;
    setStepDraft("");
    const list = msFor(g.id);
    await ms.add({ goal_id: g.id, title, position: list.length, done: false } as Partial<GoalMilestone>);
    sync(g, [...list, { done: false } as GoalMilestone]);
  };
  const toggleStep = async (g: Goal, m: GoalMilestone) => {
    await ms.update(m.id, { done: !m.done, done_at: !m.done ? new Date().toISOString() : null } as Partial<GoalMilestone>);
    sync(g, msFor(g.id).map((x) => (x.id === m.id ? { ...x, done: !m.done } : x)));
  };
  const removeStep = async (g: Goal, m: GoalMilestone) => {
    await ms.remove(m.id);
    sync(g, msFor(g.id).filter((x) => x.id !== m.id));
  };

  const archive = (g: Goal) => { goals.update(g.id, { archived: true }); setMenuFor(null); };
  const del = (g: Goal) => {
    if (confirm(`Delete goal "${g.title}"? This removes its milestones too.`)) goals.remove(g.id);
    setMenuFor(null);
  };

  return (
    <div onClick={() => menuFor && setMenuFor(null)}>
      <PageHeader
        title="Goals"
        subtitle="You climb. ISA measures, predicts, and points to the next step."
        action={<AddButton onClick={openNew} label="New goal" />}
      />

      {goals.loading ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="glass h-52 animate-pulse rounded-3xl" />)}
        </div>
      ) : active.length === 0 ? (
        <EmptyState icon={Target} title="No goals yet"
          description="Name a summit, set a deadline, then add milestones — ISA tracks the rest."
          actionLabel="Add your first goal" onAction={openNew} />
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {active.map((g, i) => {
            const list = msFor(g.id);
            const a = analyzeGoal(g, list);
            const isOpen = expanded === g.id;
            return (
              <motion.div key={g.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: i * 0.05 }}>
                <GlassCard className="p-5">
                  {/* header */}
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-lg font-semibold tracking-tight">{g.title}</h3>
                    <div className="relative shrink-0">
                      <button onClick={(e) => { e.stopPropagation(); setMenuFor(menuFor === g.id ? null : g.id); }}
                        aria-label="Goal menu" className="rounded-lg p-1.5 text-muted transition hover:bg-white/5 hover:text-fg">
                        <MoreVertical size={18} />
                      </button>
                      <AnimatePresence>
                        {menuFor === g.id && (
                          <motion.div initial={{ opacity: 0, scale: 0.95, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.15 }}
                            onClick={(e) => e.stopPropagation()}
                            className="glass absolute right-0 z-10 mt-1 w-36 overflow-hidden rounded-xl p-1 shadow-xl">
                            <MenuItem Icon={Pencil} label="Edit" onClick={() => openEdit(g)} />
                            <MenuItem Icon={Archive} label="Archive" onClick={() => archive(g)} />
                            <MenuItem Icon={Trash2} label="Delete" danger onClick={() => del(g)} />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* progress + days */}
                  <div className="mt-3 flex items-end justify-between">
                    <span className="text-3xl font-bold tabular-nums">{a.pct}%</span>
                    <div className="text-right">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${paceChip[a.pace]}`}>{a.paceLabel}</span>
                      {a.daysLeft != null && (
                        <p className={`mt-1 text-xs ${a.daysLeft < 0 ? "text-red-300" : a.daysLeft <= 3 ? "text-amber-300" : "text-muted"}`}>
                          {a.daysLeft < 0 ? `${Math.abs(a.daysLeft)} days overdue` : `${a.daysLeft} days left`}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="mt-3"><AscentProgress value={a.pct} /></div>

                  {/* intelligence */}
                  <div className="mt-4 space-y-1.5 text-sm">
                    <p className="flex items-center gap-2 text-fg/85">
                      <TrendingUp size={14} className="shrink-0 text-accent" />
                      {a.nextStep ? <span><span className="text-muted">Next: </span>{a.nextStep}</span>
                        : <span className="text-muted">Add a milestone to begin.</span>}
                    </p>
                    <p className="flex items-center gap-2 text-xs text-muted">
                      <Sparkles size={13} className="shrink-0 text-accent/70" />{a.prediction}
                    </p>
                    {a.insight && <p className="text-xs font-medium text-amber-300/90">{a.insight}</p>}
                  </div>

                  {/* milestones */}
                  <button onClick={() => setExpanded(isOpen ? null : g.id)}
                    className="mt-4 flex w-full items-center justify-between border-t border-line pt-3 text-xs text-muted transition hover:text-fg">
                    <span>{list.length ? `${list.filter((m) => m.done).length}/${list.length} milestones` : "Milestones"}</span>
                    <motion.span animate={{ rotate: isOpen ? 180 : 0 }}><ChevronDown size={15} /></motion.span>
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }} className="overflow-hidden">
                        <ul className="mt-2 space-y-1">
                          {list.map((m) => (
                            <li key={m.id} className="group/ms flex items-center gap-2.5 py-1">
                              <button onClick={() => toggleStep(g, m)} aria-label={m.done ? "Mark undone" : "Mark done"}
                                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition ${
                                  m.done ? "border-white bg-white text-black" : "border-white/30 text-transparent hover:border-white/60"}`}>
                                <Check size={12} strokeWidth={3} />
                              </button>
                              <span className={`flex-1 text-sm ${m.done ? "text-muted line-through" : "text-fg/90"}`}>{m.title}</span>
                              <button onClick={() => removeStep(g, m)} aria-label="Remove"
                                className="rounded p-1 text-muted opacity-0 transition hover:text-red-400 group-hover/ms:opacity-100">
                                <X size={13} />
                              </button>
                            </li>
                          ))}
                        </ul>
                        <form onSubmit={(e) => { e.preventDefault(); addStep(g); }} className="mt-2 flex items-center gap-2">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full border border-dashed border-line text-muted"><Plus size={11} /></span>
                          <input value={expanded === g.id ? stepDraft : ""} onChange={(e) => setStepDraft(e.target.value)}
                            placeholder="Add a milestone…" className="flex-1 bg-transparent py-1 text-sm text-fg/90 placeholder:text-muted/60" />
                        </form>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {g.motivation && <p className="mt-3 border-t border-line pt-3 text-sm italic text-muted">“{g.motivation}”</p>}
                </GlassCard>
              </motion.div>
            );
          })}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit goal" : "New goal"}>
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className={labelClass}>Title</label>
            <input required autoFocus value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="e.g. Build ISA OS" className={fieldClass} />
          </div>
          <div>
            <label className={labelClass}>Deadline</label>
            <input type="date" value={draft.deadline} onChange={(e) => setDraft({ ...draft, deadline: e.target.value })} className={fieldClass} />
          </div>
          <div>
            <label className={labelClass}>Motivation</label>
            <input value={draft.motivation} onChange={(e) => setDraft({ ...draft, motivation: e.target.value })}
              placeholder="Why this matters" className={fieldClass} />
          </div>
          {!editing && (
            <p className="text-xs text-muted">
              Progress is automatic — after creating, open the goal and add milestones. ISA tracks pace and predicts the rest.
            </p>
          )}
          <PressButton type="submit" className={primaryBtnClass}>{editing ? "Save changes" : "Create goal"}</PressButton>
        </form>
      </Modal>
    </div>
  );
}

function MenuItem({ Icon, label, onClick, danger }: { Icon: typeof Pencil; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition hover:bg-white/5 ${danger ? "text-red-400" : "text-fg/90"}`}>
      <Icon size={15} /> {label}
    </button>
  );
}
