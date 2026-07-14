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
  const [coords, setCoords] = useState<{ top: number; left: number; flip: boolean } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const place = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    // Right-aligned to the trigger and clamped into the viewport. If there isn't
    // room below (near the bottom of a list), flip and open upward instead of
    // running off the screen.
    const left = Math.min(Math.max(8, r.right - width), window.innerWidth - width - 8);
    const estHeight = 190;
    const below = window.innerHeight - r.bottom;
    const flip = below < estHeight + 16;
    setCoords({ top: flip ? r.top - estHeight - 6 : r.bottom + 6, left, flip });
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
                initial={{ opacity: 0, scale: 0.95, y: coords.flip ? 6 : -6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: coords.flip ? 4 : -4 }}
                transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: "fixed",
                  top: coords.top,
                  left: coords.left,
                  width,
                  transformOrigin: coords.flip ? "bottom right" : "top right",
                }}
                className="glass z-[80] overflow-hidden rounded-2xl border border-line p-1.5 shadow-2xl"
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
