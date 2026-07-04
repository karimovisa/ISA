"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase/client";
import { Modal } from "@/components/ui/Modal";
import { AscentProgress } from "@/components/ui/AscentProgress";
import type { WeeklyReview } from "@/lib/types";

function motivation(r: WeeklyReview): string {
  if (r.focus_total_minutes >= 300) return "A week of deep, deliberate work. Keep the momentum.";
  if (r.journal_entries_count >= 5) return "You showed up for yourself every day. That's the process.";
  if (r.avg_energy_score !== null && r.avg_energy_score >= 75)
    return "Well rested and moving forward. This is your best pace.";
  if (r.focus_sessions_count === 0 && r.journal_entries_count === 0)
    return "A quiet week. Next one is a fresh climb.";
  return "Every small step compounds. Onward and upward.";
}

export function WeeklyReviewModal() {
  const [review, setReview] = useState<WeeklyReview | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("weekly_reviews")
        .select("*")
        .is("seen_at", null)
        .order("week_start_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        setReview(data as WeeklyReview);
        setOpen(true);
      }
    })();
  }, []);

  const dismiss = async () => {
    setOpen(false);
    if (review)
      await supabase
        .from("weekly_reviews")
        .update({ seen_at: new Date().toISOString() })
        .eq("id", review.id);
  };

  if (!review) return null;

  const stats = [
    { label: "Goals at 100%", value: review.goals_completed },
    { label: "Journal entries", value: review.journal_entries_count },
    { label: "Focus sessions", value: review.focus_sessions_count },
    { label: "Focus minutes", value: review.focus_total_minutes },
  ];

  return (
    <Modal open={open} onClose={dismiss} title="Your week">
      <p className="mb-5 text-sm text-muted">
        Week of{" "}
        {new Date(review.week_start_date).toLocaleDateString([], {
          month: "long",
          day: "numeric",
        })}
      </p>

      <div className="grid grid-cols-2 gap-4">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="rounded-2xl bg-white/[0.04] p-4"
          >
            <div className="text-2xl font-bold tabular-nums">{s.value}</div>
            <div className="text-xs text-muted">{s.label}</div>
          </motion.div>
        ))}
      </div>

      {review.avg_energy_score !== null && (
        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between text-xs text-muted">
            <span>Avg energy score</span>
            <span>{review.avg_energy_score}</span>
          </div>
          <AscentProgress value={Number(review.avg_energy_score)} />
        </div>
      )}

      <p className="mt-6 text-balance text-center text-sm italic text-white/80">
        {motivation(review)}
      </p>
    </Modal>
  );
}
