"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { MOOD_COLORS, MOOD_LABELS } from "@/lib/mood";
import { todayISO } from "@/lib/datetime";

/** End-of-day mood: five color dots, no emoji. Loads + saves today's mood. */
export function MoodPicker() {
  const [score, setScore] = useState<number | null>(null);

  useEffect(() => {
    supabase
      .from("mood_logs")
      .select("mood_score")
      .eq("date", todayISO())
      .maybeSingle()
      .then(({ data }) => setScore((data?.mood_score as number) ?? null));
  }, []);

  const pick = async (s: number) => {
    setScore(s);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from("mood_logs")
      .upsert(
        { user_id: user.id, date: todayISO(), mood_score: s },
        { onConflict: "user_id,date" }
      );
  };

  return (
    <div>
      <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">
        How was today?
      </div>
      <div className="flex items-center gap-3">
        {[1, 2, 3, 4, 5].map((s) => (
          <button
            key={s}
            onClick={() => pick(s)}
            title={MOOD_LABELS[s]}
            aria-label={MOOD_LABELS[s]}
            className="h-8 w-8 rounded-full transition-all duration-200 hover:scale-110"
            style={{
              backgroundColor: MOOD_COLORS[s],
              opacity: score === null || score === s ? 1 : 0.35,
              boxShadow:
                score === s ? `0 0 0 2px rgba(255,255,255,0.5)` : undefined,
            }}
          />
        ))}
      </div>
    </div>
  );
}
