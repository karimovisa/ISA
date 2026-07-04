"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CalendarRange, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { GlassCard } from "@/components/ui/GlassCard";
import { PressButton } from "@/components/ui/PressButton";
import type { WeeklyReview } from "@/lib/types";

function thisMonday(): string {
  const now = new Date();
  const day = (now.getDay() + 6) % 7;
  const m = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
  return m.toISOString().slice(0, 10);
}

export function WeeklyReviewHistory() {
  const [reviews, setReviews] = useState<WeeklyReview[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("weekly_reviews")
      .select("*")
      .order("week_start_date", { ascending: false });
    if (data) setReviews(data as WeeklyReview[]);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const generate = async () => {
    setBusy(true);
    await supabase.rpc("generate_my_weekly_review", { p_week: thisMonday() });
    await load();
    setBusy(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <GlassCard className="p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarRange size={18} className="text-fg/80" />
            <h3 className="text-sm font-medium">Weekly reviews</h3>
          </div>
          <PressButton
            onClick={generate}
            disabled={busy}
            className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs text-fg transition hover:bg-white/15 disabled:opacity-50"
          >
            <Sparkles size={13} />
            {busy ? "Generating…" : "Generate this week"}
          </PressButton>
        </div>

        {reviews.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">
            Reviews appear here every Sunday evening. Generate one now to preview.
          </p>
        ) : (
          <ul className="space-y-3">
            {reviews.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between border-t border-line pt-3 text-sm first:border-0 first:pt-0"
              >
                <span className="text-fg/90">
                  {new Date(r.week_start_date).toLocaleDateString([], {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                <span className="flex items-center gap-4 text-muted">
                  <span>{r.focus_total_minutes}m focus</span>
                  <span>{r.journal_entries_count} entries</span>
                  {r.avg_energy_score !== null && (
                    <span className="text-fg/85">
                      ⚡ {r.avg_energy_score}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </GlassCard>
    </motion.div>
  );
}
