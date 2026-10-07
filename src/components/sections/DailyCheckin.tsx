"use client";

// ISA — the evening wrap-up (§7). Step 1 is the 5-second check-in: two taps, and
// "why?" only when the day was off — the one answer the engine can't derive.
// Step 2 (only if today's journal is still empty): ISA drafts the day from what
// was actually logged, the person edits it if they like, adds one learning and
// tomorrow's one thing — saved as the journal entry, with tomorrow's thing put on
// tomorrow's to-do list. It only asks once a day, only in the evening. Sleep is
// NOT asked here: it's logged in the morning-first Sleep card.

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Check, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { GlassCard } from "@/components/ui/GlassCard";
import { fieldClass, primaryBtnClass } from "@/components/ui/Modal";
import { todayISO } from "@/lib/datetime";
import { captureLifeEvent } from "@/lib/life-events";
import { invalidateContext } from "@/lib/intelligence";
import { isDueOn } from "@/lib/habitCoach";
import { formatSom } from "@/lib/money";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/cn";
import type { Habit } from "@/lib/types";

type Verdict = "good" | "ok" | "off";
type Reason = "busy" | "tired" | "distracted" | "unwell" | "other";
type Step = "verdict" | "reason" | "wrap";

const VERDICTS: { v: Verdict; label: string }[] = [
  { v: "good", label: "Good day" },
  { v: "ok", label: "It was okay" },
  { v: "off", label: "Not my best" },
];

const REASONS: { r: Reason; label: string }[] = [
  { r: "busy", label: "Busy" },
  { r: "tired", label: "Tired" },
  { r: "distracted", label: "Distracted" },
  { r: "unwell", label: "Unwell" },
  { r: "other", label: "Other" },
];

const dismissKey = (d: string) => `isa_checkin_skip_${d}`;

const tomorrowISO = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const chip = cn(
  "rounded-full border border-line bg-white/[0.03] px-3.5 py-2 text-sm transition",
  "hover:bg-white/[0.08] disabled:opacity-50"
);

export function DailyCheckin() {
  const { user } = useAuth();
  const { t } = useT();
  const [show, setShow] = useState(false);
  const [step, setStep] = useState<Step>("verdict");
  const [saving, setSaving] = useState(false);
  const [journaled, setJournaled] = useState(true); // assume yes until checked
  const [draft, setDraft] = useState({ did: "", learned: "", tomorrow: "" });
  const today = todayISO();

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!user) return;
      // Evening only — asking at 9am how "today" went is noise.
      if (new Date().getHours() < 18) return;
      if (typeof window !== "undefined" && localStorage.getItem(dismissKey(today))) return;
      const [{ data: checkin }, { data: entry }] = await Promise.all([
        supabase.from("daily_checkins").select("id").eq("date", today).maybeSingle(),
        supabase.from("journal_entries").select("id").eq("entry_date", today).maybeSingle(),
      ]);
      if (!alive || checkin) return;
      setJournaled(!!entry);
      setShow(true);
    })();
    return () => {
      alive = false;
    };
  }, [user, today]);

  const dismiss = () => {
    if (typeof window !== "undefined") localStorage.setItem(dismissKey(today), "1");
    setShow(false);
  };

  /** ISA's draft of the day, from what was actually logged — never invented. */
  const draftDay = async (): Promise<string> => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const [hb, hl, fs, td, tx, pr] = await Promise.all([
      supabase.from("habits").select("*").eq("is_active", true),
      supabase.from("habit_logs").select("habit_id").eq("date", today).eq("completed", true),
      supabase.from("focus_sessions").select("duration_seconds").gte("created_at", start.toISOString()),
      supabase.from("todos").select("done").eq("date", today),
      supabase.from("transactions").select("amount").eq("date", today).eq("type", "expense"),
      supabase.from("prayer_logs").select("id").eq("date", today).neq("status", "qazo"),
    ]);
    const due = ((hb.data as Habit[] | null) ?? []).filter((h) => isDueOn(h, new Date()));
    const dueIds = new Set(due.map((h) => h.id));
    const habitsDone = ((hl.data as { habit_id: string }[] | null) ?? []).filter((l) => dueIds.has(l.habit_id)).length;
    const focusMin = Math.round(
      ((fs.data as { duration_seconds: number }[] | null) ?? []).reduce((m, s) => m + s.duration_seconds, 0) / 60
    );
    const tasksDone = ((td.data as { done: boolean }[] | null) ?? []).filter((x) => x.done).length;
    const spent = ((tx.data as { amount: number }[] | null) ?? []).reduce((s, x) => s + Number(x.amount), 0);
    const prayers = ((pr.data as unknown[] | null) ?? []).length;

    const parts: string[] = [];
    if (due.length) parts.push(t("{done}/{due} habits", { done: habitsDone, due: due.length }));
    if (focusMin) parts.push(t("{n} min of focus", { n: focusMin }));
    if (tasksDone) parts.push(t("{n} tasks done", { n: tasksDone }));
    if (prayers) parts.push(t("{n} prayers", { n: prayers }));
    if (spent) parts.push(t("spent {amount}", { amount: formatSom(spent) }));
    return parts.length ? `${parts.join(", ")}.` : t("A quiet day.");
  };

  const saveCheckin = async (v: Verdict, reason: Reason | null) => {
    if (!user || saving) return;
    setSaving(true);
    await supabase
      .from("daily_checkins")
      .upsert({ user_id: user.id, date: today, verdict: v, reason }, { onConflict: "user_id,date" });
    // The reflection feeds the same engine as everything else.
    void captureLifeEvent({
      type: "ReflectionAdded",
      occurredAt: today,
      payload: { verdict: v, reason },
      emotionalImpact: v === "good" ? 0.5 : v === "off" ? -0.4 : 0,
      context: { outcome: v === "off" ? "informational" : "consistency" },
      provenance: "daily check-in",
    });
    invalidateContext();
    // Journal already written today → nothing more to ask.
    if (journaled) {
      setSaving(false);
      setShow(false);
      return;
    }
    const did = await draftDay();
    setDraft({ did, learned: "", tomorrow: "" });
    setStep("wrap");
    setSaving(false);
  };

  const saveWrap = async () => {
    if (!user || saving) return;
    setSaving(true);
    const did = draft.did.trim();
    const learned = draft.learned.trim();
    const tomorrow = draft.tomorrow.trim();
    const { error } = await supabase.from("journal_entries").upsert(
      { user_id: user.id, entry_date: today, did_today: did || null, learned: learned || null, tomorrow: tomorrow || null },
      { onConflict: "user_id,entry_date" }
    );
    if (!error) {
      const words = `${did} ${learned} ${tomorrow}`.trim().split(/\s+/).filter(Boolean).length;
      void captureLifeEvent({ type: "JournalCreated", occurredAt: today, payload: { words, source: "evening wrap-up" }, context: { outcome: "consistency" } });
      // Tomorrow's one thing lands on tomorrow's to-do list, ready in the morning.
      if (tomorrow) {
        const date = tomorrowISO();
        const { error: todoErr } = await supabase
          .from("todos")
          .insert({ user_id: user.id, title: tomorrow.slice(0, 200), date, priority: "high" });
        if (!todoErr) void captureLifeEvent({ type: "TaskCreated", occurredAt: date, payload: { title: tomorrow, priority: "high" } });
      }
      invalidateContext();
    }
    setSaving(false);
    setShow(false);
  };

  if (!show) return null;

  const title =
    step === "wrap" ? t("Today, in a few lines") : step === "reason" ? t("What got in the way?") : t("How did today go?");
  const sub =
    step === "wrap"
      ? t("ISA drafted it from your day — edit anything. Saved as today's journal.")
      : step === "reason"
        ? t("One tap — ISA uses it to explain your patterns later.")
        : t("Takes five seconds.");

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-4">
        <GlassCard className="p-5">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold">
                {step === "wrap" && <Sparkles size={14} className="text-accent" />}
                {title}
              </h2>
              <p className="mt-0.5 text-xs text-muted">{sub}</p>
            </div>
            <button
              onClick={step === "wrap" ? () => setShow(false) : dismiss}
              aria-label={t("Cancel")}
              className="shrink-0 rounded-lg p-1 text-muted transition hover:text-fg"
            >
              <X size={15} />
            </button>
          </div>

          {step === "verdict" && (
            <div className="flex flex-wrap gap-2">
              {VERDICTS.map((o) => (
                <button
                  key={o.v}
                  disabled={saving}
                  onClick={() => (o.v === "off" ? setStep("reason") : void saveCheckin(o.v, null))}
                  className={chip}
                >
                  {t(o.label)}
                </button>
              ))}
            </div>
          )}

          {step === "reason" && (
            <>
              <div className="flex flex-wrap gap-2">
                {REASONS.map((o) => (
                  <button key={o.r} disabled={saving} onClick={() => void saveCheckin("off", o.r)} className={chip}>
                    {t(o.label)}
                  </button>
                ))}
              </div>
              <button
                onClick={() => void saveCheckin("off", null)}
                className="mt-3 flex items-center gap-1.5 text-xs text-muted transition hover:text-fg"
              >
                <Check size={12} /> {t("Skip the reason")}
              </button>
            </>
          )}

          {step === "wrap" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void saveWrap();
              }}
              className="space-y-3"
            >
              <textarea
                value={draft.did}
                onChange={(e) => setDraft((d) => ({ ...d, did: e.target.value }))}
                rows={2}
                className={cn(fieldClass, "resize-none")}
              />
              <input
                value={draft.learned}
                onChange={(e) => setDraft((d) => ({ ...d, learned: e.target.value }))}
                placeholder={t("One thing you learned (optional)")}
                className={fieldClass}
              />
              <input
                value={draft.tomorrow}
                onChange={(e) => setDraft((d) => ({ ...d, tomorrow: e.target.value }))}
                placeholder={t("Tomorrow's one most important thing")}
                className={fieldClass}
              />
              <div className="flex items-center gap-3">
                <button type="submit" disabled={saving} className={primaryBtnClass}>
                  {t("Save the day")}
                </button>
                {draft.tomorrow.trim() && (
                  <span className="text-xs text-muted">{t("Goes on tomorrow's to-do")}</span>
                )}
              </div>
            </form>
          )}
        </GlassCard>
      </motion.div>
    </AnimatePresence>
  );
}
