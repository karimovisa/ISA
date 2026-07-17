"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Pencil, Archive, Trash2, FolderKanban, Search, Target, X, StickyNote, Activity,
} from "lucide-react";
import { useCollection } from "@/hooks/useCollection";
import { supabase } from "@/lib/supabase/client";
import { GlassCard } from "@/components/ui/GlassCard";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { PageHeader, AddButton } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal, fieldClass, labelClass, primaryBtnClass } from "@/components/ui/Modal";
import { PressButton } from "@/components/ui/PressButton";
import { PopMenu } from "@/components/ui/PopMenu";
import { ConfirmDialog, type ConfirmRequest } from "@/components/ui/ConfirmDialog";
import { ProjectTasks } from "@/components/sections/ProjectTasks";
import { useT } from "@/lib/i18n";
import { captureLifeEvent } from "@/lib/life-events";
import { PROJECT_STATUSES, statusMeta, projectHealth, HEALTH_META, prepareProjectMeta, normalizeStatus } from "@/lib/projects";
import { formatDeadline } from "@/lib/datetime";
import type { Project, ProjectStatus, ProjectTask, ProjectNote, ProjectRelationship, Goal } from "@/lib/types";

type Draft = { title: string; status: ProjectStatus; target_date: string };
const empty: Draft = { title: "", status: "active", target_date: "" };
type SortKey = "newest" | "oldest" | "progress_desc" | "progress_asc" | "updated" | "alpha";

export default function ProjectsPage() {
  const { t } = useT();
  const projects = useCollection<Project>("projects");
  const tasksCol = useCollection<ProjectTask>("project_tasks", { orderBy: "position", ascending: true });
  const rels = useCollection<ProjectRelationship>("project_relationships");
  const notes = useCollection<ProjectNote>("project_notes", { orderBy: "created_at", ascending: false });
  const goals = useCollection<Goal>("goals");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [draft, setDraft] = useState<Draft>(empty);
  const [confirmReq, setConfirmReq] = useState<ConfirmRequest | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | ProjectStatus | "updated">("all");
  const [sort, setSort] = useState<SortKey>("newest");
  const [linkFor, setLinkFor] = useState<Project | null>(null);
  const [noteFor, setNoteFor] = useState<Project | null>(null);
  const [noteDraft, setNoteDraft] = useState("");

  const tasksFor = (pid: string) => tasksCol.data.filter((tk) => tk.project_id === pid);
  const relsFor = (pid: string) => rels.data.filter((r) => r.project_id === pid && r.target_type === "goal");
  const notesFor = (pid: string) => notes.data.filter((n) => n.project_id === pid);
  const goalTitle = (id: string | null) => goals.data.find((g) => g.id === id)?.title ?? "Goal";
  const derivedPct = (p: Project) => { const l = tasksFor(p.id); return l.length ? Math.round((l.filter((t) => t.done).length / l.length) * 100) : p.percentage; };

  const touch = (pid: string) => supabase.from("projects").update({ last_activity_at: new Date().toISOString() }).eq("id", pid);

  const openNew = () => { setEditing(null); setDraft(empty); setOpen(true); };
  const openEdit = (p: Project) => { setEditing(p); setDraft({ title: p.title, status: normalizeStatus(p.status), target_date: p.target_date ?? "" }); setOpen(true); };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { title: draft.title.trim(), status: draft.status, target_date: draft.target_date || null };
    if (editing) {
      await projects.update(editing.id, payload);
      if (draft.status !== normalizeStatus(editing.status)) {
        void captureLifeEvent({ type: draft.status === "archived" ? "ProjectArchived" : draft.status === "completed" ? "ProjectCompleted" : "ProjectStatusChanged", payload: { title: payload.title, status: draft.status }, links: { taskIds: [editing.id] }, context: { outcome: draft.status === "completed" ? "achievement" : "informational" } });
      }
      if ((draft.target_date || null) !== editing.target_date) void captureLifeEvent({ type: "ProjectDeadlineChanged", payload: { target_date: draft.target_date || null }, links: { taskIds: [editing.id] } });
    } else {
      await projects.add({ ...payload, ai_meta: prepareProjectMeta(payload.title) } as Partial<Project>);
      void captureLifeEvent({ type: "ProjectCreated", payload: { title: payload.title } });
    }
    setOpen(false);
  };

  const syncProject = (pid: string, list: ProjectTask[]) => {
    const proj = projects.data.find((p) => p.id === pid);
    if (!proj) return;
    const total = list.length, done = list.filter((t) => t.done).length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    if (proj.tasks_total !== total || proj.tasks_done !== done || proj.percentage !== pct)
      projects.update(pid, { tasks_total: total, tasks_done: done, percentage: pct });
    touch(pid);
  };
  const addTask = async (pid: string, title: string) => {
    const list = tasksFor(pid);
    await tasksCol.add({ project_id: pid, title, done: false, position: list.length } as Partial<ProjectTask>);
    void captureLifeEvent({ type: "ProjectStepAdded", payload: { step: title }, links: { taskIds: [pid] } });
    syncProject(pid, [...list, { done: false } as ProjectTask]);
  };
  const toggleTask = async (task: ProjectTask) => {
    await tasksCol.update(task.id, { done: !task.done });
    if (!task.done) void captureLifeEvent({ type: "ProjectTaskCompleted", payload: { step: task.title }, links: { taskIds: [task.project_id] }, context: { outcome: "progress" } });
    syncProject(task.project_id, tasksFor(task.project_id).map((t) => (t.id === task.id ? { ...t, done: !task.done } : t)));
  };
  const removeTask = async (id: string, pid: string) => { await tasksCol.remove(id); syncProject(pid, tasksFor(pid).filter((t) => t.id !== id)); };

  const linkGoal = async (p: Project, goalId: string) => {
    await supabase.from("project_relationships").insert({ project_id: p.id, target_type: "goal", target_id: goalId, rel_type: "linked_to" } as never);
    void captureLifeEvent({ type: "ProjectGoalLinked", payload: {}, links: { taskIds: [p.id], goalIds: [goalId] }, context: { outcome: "progress" } });
    rels.refresh(); touch(p.id); setLinkFor(null);
  };
  const unlinkGoal = async (r: ProjectRelationship) => {
    await rels.remove(r.id);
    void captureLifeEvent({ type: "ProjectGoalUnlinked", payload: {}, links: { taskIds: [r.project_id] } });
  };
  const addNote = async (p: Project) => {
    const c = noteDraft.trim(); if (!c) return;
    await notes.add({ project_id: p.id, content: c } as Partial<ProjectNote>);
    void captureLifeEvent({ type: "ProjectNoteAdded", payload: {}, links: { taskIds: [p.id] } });
    setNoteDraft(""); touch(p.id);
  };
  const archive = (p: Project) => { projects.update(p.id, { status: "archived" }); void captureLifeEvent({ type: "ProjectArchived", payload: { title: p.title }, links: { taskIds: [p.id] } }); };
  const del = (p: Project) =>
    setConfirmReq({
      title: t("Delete \"{name}\"?", { name: p.title }),
      body: t("This removes the project and its steps. It can't be undone."),
      confirmLabel: t("Delete"),
      danger: true,
      onConfirm: () => projects.remove(p.id),
    });

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = projects.data.filter((p) => {
      const st = normalizeStatus(p.status);
      if (filter === "updated") { /* handled by sort */ }
      else if (filter !== "all" && st !== filter) return false;
      else if (filter === "all" && st === "archived") return false;
      if (q && !p.title.toLowerCase().includes(q)) return false;
      return true;
    });
    const upd = (p: Project) => p.last_activity_at ?? p.created_at;
    list = [...list].sort((a, b) => {
      switch (sort) {
        case "oldest": return a.created_at.localeCompare(b.created_at);
        case "progress_desc": return derivedPct(b) - derivedPct(a);
        case "progress_asc": return derivedPct(a) - derivedPct(b);
        case "updated": return upd(b).localeCompare(upd(a));
        case "alpha": return a.title.localeCompare(b.title);
        default: return b.created_at.localeCompare(a.created_at);
      }
    });
    if (filter === "updated") list = [...list].sort((a, b) => upd(b).localeCompare(upd(a)));
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects.data, tasksCol.data, query, filter, sort]);

  return (
    <div>
      <ConfirmDialog request={confirmReq} onClose={() => setConfirmReq(null)} />
      <PageHeader title="Projects" subtitle="Your execution hub — steps, goals, and notes in one place."
        action={<AddButton onClick={openNew} label="New project" />} />

      {/* Search / filter / sort */}
      <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-line bg-white/[0.02] px-3 py-2">
          <Search size={15} className="text-muted" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search projects…" className="min-w-0 flex-1 bg-transparent text-sm text-fg placeholder:text-muted/60" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(["all", "active", "on_hold", "completed", "archived", "updated"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`rounded-full px-3 py-1 text-xs capitalize transition ${filter === f ? "bg-accent text-white" : "bg-white/5 text-muted hover:text-fg"}`}>{f === "on_hold" ? "On Hold" : f === "updated" ? "Recent" : f}</button>
          ))}
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="rounded-full bg-white/5 px-3 py-1 text-xs text-muted">
            <option value="newest">Newest</option><option value="oldest">Oldest</option>
            <option value="progress_desc">Most progress</option><option value="progress_asc">Least progress</option>
            <option value="updated">Recently updated</option><option value="alpha">A–Z</option>
          </select>
        </div>
      </div>

      {projects.loading ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="glass h-48 animate-pulse rounded-3xl" />)}</div>
      ) : visible.length === 0 ? (
        <EmptyState icon={FolderKanban} title="No projects" description="Break a goal into a project you can actually ship."
          learns="ISA will track each project's pace against its deadline and tell you which one is quietly stalling."
          actionLabel="Add your first project" onAction={openNew} />
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {visible.map((p) => {
            const sm = statusMeta(p.status);
            const pct = derivedPct(p);
            const health = HEALTH_META[projectHealth(p, tasksFor(p.id), pct)];
            const linked = relsFor(p.id);
            const pNotes = notesFor(p.id);
            const daysLeft = p.target_date ? Math.round((new Date(p.target_date).getTime() - Date.now()) / 86_400_000) : null;
            return (
              <motion.div key={p.id} layout initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                <GlassCard className="p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-lg font-semibold tracking-tight">{p.title}</h3>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${sm.tone}`}>{sm.label}</span>
                        <span className={`flex items-center gap-1 text-xs ${health.tone}`}><Activity size={11} />{health.label}</span>
                      </div>
                    </div>
                    {/* Portaled — never clipped by the card (.reflect sets overflow:hidden). */}
                    <div className="shrink-0">
                      <PopMenu ariaLabel="Project menu">
                        {(closeMenu) => (
                          <>
                            <MI Icon={Pencil} label="Edit" onClick={() => { closeMenu(); openEdit(p); }} />
                            <MI Icon={Target} label="Link goal" onClick={() => { closeMenu(); setLinkFor(p); }} />
                            <MI Icon={StickyNote} label="Notes" onClick={() => { closeMenu(); setNoteFor(p); }} />
                            <MI Icon={Archive} label="Archive" onClick={() => { closeMenu(); archive(p); }} />
                            <MI Icon={Trash2} label="Delete" danger onClick={() => { closeMenu(); del(p); }} />
                          </>
                        )}
                      </PopMenu>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between text-sm">
                    <span className="text-muted">{tasksFor(p.id).filter((t) => t.done).length}/{tasksFor(p.id).length || p.tasks_total} steps</span>
                    <span className="font-semibold tabular-nums">{pct}%</span>
                  </div>
                  <div className="mt-2"><ProgressBar value={pct} /></div>
                  <div className="mt-2 flex flex-wrap gap-x-3 text-[11px] text-muted">
                    <span>Created {new Date(p.created_at).toLocaleDateString([], { month: "short", day: "numeric" })}</span>
                    {p.target_date && <span className={daysLeft != null && daysLeft < 0 ? "text-red-300" : ""}>{formatDeadline(p.target_date)}{daysLeft != null ? ` · ${daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`}` : ""}</span>}
                  </div>

                  {linked.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {linked.map((r) => (
                        <span key={r.id} className="group/g flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[11px] text-accent">
                          <Target size={10} />{goalTitle(r.target_id)}
                          <button onClick={() => unlinkGoal(r)} className="opacity-0 transition group-hover/g:opacity-100"><X size={10} /></button>
                        </span>
                      ))}
                    </div>
                  )}
                  {pNotes.length > 0 && <p className="mt-2 text-[11px] text-muted">{pNotes.length} note{pNotes.length === 1 ? "" : "s"}</p>}

                  <ProjectTasks tasks={tasksFor(p.id)} onAdd={(title) => addTask(p.id, title)} onToggle={toggleTask} onRemove={(id) => removeTask(id, p.id)} />
                </GlassCard>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Create / edit */}
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit project" : "New project"}>
        <form onSubmit={save} className="space-y-4">
          <div><label className={labelClass}>Title</label><input required autoFocus value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="e.g. Life OS" className={fieldClass} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={labelClass}>Status</label>
              <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as ProjectStatus })} className={fieldClass}>
                {PROJECT_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <div><label className={labelClass}>Target date</label><input type="date" value={draft.target_date} onChange={(e) => setDraft({ ...draft, target_date: e.target.value })} className={fieldClass} /></div>
          </div>
          <p className="text-xs text-muted">Progress is automatic — it comes from completed steps.</p>
          <PressButton type="submit" className={primaryBtnClass}>{editing ? "Save changes" : "Create project"}</PressButton>
        </form>
      </Modal>

      {/* Link goal */}
      <Modal open={linkFor !== null} onClose={() => setLinkFor(null)} title="Link a goal">
        <div className="space-y-1.5">
          {linkFor && goals.data.filter((g) => !g.archived).map((g) => (
            <button key={g.id} onClick={() => linkGoal(linkFor, g.id)} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-fg/85 transition hover:bg-white/5"><Target size={15} className="text-muted" />{g.title}</button>
          ))}
          {linkFor && goals.data.filter((g) => !g.archived).length === 0 && <p className="py-6 text-center text-sm text-muted">No goals yet.</p>}
        </div>
      </Modal>

      {/* Notes */}
      <Modal open={noteFor !== null} onClose={() => { setNoteFor(null); setNoteDraft(""); }} title={noteFor ? `Notes · ${noteFor.title}` : "Notes"}>
        {noteFor && (
          <div className="space-y-3">
            <form onSubmit={(e) => { e.preventDefault(); addNote(noteFor); }} className="flex gap-2">
              <input value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} placeholder="Quick note…" className={fieldClass} />
              <PressButton type="submit" className="shrink-0 rounded-xl bg-accent px-4 text-sm font-semibold text-white">Add</PressButton>
            </form>
            <div className="max-h-[40vh] space-y-2 overflow-y-auto">
              {notesFor(noteFor.id).map((n) => (
                <div key={n.id} className="group flex items-start gap-2 rounded-xl bg-white/[0.03] p-3 text-sm">
                  <p className="min-w-0 flex-1 text-fg/85">{n.content}</p>
                  <div className="shrink-0 text-right">
                    <span className="text-[10px] text-muted">{new Date(n.created_at).toLocaleDateString([], { month: "short", day: "numeric" })}</span>
                    <button onClick={() => notes.remove(n.id)} className="ml-2 text-muted opacity-0 transition hover:text-red-400 group-hover:opacity-100"><Trash2 size={12} /></button>
                  </div>
                </div>
              ))}
              {notesFor(noteFor.id).length === 0 && <p className="py-4 text-center text-xs text-muted">No notes yet.</p>}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function MI({ Icon, label, onClick, danger }: { Icon: typeof Pencil; label: string; onClick: () => void; danger?: boolean }) {
  return <button onClick={onClick} className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition hover:bg-white/5 ${danger ? "text-red-400" : "text-fg/90"}`}><Icon size={15} /> {label}</button>;
}
