"use client";

// ISA — Sleep, redesigned around real behavior: "wake-up first". People forget to
// tap "sleeping" before bed, so ISA never asks them to. In the morning the card
// already shows an ESTIMATE from the user's own pattern; one tap on how they slept
// records the night in ~2–5s. Bedtime/wake can be corrected, but never has to be.
// Nothing is fabricated — with too little history the card says so and asks.
//
// Priority for a day's truth: health_data > manual > estimated (see lib/sleep.ts).

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Moon, Pencil, Check } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { GlassCard } from "@/components/ui/GlassCard";
import { useCollection } from "@/hooks/useCollection";
import { todayISO } from "@/lib/datetime";
import { toast } from "@/lib/toast";
import { useT } from "@/lib/i18n";
import { captureLifeEvent } from "@/lib/life-events";
import { cn } from "@/lib/cn";
import {
  SLEEP_QUALITIES, clocksToTimestamps, estimateSleep, isoToClock,
  qualityOption, sourceLabelKey, splitDuration,
} from "@/lib/sleep";
import type { SleepLog } from "@/lib/types";

type Panel = "closed" | "quality" | "manual";

export function SleepCard() {
  const { t } = useT();
  const { user } = useAuth();
  const logs = useCollection<SleepLog>("sleep_logs", { orderBy: "date", ascending: false });
  const today = todayISO();

  const [panel, setPanel] = useState<Panel>("closed");
  const [bed, setBed] = useState("23:00");
  const [wake, setWake] = useState("07:00");
  const [busy, setBusy] = useState(false);

  const todayLog = useMemo(
    () => logs.data.find((l) => l.date === today && l.duration_hours > 0) ?? null,
    [logs.data, today]
  );
  const estimate = useMemo(() => estimateSleep(logs.data), [logs.data]);

  // A tiny, honest weekly insight — only when there's enough real signal.
  const weekAvg = useMemo(() => {
    const cutoff = Date.now() - 7 * 86_400_000;
    const wk = logs.data.filter((l) => new Date(l.date).getTime() >= cutoff && l.duration_hours > 0);
    if (wk.length < 3) return null;
    return wk.reduce((s, l) => s + Number(l.duration_hours), 0) / wk.length;
  }, [logs.data]);

  // Seed the manual editor from the best times we know (logged → estimate → default).
  useEffect(() => {
    if (todayLog?.sleep_start && todayLog?.sleep_end) {
      setBed(isoToClock(todayLog.sleep_start));
      setWake(isoToClock(todayLog.sleep_end));
    } else if (estimate) {
      setBed(estimate.bedClock);
      setWake(estimate.wakeClock);
    }
  }, [todayLog, estimate]);

  const openMark = () => setPanel(estimate ? "quality" : "manual");

  const commit = async (qualityValue: number) => {
    if (!user || busy) return;
    setBusy(true);
    const manual = panel === "manual";
    const bedClock = manual ? bed : estimate!.bedClock;
    const wakeClock = manual ? wake : estimate!.wakeClock;
    const { sleepStart, sleepEnd, durationMin } = clocksToTimestamps(today, bedClock, wakeClock);
    const dur = durationMin > 0 ? durationMin : durationMin + 1440;
    const hours = +(dur / 60).toFixed(2);

    const { error } = await supabase.from("sleep_logs").upsert(
      {
        user_id: user.id,
        date: today,
        sleep_start: sleepStart,
        sleep_end: sleepEnd,
        duration_hours: hours,
        quality: qualityValue,
        source: manual ? "manual" : "estimated",
        is_estimated: !manual,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,date" }
    );
    if (error) {
      toast(t("Couldn't save your sleep."), "error");
      setBusy(false);
      return;
    }
    await supabase.rpc("recompute_my_energy", { p_date: today });
    void captureLifeEvent({
      type: "SleepLogged",
      occurredAt: today,
      payload: { hours, quality: qualityValue, estimated: !manual },
      context: { metricValue: hours, outcome: "informational" },
    });
    await logs.refresh();
    setPanel("closed");
    setBusy(false);
  };

  // ── Derived display ──
  const loggedQuality = qualityOption(todayLog?.quality);
  const loggedSrcKey = todayLog ? sourceLabelKey(todayLog.source, todayLog.is_estimated) : null;
  const shownMin = todayLog
    ? Math.round(Number(todayLog.duration_hours) * 60)
    : estimate?.durationMin ?? null;
  const dur = shownMin != null ? splitDuration(shownMin) : null;

  const times = todayLog?.sleep_start && todayLog?.sleep_end
    ? `${isoToClock(todayLog.sleep_start)} → ${isoToClock(todayLog.sleep_end)}`
    : estimate
      ? `${estimate.bedClock} → ${estimate.wakeClock}`
      : null;

  return (
    <GlassCard className="p-4 sm:p-5">
      <div className="flex items-start gap-3.5">
        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/[0.05]">
          <Moon size={18} className="text-fg/80" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
            {t("Sleep")}
          </div>

          {dur ? (
            <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
              <span className="text-[24px] font-bold leading-none tabular-nums text-fg">
                {dur.h}
                <span className="text-base font-medium text-muted">h </span>
                {dur.m}
                <span className="text-base font-medium text-muted">m</span>
              </span>
              {(todayLog ? loggedSrcKey : "estimated") && (
                <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted">
                  {t(todayLog ? loggedSrcKey! : "estimated")}
                </span>
              )}
            </div>
          ) : (
            <div className="mt-1.5 text-[15px] leading-snug text-fg/70">
              {t("Sleep time not set yet")}
            </div>
          )}

          {/* quality (logged) or the estimate's time range (not yet logged) */}
          {todayLog && loggedQuality ? (
            <div className="mt-1.5 text-sm text-fg/80">
              <span className="mr-1">{loggedQuality.emoji}</span>
              {t(loggedQuality.label)}
            </div>
          ) : times ? (
            <div className="mt-1.5 flex items-center gap-2 text-xs text-muted">
              <span>{t("Estimated")}: <span className="tabular-nums">{times}</span></span>
              <button
                onClick={() => setPanel("manual")}
                className="inline-flex items-center gap-1 text-fg/70 underline-offset-2 transition hover:text-fg hover:underline"
              >
                <Pencil size={11} /> {t("Change")}
              </button>
            </div>
          ) : null}
        </div>

        {/* logged → quiet edit; not logged with a panel already open → nothing here */}
        {todayLog && panel === "closed" && (
          <button
            onClick={() => setPanel("manual")}
            aria-label={t("Edit")}
            className="shrink-0 rounded-lg p-1.5 text-muted transition hover:text-fg"
          >
            <Pencil size={15} />
          </button>
        )}
      </div>

      {/* optional, honest weekly insight */}
      {weekAvg != null && panel === "closed" && (
        <p className="mt-3 border-t border-line pt-3 text-xs text-muted">
          {t("This week you slept {avg} on average.", {
            avg: `${splitDuration(Math.round(weekAvg * 60)).h}h ${splitDuration(Math.round(weekAvg * 60)).m}m`,
          })}
        </p>
      )}

      {/* ── Interaction — kept at the BOTTOM for one-handed thumb reach ── */}
      <AnimatePresence initial={false}>
        {panel === "closed" ? (
          !todayLog && (
            <motion.button
              key="mark"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={openMark}
              className="mt-4 h-12 w-full rounded-2xl bg-[var(--color-fg)] text-[15px] font-semibold text-[color:var(--color-bg)] transition active:scale-[0.99]"
            >
              {t("Mark")}
            </motion.button>
          )
        ) : (
          <motion.div
            key="panel"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-4 border-t border-line pt-4">
              {panel === "manual" && (
                <div className="mb-4 grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="mb-1 block text-xs text-muted">{t("My bedtime")}</span>
                    <input
                      type="time"
                      value={bed}
                      onChange={(e) => setBed(e.target.value || bed)}
                      className="w-full rounded-xl border border-line bg-white/[0.04] px-3 py-2.5 text-fg tabular-nums focus:outline-none"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-muted">{t("My wake time")}</span>
                    <input
                      type="time"
                      value={wake}
                      onChange={(e) => setWake(e.target.value || wake)}
                      className="w-full rounded-xl border border-line bg-white/[0.04] px-3 py-2.5 text-fg tabular-nums focus:outline-none"
                    />
                  </label>
                </div>
              )}

              <div className="text-sm font-medium text-fg/90">{t("How did you sleep?")}</div>
              <div className="mt-2.5 grid grid-cols-4 gap-2">
                {SLEEP_QUALITIES.map((q) => (
                  <button
                    key={q.value}
                    disabled={busy}
                    onClick={() => void commit(q.value)}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-2xl border border-line bg-white/[0.03] py-3 transition",
                      "hover:border-white/15 hover:bg-white/[0.06] active:scale-[0.97] disabled:opacity-50"
                    )}
                  >
                    <span className="text-2xl leading-none">{q.emoji}</span>
                    <span className="text-[11px] text-muted">{t(q.label)}</span>
                  </button>
                ))}
              </div>

              <div className="mt-3 flex items-center justify-between">
                {panel === "quality" ? (
                  <button
                    onClick={() => setPanel("manual")}
                    className="inline-flex items-center gap-1 text-xs text-muted transition hover:text-fg"
                  >
                    <Pencil size={12} /> {t("Change")}
                  </button>
                ) : (
                  <span className="text-xs text-muted">{t("One tap saves it.")}</span>
                )}
                <button
                  onClick={() => setPanel("closed")}
                  className="inline-flex items-center gap-1 text-xs text-muted transition hover:text-fg"
                >
                  <Check size={12} /> {t("Cancel")}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassCard>
  );
}
