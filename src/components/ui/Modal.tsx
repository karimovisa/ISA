"use client";

// ISA — Modal. On phones this is a bottom SHEET you can swipe down to dismiss
// (dragging is bound to the grab handle, so scrolling the form still works).
// On desktop it stays a centered dialog. Long forms scroll inside instead of
// overflowing the screen, and the sheet respects the home-indicator safe area.

import { AnimatePresence, motion, useDragControls } from "framer-motion";
import { X } from "lucide-react";
import { useEffect } from "react";

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const controls = useDragControls();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Lock the page behind the sheet so the background never scrolls with it.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

          <motion.div
            className="glass relative z-10 flex max-h-[88dvh] w-full flex-col rounded-t-3xl sm:max-w-md sm:rounded-3xl"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 340 }}
            drag="y"
            dragListener={false}
            dragControls={controls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.35 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 110 || info.velocity.y > 550) onClose();
            }}
          >
            {/* Grab handle — the only drag surface, so the form still scrolls. */}
            <div
              onPointerDown={(e) => controls.start(e)}
              className="flex shrink-0 cursor-grab touch-none justify-center pb-1 pt-3 active:cursor-grabbing sm:hidden"
            >
              <span className="h-1 w-10 rounded-full bg-white/25" />
            </div>

            <div className="flex shrink-0 items-center justify-between px-5 pb-4 pt-3 sm:px-6 sm:pt-5">
              <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
              <button
                onClick={onClose}
                className="rounded-full p-1.5 text-muted transition hover:bg-white/5 hover:text-fg"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrolls when the form is long, instead of running off the screen. */}
            <div
              className="min-h-0 flex-1 overflow-y-auto px-5 sm:px-6"
              style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
            >
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* Shared form field styles for use inside modals. */
export const fieldClass =
  "w-full rounded-xl border border-line bg-white/[0.03] px-4 py-2.5 text-sm text-fg placeholder:text-muted/60 transition focus:border-accent/50 focus:bg-white/[0.05]";

export const labelClass =
  "mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted";

export const primaryBtnClass =
  "w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition duration-200 hover:brightness-110 hover:shadow-[0_8px_24px_-8px_rgba(79,140,255,0.55)] disabled:opacity-50";
