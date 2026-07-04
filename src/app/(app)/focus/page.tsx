"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Play, Pause, RotateCcw } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { useCollection } from "@/hooks/useCollection";
import { GlassCard } from "@/components/ui/GlassCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { fieldClass } from "@/components/ui/Modal";
import { PressButton } from "@/components/ui/PressButton";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import type { FocusSession } from "@/lib/types";

const PRESETS = [25, 50, 90];

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
  const [label, setLabel] = useState("IELTS Speaking");
  const [duration, setDuration] = useState(25 * 60);
  const [left, setLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);

  const logSession = async (seconds: number) => {
    if (!user || seconds < 30) return;
    await supabase.from("focus_sessions").insert({
      user_id: user.id,
      label: label.trim() || "Focus",
      duration_seconds: seconds,
    });
    sessions.refresh();
  };

  useEffect(() => {
    if (!running) return;
    tick.current = setInterval(() => {
      setLeft((prev) => {
        if (prev <= 1) {
          clearInterval(tick.current!);
          setRunning(false);
          logSession(duration);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (tick.current) clearInterval(tick.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const choosePreset = (min: number) => {
    setRunning(false);
    setDuration(min * 60);
    setLeft(min * 60);
  };

  const toggle = () => setRunning((r) => !r);

  const reset = () => {
    // Log whatever was completed before resetting.
    const elapsed = duration - left;
    if (elapsed >= 30 && !running) logSession(elapsed);
    setRunning(false);
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
            <svg width="300" height="300" className="-rotate-90">
              <circle
                cx="150"
                cy="150"
                r={R}
                fill="none"
                stroke="rgba(255,255,255,0.07)"
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
                  <stop offset="0%" stopColor="rgba(255,255,255,0.45)" />
                  <stop offset="100%" stopColor="#ffffff" />
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
              className="flex h-12 w-12 items-center justify-center rounded-full bg-white/5 text-muted transition duration-200 hover:text-fg"
            >
              <RotateCcw size={18} />
            </PressButton>
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
