"use client";

// ISA — a designed confirmation, replacing the raw browser confirm() dialog.
// Destructive actions get a clear, calm question — never a system alert box.

import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { PressButton } from "@/components/ui/PressButton";
import { useT } from "@/lib/i18n";

export type ConfirmRequest = {
  title: string;
  body?: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
};

export function ConfirmDialog({
  request,
  onClose,
}: {
  request: ConfirmRequest | null;
  onClose: () => void;
}) {
  const { t } = useT();
  const open = request !== null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const accept = () => {
    request?.onConfirm();
    onClose();
  };

  return (
    <AnimatePresence>
      {request && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-end justify-center p-3 sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            className="glass relative z-10 w-full max-w-sm rounded-3xl p-5"
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            style={{ marginBottom: "env(safe-area-inset-bottom)" }}
          >
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-2xl ${
                request.danger ? "bg-red-500/15" : "bg-white/[0.06]"
              }`}
            >
              <AlertTriangle size={18} className={request.danger ? "text-red-400" : "text-fg"} />
            </div>

            <h3 className="mt-3 text-base font-semibold">{request.title}</h3>
            {request.body && (
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{request.body}</p>
            )}

            <div className="mt-5 flex gap-2">
              <PressButton
                onClick={onClose}
                className="flex-1 rounded-xl border border-line py-2.5 text-sm font-medium text-fg transition hover:bg-white/5"
              >
                {t("Cancel")}
              </PressButton>
              <PressButton
                onClick={accept}
                className={`flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition hover:brightness-110 ${
                  request.danger ? "bg-red-500" : "bg-accent"
                }`}
              >
                {request.confirmLabel ?? t("Confirm")}
              </PressButton>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
