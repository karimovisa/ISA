"use client";

import { useEffect, useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { useEntitlements } from "@/components/EntitlementProvider";
import { retrieveReviews, generateReview, type Review, type ReviewPeriod } from "@/lib/reviews";
import { formatSom } from "@/lib/money";
import { useT } from "@/lib/i18n";

const num = (p: Record<string, unknown>, k: string) => (typeof p[k] === "number" ? (p[k] as number) : 0);
const metrics = (p: Record<string, unknown>): [string, string][] => [
  ["Focus", `${num(p, "focus_hours")}h`],
  ["Saved", formatSom(num(p, "net_savings"))],
  ["Goals done", `${num(p, "goals_completed")}`],
  ["Journal", `${num(p, "journal_entries")}`],
  ["Habits", `${num(p, "habits_completed")}`],
  ["Run", `${num(p, "run_km")}km`],
];

export function ReviewsCard() {
  const { canUse } = useEntitlements();
  const { t } = useT();
  const [monthly, setMonthly] = useState<Review[]>([]);
  const [yearly, setYearly] = useState<Review[]>([]);
  const [busy, setBusy] = useState(false);
  const pro = canUse("monthly_review");

  const load = () => { retrieveReviews("monthly").then(setMonthly); retrieveReviews("yearly").then(setYearly); };
  useEffect(() => { if (pro) load(); }, [pro]);
  if (!pro) return null;

  const gen = async (period: ReviewPeriod) => {
    setBusy(true);
    const key = period === "monthly" ? new Date().toISOString().slice(0, 7) : String(new Date().getFullYear());
    await generateReview(period, key);
    load();
    setBusy(false);
  };

  return (
    <GlassCard className="p-6">
      <h3 className="mb-4 text-sm font-medium">{t("Reviews")}</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <Block title={monthly[0] ? `${t("Month")} · ${monthly[0].period_key}` : t("This month")} p={monthly[0]?.payload} onGen={() => gen("monthly")} busy={busy} t={t} />
        <Block title={yearly[0] ? `${t("Year")} · ${yearly[0].period_key}` : t("This year")} p={yearly[0]?.payload} onGen={() => gen("yearly")} busy={busy} t={t} />
      </div>
    </GlassCard>
  );
}

function Block({ title, p, onGen, busy, t }: { title: string; p?: Record<string, unknown>; onGen: () => void; busy: boolean; t: (s: string) => string }) {
  const ach = p && Array.isArray(p.achievements) ? (p.achievements as string[]) : [];
  return (
    <div className="rounded-2xl border border-line p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted">{title}</span>
        <button onClick={onGen} disabled={busy} className="text-xs text-accent transition hover:underline disabled:opacity-50">{busy ? "…" : t("Generate")}</button>
      </div>
      {p ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            {metrics(p).map(([l, v]) => (
              <div key={l}><p className="text-[11px] text-muted">{t(l)}</p><p className="truncate text-sm font-semibold tabular-nums">{v}</p></div>
            ))}
          </div>
          {ach.length > 0 && <p className="mt-3 text-xs text-muted">🏔 {ach.slice(0, 3).join(" · ")}</p>}
        </>
      ) : (
        <p className="text-xs text-muted">{t("Tap Generate to build it from your data.")}</p>
      )}
    </div>
  );
}
