"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useCollection } from "@/hooks/useCollection";
import { GlassCard } from "@/components/ui/GlassCard";
import { PressButton } from "@/components/ui/PressButton";
import {
  Modal,
  fieldClass,
  labelClass,
  primaryBtnClass,
} from "@/components/ui/Modal";
import { todayISO } from "@/lib/datetime";
import type { SleepLog } from "@/lib/types";

function MoonIcon({ low }: { low: boolean }) {
  return (
    <svg width="46" height="46" viewBox="0 0 48 48" aria-hidden>
      <circle cx="24" cy="24" r="16" fill="#ffffff" opacity="0.06" />
      <path
        d="M 30 10 A 14 14 0 1 0 30 38 A 11 11 0 1 1 30 10 Z"
        fill={low ? "#F5B7A6" : "#F5F0E8"}
        opacity="0.95"
      />
    </svg>
  );
}

export function SleepCard() {
  const logs = useCollection<SleepLog>("sleep_logs", {
    orderBy: "date",
    ascending: false,
  });
  const [score, setScore] = useState<number | null>(null);
  const [open, setOpen] = useState(false);

  // form
  const [mode, setMode] = useState<"times" | "hours">("times");
  const [bedtime, setBedtime] = useState("23:00");
  const [wake, setWake] = useState("07:00");
  const [hours, setHours] = useState("");
  const [quality, setQuality] = useState(0);
  const [busy, setBusy] = useState(false);

  const loadScore = useCallback(async () => {
    const { data } = await supabase
      .from("daily_energy_scores")
      .select("score")
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();
    setScore((data?.score as number | undefined) ?? null);
  }, []);

  useEffect(() => {
    loadScore();
  }, [loadScore]);

  // Average sleep over the last 7 days.
  const cutoff = Date.now() - 7 * 86_400_000;
  const week = logs.data.filter((l) => new Date(l.date).getTime() >= cutoff);
  const avg =
    week.length > 0
      ? week.reduce((s, l) => s + Number(l.duration_hours), 0) / week.length
      : null;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const today = todayISO();
    let duration: number;
    let start: string | null = null;
    let end: string | null = null;

    if (mode === "times") {
      const [bh, bm] = bedtime.split(":").map(Number);
      const [wh, wm] = wake.split(":").map(Number);
      let s = bh * 60 + bm;
      let en = wh * 60 + wm;
      if (en <= s) en += 1440;
      duration = +((en - s) / 60).toFixed(2);
      const startD = new Date(`${today}T${bedtime}:00`);
      start = startD.toISOString();
      end = new Date(startD.getTime() + duration * 3_600_000).toISOString();
    } else {
      duration = Number(hours);
      if (!duration || duration <= 0) return;
    }

    setBusy(true);
    await logs.add({
      date: today,
      sleep_start: start,
      sleep_end: end,
      duration_hours: duration,
      quality: quality || null,
    });
    await supabase.rpc("recompute_my_energy", { p_date: today });
    await loadScore();
    setBusy(false);
    setOpen(false);
    setHours("");
    setQuality(0);
  };

  const low = score !== null && score < 40;

  return (
    <>
      <GlassCard
        className="flex items-center gap-4 p-5"
        title="Avg sleep this week"
      >
        {logs.loading ? (
          <div className="flex w-full items-center gap-4">
            <div className="h-11 w-11 animate-pulse rounded-full bg-white/5" />
            <div className="h-6 w-16 animate-pulse rounded bg-white/5" />
          </div>
        ) : (
          <>
            <MoonIcon low={low} />
            <div className="min-w-0 flex-1">
              <div className="text-xs uppercase tracking-wider text-muted">
                Sleep
              </div>
              {avg !== null ? (
                <div className="text-2xl font-bold tabular-nums text-[#F5F0E8]">
                  {avg.toFixed(1)}
                  <span className="text-sm font-medium text-muted">h</span>
                </div>
              ) : (
                <div className="text-sm text-muted">Track your rest</div>
              )}
            </div>
            <button
              onClick={() => setOpen(true)}
              className="shrink-0 rounded-full bg-white/10 px-3 py-1.5 text-xs text-fg transition hover:bg-white/15"
            >
              Log
            </button>
          </>
        )}
      </GlassCard>

      <Modal open={open} onClose={() => setOpen(false)} title="Log sleep">
        <form onSubmit={save} className="space-y-4">
          <div className="flex gap-2">
            {(["times", "hours"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`flex-1 rounded-xl px-3 py-2 text-sm transition ${
                  mode === m
                    ? "bg-white/10 text-fg ring-1 ring-inset ring-white/20"
                    : "text-muted hover:text-fg"
                }`}
              >
                {m === "times" ? "Bed & wake" : "Just hours"}
              </button>
            ))}
          </div>

          {mode === "times" ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Bedtime</label>
                <input
                  type="time"
                  value={bedtime}
                  onChange={(e) => setBedtime(e.target.value)}
                  className={fieldClass}
                />
              </div>
              <div>
                <label className={labelClass}>Woke up</label>
                <input
                  type="time"
                  value={wake}
                  onChange={(e) => setWake(e.target.value)}
                  className={fieldClass}
                />
              </div>
            </div>
          ) : (
            <div>
              <label className={labelClass}>Hours slept</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="24"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                placeholder="7.5"
                className={fieldClass}
                autoFocus
              />
            </div>
          )}

          <div>
            <label className={labelClass}>Quality (optional)</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setQuality(q === quality ? 0 : q)}
                  className={`h-9 flex-1 rounded-lg text-sm transition ${
                    quality >= q && quality > 0
                      ? "bg-white/15 text-fg"
                      : "bg-white/[0.04] text-muted hover:text-fg"
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          <PressButton type="submit" disabled={busy} className={primaryBtnClass}>
            {busy ? "Saving…" : "Save sleep"}
          </PressButton>
        </form>
      </Modal>
    </>
  );
}
