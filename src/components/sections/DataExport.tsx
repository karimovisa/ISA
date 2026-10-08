"use client";

import { useRef, useState } from "react";
import { FileText, Download, Upload, ChevronDown, Share2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { GlassCard } from "@/components/ui/GlassCard";
import { PressButton } from "@/components/ui/PressButton";
import { toast } from "@/lib/toast";
import { useT } from "@/lib/i18n";
import { loadReport, type ReportPeriod } from "@/lib/report/data";
import { renderReportPdf, renderStoryPng, saveBlob, shareOrSave } from "@/lib/report/render";

// Every table holding the user's own content. RLS scopes each select to them.
// Credential tables (strava_connections, push_subscriptions) are intentionally
// excluded — they hold OAuth/push secrets, not personal data. Engine-derived
// tables (life_events, ai_*) are excluded too — they rebuild from this content.
//
// Order matters for RESTORE: a table whose rows reference another (FK) must come
// AFTER its parent so the upsert doesn't hit a missing reference — hence
// goal_milestones after goals, transactions after finance_goals, etc.
const TABLES = [
  "goals",
  "goal_milestones",
  "projects",
  "project_tasks",
  "project_notes",
  "ideas",
  "journal_entries",
  "focus_sessions",
  "sleep_logs",
  "daily_energy_scores",
  "daily_checkins",
  "weekly_reviews",
  "habits",
  "habit_logs",
  "mood_logs",
  "todos",
  "runs",
  "strava_activities",
  "finance_goals",
  "transactions",
  "recurring_payments",
  "reminders",
  "prayer_preferences",
  "prayer_logs",
];

export function DataExport() {
  const { t, lang } = useT();
  const [period, setPeriod] = useState<ReportPeriod>("week");
  const [working, setWorking] = useState<"pdf" | "story" | null>(null);
  const [busy, setBusy] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Primary: the weekly / monthly life report (PDF) and a story to share ──
  const stamp = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const makeReport = async (kind: "pdf" | "story") => {
    setBusy(true);
    setWorking(kind);
    setNote(null);
    try {
      const data = await loadReport(period);
      if (kind === "pdf") {
        saveBlob(await renderReportPdf(data, t, lang), `ISA-${period}-${stamp()}.pdf`);
        setNote(t("Report downloaded."));
      } else {
        const how = await shareOrSave(await renderStoryPng(data, t, lang), `ISA-${period}-${stamp()}.png`);
        if (how === "saved") setNote(t("Story image saved — share it from your gallery."));
      }
    } catch {
      setNote(t("Couldn't build the report. Check your connection and try again."));
    } finally {
      setBusy(false);
      setWorking(null);
    }
  };

  // ── Advanced: raw JSON export ──
  const exportJson = async () => {
    setBusy(true);
    setNote(null);
    try {
      const data: Record<string, unknown[]> = {};
      let total = 0;
      for (const tbl of TABLES) {
        const { data: rows, error } = await supabase.from(tbl).select("*");
        const list = error ? [] : rows ?? [];
        data[tbl] = list;
        total += list.length;
      }
      const { data: { user } } = await supabase.auth.getUser();
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
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `isa-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setNote(t("Exported {n} records.", { n: total }));
    } catch {
      setNote(t("Export failed. Check your connection and try again."));
    } finally {
      setBusy(false);
    }
  };

  // ── Advanced: restore from a JSON backup ──
  const onImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    if (!window.confirm(t("Restore this backup into your account? Items with the same id will be overwritten.")))
      return;
    setBusy(true);
    setNote(null);
    try {
      const parsed = JSON.parse(await file.text());
      if (parsed?.app !== "ISA" || !parsed.data) {
        toast(t("That doesn't look like an ISA backup file."), "error");
        setBusy(false);
        return;
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setBusy(false);
        return;
      }
      let imported = 0;
      for (const tbl of TABLES) {
        const rows = parsed.data[tbl];
        if (!Array.isArray(rows) || rows.length === 0) continue;
        const owned = rows.map((r) =>
          r && typeof r === "object" && "user_id" in r ? { ...r, user_id: user.id } : r
        );
        const { error } = await supabase.from(tbl).upsert(owned);
        if (!error) imported += owned.length;
      }
      toast(t("Restored {n} records.", { n: imported }), "success");
      setNote(t("Restored {n} records. Refresh to see them.", { n: imported }));
    } catch {
      toast(t("Import failed — is the file a valid ISA export?"), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <GlassCard className="mt-6 max-w-xl p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.06]">
          <FileText size={16} className="text-fg" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium">{t("Your life report")}</h3>
          <p className="text-xs text-muted">{t("Your week or month in one beautiful report — keep it, or share the story.")}</p>
        </div>
      </div>

      <div className="mt-3 space-y-2.5">
        <div role="tablist" className="inline-flex rounded-full border border-line p-0.5">
          {(["week", "month", "year"] as ReportPeriod[]).map((p) => (
            <button
              key={p}
              role="tab"
              aria-selected={period === p}
              onClick={() => setPeriod(p)}
              className={`rounded-full px-3 py-1 text-xs transition ${period === p ? "bg-white/10 font-semibold text-fg" : "text-muted hover:text-fg"}`}
            >
              {t(p === "week" ? "Week" : p === "month" ? "Month" : "Year")}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <PressButton
            onClick={() => void makeReport("pdf")}
            disabled={busy}
            className="flex items-center gap-2 rounded-xl bg-accent px-3.5 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
          >
            <FileText size={15} />
            {working === "pdf" ? t("Working…") : t("Download PDF report")}
          </PressButton>
          <PressButton
            onClick={() => void makeReport("story")}
            disabled={busy}
            className="flex items-center gap-2 rounded-xl bg-white/10 px-3.5 py-2 text-sm font-medium text-fg transition hover:bg-white/15 disabled:opacity-50"
          >
            <Share2 size={15} />
            {working === "story" ? t("Working…") : t("Share as Story")}
          </PressButton>
        </div>
      </div>

      {/* Advanced: the raw-data tools most people never need. */}
      <button
        onClick={() => setAdvanced((v) => !v)}
        className="mt-3 flex items-center gap-1 text-xs text-muted transition hover:text-fg"
      >
        <ChevronDown size={13} className={advanced ? "rotate-180 transition" : "transition"} />
        {t("Backup & restore")}
      </button>
      {advanced && (
        <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <PressButton
            onClick={exportJson}
            disabled={busy}
            className="flex items-center gap-2 rounded-xl bg-white/10 px-3.5 py-2 text-sm font-medium text-fg transition hover:bg-white/15 disabled:opacity-50"
          >
            <Download size={15} />
            {t("Download JSON")}
          </PressButton>
          <PressButton
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="flex items-center gap-2 rounded-xl bg-white/10 px-3.5 py-2 text-sm font-medium text-fg transition hover:bg-white/15 disabled:opacity-50"
          >
            <Upload size={15} />
            {t("Restore")}
          </PressButton>
          <input ref={fileRef} type="file" accept="application/json,.json" onChange={onImport} className="hidden" />
        </div>
      )}
      {note && <p className="mt-3 text-xs text-muted">{note}</p>}
    </GlassCard>
  );
}
