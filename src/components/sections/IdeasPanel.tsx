"use client";

// ISA — Ideas, folded into Journal. A light capture-and-keep inbox for sparks
// (Journal is for dated reflection; this is for atomic notes). Same `ideas` table
// as before — just a calmer home, without the project/convert machinery.

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Lightbulb, Star, Trash2, Plus, Search } from "lucide-react";
import { useCollection } from "@/hooks/useCollection";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog, type ConfirmRequest } from "@/components/ui/ConfirmDialog";
import { PressButton } from "@/components/ui/PressButton";
import { useT } from "@/lib/i18n";
import { captureLifeEvent } from "@/lib/life-events";
import { prepareIdeaMeta } from "@/lib/ideas";
import type { Idea } from "@/lib/types";

const CARD = "rounded-[28px] border border-line bg-[var(--color-card)]";

export function IdeasPanel() {
  const { t } = useT();
  const ideas = useCollection<Idea>("ideas");
  const [content, setContent] = useState("");
  const [tag, setTag] = useState("");
  const [query, setQuery] = useState("");
  const [favOnly, setFavOnly] = useState(false);
  const [confirmReq, setConfirmReq] = useState<ConfirmRequest | null>(null);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const c = content.trim();
    if (!c) return;
    await ideas.add({
      content: c,
      tag: tag.trim() || null,
      status: "new",
      ai_meta: prepareIdeaMeta(c, tag.trim() || null),
    } as Partial<Idea>);
    void captureLifeEvent({ type: "NoteCaptured", payload: { tag: tag.trim() || null }, context: { outcome: "informational" } });
    setContent("");
    setTag("");
  };

  const toggleFav = (idea: Idea) => {
    ideas.update(idea.id, { favorite: !idea.favorite });
    if (!idea.favorite)
      void captureLifeEvent({ type: "IdeaFavorited", payload: {}, links: { noteIds: [idea.id] }, context: { outcome: "consistency" } });
  };
  const del = (idea: Idea) =>
    setConfirmReq({
      title: t("Delete this idea?"),
      body: idea.content.slice(0, 90),
      confirmLabel: t("Delete"),
      danger: true,
      onConfirm: () => ideas.remove(idea.id),
    });

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ideas.data
      .filter((i) => i.status !== "archived")
      .filter((i) => (favOnly ? i.favorite : true))
      .filter((i) => (q ? `${i.content} ${i.tag ?? ""}`.toLowerCase().includes(q) : true))
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.created_at.localeCompare(a.created_at));
  }, [ideas.data, query, favOnly]);

  return (
    <div>
      <ConfirmDialog request={confirmReq} onClose={() => setConfirmReq(null)} />

      {/* Capture */}
      <form onSubmit={add} className={`${CARD} p-5 sm:p-6`}>
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white/[0.04]">
            <Lightbulb size={16} className="text-accent" />
          </span>
          <h3 className="text-[15px] font-semibold">{t("Capture an idea")}</h3>
        </div>
        <textarea
          rows={2}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={t("Drop the next thought before it slips away.")}
          className="w-full resize-none rounded-2xl border border-line bg-white/[0.02] p-3.5 text-[15px] leading-relaxed text-fg/90 placeholder:text-muted/50 focus:border-accent/40 focus:outline-none"
        />
        <div className="mt-3 flex items-center gap-2">
          <input
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            placeholder={t("Tag (optional)")}
            className="min-w-0 flex-1 rounded-xl border border-line bg-white/[0.02] px-3 py-2 text-sm text-fg placeholder:text-muted/50 focus:outline-none"
          />
          <PressButton
            type="submit"
            className="flex shrink-0 items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
          >
            <Plus size={15} /> {t("Save")}
          </PressButton>
        </div>
      </form>

      {/* Search + favourite filter */}
      {ideas.data.some((i) => i.status !== "archived") && (
        <div className="mt-4 flex items-center gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-line bg-white/[0.02] px-3 py-2">
            <Search size={15} className="text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("Search ideas…")}
              className="min-w-0 flex-1 bg-transparent text-sm text-fg placeholder:text-muted/60 focus:outline-none"
            />
          </div>
          <button
            onClick={() => setFavOnly((v) => !v)}
            aria-label={t("Favorites")}
            className={`shrink-0 rounded-xl border border-line px-3 py-2 transition ${favOnly ? "text-amber-300" : "text-muted hover:text-fg"}`}
          >
            <Star size={15} className={favOnly ? "fill-amber-300 text-amber-300" : ""} />
          </button>
        </div>
      )}

      {/* List */}
      <div className="mt-4">
        {ideas.loading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="glass h-24 animate-pulse rounded-3xl" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={Lightbulb}
            title={query || favOnly ? t("No matching ideas") : t("No ideas yet")}
            description={t("Catch a spark — it lives here, out of the way of your journal.")}
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <AnimatePresence initial={false}>
              {visible.map((idea) => (
                <motion.div
                  key={idea.id}
                  layout
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className={`${CARD} group p-4`}
                >
                  <div className="flex items-start justify-between gap-2">
                    {idea.tag ? (
                      <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-muted">{idea.tag}</span>
                    ) : (
                      <span />
                    )}
                    <div className="flex shrink-0 items-center gap-0.5">
                      <button onClick={() => toggleFav(idea)} aria-label={t("Favorites")} className="rounded-lg p-1 text-muted transition hover:text-amber-300">
                        <Star size={14} className={idea.favorite ? "fill-amber-300 text-amber-300" : ""} />
                      </button>
                      <button onClick={() => del(idea)} aria-label={t("Delete")} className="rounded-lg p-1 text-muted opacity-0 transition hover:text-red-400 group-hover:opacity-100">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                  <p className="mt-1.5 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-fg/90">{idea.content}</p>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
