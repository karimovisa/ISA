"use client";

// ISA — the one "+" that captures anything. The user should never hunt through
// menus to save a thought, and never get bounced onto another page just to add
// one line. Composable types (task, habit, goal, idea, project, expense) add
// INLINE right here in the sheet; only the rich flows (journal, run, mood)
// navigate. Asking ISA sits at the top — "tell ISA in a sentence" is the fastest
// capture of all.
//
// Gated modules aren't offered here — capture never points at a locked page.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Plus, X, ArrowLeft, Check, MessageCircle, Target, Repeat, ListTodo, PenLine,
  Wallet, Lightbulb, FolderKanban, Footprints, Smile,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { useT } from "@/lib/i18n";
import { fieldClass } from "@/components/ui/Modal";
import { PressButton } from "@/components/ui/PressButton";
import { todayISO } from "@/lib/datetime";
import { toast } from "@/lib/toast";
import { captureLifeEvent } from "@/lib/life-events";
import {
  accountAgeDays, isUnlocked, readUnlockOverrides, type ModuleKey,
} from "@/lib/unlock";

/** How tapping the item behaves: "text"/"amount" add inline; undefined navigates. */
type Compose = "text" | "amount";

type Item = {
  key: string;
  label: string;
  href: string;
  Icon: typeof Target;
  /** Gate the entry behind its module, so we never offer a locked page. */
  module?: ModuleKey;
  compose?: Compose;
};

const ITEMS: Item[] = [
  { key: "task", label: "Task", href: "/?new=task", Icon: ListTodo, compose: "text" },
  { key: "habit", label: "Habit", href: "/habits?new=1", Icon: Repeat, module: "habits", compose: "text" },
  { key: "goal", label: "Goal", href: "/goals?new=1", Icon: Target, module: "goals", compose: "text" },
  { key: "journal", label: "Journal", href: "/journal", Icon: PenLine, module: "journal" },
  { key: "expense", label: "Expense", href: "/money?new=expense", Icon: Wallet, module: "money", compose: "amount" },
  { key: "idea", label: "Idea", href: "/ideas?new=1", Icon: Lightbulb, module: "ideas", compose: "text" },
  { key: "project", label: "Project", href: "/projects?new=1", Icon: FolderKanban, module: "projects", compose: "text" },
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

  // Inline compose state.
  const [active, setActive] = useState<Item | null>(null);
  const [text, setText] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const show = () => {
    setOverrides(readUnlockOverrides());
    setActive(null); setText(""); setAmount(""); setNote("");
    setOpen(true);
  };
  const closeAll = () => { setOpen(false); setActive(null); };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Escape backs out of compose first, then closes the sheet.
      setActive((a) => { if (a) return null; setOpen(false); return null; });
    };
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
    closeAll();
    router.push(href);
  };

  const pick = (i: Item) => {
    if (!i.compose) { go(i.href); return; }
    setActive(i); setText(""); setAmount(""); setNote("");
  };

  // Add the item directly, without leaving the page. Other screens pick it up on
  // their next load (useCollection revalidates on mount).
  const submit = async () => {
    if (!user || !active || saving) return;
    const uid = user.id;
    const day = todayISO();
    let error: unknown = null;

    if (active.compose === "amount") {
      const amt = Number(amount);
      if (!amt || amt <= 0) return;
      setSaving(true);
      const res = await supabase.from("transactions").insert({
        user_id: uid, type: "expense", amount: amt, category: "Other",
        note: note.trim() || null, date: day, goal_id: null,
      });
      error = res.error;
      if (!error)
        void captureLifeEvent({
          type: "ExpenseCreated", occurredAt: day,
          payload: { amount: amt, category: "Other", note: note.trim() || null },
          context: { metricValue: amt, outcome: "informational" },
        });
    } else {
      const v = text.trim();
      if (!v) return;
      setSaving(true);
      switch (active.key) {
        case "task": {
          const res = await supabase.from("todos").insert({ user_id: uid, title: v, date: day, done: false, priority: "normal" });
          error = res.error;
          if (!error) void captureLifeEvent({ type: "TaskCreated", occurredAt: day, payload: { title: v, priority: "normal" } });
          break;
        }
        case "habit": {
          const res = await supabase.from("habits").insert({
            user_id: uid, name: v, is_active: true, category: "Custom",
            frequency_type: "daily", frequency_config: {},
            target_value: null, target_unit: null, notes: null, goal_id: null,
          });
          error = res.error;
          break;
        }
        case "goal": {
          const res = await supabase.from("goals").insert({ user_id: uid, title: v, deadline: null, motivation: null });
          error = res.error;
          if (!error) void captureLifeEvent({ type: "GoalCreated", occurredAt: day, payload: { title: v } });
          break;
        }
        case "idea": {
          const res = await supabase.from("ideas").insert({ user_id: uid, content: v });
          error = res.error;
          if (!error) void captureLifeEvent({ type: "NoteCaptured", occurredAt: day, payload: { preview: v.slice(0, 60) } });
          break;
        }
        case "project": {
          const res = await supabase.from("projects").insert({ user_id: uid, title: v, status: "active", ai_meta: {} });
          error = res.error;
          if (!error) void captureLifeEvent({ type: "ProjectCreated", occurredAt: day, payload: { title: v } });
          break;
        }
      }
    }

    setSaving(false);
    if (error) { toast(t("Couldn't save."), "error"); return; }
    toast(t("Added ✓"), "success");
    closeAll();
  };

  const placeholder = active?.key === "task" ? t("Add a task…") : t("Name it…");

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
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={closeAll} />
            <motion.div
              className="glass relative z-10 w-full rounded-t-3xl p-5 sm:max-w-md sm:rounded-3xl"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 32, stiffness: 340 }}
              style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
            >
              <div className="mb-4 flex items-center justify-between">
                <div className="flex min-w-0 items-center gap-2">
                  {active && (
                    <button
                      onClick={() => setActive(null)}
                      aria-label={t("Back")}
                      className="-ml-1 rounded-full p-1.5 text-muted transition hover:bg-white/5 hover:text-fg"
                    >
                      <ArrowLeft size={18} />
                    </button>
                  )}
                  <h2 className="truncate text-base font-semibold">
                    {active ? t(active.label) : t("What would you like to add?")}
                  </h2>
                </div>
                <button
                  onClick={closeAll}
                  aria-label={t("Cancel")}
                  className="rounded-full p-1.5 text-muted transition hover:bg-white/5 hover:text-fg"
                >
                  <X size={18} />
                </button>
              </div>

              {active ? (
                /* ── Inline compose — no navigation ── */
                <form
                  onSubmit={(e) => { e.preventDefault(); void submit(); }}
                  className="space-y-3"
                >
                  {active.compose === "amount" ? (
                    <>
                      <input
                        autoFocus type="number" inputMode="decimal" min="0" step="any"
                        value={amount} onChange={(e) => setAmount(e.target.value)}
                        placeholder={t("Amount")} className={fieldClass}
                      />
                      <input
                        value={note} onChange={(e) => setNote(e.target.value)}
                        placeholder={t("Note (optional)")} className={fieldClass}
                      />
                    </>
                  ) : (
                    <input
                      autoFocus value={text} onChange={(e) => setText(e.target.value)}
                      placeholder={placeholder} className={fieldClass}
                    />
                  )}
                  <PressButton
                    type="submit"
                    disabled={saving || (active.compose === "amount" ? !Number(amount) : !text.trim())}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-accent py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
                  >
                    <Check size={16} /> {saving ? t("Saving…") : t("Add")}
                  </PressButton>
                </form>
              ) : (
                <>
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
                        onClick={() => pick(i)}
                        className="flex flex-col items-center gap-1.5 rounded-2xl border border-line bg-white/[0.02] p-3 transition hover:bg-white/[0.06]"
                      >
                        <i.Icon size={18} className="text-accent" />
                        <span className="text-[11px] font-medium text-fg/90">{t(i.label)}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
