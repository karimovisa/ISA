"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";
import type { ToastDetail, ToastTone } from "@/lib/toast";

type Toast = { id: number; message: string; tone: ToastTone };

const ICON = {
  success: CheckCircle2,
  error: AlertTriangle,
  info: Info,
} as const;

const TONE = {
  success: "text-emerald-300",
  error: "text-red-300",
  info: "text-fg",
} as const;

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    let seq = 0;
    const onToast = (e: Event) => {
      const detail = (e as CustomEvent<ToastDetail>).detail;
      if (!detail?.message) return;
      const id = ++seq;
      const tone: ToastTone = detail.tone ?? "info";
      setToasts((list) => [...list, { id, message: detail.message, tone }]);
      window.setTimeout(() => {
        setToasts((list) => list.filter((t) => t.id !== id));
      }, 4200);
    };
    window.addEventListener("isa:toast", onToast);
    return () => window.removeEventListener("isa:toast", onToast);
  }, []);

  const dismiss = (id: number) =>
    setToasts((list) => list.filter((t) => t.id !== id));

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[80] flex flex-col items-center gap-2 px-4 pt-4 sm:items-end sm:pr-6"
      style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
          const Icon = ICON[t.tone];
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: -16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="glass reflect pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl px-4 py-3 shadow-lg"
            >
              <Icon size={18} className={`mt-0.5 shrink-0 ${TONE[t.tone]}`} />
              <p className="flex-1 text-sm text-fg/90">{t.message}</p>
              <button
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss"
                className="shrink-0 rounded-full p-0.5 text-muted transition hover:text-fg"
              >
                <X size={14} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
