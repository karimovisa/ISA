"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Target, Lightbulb, Timer, Repeat, X, Command } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";

const STEPS = [
  { href: "/goals", label: "Set a goal", hint: "Name a summit to climb", Icon: Target },
  { href: "/ideas", label: "Capture an idea", hint: "Before it fades", Icon: Lightbulb },
  { href: "/focus", label: "Focus for 25m", hint: "One thing, full attention", Icon: Timer },
  { href: "/habits", label: "Build a habit", hint: "Small, daily, repeated", Icon: Repeat },
];

const KEY = "isa_onboarded";

/** First-run guide. Renders only when the account has no data yet. */
export function Onboarding({
  name,
  show,
}: {
  name: string;
  show: boolean;
}) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {}
    setDismissed(true);
  };

  return (
    <AnimatePresence>
      {show && !dismissed && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="mb-8"
        >
          <GlassCard className="relative overflow-hidden p-6">
            <button
              onClick={dismiss}
              className="absolute right-4 top-4 rounded-lg p-1 text-muted transition hover:text-fg"
              aria-label="Dismiss"
            >
              <X size={16} />
            </button>
            <h2 className="text-lg font-semibold tracking-tight">
              Welcome to ISA, {name}.
            </h2>
            <p className="mt-1.5 max-w-md text-sm text-muted">
              Your space is a blank slate. Pick a first move — everything grows
              from here.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {STEPS.map(({ href, label, hint, Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="group flex items-center gap-3 rounded-2xl border border-line bg-white/[0.02] px-4 py-3 transition hover:border-white/20 hover:bg-white/[0.04]"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.06]">
                    <Icon size={18} className="text-fg" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-fg">{label}</div>
                    <div className="truncate text-xs text-muted">{hint}</div>
                  </div>
                </Link>
              ))}
            </div>

            <div className="mt-5 flex items-center gap-2 text-xs text-muted">
              <Command size={13} />
              <span>
                Tip: press{" "}
                <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-fg">
                  ⌘K
                </kbd>{" "}
                anytime to jump or quick-add.
              </span>
            </div>
          </GlassCard>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
