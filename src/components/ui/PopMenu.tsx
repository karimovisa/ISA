"use client";

// ISA — a dropdown menu that always renders above everything. It portals to
// <body> and positions itself with fixed coordinates from the trigger, so it is
// never clipped by a card's overflow (.reflect) or hidden behind sibling cards.
// Works on every screen size; closes on outside click, scroll, resize or Escape.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { MoreVertical } from "lucide-react";

type PopMenuProps = {
  children: (close: () => void) => ReactNode;
  ariaLabel?: string;
  width?: number;
  trigger?: ReactNode; // defaults to the ⋮ icon
};

export function PopMenu({ children, ariaLabel = "Menu", width = 160, trigger }: PopMenuProps) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const place = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    // Right-aligned to the trigger, opening downward; clamped into the viewport.
    const left = Math.min(Math.max(8, r.right - width), window.innerWidth - width - 8);
    setCoords({ top: r.bottom + 6, left });
  };

  const close = () => setOpen(false);
  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!open) place();
    setOpen((o) => !o);
  };

  useEffect(() => {
    if (!open) return;
    const onClose = () => close();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("click", onClose);
    window.addEventListener("scroll", onClose, true);
    window.addEventListener("resize", onClose);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", onClose);
      window.removeEventListener("scroll", onClose, true);
      window.removeEventListener("resize", onClose);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        className="rounded-lg p-1.5 text-muted transition hover:bg-white/5 hover:text-fg"
      >
        {trigger ?? <MoreVertical size={18} />}
      </button>
      {coords &&
        typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                role="menu"
                initial={{ opacity: 0, scale: 0.96, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.14 }}
                onClick={(e) => e.stopPropagation()}
                style={{ position: "fixed", top: coords.top, left: coords.left, width }}
                className="glass z-[80] overflow-hidden rounded-xl p-1 shadow-xl"
              >
                {children(close)}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}
