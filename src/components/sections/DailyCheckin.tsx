"use client";

// ISA — the 30-second evening conversation (§7). Two taps, not a questionnaire.
// It only asks once a day, only in the evening, and only follows up when the day
// was actually off — because "why?" is the one answer the engine can't derive.
//
// It also quietly collects the one bit of health data ISA can't sense: last
// night's sleep — but only if the day hasn't already recorded it. One tap, then
// silence: once answered (or dismissed), the whole card disappears for the day.

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Check, Moon } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { GlassCard } from "@/components/ui/GlassCard";
import { todayISO } from "@/lib/datetime";
import { captureLifeEvent } from "@/lib/life-events";
import { invalidateContext } from "@/lib/intelligence";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/cn";

type Verdict = "good" | "ok" | "off";
type Reason = "busy" | "tired" | "distracted" | "unwell" | "other";
type Phase = "day" | "sleep";

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

const SLEEP_HOURS = [5, 6, 7, 8, 9];

const dismissKey = (d: string) => `isa_checkin_skip_${d}`;

export function DailyCheckin() {
  const { user } = useAuth();
  const { t } = useT();
  const [show, setShow] = useState(false);
  const [phase, setPhase] = useState<Phase>("day");
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [askSleep, setAskSleep] = useState(false);
  const [saving, setSaving] = useState(false);
  const today = todayISO();

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!user) return;
      // Evening only — asking at 9am how "today" went is noise.
      if (new Date().getHours() < 18) return;
      if (typeof window !== "undefined" && localStorage.getItem(dismissKey(today))) return;
      const [{ data: checkin }, { data: sleep }] = await Promise.all([
        supabase.from("daily_checkins").select("id").eq("date", today).maybeSingle(),
        supabase.from("sleep_logs").select("id").eq("date", today).maybeSingle(),
      ]);
      if (!alive || checkin) return;
      setAskSleep(!sleep);
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

  const saveDay = async (v: Verdict, reason: Reason | null) => {
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
    setSaving(false);
    // Collect last night's sleep only if the day hasn't already recorded it.
    if (askSleep) setPhase("sleep");
    else setShow(false);
  };

  const logSleep = async (h: number) => {
    if (!user || saving) return;
    setSaving(true);
    await supabase
      .from("sleep_logs")
      .upsert({ user_id: user.id, date: today, duration_hours: h }, { onConflict: "user_id,date" });
    // Keep the Energy Score honest — recompute exactly like the Sleep card does.
    await supabase.rpc("recompute_my_energy", { p_date: today });
    void captureLifeEvent({
      type: "SleepLogged",
      occurredAt: today,
      payload: { hours: h },
      context: { metricValue: h, outcome: "informational" },
      provenance: "daily check-in",
    });
    setSaving(false);
    setShow(false);
  };

  if (!show) return null;

  const dayTitle = verdict === "off" ? t("What got in the way?") : t("How did today go?");
  const daySub = verdict === "off"
    ? t("One tap — ISA uses it to explain your patterns later.")
    : t("Takes five seconds.");

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        className="mb-4"
      >
        <GlassCard className="p-5">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold">
                {phase === "sleep" && <Moon size={14} className="text-accent" />}
                {phase === "sleep" ? t("How many hours did you sleep?") : dayTitle}
              </h2>
              <p className="mt-0.5 text-xs text-muted">
                {phase === "sleep" ? t("Last night — a rough number is fine.") : daySub}
              </p>
            </div>
            <button
              onClick={dismiss}
              aria-label={t("Cancel")}
              className="shrink-0 rounded-lg p-1 text-muted transition hover:text-fg"
            >
              <X size={15} />
            </button>
          </div>

          {phase === "sleep" ? (
            <div className="flex flex-wrap gap-2">
              {SLEEP_HOURS.map((h) => (
                <button
                  key={h}
                  disabled={saving}
                  onClick={() => void logSleep(h)}
                  className={cn(
                    "min-w-[3rem] rounded-full border border-line bg-white/[0.03] px-3.5 py-2 text-sm tabular-nums transition",
                    "hover:bg-white/[0.08] disabled:opacity-50"
                  )}
                >
                  {h}h
                </button>
              ))}
              <button
                disabled={saving}
                onClick={() => void logSleep(10)}
                className={cn(
                  "rounded-full border border-line bg-white/[0.03] px-3.5 py-2 text-sm transition",
                  "hover:bg-white/[0.08] disabled:opacity-50"
                )}
              >
                10h+
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {verdict !== "off"
                ? VERDICTS.map((o) => (
                    <button
                      key={o.v}
                      disabled={saving}
                      onClick={() => (o.v === "off" ? setVerdict("off") : void saveDay(o.v, null))}
                      className={cn(
                        "rounded-full border border-line bg-white/[0.03] px-3.5 py-2 text-sm transition",
                        "hover:bg-white/[0.08] disabled:opacity-50"
                      )}
                    >
                      {t(o.label)}
                    </button>
                  ))
                : REASONS.map((o) => (
                    <button
                      key={o.r}
                      disabled={saving}
                      onClick={() => void saveDay("off", o.r)}
                      className={cn(
                        "rounded-full border border-line bg-white/[0.03] px-3.5 py-2 text-sm transition",
                        "hover:bg-white/[0.08] disabled:opacity-50"
                      )}
                    >
                      {t(o.label)}
                    </button>
                  ))}
            </div>
          )}

          {phase === "day" && verdict === "off" && (
            <button
              onClick={() => void saveDay("off", null)}
              className="mt-3 flex items-center gap-1.5 text-xs text-muted transition hover:text-fg"
            >
              <Check size={12} /> {t("Skip the reason")}
            </button>
          )}
          {phase === "sleep" && (
            <button
              onClick={() => setShow(false)}
              className="mt-3 flex items-center gap-1.5 text-xs text-muted transition hover:text-fg"
            >
              <Check size={12} /> {t("Skip")}
            </button>
          )}
        </GlassCard>
      </motion.div>
    </AnimatePresence>
  );
}
