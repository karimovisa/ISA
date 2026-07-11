"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Play, Pause, RotateCcw, Check } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { useCollection } from "@/hooks/useCollection";
import { GlassCard } from "@/components/ui/GlassCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { fieldClass } from "@/components/ui/Modal";
import { PressButton } from "@/components/ui/PressButton";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { toast } from "@/lib/toast";
import type { FocusSession } from "@/lib/types";

const PRESETS = [25, 50, 90];

// Running/paused timer survives navigation and browser close.
const STORAGE = "isa_focus_v1";
type SavedTimer = {
  label: string;
  duration: number;
  endAt?: number; // running: absolute finish time
  left?: number; // paused: seconds remaining
};

function fmt(total: number) {
  const m = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const s = (total % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function FocusPage() {
  const { user } = useAuth();
  const sessions = useCollection<FocusSession>("focus_sessions");
  const [label, setLabel] = useState("Deep work");
  const [duration, setDuration] = useState(25 * 60);
  const [left, setLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState(false);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);
  const leftRef = useRef(left);
  leftRef.current = left;
  const restored = useRef(false);
  // Absolute wall-clock finish time for the running timer. Recomputing `left`
  // from this (instead of just decrementing a counter) means the countdown
  // self-corrects after the JS timer gets throttled — e.g. screen locked or
  // the tab backgrounded — instead of drifting or freezing.
  const endAtRef = useRef<number | null>(null);
  const completedRef = useRef(false);
  const savingRef = useRef(false);
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);

  const logSession = async (seconds: number, sessionLabel?: string) => {
    if (!user || seconds < 30 || savingRef.current) return;
    savingRef.current = true;
    setBusy(true);
    const { error } = await supabase.from("focus_sessions").insert({
      user_id: user.id,
      label: (sessionLabel ?? label).trim() || "Focus",
      duration_seconds: seconds,
    });
    if (error) toast("Couldn't save your focus session.", "error");
    else {
      toast(`Focus session saved — ${Math.round(seconds / 60)} min ✓`, "success");
      sessions.refresh();
    }
    savingRef.current = false;
    setBusy(false);
  };

  // Timer finished: fires exactly once per run (completedRef guards re-entry
  // from the interval tick and the visibility/focus resync firing together).
  const complete = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    if (tick.current) clearInterval(tick.current);
    endAtRef.current = null;
    setRunning(false);
    setLeft(0);
    localStorage.removeItem(STORAGE);
    syncAlarm(false);
    logSession(duration);
  };

  // Restore a running/paused timer once the user is known (needed for logging
  // a session that finished while the app was closed).
  useEffect(() => {
    if (!user || restored.current) return;
    restored.current = true;
    try {
      const raw = localStorage.getItem(STORAGE);
      if (!raw) return;
      const s = JSON.parse(raw) as SavedTimer;
      if (!s.duration) return;
      setLabel(s.label || "Focus");
      setDuration(s.duration);
      if (s.endAt) {
        const remaining = Math.round((s.endAt - Date.now()) / 1000);
        if (remaining > 0) {
          endAtRef.current = s.endAt;
          completedRef.current = false;
          setLeft(remaining);
          setRunning(true);
        } else {
          // Finished while away — count the full session.
          completedRef.current = true;
          localStorage.removeItem(STORAGE);
          setLeft(0);
          logSession(s.duration, s.label);
        }
      } else if (typeof s.left === "number") {
        setLeft(s.left);
      }
    } catch {
      localStorage.removeItem(STORAGE);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Server-side alarm: pg_cron pushes "Focus complete" if the timer ends
  // while the app is closed. One row per user; deleted on pause/reset.
  const syncAlarm = (on: boolean) => {
    if (!user) return;
    if (on) {
      supabase
        .from("focus_alarms")
        .upsert({
          user_id: user.id,
          label: label.trim() || "Focus",
          duration_s: duration,
          end_at: new Date(Date.now() + leftRef.current * 1000).toISOString(),
        })
        .then(() => {});
    } else {
      supabase.from("focus_alarms").delete().eq("user_id", user.id).then(() => {});
    }
  };

  // Persist on start/pause so the timer survives navigation and close.
  useEffect(() => {
    if (!restored.current && !running) return;
    if (running) {
      endAtRef.current = Date.now() + leftRef.current * 1000;
      completedRef.current = false;
      localStorage.setItem(
        STORAGE,
        JSON.stringify({
          label,
          duration,
          endAt: endAtRef.current,
        } satisfies SavedTimer)
      );
      syncAlarm(true);
    } else {
      endAtRef.current = null;
      if (leftRef.current > 0 && leftRef.current < duration) {
        localStorage.setItem(
          STORAGE,
          JSON.stringify({
            label,
            duration,
            left: leftRef.current,
          } satisfies SavedTimer)
        );
      }
      syncAlarm(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  // Resync against the true wall-clock end time whenever the app regains
  // visibility/focus — this is what actually catches a finish that happened
  // while the screen was locked or the tab backgrounded, since setInterval
  // ticks get throttled or paused in both of those states and can't be
  // trusted to fire on their own.
  useEffect(() => {
    const resync = () => {
      if (!running || !endAtRef.current) return;
      const remaining = Math.max(0, Math.round((endAtRef.current - Date.now()) / 1000));
      setLeft(remaining);
      if (remaining <= 0) complete();
    };
    document.addEventListener("visibilitychange", resync);
    window.addEventListener("focus", resync);
    return () => {
      document.removeEventListener("visibilitychange", resync);
      window.removeEventListener("focus", resync);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  // Keep the screen awake during an active session where supported, so the
  // countdown and completion notification aren't left to a throttled
  // background timer in the first place. Not all browsers support this —
  // the wall-clock resync above is what covers those.
  useEffect(() => {
    if (!running) {
      wakeLockRef.current?.release().catch(() => {});
      wakeLockRef.current = null;
      return;
    }
    let cancelled = false;
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> };
    };
    nav.wakeLock
      ?.request("screen")
      .then((wl) => {
        if (cancelled) wl.release().catch(() => {});
        else wakeLockRef.current = wl;
      })
      .catch(() => {
        // Unsupported or denied — the resync effect still catches completion.
      });
    return () => {
      cancelled = true;
    };
  }, [running]);

  useEffect(() => {
    if (!running) return;
    const step = () => {
      if (!endAtRef.current) return;
      const remaining = Math.max(0, Math.round((endAtRef.current - Date.now()) / 1000));
      setLeft(remaining);
      if (remaining <= 0) complete();
    };
    step();
    tick.current = setInterval(step, 1000);
    return () => {
      if (tick.current) clearInterval(tick.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const choosePreset = (min: number) => {
    setRunning(false);
    localStorage.removeItem(STORAGE);
    setDuration(min * 60);
    setLeft(min * 60);
  };

  const toggle = () => setRunning((r) => !r);

  // Discard without saving.
  const reset = () => {
    setRunning(false);
    localStorage.removeItem(STORAGE);
    syncAlarm(false);
    setLeft(duration);
  };

  // Save the elapsed part of a paused session, then reset.
  const saveNow = () => {
    if (savingRef.current) return; // guard against a rapid double-tap double-logging
    const elapsed = duration - left;
    if (elapsed >= 30) logSession(elapsed);
    localStorage.removeItem(STORAGE);
    syncAlarm(false);
    setLeft(duration);
  };

  const progress = duration > 0 ? (duration - left) / duration : 0;
  const R = 130;
  const C = 2 * Math.PI * R;

  const todayTotal = sessions.data
    .filter(
      (s) =>
        new Date(s.created_at).toDateString() === new Date().toDateString()
    )
    .reduce((sum, s) => sum + s.duration_seconds, 0);

  return (
    <div>
      <PageHeader
        title="Focus"
        subtitle="One thing. Full attention. Nothing else."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* Timer */}
        <GlassCard className="flex flex-col items-center p-8">
          <div className="mb-2 text-xs uppercase tracking-wider text-muted">
            Current focus
          </div>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className={`${fieldClass} mb-8 max-w-xs text-center text-lg`}
          />

          <div className="relative flex items-center justify-center">
            <svg
              viewBox="0 0 300 300"
              className="h-auto w-[300px] max-w-full -rotate-90"
            >
              <circle
                cx="150"
                cy="150"
                r={R}
                fill="none"
                stroke="var(--color-line)"
                strokeWidth="10"
              />
              <motion.circle
                cx="150"
                cy="150"
                r={R}
                fill="none"
                stroke="url(#focusGrad)"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={C}
                animate={{ strokeDashoffset: C * (1 - progress) }}
                transition={{ ease: "linear", duration: 0.4 }}
              />
              <defs>
                <linearGradient id="focusGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="var(--color-fg)" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="var(--color-fg)" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="font-mono text-5xl font-bold tabular-nums">
                {fmt(left)}
              </span>
              <span className="mt-1 text-xs text-muted">
                {Math.round(progress * 100)}% complete
              </span>
            </div>
          </div>

          <div className="mt-8 flex items-center gap-3">
            <PressButton
              onClick={toggle}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-lg shadow-accent/30 transition duration-200 hover:brightness-110"
            >
              {running ? <Pause size={22} /> : <Play size={22} className="ml-0.5" />}
            </PressButton>
            <PressButton
              onClick={reset}
              title="Reset without saving"
              className="flex h-12 w-12 items-center justify-center rounded-full bg-white/5 text-muted transition duration-200 hover:text-fg"
            >
              <RotateCcw size={18} />
            </PressButton>
            {!running && left > 0 && duration - left >= 30 && (
              <PressButton
                onClick={saveNow}
                disabled={busy}
                className="flex h-12 items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-black transition hover:bg-white/90 disabled:opacity-50"
              >
                <Check size={16} />
                {busy ? "Saving…" : `Save ${Math.round((duration - left) / 60)}m`}
              </PressButton>
            )}
          </div>

          <div className="mt-8 flex gap-2">
            {PRESETS.map((m) => (
              <button
                key={m}
                onClick={() => choosePreset(m)}
                className={`rounded-full px-4 py-1.5 text-sm transition ${
                  duration === m * 60
                    ? "bg-accent-soft text-fg ring-1 ring-inset ring-accent/30"
                    : "text-muted hover:text-fg"
                }`}
              >
                {m}m
              </button>
            ))}
          </div>
        </GlassCard>

        {/* Stats */}
        <div className="space-y-6">
          <GlassCard className="p-6">
            <div className="text-xs uppercase tracking-wider text-muted">
              Focused today
            </div>
            <div className="mt-2 text-4xl font-bold tabular-nums">
              <AnimatedNumber value={Math.floor(todayTotal / 60)} />
              <span className="text-lg font-medium text-muted"> min</span>
            </div>
          </GlassCard>

          <GlassCard className="p-6">
            <div className="mb-4 text-xs uppercase tracking-wider text-muted">
              Recent sessions
            </div>
            {sessions.data.length === 0 ? (
              <p className="text-sm text-muted">
                No sessions yet. Start your first focus block.
              </p>
            ) : (
              <ul className="space-y-3">
                {sessions.data.slice(0, 6).map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="truncate text-fg/90">{s.label}</span>
                    <span className="shrink-0 text-muted">
                      {Math.round(s.duration_seconds / 60)}m
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
