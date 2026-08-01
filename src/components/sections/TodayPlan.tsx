"use client";

// ISA — Today's Plan. Two panels, exactly as designed: a live TIMELINE of the
// day's timed events (completed → NOW → upcoming) and a HABITS checklist with a
// glyph per habit and a tap-to-check ring. Timed events are a real, lightweight
// feature (timed_events table) — the user builds their own day, no fake data.

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Plus, X, Droplet, BookOpen, Dumbbell, Leaf, Moon, Repeat } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { useCollection } from "@/hooks/useCollection";
import { useT } from "@/lib/i18n";
import { todayISO } from "@/lib/datetime";
import { captureLifeEvent } from "@/lib/life-events";
import type { Habit } from "@/lib/types";

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

// A quiet glyph per habit — matched by name/category, with a calm fallback.
const habitIcon = (h: Habit) => {
  const s = `${h.name} ${h.category ?? ""}`.toLowerCase();
  if (/water|suv|drink|ichish/.test(s)) return Droplet;
  if (/read|kitob|o'qi|oqi/.test(s)) return BookOpen;
  if (/workout|gym|sport|mashq|exercise|fitness|run|yugur|push|train/.test(s)) return Dumbbell;
  if (/medit|breath|nafas|yoga|calm|namoz|pray|tafakkur/.test(s)) return Leaf;
  if (/sleep|uyqu|bed|yot/.test(s)) return Moon;
  return Repeat;
};

export function TodayPlan() {
  const { user } = useAuth();
  const { t } = useT();
  const today = todayISO();
  const habits = useCollection<Habit>("habits");

  const [events, setEvents] = useState<TimedEvent[]>([]);
  const [doneHabits, setDoneHabits] = useState<Set<string>>(new Set());
  const [addOpen, setAddOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newTime, setNewTime] = useState("09:00");

  const load = useCallback(async () => {
    const [{ data: ev }, { data: hl }] = await Promise.all([
      supabase.from("timed_events").select("id,title,event_time,done").eq("event_date", today).order("event_time", { ascending: true }),
      supabase.from("habit_logs").select("habit_id,completed").eq("date", today),
    ]);
    setEvents((ev as TimedEvent[]) ?? []);
    setDoneHabits(
      new Set(((hl as { habit_id: string; completed: boolean }[]) ?? []).filter((x) => x.completed).map((x) => x.habit_id))
    );
  }, [today]);

  useEffect(() => {
    load();
  }, [load]);

  const sorted = useMemo(() => [...events].sort((a, b) => toMin(a.event_time) - toMin(b.event_time)), [events]);
  // "NOW" is the latest not-done event that's already begun; if the day hasn't
  // started, it's the first one coming up.
  const nowEventId = useMemo(() => {
    const n = nowMinutes();
    const nonDone = sorted.filter((e) => !e.done);
    const begun = nonDone.filter((e) => toMin(e.event_time) <= n);
    return (begun.length ? begun[begun.length - 1] : nonDone[0])?.id ?? null;
  }, [sorted]);

  const activeHabits = habits.data.filter((h) => h.is_active).slice(0, 6);

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

  const toggleHabit = async (h: Habit) => {
    if (!user) return;
    const done = !doneHabits.has(h.id);
    setDoneHabits((prev) => {
      const n = new Set(prev);
      if (done) n.add(h.id);
      else n.delete(h.id);
      return n;
    });
    await supabase.from("habit_logs").upsert({ user_id: user.id, habit_id: h.id, date: today, completed: done }, { onConflict: "habit_id,date" });
    if (done)
      void captureLifeEvent({ type: "HabitCompleted", occurredAt: today, payload: { habit: h.name, category: h.category }, context: { outcome: "consistency" } });
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      {/* ── TODAY'S TIMELINE ── */}
      <div className="min-w-0 rounded-[22px] border border-line bg-[var(--color-card)] p-3.5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xs font-medium uppercase tracking-[0.14em] text-muted">{t("Today's Timeline")}</h3>
          <button
            onClick={() => setAddOpen((v) => !v)}
            aria-label={t("Add event")}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-line text-muted transition hover:text-fg"
          >
            {addOpen ? <X size={14} /> : <Plus size={15} />}
          </button>
        </div>

        <AnimatePresence initial={false}>
          {addOpen && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mb-3 overflow-hidden">
              <div className="flex items-center gap-2 rounded-2xl border border-line bg-white/[0.02] p-2">
                <input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder={t("Event name")}
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && addEvent()}
                  className="min-w-0 flex-1 bg-transparent px-2 text-sm text-fg placeholder:text-muted/60 focus:outline-none"
                />
                <input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} className="rounded-lg bg-white/[0.05] px-2 py-1.5 text-xs text-fg" />
                <button onClick={addEvent} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: GREEN }}>
                  <Check size={15} style={{ color: "var(--color-bg)" }} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {sorted.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted">{t("No events yet — add your day's plan.")}</p>
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
      </div>

      {/* ── TODAY'S HABITS ── */}
      <div className="min-w-0 rounded-[22px] border border-line bg-[var(--color-card)] p-3.5">
        <h3 className="mb-4 text-xs font-medium uppercase tracking-[0.14em] text-muted">{t("Today's Habits")}</h3>
        {activeHabits.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted">{t("No habits yet")}</p>
        ) : (
          <div className="space-y-0.5">
            {activeHabits.map((h) => {
              const Icon = habitIcon(h);
              const done = doneHabits.has(h.id);
              return (
                <button key={h.id} onClick={() => toggleHabit(h)} className="flex w-full items-center gap-2 py-2 text-left">
                  <Icon size={16} className="shrink-0 text-fg/70" />
                  <span className={`min-w-0 flex-1 truncate text-[13px] ${done ? "text-muted line-through" : "text-fg/90"}`}>{h.name}</span>
                  <motion.span
                    whileTap={{ scale: 0.85 }}
                    className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border transition-colors"
                    style={done ? { borderColor: GREEN } : { borderColor: "var(--color-line)" }}
                  >
                    {done && <Check size={12} strokeWidth={3} style={{ color: GREEN }} />}
                  </motion.span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
