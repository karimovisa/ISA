"use client";

import { useRef, useState } from "react";
import { FileText, Download, Upload, ChevronDown } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { GlassCard } from "@/components/ui/GlassCard";
import { PressButton } from "@/components/ui/PressButton";
import { formatSom } from "@/lib/money";
import { toast } from "@/lib/toast";
import { useT } from "@/lib/i18n";

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

// Human labels for the readable report — no raw table names ever reach the page.
const DATASET_LABELS: Record<string, string> = {
  goals: "Goals",
  projects: "Projects",
  project_tasks: "Project steps",
  ideas: "Ideas",
  journal_entries: "Journal entries",
  focus_sessions: "Focus sessions",
  sleep_logs: "Sleep logs",
  daily_energy_scores: "Energy scores",
  weekly_reviews: "Weekly reviews",
  habits: "Habits",
  habit_logs: "Habit check-ins",
  mood_logs: "Mood logs",
  todos: "Tasks",
  runs: "Runs (manual)",
  strava_activities: "Runs (Strava)",
  reminders: "Reminders",
  prayer_preferences: "Prayer settings",
  prayer_logs: "Prayer logs",
};

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>]/g, (c) => (c === "&" ? "&amp;" : c === "<" ? "&lt;" : "&gt;"));

export function DataExport() {
  const { t } = useT();
  const [busy, setBusy] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Primary: a readable PDF report (printed → "Save as PDF") ──
  const downloadReport = async () => {
    setBusy(true);
    setNote(null);
    try {
      const counts: Record<string, number> = {};
      for (const tbl of TABLES) {
        const { count } = await supabase.from(tbl).select("*", { count: "exact", head: true });
        counts[tbl] = count ?? 0;
      }
      const [{ data: goals }, { data: txns }, { data: habits }, { data: { user } }] =
        await Promise.all([
          supabase.from("goals").select("title,percentage,archived").order("percentage", { ascending: false }),
          supabase.from("transactions").select("type,amount"),
          supabase.from("habits").select("name,is_active"),
          supabase.auth.getUser(),
        ]);

      const tx = (txns as { type: string; amount: number }[]) ?? [];
      const income = tx.filter((x) => x.type === "income").reduce((s, x) => s + Number(x.amount), 0);
      const expense = tx.filter((x) => x.type === "expense").reduce((s, x) => s + Number(x.amount), 0);
      const activeGoals = ((goals as { title: string; percentage: number; archived: boolean }[]) ?? [])
        .filter((g) => !g.archived);
      const activeHabits = ((habits as { name: string; is_active: boolean }[]) ?? [])
        .filter((h) => h.is_active);

      const name = (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? "";
      const when = new Date().toLocaleDateString([], { year: "numeric", month: "long", day: "numeric" });

      const countRows = TABLES.filter((tbl) => counts[tbl] > 0)
        .map((tbl) => `<tr><td>${esc(DATASET_LABELS[tbl] ?? tbl)}</td><td class="num">${counts[tbl]}</td></tr>`)
        .join("");

      const goalRows = activeGoals.length
        ? activeGoals.map((g) => `<li><span>${esc(g.title)}</span><b>${Math.round(g.percentage ?? 0)}%</b></li>`).join("")
        : `<li class="muted">No active goals.</li>`;

      const habitList = activeHabits.length
        ? activeHabits.map((h) => `<span class="chip">${esc(h.name)}</span>`).join("")
        : `<span class="muted">No active habits.</span>`;

      const html = `<!doctype html><html><head><meta charset="utf-8"><title>ISA — Life Report</title>
<style>
  * { box-sizing: border-box; }
  body { font: 14px/1.6 -apple-system, Segoe UI, Roboto, sans-serif; color: #1a1a1a; margin: 0; padding: 40px; }
  h1 { font-size: 26px; margin: 0 0 4px; letter-spacing: -0.02em; }
  .sub { color: #666; margin: 0 0 28px; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em; color: #888; margin: 28px 0 10px; border-bottom: 1px solid #eee; padding-bottom: 6px; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 5px 0; border-bottom: 1px solid #f2f2f2; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; }
  ul { list-style: none; padding: 0; margin: 0; }
  li { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #f2f2f2; }
  .money { display: flex; gap: 32px; margin-top: 8px; }
  .money div { }
  .money .k { color: #888; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; }
  .money .v { font-size: 20px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .chip { display: inline-block; background: #f4f4f5; border-radius: 999px; padding: 3px 12px; margin: 0 6px 6px 0; font-size: 13px; }
  .muted { color: #999; }
  footer { margin-top: 36px; color: #aaa; font-size: 12px; border-top: 1px solid #eee; padding-top: 12px; }
  @media print { body { padding: 24px; } }
</style></head><body>
  <h1>ISA — Your Life Report</h1>
  <p class="sub">${esc(name)} · ${esc(when)}</p>

  <h2>Money</h2>
  <div class="money">
    <div><div class="k">Income</div><div class="v">${esc(formatSom(income))}</div></div>
    <div><div class="k">Expenses</div><div class="v">${esc(formatSom(expense))}</div></div>
    <div><div class="k">Balance</div><div class="v">${esc(formatSom(income - expense))}</div></div>
  </div>

  <h2>Active goals</h2>
  <ul>${goalRows}</ul>

  <h2>Active habits</h2>
  <div>${habitList}</div>

  <h2>Everything ISA is tracking</h2>
  <table>${countRows || `<tr><td class="muted">Nothing recorded yet.</td></tr>`}</table>

  <footer>Generated by ISA · islom-os.vercel.app · This report reflects your data at the time of export.</footer>
</body></html>`;

      const w = window.open("", "_blank");
      if (!w) {
        toast(t("Allow pop-ups to download your report."), "error");
        setBusy(false);
        return;
      }
      w.document.write(html);
      w.document.close();
      w.focus();
      setTimeout(() => w.print(), 500);
      setNote(t("Report opened — choose \"Save as PDF\" in the print dialog."));
    } catch {
      setNote(t("Couldn't build the report. Check your connection and try again."));
    } finally {
      setBusy(false);
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
          <h3 className="text-sm font-medium">{t("Backup & restore")}</h3>
          <p className="text-xs text-muted">{t("A readable report of your progress — download it any time.")}</p>
        </div>
      </div>

      <div className="mt-3">
        <PressButton
          onClick={downloadReport}
          disabled={busy}
          className="flex items-center gap-2 rounded-xl bg-accent px-3.5 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
        >
          <FileText size={15} />
          {busy ? t("Working…") : t("Download PDF report")}
        </PressButton>
      </div>

      {/* Advanced: the raw-data tools most people never need. */}
      <button
        onClick={() => setAdvanced((v) => !v)}
        className="mt-3 flex items-center gap-1 text-xs text-muted transition hover:text-fg"
      >
        <ChevronDown size={13} className={advanced ? "rotate-180 transition" : "transition"} />
        {t("Advanced")}
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
