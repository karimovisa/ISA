"use client";

// ISA — Today's habits on the Dashboard. Content, not a card: a plain list of
// the habits actually due today (a Mon/Wed/Fri habit isn't shown on Tuesday),
// each with a glyph and a tap-to-check ring.

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, Droplet, BookOpen, Dumbbell, Leaf, Moon, Repeat } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { useCollection } from "@/hooks/useCollection";
import { useT } from "@/lib/i18n";
import { todayISO } from "@/lib/datetime";
import { captureLifeEvent } from "@/lib/life-events";
import { isDueOn } from "@/lib/habitCoach";
import type { Habit } from "@/lib/types";

const GREEN = "#86A97F";

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

/** `onChange` lets the Dashboard refresh its numbers after a tick. */
export function TodayHabits({ onChange }: { onChange?: () => void }) {
  const { user } = useAuth();
  const { t } = useT();
  const today = todayISO();
  const habits = useCollection<Habit>("habits");
  const [done, setDone] = useState<Set<string>>(new Set());

  useEffect(() => {
    let alive = true;
    void supabase
      .from("habit_logs")
      .select("habit_id,completed")
      .eq("date", today)
      .then(({ data }) => {
        if (!alive) return;
        setDone(new Set(((data as { habit_id: string; completed: boolean }[]) ?? []).filter((x) => x.completed).map((x) => x.habit_id)));
      });
    return () => {
      alive = false;
    };
  }, [today]);

  const due = habits.data.filter((h) => h.is_active && isDueOn(h, new Date()));

  const toggle = async (h: Habit) => {
    if (!user) return;
    const next = !done.has(h.id);
    setDone((prev) => {
      const n = new Set(prev);
      if (next) n.add(h.id);
      else n.delete(h.id);
      return n;
    });
    await supabase
      .from("habit_logs")
      .upsert({ user_id: user.id, habit_id: h.id, date: today, completed: next }, { onConflict: "habit_id,date" });
    if (next)
      void captureLifeEvent({ type: "HabitCompleted", occurredAt: today, payload: { habit: h.name, category: h.category }, context: { outcome: "consistency" } });
    onChange?.();
  };

  if (habits.loading) return null;
  if (due.length === 0) return <p className="text-sm text-muted">{t("Nothing due today — rest is part of the plan.")}</p>;

  return (
    <ul>
      {due.map((h) => {
        const Icon = habitIcon(h);
        const isDone = done.has(h.id);
        return (
          <li key={h.id}>
            <button onClick={() => void toggle(h)} className="group flex w-full items-center gap-3 py-2.5 text-left">
              <motion.span
                whileTap={{ scale: 0.85 }}
                className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border transition-colors"
                style={isDone ? { borderColor: GREEN, background: `${GREEN}22` } : { borderColor: "var(--color-line)" }}
              >
                {isDone && <Check size={12} strokeWidth={3} style={{ color: GREEN }} />}
              </motion.span>
              <span className={`min-w-0 flex-1 truncate text-[15px] ${isDone ? "text-muted line-through" : "text-fg/90 group-hover:text-fg"}`}>
                {h.name}
              </span>
              <Icon size={15} className="shrink-0 text-fg/35" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
