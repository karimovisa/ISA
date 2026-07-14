"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { GlassCard } from "@/components/ui/GlassCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { Modal } from "@/components/ui/Modal";
import { MOOD_COLORS, MOOD_LABELS } from "@/lib/mood";
import { formatSom } from "@/lib/money";

const WD = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
type DayMood = { mood_score: number | null; has_journal: boolean };
type Summary = Record<string, unknown>;
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const num = (s: Summary | null, k: string) => (s && typeof s[k] === "number" ? (s[k] as number) : 0);

export default function CalendarPage() {
  const [cursor, setCursor] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); });
  const [view, setView] = useState<"month" | "year">("month");
  const [moods, setMoods] = useState<Record<string, DayMood>>({});
  const [eventDates, setEventDates] = useState<Set<string>>(new Set());
  const [monthSummary, setMonthSummary] = useState<Summary | null>(null);
  const [yearMoods, setYearMoods] = useState<Record<number, number | null>>({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [day, setDay] = useState<Summary | null>(null);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const mkey = `${year}-${String(month + 1).padStart(2, "0")}`;

  const loadMonth = useCallback(async () => {
    setLoading(true);
    const start = new Date(year, month, 1), end = new Date(year, month + 1, 0);
    const [moodRes, evRes, sumRes] = await Promise.all([
      supabase.rpc("get_month_moods", { p_start: iso(start), p_end: iso(end) }),
      supabase.from("life_events").select("occurred_at,importance,metadata").gte("occurred_at", iso(start)).lt("occurred_at", iso(new Date(year, month + 1, 1))),
      supabase.rpc("month_summary", { p_month: mkey }),
    ]);
    const map: Record<string, DayMood> = {};
    for (const r of (moodRes.data ?? []) as { d: string; mood_score: number | null; has_journal: boolean }[]) map[r.d] = { mood_score: r.mood_score, has_journal: r.has_journal };
    setMoods(map);
    const ev = new Set<string>();
    for (const e of (evRes.data ?? []) as { occurred_at: string; importance: string; metadata: { timeContext?: { localDate?: string } } }[])
      if (e.importance === "pivotal" || e.importance === "significant") ev.add(e.metadata?.timeContext?.localDate ?? e.occurred_at.slice(0, 10));
    setEventDates(ev);
    setMonthSummary(sumRes.data as Summary);
    setLoading(false);
  }, [year, month, mkey]);
  useEffect(() => { loadMonth(); }, [loadMonth]);

  const loadYear = useCallback(async () => {
    const { data } = await supabase.from("mood_logs").select("date,mood_score").gte("date", `${year}-01-01`).lte("date", `${year}-12-31`);
    const byMonth: Record<number, number[]> = {};
    for (const r of (data ?? []) as { date: string; mood_score: number }[]) { const m = Number(r.date.slice(5, 7)) - 1; (byMonth[m] ??= []).push(r.mood_score); }
    const avg: Record<number, number | null> = {};
    for (let m = 0; m < 12; m++) avg[m] = byMonth[m]?.length ? Math.round(byMonth[m].reduce((a, b) => a + b, 0) / byMonth[m].length) : null;
    setYearMoods(avg);
  }, [year]);
  useEffect(() => { if (view === "year") loadYear(); }, [view, loadYear]);

  const openDay = async (date: string) => {
    setSelected(date); setDay(null);
    const { data } = await supabase.rpc("day_summary", { p_date: date });
    setDay((data as Summary) ?? {});
  };

  const startWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(startWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const todayStr = iso(new Date());

  return (
    <div>
      <PageHeader title="Calendar" subtitle="The visual timeline of your life — moods, milestones, momentum." />

      <GlassCard className="p-5 sm:p-6">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setView(view === "month" ? "year" : "month")} className="rounded-full bg-white/5 px-3 py-1 text-xs text-muted transition hover:text-fg">{view === "month" ? year : "Month"}</button>
            <h3 className="text-lg font-semibold">{view === "month" ? cursor.toLocaleDateString([], { month: "long", year: "numeric" }) : year}</h3>
          </div>
          <div className="flex gap-1">
            <button onClick={() => view === "month" ? setCursor(new Date(year, month - 1, 1)) : setCursor(new Date(year - 1, month, 1))} className="rounded-lg p-2 text-muted transition hover:text-fg"><ChevronLeft size={18} /></button>
            <button onClick={() => view === "month" ? setCursor(new Date(year, month + 1, 1)) : setCursor(new Date(year + 1, month, 1))} className="rounded-lg p-2 text-muted transition hover:text-fg"><ChevronRight size={18} /></button>
          </div>
        </div>

        {view === "month" ? (
          <>
            <div className="mb-2 grid grid-cols-7 gap-2 text-center text-xs text-muted">{WD.map((w) => <div key={w}>{w}</div>)}</div>
            <div className="grid grid-cols-7 gap-2">
              {cells.map((d, i) => {
                if (d === null) return <div key={i} />;
                const date = iso(new Date(year, month, d));
                const m = moods[date];
                const color = m?.mood_score ? MOOD_COLORS[m.mood_score] : null;
                return (
                  <button key={i} onClick={() => openDay(date)} className="relative flex aspect-square items-center justify-center rounded-xl text-sm transition-colors duration-300"
                    style={{ backgroundColor: color ?? "var(--color-surface)", color: color ? "#fff" : "var(--color-muted)", opacity: loading ? 0.4 : 1 }}>
                    {d}
                    <div className="absolute bottom-1 flex gap-0.5">
                      {m?.has_journal && <span className="h-1 w-1 rounded-full bg-fg/60" />}
                      {eventDates.has(date) && <span className="h-1 w-1 rounded-full bg-accent" />}
                    </div>
                    {date === todayStr && <span className="absolute inset-0 rounded-xl ring-1 ring-inset ring-fg/40" />}
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {MONTHS.map((mn, mi) => {
              const avg = yearMoods[mi];
              const color = avg ? MOOD_COLORS[avg] : null;
              return (
                <button key={mn} onClick={() => { setCursor(new Date(year, mi, 1)); setView("month"); }} className="flex aspect-[4/3] flex-col items-center justify-center rounded-xl text-sm transition"
                  style={{ backgroundColor: color ?? "var(--color-surface)", color: color ? "#fff" : "var(--color-muted)" }}>
                  <span className="font-medium">{mn}</span>
                  {avg && <span className="mt-1 text-[10px] opacity-80">{MOOD_LABELS[avg]}</span>}
                </button>
              );
            })}
          </div>
        )}
      </GlassCard>

      {/* Month summary */}
      {view === "month" && (
        <GlassCard className="mt-4 p-5">
          <h3 className="mb-3 text-sm font-medium text-muted">This month</h3>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            <Mini label="Avg mood" value={monthSummary?.mood_avg != null ? String(monthSummary.mood_avg) : "—"} />
            <Mini label="Focus" value={`${num(monthSummary, "focus_hours")}h`} />
            <Mini label="Habits" value={`${num(monthSummary, "habits_completed")}`} />
            <Mini label="Prayers" value={`${num(monthSummary, "prayers")}`} />
            <Mini label="Run" value={`${num(monthSummary, "run_km")}km`} />
            <Mini label="Journal" value={`${num(monthSummary, "journal_entries")}`} />
            <Mini label="Goals done" value={`${num(monthSummary, "goals_completed")}`} />
          </div>
        </GlassCard>
      )}

      {/* Day summary */}
      <Modal open={selected !== null} onClose={() => setSelected(null)}
        title={selected ? new Date(selected).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" }) : ""}>
        {!day ? <div className="h-32 animate-pulse rounded-xl bg-white/5" /> : (
          <div className="space-y-4">
            {typeof day.mood === "number" && (
              <div className="flex items-center gap-2 text-sm"><span className="h-4 w-4 rounded-full" style={{ backgroundColor: MOOD_COLORS[day.mood as number] }} /><span className="text-muted">{MOOD_LABELS[day.mood as number]}</span></div>
            )}
            <div className="grid grid-cols-3 gap-2 text-center">
              <Mini label="Focus" value={`${num(day, "focus_min")}m`} />
              <Mini label="Habits" value={`${num(day, "habits_done")}`} />
              <Mini label="Prayers" value={`${num(day, "prayers")}/5`} />
              <Mini label="Goals" value={`${num(day, "goals_completed")}`} />
              <Mini label="Run" value={`${num(day, "run_km")}km`} />
              <Mini label="Money" value={formatSom(num(day, "money_net"))} />
            </div>
            {Array.isArray(day.events) && (day.events as { type: string; title: string | null }[]).length > 0 && (
              <div>
                <p className="mb-1 flex items-center gap-1 text-xs text-muted"><Sparkles size={11} /> Life events</p>
                {(day.events as { type: string; title: string | null }[]).map((e, i) => (
                  <p key={i} className="text-sm text-fg/85">• {e.title || e.type}</p>
                ))}
              </div>
            )}
            {typeof day.journal === "string" && day.journal && (
              <div><p className="mb-1 text-xs text-muted">Journal</p><p className="whitespace-pre-wrap text-sm text-fg/85">{day.journal}</p></div>
            )}
            {!day.mood && !day.journal && num(day, "focus_min") === 0 && num(day, "habits_done") === 0 && (
              <p className="py-4 text-center text-sm text-muted">A quiet day — nothing logged.</p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/[0.03] py-2.5 text-center">
      <div className="truncate text-lg font-bold tabular-nums">{value}</div>
      <div className="text-[11px] text-muted">{label}</div>
    </div>
  );
}
