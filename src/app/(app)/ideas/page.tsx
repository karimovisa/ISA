"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Trash2, Lightbulb } from "lucide-react";
import { useCollection } from "@/hooks/useCollection";
import { GlassCard } from "@/components/ui/GlassCard";
import { PageHeader, AddButton } from "@/components/ui/PageHeader";
import {
  Modal,
  fieldClass,
  labelClass,
  primaryBtnClass,
} from "@/components/ui/Modal";
import { PressButton } from "@/components/ui/PressButton";
import type { Idea } from "@/lib/types";

const TINTS = [
  "from-amber-300/[0.12]",
  "from-accent/[0.12]",
  "from-emerald-300/[0.12]",
  "from-fuchsia-300/[0.12]",
  "from-rose-300/[0.12]",
];

export default function IdeasPage() {
  const { data, loading, add, remove } = useCollection<Idea>("ideas");
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [tag, setTag] = useState("");

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    await add({ content: content.trim(), tag: tag.trim() || null });
    setContent("");
    setTag("");
    setOpen(false);
  };

  return (
    <div>
      <PageHeader
        title="Idea Vault"
        subtitle="Catch the sparks before they fade."
        action={<AddButton onClick={() => setOpen(true)} label="New idea" />}
      />

      {loading ? (
        <div className="columns-1 gap-5 sm:columns-2 lg:columns-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="glass mb-5 h-32 animate-pulse rounded-3xl"
            />
          ))}
        </div>
      ) : data.length === 0 ? (
        <GlassCard className="flex flex-col items-center justify-center py-20 text-center">
          <Lightbulb className="mb-4 text-muted" size={32} />
          <p className="text-sm text-muted">Your vault is empty.</p>
          <button
            onClick={() => setOpen(true)}
            className="mt-4 text-sm font-medium text-accent hover:underline"
          >
            Capture your first idea
          </button>
        </GlassCard>
      ) : (
        <div className="columns-1 gap-5 sm:columns-2 lg:columns-3">
          {data.map((idea, i) => (
            <motion.div
              key={idea.id}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              className="mb-5 break-inside-avoid"
            >
              <GlassCard
                hover
                className={`group bg-gradient-to-br ${
                  TINTS[i % TINTS.length]
                } to-transparent p-5`}
              >
                <div className="flex items-start justify-between gap-2">
                  {idea.tag && (
                    <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-muted">
                      {idea.tag}
                    </span>
                  )}
                  <button
                    onClick={() => remove(idea.id)}
                    className="ml-auto rounded-lg p-1.5 text-muted opacity-0 transition hover:text-red-400 group-hover:opacity-100"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <p className="mt-3 text-[15px] leading-relaxed text-white/90">
                  {idea.content}
                </p>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="New idea">
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className={labelClass}>Idea</label>
            <textarea
              required
              autoFocus
              rows={3}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Wheat field cinematic reel…"
              className={`${fieldClass} resize-none`}
            />
          </div>
          <div>
            <label className={labelClass}>Tag (optional)</label>
            <input
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              placeholder="Video, Brand, Product…"
              className={fieldClass}
            />
          </div>
          <PressButton type="submit" className={primaryBtnClass}>
            Save idea
          </PressButton>
        </form>
      </Modal>
    </div>
  );
}
