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
import { toast } from "@/lib/toast";
import type { SleepLog } from "@/lib/types";

function MoonIcon({ low }: { low: boolean }) {
  return (
    <svg width="46" height="46" viewBox="0 0 48 48" aria-hidden>
      <defs>
        <mask id="isa-moon">
          <rect x="0" y="0" width="48" height="48" fill="#fff" />
          <circle cx="30" cy="21" r="14" fill="#000" />
        </mask>
      </defs>
      <circle cx="24" cy="24" r="16" fill="currentColor" opacity="0.08" />
      <circle
        cx="22"
        cy="24"
        r="15"
        fill={low ? "#E0653A" : "var(--color-fg)"}
        mask="url(#isa-moon)"
      />
    </svg>
  );
}

type Ongoing = { id: string; sleep_start: string; date: string } | null;

// If "Wake" is never tapped, cap an open session so it doesn't run forever.
const CAP_HOURS = 16;
const CAP_MS = CAP_HOURS * 3_600_000;

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
  const [note, setNote] = useState<string | null>(null);

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

  // Auto-close a forgotten session: if "Wake" wasn't tapped within ~16h, close
  // it capped at CAP_HOURS. Runs when a session loads and on each 30s tick.
  useEffect(() => {
    if (!ongoing) return;
    const start = new Date(ongoing.sleep_start).getTime();
    if (Date.now() - start < CAP_MS) return;
    const o = ongoing;
    (async () => {
      await supabase
        .from("sleep_logs")
        .update({
          sleep_end: new Date(start + CAP_MS).toISOString(),
          duration_hours: CAP_HOURS,
        })
        .eq("id", o.id);
      await supabase.rpc("recompute_my_energy", { p_date: o.date });
      setOngoing(null);
      await Promise.all([logs.refresh(), loadScore()]);
      toast(
        `Sleep auto-closed at ${CAP_HOURS}h — you forgot to tap Wake.`,
        "info"
      );
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ongoing, now]);

  const startSleep = async () => {
    setBusy(true);
    setNote(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setNote("Not signed in.");
      setBusy(false);
      return;
    }
    const { error } = await supabase.from("sleep_logs").upsert(
      {
        user_id: user.id,
        date: todayISO(),
        sleep_start: new Date().toISOString(),
        sleep_end: null,
        duration_hours: 0,
      },
      { onConflict: "user_id,date" }
    );
    if (error) {
      setNote(`Couldn't start: ${error.message}`);
      toast("Couldn't start sleep tracking.", "error");
    } else await loadOngoing();
    setBusy(false);
  };

  const wake = async () => {
    if (!ongoing) return;
    setBusy(true);
    const start = new Date(ongoing.sleep_start).getTime();
    const duration = +((Date.now() - start) / 3_600_000).toFixed(2);
    const { error } = await supabase
      .from("sleep_logs")
      .update({
        sleep_end: new Date().toISOString(),
        duration_hours: duration,
      })
      .eq("id", ongoing.id);
    if (error) {
      toast("Couldn't save your wake time.", "error");
      setBusy(false);
      return;
    }
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
    ? Math.min(now - new Date(ongoing.sleep_start).getTime(), CAP_MS)
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
              <div className="text-2xl font-bold tabular-nums text-fg">
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
                <div className="text-2xl font-bold tabular-nums text-fg">
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
        {note && <p className="mt-3 text-xs text-red-300">{note}</p>}
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
