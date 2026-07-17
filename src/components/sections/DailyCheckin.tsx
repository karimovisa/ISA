"use client";

// ISA — the 30-second evening conversation (§7). Two taps, not a questionnaire.
// It only asks once a day, only in the evening, and only follows up when the day
// was actually off — because "why?" is the one answer the engine can't derive.
//
// Silence is the default: once answered (or dismissed), it disappears for the day.

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Check } from "lucide-react";
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

export function DailyCheckin() {
  const { user } = useAuth();
  const { t } = useT();
  const [show, setShow] = useState(false);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [saving, setSaving] = useState(false);
  const today = todayISO();

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!user) return;
      // Evening only — asking at 9am how "today" went is noise.
      if (new Date().getHours() < 18) return;
      if (typeof window !== "undefined" && localStorage.getItem(dismissKey(today))) return;
      const { data } = await supabase.from("daily_checkins").select("id").eq("date", today).maybeSingle();
      if (alive && !data) setShow(true);
    })();
    return () => {
      alive = false;
    };
  }, [user, today]);

  const dismiss = () => {
    if (typeof window !== "undefined") localStorage.setItem(dismissKey(today), "1");
    setShow(false);
  };

  const save = async (v: Verdict, reason: Reason | null) => {
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
    setShow(false);
  };

  if (!show) return null;

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
              <h2 className="text-sm font-semibold">
                {verdict === "off" ? t("What got in the way?") : t("How did today go?")}
              </h2>
              <p className="mt-0.5 text-xs text-muted">
                {verdict === "off" ? t("One tap — ISA uses it to explain your patterns later.") : t("Takes five seconds.")}
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

          <div className="flex flex-wrap gap-2">
            {verdict !== "off"
              ? VERDICTS.map((o) => (
                  <button
                    key={o.v}
                    disabled={saving}
                    onClick={() => (o.v === "off" ? setVerdict("off") : void save(o.v, null))}
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
                    onClick={() => void save("off", o.r)}
                    className={cn(
                      "rounded-full border border-line bg-white/[0.03] px-3.5 py-2 text-sm transition",
                      "hover:bg-white/[0.08] disabled:opacity-50"
                    )}
                  >
                    {t(o.label)}
                  </button>
                ))}
          </div>

          {verdict === "off" && (
            <button
              onClick={() => void save("off", null)}
              className="mt-3 flex items-center gap-1.5 text-xs text-muted transition hover:text-fg"
            >
              <Check size={12} /> {t("Skip the reason")}
            </button>
          )}
        </GlassCard>
      </motion.div>
    </AnimatePresence>
  );
}
