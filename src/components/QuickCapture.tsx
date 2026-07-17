"use client";

// ISA — the one "+" that captures anything. The user should never hunt through
// menus to save a thought. Asking ISA sits at the top of the same sheet, because
// "tell ISA in a sentence" is just the fastest capture of all.
//
// Gated modules aren't offered here — capture never points at a locked page.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Plus, X, MessageCircle, Target, Repeat, ListTodo, PenLine,
  Wallet, Lightbulb, FolderKanban, Footprints, Smile,
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useT } from "@/lib/i18n";
import {
  accountAgeDays, isUnlocked, readUnlockOverrides, type ModuleKey,
} from "@/lib/unlock";

type Item = {
  key: string;
  label: string;
  href: string;
  Icon: typeof Target;
  /** Gate the entry behind its module, so we never offer a locked page. */
  module?: ModuleKey;
};

const ITEMS: Item[] = [
  { key: "task", label: "Task", href: "/?new=task", Icon: ListTodo },
  { key: "habit", label: "Habit", href: "/habits?new=1", Icon: Repeat, module: "habits" },
  { key: "goal", label: "Goal", href: "/goals?new=1", Icon: Target, module: "goals" },
  { key: "journal", label: "Journal", href: "/journal", Icon: PenLine, module: "journal" },
  { key: "expense", label: "Expense", href: "/money?new=expense", Icon: Wallet, module: "money" },
  { key: "idea", label: "Idea", href: "/ideas?new=1", Icon: Lightbulb, module: "ideas" },
  { key: "project", label: "Project", href: "/projects?new=1", Icon: FolderKanban, module: "projects" },
  { key: "run", label: "Run", href: "/ask?q=run", Icon: Footprints, module: "running" },
  { key: "mood", label: "Mood", href: "/journal#mood", Icon: Smile },
];

export function QuickCapture() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useT();
  const [open, setOpen] = useState(false);
  // Read the early-unlock list at open time — no effect, no cascading render.
  const [overrides, setOverrides] = useState<string[]>([]);

  const show = () => {
    setOverrides(readUnlockOverrides());
    setOpen(true);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    if (open) {
      window.addEventListener("keydown", onKey);
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        window.removeEventListener("keydown", onKey);
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  const age = accountAgeDays(user?.created_at);
  const items = ITEMS.filter((i) => !i.module || isUnlocked(i.module, age, overrides));

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <>
      <button
        onClick={show}
        aria-label={t("Quick add")}
        className="fixed right-4 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-[0_12px_32px_-8px_rgba(0,0,0,0.7)] transition hover:brightness-110 active:scale-95 md:bottom-8"
      >
        <Plus size={26} strokeWidth={2.4} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[75] flex items-end justify-center sm:items-center sm:p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} />
            <motion.div
              className="glass relative z-10 w-full rounded-t-3xl p-5 sm:max-w-md sm:rounded-3xl"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 32, stiffness: 340 }}
              style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-semibold">{t("What would you like to add?")}</h2>
                <button
                  onClick={() => setOpen(false)}
                  aria-label={t("Cancel")}
                  className="rounded-full p-1.5 text-muted transition hover:bg-white/5 hover:text-fg"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Fastest capture of all: just tell ISA. */}
              <button
                onClick={() => go("/ask")}
                className="mb-3 flex w-full items-center gap-3 rounded-2xl bg-accent/15 p-3 text-left transition hover:bg-accent/25"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-white">
                  <MessageCircle size={17} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-fg">{t("Ask ISA")}</span>
                  <span className="block text-xs text-muted">{t("Just say it — ISA fills in the rest.")}</span>
                </span>
              </button>

              <div className="grid grid-cols-3 gap-2">
                {items.map((i) => (
                  <button
                    key={i.key}
                    onClick={() => go(i.href)}
                    className="flex flex-col items-center gap-1.5 rounded-2xl border border-line bg-white/[0.02] p-3 transition hover:bg-white/[0.06]"
                  >
                    <i.Icon size={18} className="text-accent" />
                    <span className="text-[11px] font-medium text-fg/90">{t(i.label)}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
