"use client";

// ISA — Ask ISA. The conversational surface over the Conversation & Action Layer.
// ISA thinks first (deterministic intent → context → reasoning); the LLM, when
// configured, only phrases the result. Actions ALWAYS require confirmation — ISA
// never writes to your life without you saying yes.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Send, Sparkles, RotateCcw, ArrowUpRight, Footprints, Wallet, type LucideIcon } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { ActionForm } from "@/components/conversation/ActionForm";
import { useAskIsa } from "@/lib/conversation";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/cn";

// English keys — the displayed (and sent) text is localised via t() at render.
// "q" = a question (plain outline pill); "log" = a record/log statement (leading
// icon + warm-accent border), so the two intents read differently at a glance.
type Starter = { text: string; kind: "q" | "log"; Icon?: LucideIcon };
const STARTERS: Starter[] = [
  { text: "What should I focus on today?", kind: "q" },
  { text: "Where is my money going?", kind: "q" },
  { text: "I'm tired", kind: "q" },
  { text: "I'll run 5 km tomorrow", kind: "log", Icon: Footprints },
  { text: "I spent 50,000 on food", kind: "log", Icon: Wallet },
];

export default function AskPage() {
  const {
    turns, busy, pendingAction, clarification, undoable,
    send, confirmAction, cancelAction, chooseClarification, undo,
  } = useAskIsa();
  const { t } = useT();
  const router = useRouter();
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns.length, pendingAction, clarification, undoable]);

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
          <div className="reflect rounded-3xl border border-white/10 bg-white/[0.05] p-5 backdrop-blur-xl">
            <div className="mb-4 flex items-center gap-2">
              <Sparkles size={16} style={{ color: "var(--color-accent)" }} />
              <h2 className="text-sm font-semibold">{t("ISA already knows you")}</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {STARTERS.map((s) => (
                <button
                  key={s.text}
                  onClick={() => void send(t(s.text))}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs transition",
                    s.kind === "log"
                      ? "border text-fg/90"
                      : "border border-line bg-white/[0.03] text-fg/80 hover:bg-white/[0.07]"
                  )}
                  style={
                    s.kind === "log"
                      ? {
                          borderColor: "color-mix(in srgb, var(--color-accent) 45%, transparent)",
                          background: "color-mix(in srgb, var(--color-accent) 9%, transparent)",
                        }
                      : undefined
                  }
                >
                  {s.Icon && <s.Icon size={13} style={{ color: "var(--color-accent)" }} />}
                  {t(s.text)}
                </button>
              ))}
            </div>
          </div>
        )}

        {turns.map((turn, i) => {
          // A question/coaching reply may carry a deep link — offer it as a chip,
          // never an automatic jump (that belongs to an explicit "open X").
          const nav =
            turn.role === "assistant" && turn.answer?.navigation && turn.answer.intent !== "navigate"
              ? turn.answer.navigation
              : null;
          // Suggested next steps live only under the LATEST answer, so the thread
          // doesn't fill with stale chips. ISA answers, then offers — never nags.
          const isLast = i === turns.length - 1;
          const followUps =
            isLast && turn.role === "assistant" && !pendingAction && !clarification
              ? (turn.answer?.followUps ?? []).slice(0, 3)
              : [];
          return (
            <motion.div
              key={turn.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className={cn("flex flex-col gap-1.5", turn.role === "user" ? "items-end" : "items-start")}
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
              {nav && (
                <button
                  onClick={() => router.push(nav.deepLink)}
                  className="flex items-center gap-1 rounded-full border border-line px-3 py-1.5 text-xs text-accent transition hover:bg-white/[0.05]"
                >
                  {t("Open")} {t(nav.label)} <ArrowUpRight size={13} />
                </button>
              )}
              {followUps.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {followUps.map((fu) => (
                    <button
                      key={fu}
                      onClick={() => void send(t(fu))}
                      className="rounded-full border border-line bg-white/[0.03] px-3 py-1.5 text-xs text-fg/80 transition hover:bg-white/[0.07]"
                    >
                      {t(fu)}
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          );
        })}

        {busy && (
          <div className="flex justify-start">
            <div className="glass rounded-2xl px-4 py-2.5 text-sm text-muted">{t("ISA is thinking…")}</div>
          </div>
        )}

        {/* ISA acted on its own (high confidence) — one tap to take it back. */}
        {undoable && !busy && (
          <div className="flex justify-start">
            <button
              onClick={() => void undo()}
              className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs text-muted transition hover:text-fg"
            >
              <RotateCcw size={13} /> {t("Undo")}
            </button>
          </div>
        )}

        {/* Not sure which template fits — offer the likely readings as buttons. */}
        {clarification && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <GlassCard className="border border-accent/40 p-4">
              <p className="mb-3 text-sm font-semibold text-accent">{t(clarification.prompt)}</p>
              <div className="flex flex-wrap gap-2">
                {clarification.options.map((o) => (
                  <button
                    key={o.kind}
                    onClick={() => chooseClarification(o)}
                    className="rounded-full border border-line bg-white/[0.03] px-3.5 py-1.5 text-sm text-fg/90 transition hover:bg-white/[0.07]"
                  >
                    {t(o.label)}
                  </button>
                ))}
              </div>
            </GlassCard>
          </motion.div>
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
