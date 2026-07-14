"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Sparkles, Rocket, Check } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { PressButton } from "@/components/ui/PressButton";
import { toast } from "@/lib/toast";
import {
  PROVIDERS, providerConfigured, checkoutUrl, getPricing, getAiReadyStats,
  formatUzs, type Pricing, type AiReadyStats,
} from "@/lib/billing";

const LEARNS_FROM = ["Goals", "Habits", "Journal", "Focus", "Money", "Projects", "Prayer", "Mood", "Ideas", "Running", "Sleep", "Memory"];

/** Global premium upgrade modal. Any gated spot opens it via
 *  window.dispatchEvent(new Event("isa:open-upgrade")). */
export function UpgradeModal() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [price, setPrice] = useState<Pricing | null>(null);
  const [stats, setStats] = useState<AiReadyStats | null>(null);

  useEffect(() => {
    const onOpen = () => {
      setOpen(true);
      getPricing().then(setPrice);
      getAiReadyStats().then(setStats);
    };
    window.addEventListener("isa:open-upgrade", onOpen);
    return () => window.removeEventListener("isa:open-upgrade", onOpen);
  }, []);

  const pay = useCallback((id: "click" | "payme") => {
    if (!user || !price) return;
    if (!providerConfigured(id)) { toast(`${id === "click" ? "Click" : "Payme"} is being set up — coming soon.`, "info"); return; }
    const url = checkoutUrl(id, user.id, price.amount);
    if (url) window.location.href = url;
  }, [user, price]);

  const readyStats = stats ? [
    { label: "Life events captured", value: stats.life_events },
    { label: "Memories created", value: stats.memories },
    { label: "Patterns detected", value: stats.patterns },
    { label: "Connections", value: stats.connections },
    { label: "Insights generated", value: stats.insights },
    { label: "Timeline moments", value: stats.timeline },
  ] : [];

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[80] flex items-end justify-center p-3 sm:items-center sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <motion.div className="glass relative z-10 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl p-6"
            style={{ background: "color-mix(in srgb, var(--color-bg) 94%, transparent)" }}
            initial={{ opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12 }} transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}>
            <div className="mb-4 flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-accent" />
                <h2 className="text-lg font-bold">Unlock ISA Pro</h2>
              </div>
              <button onClick={() => setOpen(false)} className="text-muted hover:text-fg"><X size={18} /></button>
            </div>

            <p className="text-sm leading-relaxed text-muted">
              ISA has already been learning from your{" "}
              <span className="text-fg/80">{LEARNS_FROM.slice(0, 6).join(", ")}</span> and more. Pro simply unlocks what it already understands.
            </p>

            {/* AI-Ready — real numbers */}
            {readyStats.length > 0 && (
              <div className="mt-4 grid grid-cols-3 gap-2">
                {readyStats.map((s) => (
                  <div key={s.label} className="rounded-xl bg-white/[0.04] p-2.5 text-center">
                    <div className="text-lg font-bold tabular-nums">{s.value}</div>
                    <div className="text-[10px] leading-tight text-muted">{s.label}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 space-y-1.5">
              {["AI Coach Ready", "Weekly & Monthly Reviews Ready", "Predictions Ready", "Financial Analysis Ready", "Behavior Analysis Ready"].map((r) => (
                <p key={r} className="flex items-center gap-2 text-sm text-fg/85"><Check size={14} className="text-emerald-400" />{r}</p>
              ))}
            </div>

            {/* Coffee value message */}
            <div className="mt-5 rounded-2xl border border-line bg-white/[0.02] p-4 text-center">
              <p className="text-2xl">☕</p>
              <p className="mt-1 text-sm text-muted">One coffee lasts a few hours.</p>
              <p className="text-sm text-fg/90">ISA improves your life every single day.</p>
              <p className="mt-2 text-2xl font-bold">{price ? formatUzs(price.amount) : "—"}<span className="text-sm font-medium text-muted"> / month</span></p>
              <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-accent/15 px-2.5 py-0.5 text-[11px] font-medium text-accent"><Rocket size={11} /> Founding Member · Launch price locked</p>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              {PROVIDERS.map((p) => (
                <PressButton key={p.id} onClick={() => pay(p.id)} className="rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110">
                  Pay with {p.name}
                </PressButton>
              ))}
            </div>
            <p className="mt-3 text-center text-[11px] text-muted">Secure payment · cancel anytime · you keep every free feature.</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
