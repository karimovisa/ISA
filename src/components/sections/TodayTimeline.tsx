"use client";

// ISA — Today's timeline. A live list of the day's timed events (completed →
// NOW → upcoming). Timed events are a real, lightweight feature (timed_events
// table) — the user builds their own day, no fake data. Lives on the Calendar
// page (the Dashboard is a daily ritual now, not a schedule view).

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Plus, Clock } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { GlassCard } from "@/components/ui/GlassCard";
import { Modal, fieldClass, labelClass, primaryBtnClass } from "@/components/ui/Modal";
import { PressButton } from "@/components/ui/PressButton";
import { useT } from "@/lib/i18n";
import { todayISO } from "@/lib/datetime";

const GREEN = "#86A97F";

type TimedEvent = { id: string; title: string; event_time: string; done: boolean };

const nowMinutes = () => {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
};
const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

export function TodayTimeline({ className = "" }: { className?: string }) {
  const { user } = useAuth();
  const { t } = useT();
  const today = todayISO();

  const [events, setEvents] = useState<TimedEvent[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newTime, setNewTime] = useState("09:00");
  const timeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    void supabase
      .from("timed_events")
      .select("id,title,event_time,done")
      .eq("event_date", today)
      .order("event_time", { ascending: true })
      .then(({ data }) => {
        if (alive) setEvents((data as TimedEvent[]) ?? []);
      });
    return () => {
      alive = false;
    };
  }, [today]);

  const sorted = useMemo(() => [...events].sort((a, b) => toMin(a.event_time) - toMin(b.event_time)), [events]);
  // "NOW" is the latest not-done event that's already begun; if the day hasn't
  // started, it's the first one coming up.
  const nowEventId = useMemo(() => {
    const n = nowMinutes();
    const nonDone = sorted.filter((e) => !e.done);
    const begun = nonDone.filter((e) => toMin(e.event_time) <= n);
    return (begun.length ? begun[begun.length - 1] : nonDone[0])?.id ?? null;
  }, [sorted]);

  const toggleEvent = async (e: TimedEvent) => {
    const done = !e.done;
    setEvents((prev) => prev.map((x) => (x.id === e.id ? { ...x, done } : x)));
    await supabase.from("timed_events").update({ done }).eq("id", e.id);
  };

  const addEvent = async () => {
    const title = newTitle.trim();
    if (!user || !title) return;
    setNewTitle("");
    setAddOpen(false);
    const { data } = await supabase
      .from("timed_events")
      .insert({ user_id: user.id, title, event_time: newTime, event_date: today, done: false })
      .select("id,title,event_time,done")
      .single();
    if (data) setEvents((prev) => [...prev, data as TimedEvent]);
  };

  return (
    <>
      <GlassCard className={`p-5 ${className}`}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xs font-medium uppercase tracking-[0.14em] text-muted">{t("Today's Timeline")}</h3>
          <button
            onClick={() => setAddOpen(true)}
            aria-label={t("Add event")}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-line text-muted transition hover:text-fg"
          >
            <Plus size={15} />
          </button>
        </div>

        {sorted.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted">{t("No events yet — add your day's plan.")}</p>
        ) : (
          <div className="relative">
            <span className="absolute bottom-4 left-[9px] top-4 w-px bg-[var(--color-line)]" />
            {sorted.map((e) => {
              const isNow = !e.done && e.id === nowEventId;
              return (
                <div key={e.id} className="relative flex gap-2.5 py-0.5">
                  <button
                    onClick={() => toggleEvent(e)}
                    aria-label={e.title}
                    className="relative z-10 mt-2.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition"
                    style={
                      e.done
                        ? { background: GREEN, borderColor: GREEN }
                        : isNow
                          ? { background: "var(--color-fg)", borderColor: "var(--color-fg)" }
                          : { background: "var(--color-card)", borderColor: "var(--color-line)" }
                    }
                  >
                    {e.done && <Check size={10} strokeWidth={3} style={{ color: "var(--color-bg)" }} />}
                  </button>
                  <div className={`min-w-0 flex-1 rounded-xl px-2 py-1.5 ${isNow ? "bg-white/[0.05]" : ""}`}>
                    <div className="text-[11px] tabular-nums text-muted">{e.event_time}</div>
                    <div className={`truncate text-[13px] ${e.done ? "text-muted line-through" : "text-fg"}`}>{e.title}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>

      {/* Add event — a roomy modal so the name field never gets squeezed */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title={t("Add event")}>
        <form onSubmit={(e) => { e.preventDefault(); void addEvent(); }} className="space-y-4">
          <div>
            <label className={labelClass}>{t("Event name")}</label>
            <input
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder={t("Event name")}
              className={fieldClass}
            />
          </div>
          <div>
            <label className={labelClass}>{t("Time")}</label>
            <button
              type="button"
              onClick={() => { const el = timeRef.current; if (el?.showPicker) el.showPicker(); else el?.focus(); }}
              className={`${fieldClass} flex items-center gap-2 text-left`}
            >
              <Clock size={15} className="text-muted" />
              <span className="tabular-nums">{newTime}</span>
            </button>
            <input
              ref={timeRef}
              type="time"
              value={newTime}
              onChange={(e) => setNewTime(e.target.value || newTime)}
              tabIndex={-1}
              aria-hidden
              className="sr-only"
            />
          </div>
          <PressButton type="submit" disabled={!newTitle.trim()} className={primaryBtnClass}>
            {t("Save")}
          </PressButton>
        </form>
      </Modal>
    </>
  );
}
