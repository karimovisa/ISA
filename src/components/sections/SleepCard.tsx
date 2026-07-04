"use client";

import { useCallback, useEffect, useState } from "react";
import { Moon, Sunrise } from "lucide-react";
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
      <circle cx="24" cy="24" r="16" fill="currentColor" opacity="0.06" />
      <path
        d="M 30 10 A 14 14 0 1 0 30 38 A 11 11 0 1 1 30 10 Z"
        fill={low ? "#F5B7A6" : "#F5F0E8"}
        opacity="0.95"
      />
    </svg>
  );
}

type Ongoing = { id: string; sleep_start: string; date: string } | null;

export function SleepCard() {
  const logs = useCollection<SleepLog>("sleep_logs", {
    orderBy: "date",
    ascending: false,
  });
  const [score, setScore] = useState<number | null>(null);
  const [ongoing, setOngoing] = useState<Ongoing>(null);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [hours, setHours] = useState("");
  const [quality, setQuality] = useState(0);

  const loadScore = useCallback(async () => {
    const { data } = await supabase
      .from("daily_energy_scores")
      .select("score")
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();
    setScore((data?.score as number | undefined) ?? null);
  }, []);

  const loadOngoing = useCallback(async () => {
    const { data } = await supabase
      .from("sleep_logs")
      .select("id, sleep_start, date")
      .is("sleep_end", null)
      .order("sleep_start", { ascending: false })
      .limit(1)
      .maybeSingle();
    setOngoing((data as Ongoing) ?? null);
  }, []);

  useEffect(() => {
    loadScore();
    loadOngoing();
  }, [loadScore, loadOngoing]);

  // tick every 30s while sleeping, for the live elapsed display
  useEffect(() => {
    if (!ongoing) return;
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [ongoing]);

  const startSleep = async () => {
    setBusy(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("sleep_logs").upsert(
        {
          user_id: user.id,
          date: todayISO(),
          sleep_start: new Date().toISOString(),
          sleep_end: null,
          duration_hours: 0,
        },
        { onConflict: "user_id,date" }
      );
      await loadOngoing();
    }
    setBusy(false);
  };

  const wake = async () => {
    if (!ongoing) return;
    setBusy(true);
    const start = new Date(ongoing.sleep_start).getTime();
    const duration = +((Date.now() - start) / 3_600_000).toFixed(2);
    await supabase
      .from("sleep_logs")
      .update({
        sleep_end: new Date().toISOString(),
        duration_hours: duration,
      })
      .eq("id", ongoing.id);
    await supabase.rpc("recompute_my_energy", { p_date: ongoing.date });
    setOngoing(null);
    await Promise.all([logs.refresh(), loadScore()]);
    setBusy(false);
  };

  const saveManual = async (e: React.FormEvent) => {
    e.preventDefault();
    const d = Number(hours);
    if (!d || d <= 0) return;
    setBusy(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("sleep_logs").upsert(
        {
          user_id: user.id,
          date: todayISO(),
          duration_hours: d,
          quality: quality || null,
        },
        { onConflict: "user_id,date" }
      );
      await supabase.rpc("recompute_my_energy", { p_date: todayISO() });
      await Promise.all([logs.refresh(), loadScore()]);
    }
    setBusy(false);
    setOpen(false);
    setHours("");
    setQuality(0);
  };

  const cutoff = Date.now() - 7 * 86_400_000;
  const week = logs.data.filter(
    (l) => new Date(l.date).getTime() >= cutoff && l.duration_hours > 0
  );
  const avg =
    week.length > 0
      ? week.reduce((s, l) => s + Number(l.duration_hours), 0) / week.length
      : null;
  const low = score !== null && score < 40;

  const elapsedMs = ongoing
    ? now - new Date(ongoing.sleep_start).getTime()
    : 0;
  const eh = Math.floor(elapsedMs / 3_600_000);
  const em = Math.floor((elapsedMs % 3_600_000) / 60_000);

  return (
    <>
      <GlassCard className="p-5" title="Avg sleep this week">
        {logs.loading ? (
          <div className="flex items-center gap-4">
            <div className="h-11 w-11 animate-pulse rounded-full bg-white/5" />
            <div className="h-6 w-16 animate-pulse rounded bg-white/5" />
          </div>
        ) : ongoing ? (
          <div className="flex items-center gap-4">
            <div className="text-fg">
              <MoonIcon low={false} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs uppercase tracking-wider text-muted">
                Sleeping
              </div>
              <div className="text-2xl font-bold tabular-nums text-[#F5F0E8]">
                {eh}
                <span className="text-sm font-medium text-muted">h </span>
                {em}
                <span className="text-sm font-medium text-muted">m</span>
              </div>
            </div>
            <PressButton
              onClick={wake}
              disabled={busy}
              className="flex shrink-0 items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-semibold text-black transition hover:bg-white/90 disabled:opacity-50"
            >
              <Sunrise size={14} />
              Wake up
            </PressButton>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <div className="text-fg">
              <MoonIcon low={low} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs uppercase tracking-wider text-muted">
                Sleep
              </div>
              {avg !== null ? (
                <div className="text-2xl font-bold tabular-nums text-[#F5F0E8]">
                  {avg.toFixed(1)}
                  <span className="text-sm font-medium text-muted">h avg</span>
                </div>
              ) : (
                <button
                  onClick={() => setOpen(true)}
                  className="text-sm text-muted underline-offset-2 hover:underline"
                >
                  or log hours
                </button>
              )}
            </div>
            <PressButton
              onClick={startSleep}
              disabled={busy}
              className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-xs font-medium text-fg transition hover:bg-white/15 disabled:opacity-50"
            >
              <Moon size={14} />
              Sleep
            </PressButton>
          </div>
        )}
      </GlassCard>

      <Modal open={open} onClose={() => setOpen(false)} title="Log sleep">
        <form onSubmit={saveManual} className="space-y-4">
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
