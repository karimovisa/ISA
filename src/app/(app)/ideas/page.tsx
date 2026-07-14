"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trash2, Lightbulb, MoreVertical, Star, Pin, Target, FolderKanban, ListTodo,
  Link2, Archive, RotateCcw, Search,
} from "lucide-react";
import { useCollection } from "@/hooks/useCollection";
import { supabase } from "@/lib/supabase/client";
import { GlassCard } from "@/components/ui/GlassCard";
import { PageHeader, AddButton } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal, fieldClass, labelClass, primaryBtnClass } from "@/components/ui/Modal";
import { PressButton } from "@/components/ui/PressButton";
import { toast } from "@/lib/toast";
import { todayISO } from "@/lib/datetime";
import { captureLifeEvent } from "@/lib/life-events";
import { prepareIdeaMeta, statusMeta, IDEA_STATUSES } from "@/lib/ideas";
import type { Idea, IdeaStatus, Goal, Project } from "@/lib/types";

const CYCLE: IdeaStatus[] = ["new", "active", "in_progress", "implemented"];
const TINTS = ["from-amber-300/[0.12]", "from-accent/[0.12]", "from-emerald-300/[0.12]", "from-fuchsia-300/[0.12]", "from-rose-300/[0.12]"];

export default function IdeasPage() {
  const ideas = useCollection<Idea>("ideas");
  const goals = useCollection<Goal>("goals");
  const projects = useCollection<Project>("projects");
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [tag, setTag] = useState("");
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<IdeaStatus | "all" | "favorite">("all");
  const [linkMode, setLinkMode] = useState<{ idea: Idea; type: "goal" | "project" } | null>(null);

  const addRel = (ideaId: string, targetType: string, targetId: string | null, relType: string) =>
    supabase.from("idea_relationships").insert({ idea_id: ideaId, target_type: targetType, target_id: targetId, rel_type: relType } as never);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const c = content.trim();
    if (!c) return;
    await ideas.add({ content: c, tag: tag.trim() || null, status: "new", ai_meta: prepareIdeaMeta(c, tag.trim() || null) } as Partial<Idea>);
    void captureLifeEvent({ type: "NoteCaptured", payload: { tag: tag.trim() || null }, context: { outcome: "informational" } });
    setContent(""); setTag(""); setOpen(false);
  };

  const cycleStatus = (idea: Idea) => {
    const i = CYCLE.indexOf(idea.status as IdeaStatus);
    const next = CYCLE[(i + 1) % CYCLE.length];
    ideas.update(idea.id, { status: next });
    void captureLifeEvent({ type: "IdeaStatusChanged", payload: { from: idea.status, to: next }, links: { noteIds: [idea.id] } });
  };
  const toggleFav = (idea: Idea) => {
    ideas.update(idea.id, { favorite: !idea.favorite });
    if (!idea.favorite) void captureLifeEvent({ type: "IdeaFavorited", payload: {}, links: { noteIds: [idea.id] }, context: { outcome: "consistency" } });
  };
  const togglePin = (idea: Idea) => { ideas.update(idea.id, { pinned: !idea.pinned }); setMenuFor(null); };
  const archive = (idea: Idea) => { ideas.update(idea.id, { status: "archived" }); void captureLifeEvent({ type: "IdeaArchived", payload: {}, links: { noteIds: [idea.id] } }); setMenuFor(null); };
  const restore = (idea: Idea) => { ideas.update(idea.id, { status: "active" }); void captureLifeEvent({ type: "IdeaRestored", payload: {}, links: { noteIds: [idea.id] } }); setMenuFor(null); };
  const del = (idea: Idea) => { if (confirm("Delete this idea?")) ideas.remove(idea.id); setMenuFor(null); };

  const convert = async (idea: Idea, kind: "goal" | "project" | "task") => {
    setMenuFor(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const title = idea.content.slice(0, 80);
    if (kind === "goal") {
      const { data } = await supabase.from("goals").insert({ user_id: user.id, title }).select("id").single();
      if (data) { await addRel(idea.id, "goal", data.id as string, "converted_to"); await ideas.update(idea.id, { status: "in_progress" }); void captureLifeEvent({ type: "IdeaConvertedToGoal", payload: { title }, links: { noteIds: [idea.id], goalIds: [data.id as string] }, context: { outcome: "achievement" } }); toast("Idea → Goal", "success"); }
    } else if (kind === "project") {
      const { data } = await supabase.from("projects").insert({ user_id: user.id, title, status: "planning" }).select("id").single();
      if (data) { await addRel(idea.id, "project", data.id as string, "converted_to"); await ideas.update(idea.id, { status: "in_progress" }); void captureLifeEvent({ type: "IdeaConvertedToProject", payload: { title }, links: { noteIds: [idea.id], taskIds: [data.id as string] }, context: { outcome: "achievement" } }); toast("Idea → Project", "success"); }
    } else {
      const { data } = await supabase.from("todos").insert({ user_id: user.id, title, date: todayISO(), done: false, priority: "normal" }).select("id").single();
      if (data) { await addRel(idea.id, "task", data.id as string, "converted_to"); void captureLifeEvent({ type: "IdeaConvertedToTask", payload: { title }, links: { noteIds: [idea.id] }, context: { outcome: "progress" } }); toast("Idea → Task", "success"); }
    }
  };

  const linkTo = async (idea: Idea, type: "goal" | "project", targetId: string) => {
    await addRel(idea.id, type, targetId, "linked_to");
    void captureLifeEvent({ type: type === "goal" ? "IdeaLinkedToGoal" : "IdeaLinkedToProject", payload: {}, links: type === "goal" ? { noteIds: [idea.id], goalIds: [targetId] } : { noteIds: [idea.id], taskIds: [targetId] }, context: { outcome: "progress" } });
    setLinkMode(null); toast("Linked ✓", "success");
  };

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ideas.data
      .filter((i) => {
        if (filter === "favorite") { if (!i.favorite) return false; }
        else if (filter === "all") { if (i.status === "archived") return false; }
        else if (i.status !== filter) return false;
        if (q && !`${i.content} ${i.tag ?? ""}`.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.created_at.localeCompare(a.created_at));
  }, [ideas.data, query, filter]);

  return (
    <div onClick={() => menuFor && setMenuFor(null)}>
      <PageHeader title="Idea Vault" subtitle="Catch sparks — then grow them into goals, projects, and tasks."
        action={<AddButton onClick={() => setOpen(true)} label="New idea" />} />

      {/* Search + filter */}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-line bg-white/[0.02] px-3 py-2">
          <Search size={15} className="text-muted" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search ideas…" className="min-w-0 flex-1 bg-transparent text-sm text-fg placeholder:text-muted/60" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(["all", "favorite", ...IDEA_STATUSES.map((s) => s.id)] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`rounded-full px-3 py-1 text-xs capitalize transition ${filter === f ? "bg-accent text-white" : "bg-white/5 text-muted hover:text-fg"}`}>
              {f === "favorite" ? "★" : f === "in_progress" ? "In Progress" : f}
            </button>
          ))}
        </div>
      </div>

      {ideas.loading ? (
        <div className="columns-1 gap-5 sm:columns-2 lg:columns-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="glass mb-5 h-32 animate-pulse rounded-3xl" />)}</div>
      ) : visible.length === 0 ? (
        <EmptyState icon={Lightbulb} title={query || filter !== "all" ? "No matching ideas" : "Your vault is empty"} description="Drop the next thought before it slips away." actionLabel="Capture your first idea" onAction={() => setOpen(true)} />
      ) : (
        <div className="columns-1 gap-5 sm:columns-2 lg:columns-3">
          {visible.map((idea, i) => {
            const sm = statusMeta(idea.status);
            return (
              <motion.div key={idea.id} layout initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.35, delay: Math.min(i, 8) * 0.03 }} className="mb-5 break-inside-avoid">
                <GlassCard className={`bg-gradient-to-br ${TINTS[i % TINTS.length]} to-transparent p-5`}>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      {idea.pinned && <Pin size={12} className="text-accent" />}
                      <button onClick={() => cycleStatus(idea)} className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition ${sm.tone}`}>{sm.label}</button>
                      {idea.tag && <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-muted">{idea.tag}</span>}
                    </div>
                    <div className="flex items-center gap-0.5">
                      <button onClick={() => toggleFav(idea)} aria-label="Favorite" className="rounded-lg p-1 text-muted transition hover:text-amber-300"><Star size={14} className={idea.favorite ? "fill-amber-300 text-amber-300" : ""} /></button>
                      <div className="relative">
                        <button onClick={(e) => { e.stopPropagation(); setMenuFor(menuFor === idea.id ? null : idea.id); }} aria-label="Idea menu" className="rounded-lg p-1 text-muted transition hover:text-fg"><MoreVertical size={16} /></button>
                        <AnimatePresence>
                          {menuFor === idea.id && (
                            <motion.div initial={{ opacity: 0, scale: 0.95, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.15 }} onClick={(e) => e.stopPropagation()}
                              className="glass absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-xl p-1 shadow-xl">
                              <MI Icon={Pin} label={idea.pinned ? "Unpin" : "Pin"} onClick={() => togglePin(idea)} />
                              <MI Icon={Target} label="Convert to Goal" onClick={() => convert(idea, "goal")} />
                              <MI Icon={FolderKanban} label="Convert to Project" onClick={() => convert(idea, "project")} />
                              <MI Icon={ListTodo} label="Convert to Task" onClick={() => convert(idea, "task")} />
                              <MI Icon={Link2} label="Link to Goal" onClick={() => { setMenuFor(null); setLinkMode({ idea, type: "goal" }); }} />
                              <MI Icon={Link2} label="Link to Project" onClick={() => { setMenuFor(null); setLinkMode({ idea, type: "project" }); }} />
                              {idea.status === "archived" ? <MI Icon={RotateCcw} label="Restore" onClick={() => restore(idea)} /> : <MI Icon={Archive} label="Archive" onClick={() => archive(idea)} />}
                              <MI Icon={Trash2} label="Delete" danger onClick={() => del(idea)} />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>
                  <p className="text-[15px] leading-relaxed text-fg/90">{idea.content}</p>
                </GlassCard>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* New idea */}
      <Modal open={open} onClose={() => setOpen(false)} title="New idea">
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className={labelClass}>Idea</label>
            <textarea required autoFocus rows={3} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Wheat field cinematic reel…" className={`${fieldClass} resize-none`} />
          </div>
          <div>
            <label className={labelClass}>Tag (optional)</label>
            <input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="Video, Brand, Product…" className={fieldClass} />
          </div>
          <PressButton type="submit" className={primaryBtnClass}>Save idea</PressButton>
        </form>
      </Modal>

      {/* Link picker */}
      <Modal open={linkMode !== null} onClose={() => setLinkMode(null)} title={linkMode ? `Link to ${linkMode.type}` : ""}>
        <div className="space-y-1.5">
          {linkMode && (linkMode.type === "goal" ? goals.data.filter((g) => !g.archived) : projects.data).map((x) => (
            <button key={x.id} onClick={() => linkTo(linkMode.idea, linkMode.type, x.id)} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-fg/85 transition hover:bg-white/5">
              {linkMode.type === "goal" ? <Target size={15} className="text-muted" /> : <FolderKanban size={15} className="text-muted" />}
              {x.title}
            </button>
          ))}
          {linkMode && (linkMode.type === "goal" ? goals.data.filter((g) => !g.archived).length === 0 : projects.data.length === 0) && (
            <p className="py-6 text-center text-sm text-muted">No {linkMode.type}s yet.</p>
          )}
        </div>
      </Modal>
    </div>
  );
}

function MI({ Icon, label, onClick, danger }: { Icon: typeof Pin; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition hover:bg-white/5 ${danger ? "text-red-400" : "text-fg/90"}`}>
      <Icon size={15} /> {label}
    </button>
  );
}
