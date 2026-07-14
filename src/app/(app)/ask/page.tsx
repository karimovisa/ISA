"use client";

// ISA — Ask ISA. The conversational surface over the Conversation & Action Layer.
// ISA thinks first (deterministic intent → context → reasoning); the LLM, when
// configured, only phrases the result. Actions ALWAYS require confirmation — ISA
// never writes to your life without you saying yes.

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Send, Sparkles, Check, X } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { PressButton } from "@/components/ui/PressButton";
import { useAskIsa } from "@/lib/conversation";
import { cn } from "@/lib/cn";

const STARTERS = [
  "Bugun nimaga e'tibor beray?",
  "Ertaga 5 km yuguraman",
  "50 000 so'm ovqatga sarfladim",
  "Pulim qayerga ketyapti?",
  "Charchadim",
];

export default function AskPage() {
  const { turns, busy, pendingAction, send, confirmAction, cancelAction } = useAskIsa();
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
      <PageHeader title="Ask ISA" subtitle="Hayotingiz haqida so'rang — yoki shu yerdan qo'shing." />

      {/* Conversation */}
      <div className="space-y-3 pb-4">
        {turns.length === 0 && (
          <GlassCard className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <Sparkles size={16} className="text-accent" />
              <h2 className="text-sm font-semibold">ISA sizni allaqachon biladi</h2>
            </div>
            <p className="text-sm leading-relaxed text-muted">
              Savol bering, yoki shunchaki nima qilganingizni yozing — ISA tushunadi va
              kerak bo&apos;lsa o&apos;zi yozib qo&apos;yadi. Har doim avval sizdan so&apos;raydi.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => void send(s)}
                  className="rounded-full border border-line bg-white/[0.03] px-3 py-1.5 text-xs text-fg/80 transition hover:bg-white/[0.07]"
                >
                  {s}
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
            <div className="glass rounded-2xl px-4 py-2.5 text-sm text-muted">ISA o&apos;ylayapti…</div>
          </div>
        )}

        {/* A write always needs an explicit yes. */}
        {pendingAction && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <GlassCard className="border border-accent/40 p-4">
              <p className="text-sm text-fg">{pendingAction.summary}</p>
              {pendingAction.warnings.map((w) => (
                <p key={w} className="mt-1 text-xs text-amber-400">{w}</p>
              ))}
              <div className="mt-3 flex gap-2">
                <PressButton
                  onClick={() => void confirmAction()}
                  disabled={busy}
                  className="flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
                >
                  <Check size={15} /> {pendingAction.confirmLabel}
                </PressButton>
                <PressButton
                  onClick={cancelAction}
                  className="flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm text-muted transition hover:text-fg"
                >
                  <X size={15} /> Yo&apos;q
                </PressButton>
              </div>
            </GlassCard>
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
            placeholder="ISA'dan so'rang…"
            className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-fg placeholder:text-muted/60 focus:outline-none"
          />
          <button
            type="submit"
            aria-label="Yuborish"
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
