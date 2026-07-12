"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useT } from "@/lib/i18n";

export type TourStep = { selector: string; title: string; body: string };

type Rect = { top: number; left: number; width: number; height: number };

/** First on-screen (non-zero-size) element matching the selector, or null. */
function firstVisible(selector: string): HTMLElement | null {
  if (!selector) return null;
  const els = Array.from(document.querySelectorAll<HTMLElement>(selector));
  return (
    els.find((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    }) ?? null
  );
}

/**
 * Reusable spotlight walkthrough. Driven by an ordered `steps` config of
 * { selector, title, body }. Steps whose target isn't currently visible are
 * skipped automatically (so one config adapts to mobile vs desktop nav).
 * Step position is persisted so a refresh mid-tour resumes where it left off.
 */
export function SpotlightTour({
  steps,
  open,
  onClose,
  storageKey = "isa_tour_step",
}: {
  steps: TourStep[];
  open: boolean;
  onClose: () => void;
  storageKey?: string;
}) {
  const { t } = useT();
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  // Nearest resolvable step from `start`, moving by `dir` (+1 / -1). -1 if none.
  const resolve = useCallback(
    (start: number, dir: number): number => {
      let i = start;
      while (i >= 0 && i < steps.length) {
        if (firstVisible(steps[i].selector)) return i;
        i += dir;
      }
      return -1;
    },
    [steps]
  );

  const finish = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
    } catch {}
    onClose();
  }, [onClose, storageKey]);

  // On open: resume from the persisted step, then resolve forward.
  useEffect(() => {
    if (!open) return;
    let start = 0;
    try {
      const s = localStorage.getItem(storageKey);
      if (s) start = Math.max(0, Math.min(steps.length - 1, Number(s)));
    } catch {}
    const i = resolve(start, 1);
    if (i < 0) {
      finish();
    } else {
      // Resolving the first *visible* step requires reading the DOM, so this
      // one-time sync on open is the intended "measure then set state" pattern.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIndex(i);
    }
  }, [open, resolve, steps.length, storageKey, finish]);

  // Track the target rectangle across step changes, scroll and resize.
  useEffect(() => {
    if (!open) return;
    const measure = () => {
      const el = firstVisible(steps[index]?.selector ?? "");
      if (!el) {
        setRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      const pad = 8;
      setRect({
        top: r.top - pad,
        left: r.left - pad,
        width: r.width + pad * 2,
        height: r.height + pad * 2,
      });
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, index, steps]);

  useEffect(() => {
    if (open)
      try {
        localStorage.setItem(storageKey, String(index));
      } catch {}
  }, [open, index, storageKey]);

  if (!open || !rect) return null;

  const step = steps[index];
  const hasBack = resolve(index - 1, -1) >= 0;
  const isLast = resolve(index + 1, 1) < 0;

  const next = () => {
    const i = resolve(index + 1, 1);
    if (i < 0) finish();
    else setIndex(i);
  };
  const back = () => {
    const i = resolve(index - 1, -1);
    if (i >= 0) setIndex(i);
  };

  // Tooltip below the target when there's room, otherwise above it.
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const belowRoom = vh - (rect.top + rect.height) > 190;
  const left = Math.max(12, Math.min(rect.left, vw - 332));
  const top = belowRoom
    ? rect.top + rect.height + 12
    : Math.max(12, rect.top - 12 - 172);

  return (
    <div className="fixed inset-0 z-[70]">
      {/* Full-screen click blocker — forces the user through Next/Skip. */}
      <div className="absolute inset-0" />

      {/* Spotlight: transparent hole with a huge outer shadow dims the rest. */}
      <motion.div
        className="pointer-events-none absolute rounded-2xl ring-2 ring-accent"
        style={{ boxShadow: "0 0 0 9999px rgba(0,0,0,0.66)" }}
        animate={{
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
      />

      {/* Tooltip card */}
      <motion.div
        key={index}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass reflect absolute z-[80] w-[min(20rem,90vw)] rounded-2xl p-4"
        style={{ top, left }}
      >
        <h3 className="font-semibold tracking-tight">{t(step.title)}</h3>
        <p className="mt-1 text-sm leading-relaxed text-muted">{t(step.body)}</p>
        <div className="mt-4 flex items-center justify-between">
          <button
            onClick={finish}
            className="text-xs text-muted transition hover:text-fg"
          >
            {t("Skip")}
          </button>
          <div className="flex items-center gap-2">
            {hasBack && (
              <button
                onClick={back}
                className="rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium text-fg transition hover:bg-white/15"
              >
                {t("Back")}
              </button>
            )}
            <button
              onClick={next}
              className="rounded-lg bg-accent px-3.5 py-1.5 text-sm font-semibold text-white transition hover:brightness-110"
            >
              {isLast ? t("Done") : t("Next")}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
