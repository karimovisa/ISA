"use client";

import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { GlassCard } from "@/components/ui/GlassCard";
import { PressButton } from "@/components/ui/PressButton";
import { toast } from "@/lib/toast";

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
  const fileRef = useRef<HTMLInputElement>(null);

  const onImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    if (
      !window.confirm(
        "Restore this backup into your account? Items with the same id will be overwritten."
      )
    )
      return;
    setBusy(true);
    setNote(null);
    try {
      const parsed = JSON.parse(await file.text());
      if (parsed?.app !== "ISA" || !parsed.data) {
        toast("That doesn't look like an ISA backup file.", "error");
        setBusy(false);
        return;
      }
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setBusy(false);
        return;
      }
      let imported = 0;
      for (const t of TABLES) {
        const rows = parsed.data[t];
        if (!Array.isArray(rows) || rows.length === 0) continue;
        // Re-own each row to the current account so RLS accepts it.
        const owned = rows.map((r) =>
          r && typeof r === "object" && "user_id" in r
            ? { ...r, user_id: user.id }
            : r
        );
        const { error } = await supabase.from(t).upsert(owned);
        if (!error) imported += owned.length;
      }
      toast(`Restored ${imported} records.`, "success");
      setNote(`Restored ${imported} records. Refresh to see them.`);
    } catch {
      toast("Import failed — is the file a valid ISA export?", "error");
    } finally {
      setBusy(false);
    }
  };

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
          <h3 className="font-medium">Backup &amp; restore</h3>
          <p className="mt-1 text-sm text-muted">
            Download everything — goals, journal, habits, runs and more — as a
            single JSON file, or restore it later. It&apos;s yours.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <PressButton
              onClick={exportAll}
              disabled={busy}
              className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-medium text-fg transition hover:bg-white/15 disabled:opacity-50"
            >
              <Download size={15} />
              {busy ? "Working…" : "Download JSON"}
            </PressButton>
            <PressButton
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-medium text-fg transition hover:bg-white/15 disabled:opacity-50"
            >
              <Upload size={15} />
              Restore
            </PressButton>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              onChange={onImport}
              className="hidden"
            />
          </div>
          {note && <p className="mt-3 text-xs text-muted">{note}</p>}
        </div>
      </div>
    </GlassCard>
  );
}
