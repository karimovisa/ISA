"use client";

// ISA — Reviews. Weekly, monthly and yearly reviews built by the same engine as
// the Progress card and the PDF (compareRows + loadReport), so they're always
// fresh — no "Generate" button, nothing stale, every area counted (Strava runs,
// prayer, mood…). The latest three periods show; the rest fold away. Tapping a
// period opens its full review in place, with the PDF and the story to share.

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarRange, ChevronDown, FileText, Share2 } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { AreaTiles } from "@/components/sections/AreaTiles";
import { loadHistory, loadReport, type HistoryItem, type ReportData, type ReportPeriod } from "@/lib/report/data";
import { PERIOD_COPY, isaNote, renderReportPdf, renderStoryPng, saveBlob, shareOrSave } from "@/lib/report/render";
import { formatLocalDate } from "@/lib/datetime";
import { formatSom } from "@/lib/money";
import { useT } from "@/lib/i18n";
import type { Verdict } from "@/lib/progressCompare";

const VISIBLE = 3;
const TONE: Record<Verdict, string> = {
  improving: "text-emerald-400",
  steady: "text-fg/80",
  softening: "text-amber-400",
  in_progress: "text-fg/80",
};

function useTitle() {
  const { t, lang } = useT();
  return (item: Pick<HistoryItem, "period" | "live" | "from" | "to">) => {
    const from = new Date(`${item.from}T00:00:00`);
    const to = new Date(`${item.to}T00:00:00`);
    if (item.period === "year") return item.live ? t("{year} so far", { year: from.getFullYear() }) : String(from.getFullYear());
    if (item.period === "month") return formatLocalDate(from, lang, "monthYear") + (item.live ? ` · ${t("so far")}` : "");
    if (item.live) return t("Last 7 days");
    return `${formatLocalDate(from, lang, "dayMonthShort")} – ${formatLocalDate(to, lang, "dayMonthShort")}`;
  };
}

export function ReviewsSection() {
  const { t } = useT();
  const title = useTitle();
  const [period, setPeriod] = useState<ReportPeriod>("week");
  const [history, setHistory] = useState<Partial<Record<ReportPeriod, HistoryItem[]>>>({});
  const [showAll, setShowAll] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    if (history[period]) return;
    let alive = true;
    void loadHistory(period).then((items) => {
      if (alive) setHistory((h) => ({ ...h, [period]: items }));
    });
    return () => {
      alive = false;
    };
  }, [period, history]);

  const items = history[period];
  const shown = items ? (showAll ? items : items.slice(0, VISIBLE)) : [];

  const verdictLabel = (v: Verdict | null) =>
    v === "improving" ? t(PERIOD_COPY[period].growth) : v === "softening" ? t(PERIOD_COPY[period].slower) : v === "steady" ? t(PERIOD_COPY[period].steady) : t("Quiet");

  return (
    <GlassCard tier="dense" className="mb-4 p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-medium">
          <CalendarRange size={15} className="text-muted" /> {t("Reviews")}
        </h3>
        <div role="tablist" className="flex rounded-full border border-line p-0.5">
          {(["week", "month", "year"] as ReportPeriod[]).map((p) => (
            <button
              key={p}
              role="tab"
              aria-selected={period === p}
              onClick={() => {
                setPeriod(p);
                setShowAll(false);
                setOpen(null);
              }}
              className={`rounded-full px-3 py-1 text-xs transition ${period === p ? "bg-white/10 font-semibold text-fg" : "text-muted hover:text-fg"}`}
            >
              {t(p === "week" ? "Week" : p === "month" ? "Month" : "Year")}
            </button>
          ))}
        </div>
      </div>

      {!items ? (
        <p className="py-4 text-sm text-muted">{t("Loading…")}</p>
      ) : (
        <ul>
          {shown.map((it) => {
            const key = `${it.period}-${it.from}`;
            const isOpen = open === key;
            return (
              <li key={key} className="border-t border-line first:border-0">
                <button onClick={() => setOpen(isOpen ? null : key)} className="flex w-full items-center gap-3 py-3 text-left">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-fg/90">{title(it)}</span>
                    <span className="text-[11px] text-muted">
                      {it.areas ? t("{up} of {n} areas improved", { up: it.ups, n: it.areas }) : t("No activity to compare yet for this period.")}
                    </span>
                  </span>
                  <span className={`shrink-0 text-xs font-semibold ${it.verdict ? TONE[it.verdict] : "text-muted"}`}>{verdictLabel(it.verdict)}</span>
                  <ChevronDown size={15} className={`shrink-0 text-muted transition ${isOpen ? "rotate-180" : ""}`} />
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <ReviewPanel period={it.period} anchor={it.anchor} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </li>
            );
          })}
        </ul>
      )}

      {items && items.length > VISIBLE && (
        <button
          onClick={() => setShowAll((v) => !v)}
          className="mt-2 w-full rounded-xl border border-line py-2 text-xs text-muted transition hover:text-fg"
        >
          {showAll ? t("Show less") : t("Show {n} more", { n: items.length - VISIBLE })}
        </button>
      )}
    </GlassCard>
  );
}

/** One period's full review, in place. */
function ReviewPanel({ period, anchor }: { period: ReportPeriod; anchor: Date }) {
  const { t, lang } = useT();
  const [data, setData] = useState<ReportData | null>(null);
  const [working, setWorking] = useState<"pdf" | "story" | null>(null);

  useEffect(() => {
    let alive = true;
    void loadReport(period, anchor).then((d) => {
      if (alive) setData(d);
    });
    return () => {
      alive = false;
    };
  }, [period, anchor]);

  if (!data) return <p className="pb-4 text-xs text-muted">{t("Loading…")}</p>;

  const stamp = `${data.current.from}_${data.current.to}`;
  const share = async (kind: "pdf" | "story") => {
    setWorking(kind);
    try {
      if (kind === "pdf") saveBlob(await renderReportPdf(data, t, lang), `ISA-${period}-${stamp}.pdf`);
      else await shareOrSave(await renderStoryPng(data, t, lang), `ISA-${period}-${stamp}.png`);
    } finally {
      setWorking(null);
    }
  };

  const best = data.bestDay ? formatLocalDate(new Date(`${data.bestDay.date}T00:00:00`), lang, "weekdayDayMonth") : null;
  const daysTotal = data.days.good + data.days.ok + data.days.off;

  return (
    <div className="space-y-4 pb-5">
      <AreaTiles domains={data.domains} totals={data.totals} />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-white/[0.035] p-3.5 text-sm">
          <p className="mb-2 text-[11px] uppercase tracking-wider text-muted">{t("Money")}</p>
          <div className="flex justify-between"><span className="text-muted">{t("Income")}</span><span className="tabular-nums text-emerald-300">{formatSom(data.money.income)}</span></div>
          <div className="flex justify-between"><span className="text-muted">{t("Expenses")}</span><span className="tabular-nums text-amber-300">{formatSom(data.money.expense)}</span></div>
          {data.money.topCategories.map((c) => (
            <div key={c.category} className="mt-1 flex justify-between text-xs"><span className="text-muted">{t(c.category)}</span><span className="tabular-nums">{formatSom(c.amount)}</span></div>
          ))}
        </div>
        <div className="rounded-2xl bg-white/[0.035] p-3.5 text-sm">
          <p className="mb-2 text-[11px] uppercase tracking-wider text-muted">{t("How the days felt")}</p>
          {daysTotal ? (
            <p>
              <span className="text-emerald-300">{data.days.good}</span> {t("Good day").toLowerCase()} ·{" "}
              <span className="text-fg/80">{data.days.ok}</span> {t("It was okay").toLowerCase()} ·{" "}
              <span className="text-amber-300">{data.days.off}</span> {t("Not my best").toLowerCase()}
            </p>
          ) : (
            <p className="text-muted">{t("No evening check-ins yet.")}</p>
          )}
          <p className="mt-2 text-xs text-muted">{t("{n} active days", { n: data.activeDays })}</p>
          {best && <p className="text-xs text-muted">{t("Most active: {day}", { day: best })}</p>}
        </div>
      </div>

      <p className="border-l-2 border-accent pl-3 text-sm leading-relaxed text-fg/90">{isaNote(data, t)}</p>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => void share("pdf")} disabled={!!working}
          className="flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-1.5 text-xs font-medium text-fg transition hover:bg-white/15 disabled:opacity-50">
          <FileText size={13} /> {working === "pdf" ? t("Working…") : "PDF"}
        </button>
        <button onClick={() => void share("story")} disabled={!!working}
          className="flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-1.5 text-xs font-medium text-fg transition hover:bg-white/15 disabled:opacity-50">
          <Share2 size={13} /> {working === "story" ? t("Working…") : t("Share as Story")}
        </button>
      </div>
    </div>
  );
}
