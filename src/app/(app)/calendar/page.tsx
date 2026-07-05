"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { GlassCard } from "@/components/ui/GlassCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { Modal } from "@/components/ui/Modal";
import { MOOD_COLORS, MOOD_LABELS } from "@/lib/mood";
import type { JournalEntry } from "@/lib/types";

const WD = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
type DayMood = { mood_score: number | null; has_journal: boolean };

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export default function CalendarPage() {
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [moods, setMoods] = useState<Record<string, DayMood>>({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [entry, setEntry] = useState<JournalEntry | null>(null);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  const load = useCallback(async () => {
    setLoading(true);
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0);
    const { data } = await supabase.rpc("get_month_moods", {
      p_start: iso(start),
      p_end: iso(end),
    });
    const map: Record<string, DayMood> = {};
    for (const r of (data ?? []) as {
      d: string;
      mood_score: number | null;
      has_journal: boolean;
    }[])
      map[r.d] = { mood_score: r.mood_score, has_journal: r.has_journal };
    setMoods(map);
    setLoading(false);
  }, [year, month]);

  useEffect(() => {
    load();
  }, [load]);

  const openDay = async (date: string) => {
    setSelected(date);
    setEntry(null);
    const { data } = await supabase
      .from("journal_entries")
      .select("*")
      .eq("entry_date", date)
      .maybeSingle();
    setEntry((data as JournalEntry) ?? null);
  };

  const startWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(startWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const todayStr = iso(new Date());

  return (
    <div>
      <PageHeader title="Calendar" subtitle="Your days, colored by mood." />

      <GlassCard className="p-5 sm:p-6">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            {cursor.toLocaleDateString([], { month: "long", year: "numeric" })}
          </h3>
          <div className="flex gap-1">
            <button
              onClick={() => setCursor(new Date(year, month - 1, 1))}
              className="rounded-lg p-2 text-muted transition hover:text-fg"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => setCursor(new Date(year, month + 1, 1))}
              className="rounded-lg p-2 text-muted transition hover:text-fg"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        <div className="mb-2 grid grid-cols-7 gap-2 text-center text-xs text-muted">
          {WD.map((w) => (
            <div key={w}>{w}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {cells.map((day, i) => {
            if (day === null) return <div key={i} />;
            const date = iso(new Date(year, month, day));
            const m = moods[date];
            const color = m?.mood_score ? MOOD_COLORS[m.mood_score] : null;
            return (
              <button
                key={i}
                onClick={() => openDay(date)}
                className="relative flex aspect-square items-center justify-center rounded-xl text-sm transition-colors duration-300"
                style={{
                  backgroundColor: color ?? "var(--color-surface)",
                  color: color ? "#ffffff" : "var(--color-muted)",
                  opacity: loading ? 0.4 : 1,
                }}
              >
                {day}
                {m?.has_journal && (
                  <span className="absolute bottom-1 h-1 w-1 rounded-full bg-fg/60" />
                )}
                {date === todayStr && (
                  <span className="absolute inset-0 rounded-xl ring-1 ring-inset ring-fg/30" />
                )}
              </button>
            );
          })}
        </div>
      </GlassCard>

      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={
          selected
            ? new Date(selected).toLocaleDateString([], {
                weekday: "long",
                month: "long",
                day: "numeric",
              })
            : ""
        }
      >
        {selected && moods[selected]?.mood_score && (
          <div className="mb-4 flex items-center gap-2 text-sm">
            <span
              className="h-4 w-4 rounded-full"
              style={{ backgroundColor: MOOD_COLORS[moods[selected].mood_score!] }}
            />
            <span className="text-muted">
              Mood · {MOOD_LABELS[moods[selected].mood_score!]}
            </span>
          </div>
        )}
        {entry ? (
          <dl className="space-y-3 text-sm">
            {entry.did_today && (
              <div>
                <dt className="text-xs text-muted">What I did</dt>
                <dd className="text-fg/90">{entry.did_today}</dd>
              </div>
            )}
            {entry.learned && (
              <div>
                <dt className="text-xs text-muted">What I learned</dt>
                <dd className="text-fg/90">{entry.learned}</dd>
              </div>
            )}
            {entry.tomorrow && (
              <div>
                <dt className="text-xs text-muted">Tomorrow</dt>
                <dd className="text-fg/90">{entry.tomorrow}</dd>
              </div>
            )}
          </dl>
        ) : (
          <p className="py-6 text-center text-sm text-muted">
            No journal entry on this day.
          </p>
        )}
      </Modal>
    </div>
  );
}
