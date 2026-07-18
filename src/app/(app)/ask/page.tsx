"use client";

// ISA — Ask ISA. The conversational surface over the Conversation & Action Layer.
// ISA thinks first (deterministic intent → context → reasoning); the LLM, when
// configured, only phrases the result. Actions ALWAYS require confirmation — ISA
// never writes to your life without you saying yes.

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Send, Sparkles } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { ActionForm } from "@/components/conversation/ActionForm";
import { useAskIsa } from "@/lib/conversation";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/cn";

// English keys — the displayed (and sent) text is localised via t() at render.
const STARTERS = [
  "What should I focus on today?",
  "I'll run 5 km tomorrow",
  "I spent 50,000 on food",
  "Where is my money going?",
  "I'm tired",
];

export default function AskPage() {
  const { turns, busy, pendingAction, send, confirmAction, cancelAction } = useAskIsa();
  const { t } = useT();
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns.length, pendingAction]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = text.trim();
    if (!v || busy) return;
    setText("");
    void send(v);
  };

  return (
    <div>
      <PageHeader title="Ask ISA" subtitle="Ask your life a question — or add something in a sentence." />

      {/* Conversation */}
      <div className="space-y-3 pb-4">
        {turns.length === 0 && (
          <GlassCard className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <Sparkles size={16} className="text-accent" />
              <h2 className="text-sm font-semibold">{t("ISA already knows you")}</h2>
            </div>
            <p className="text-sm leading-relaxed text-muted">
              {t("Ask a question, or just note what you did — ISA understands and records it if needed. It always asks you first.")}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => void send(t(s))}
                  className="rounded-full border border-line bg-white/[0.03] px-3 py-1.5 text-xs text-fg/80 transition hover:bg-white/[0.07]"
                >
                  {t(s)}
                </button>
              ))}
            </div>
          </GlassCard>
        )}

        {turns.map((turn) => (
          <motion.div
            key={turn.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className={cn("flex", turn.role === "user" ? "justify-end" : "justify-start")}
          >
            <div
              className={cn(
                "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                turn.role === "user"
                  ? "bg-accent text-white"
                  : "glass text-fg/90"
              )}
            >
              {turn.text}
            </div>
          </motion.div>
        ))}

        {busy && (
          <div className="flex justify-start">
            <div className="glass rounded-2xl px-4 py-2.5 text-sm text-muted">{t("ISA is thinking…")}</div>
          </div>
        )}

        {/* A detected intent becomes a filled template — confirm, don't build. */}
        {pendingAction && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <ActionForm
              proposal={pendingAction}
              busy={busy}
              onConfirm={(v) => void confirmAction(v)}
              onCancel={cancelAction}
            />
          </motion.div>
        )}

        <div ref={endRef} />
      </div>

      {/* Composer — pinned above the mobile nav bar */}
      <form
        onSubmit={submit}
        className="sticky bottom-24 z-20 mt-2 md:bottom-4"
      >
        <div className="glass flex items-center gap-2 rounded-2xl p-1.5">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("Ask ISA…")}
            className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-fg placeholder:text-muted/60 focus:outline-none"
          />
          <button
            type="submit"
            aria-label={t("Send")}
            disabled={busy || !text.trim()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-white transition hover:brightness-110 disabled:opacity-40"
          >
            <Send size={15} />
          </button>
        </div>
      </form>
    </div>
  );
}
