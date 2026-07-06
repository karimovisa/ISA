"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { GlassCard } from "@/components/ui/GlassCard";
import { PressButton } from "@/components/ui/PressButton";

// Every table holding the user's own content. RLS scopes each select to them.
// Credential tables (strava_connections, push_subscriptions) are intentionally
// excluded — they hold OAuth/push secrets, not personal data.
const TABLES = [
  "goals",
  "projects",
  "project_tasks",
  "ideas",
  "journal_entries",
  "focus_sessions",
  "sleep_logs",
  "daily_energy_scores",
  "weekly_reviews",
  "habits",
  "habit_logs",
  "mood_logs",
  "todos",
  "runs",
  "strava_activities",
  "reminders",
  "prayer_preferences",
  "prayer_logs",
];

export function DataExport() {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const exportAll = async () => {
    setBusy(true);
    setNote(null);
    try {
      const data: Record<string, unknown[]> = {};
      let total = 0;
      for (const t of TABLES) {
        const { data: rows, error } = await supabase.from(t).select("*");
        const list = error ? [] : rows ?? [];
        data[t] = list;
        total += list.length;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const payload = {
        app: "ISA",
        version: 1,
        exported_at: new Date().toISOString(),
        user: {
          id: user?.id ?? null,
          email: user?.email ?? null,
          name: (user?.user_metadata?.full_name as string | undefined) ?? null,
        },
        data,
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `isa-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setNote(`Exported ${total} records across ${TABLES.length} datasets.`);
    } catch {
      setNote("Export failed. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <GlassCard className="mt-6 max-w-xl p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/[0.06]">
          <Download size={20} className="text-fg" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-medium">Export your data</h3>
          <p className="mt-1 text-sm text-muted">
            Download everything — goals, journal, habits, runs and more — as a
            single JSON file. It&apos;s yours.
          </p>
          <div className="mt-4">
            <PressButton
              onClick={exportAll}
              disabled={busy}
              className="rounded-xl bg-white/10 px-4 py-2.5 text-sm font-medium text-fg transition hover:bg-white/15 disabled:opacity-50"
            >
              {busy ? "Preparing…" : "Download JSON"}
            </PressButton>
          </div>
          {note && <p className="mt-3 text-xs text-muted">{note}</p>}
        </div>
      </div>
    </GlassCard>
  );
}
