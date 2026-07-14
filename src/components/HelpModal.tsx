"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, ArrowLeft, ArrowRight } from "lucide-react";
import { PressButton } from "@/components/ui/PressButton";
import { HELP, HELP_FINAL, type HelpStep } from "@/lib/help";
import { useT } from "@/lib/i18n";

/** Global contextual help. Any page opens it via
 *  window.dispatchEvent(new CustomEvent("isa:open-help", { detail: pageKey })). */
export function HelpModal() {
  const { t } = useT();
  const [steps, setSteps] = useState<HelpStep[] | null>(null);
  const [i, setI] = useState(0);

  useEffect(() => {
    const onOpen = (e: Event) => {
      const key = (e as CustomEvent<string>).detail;
      const s = HELP[key];
      if (s) { setSteps([...s, HELP_FINAL]); setI(0); }
    };
    window.addEventListener("isa:open-help", onOpen);
    return () => window.removeEventListener("isa:open-help", onOpen);
  }, []);

  if (!steps) return null;
  const step = steps[i];
  const last = i === steps.length - 1;
  const close = () => setSteps(null);

  return (
    <AnimatePresence>
      {steps && (
        <motion.div className="fixed inset-0 z-[80] flex items-end justify-center p-3 sm:items-center sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={close} />
          <motion.div className="glass relative z-10 w-full max-w-md rounded-3xl p-6"
            style={{ background: "color-mix(in srgb, var(--color-bg) 94%, transparent)" }}
            initial={{ opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex gap-1.5">
                {steps.map((_, n) => (
                  <span key={n} className={`h-1.5 rounded-full transition-all ${n === i ? "w-5 bg-accent" : "w-1.5 bg-white/15"}`} />
                ))}
              </div>
              <button onClick={close} aria-label="Close" className="text-muted hover:text-fg"><X size={18} /></button>
            </div>

            <AnimatePresence mode="wait">
              <motion.div key={i} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }} className="min-h-[120px]">
                <h3 className={`font-semibold ${last ? "text-lg" : "text-base"}`}>{t(step.title)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{t(step.body)}</p>
              </motion.div>
            </AnimatePresence>

            <div className="mt-6 flex items-center justify-between">
              <button onClick={() => setI((n) => Math.max(0, n - 1))} disabled={i === 0}
                className="flex items-center gap-1 text-sm text-muted transition hover:text-fg disabled:opacity-0">
                <ArrowLeft size={14} /> {t("Back")}
              </button>
              {last ? (
                <PressButton onClick={close} className="rounded-xl bg-accent px-5 py-2 text-sm font-semibold text-white">{t("Got it")}</PressButton>
              ) : (
                <PressButton onClick={() => setI((n) => n + 1)} className="flex items-center gap-1 rounded-xl bg-accent px-5 py-2 text-sm font-semibold text-white">
                  {t("Next")} <ArrowRight size={14} />
                </PressButton>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
