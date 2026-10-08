"use client";

// ISA — Area tiles. One tile per life area that has data in either window: the
// current figure, its change, and what it was before. Shared by the Progress
// report card and every review, so the numbers look the same everywhere.

import { Timer, Repeat, ListChecks, BookOpen, Footprints, Moon, Sunrise, Smile, type LucideIcon } from "lucide-react";
import { useT } from "@/lib/i18n";
import type { DomainKey, DomainResult, windowTotals } from "@/lib/progressCompare";

type Totals = ReturnType<typeof windowTotals>;
type T = (key: string, vars?: Record<string, string | number>) => string;

export const AREA_META: Record<DomainKey, { label: string; Icon: LucideIcon; fmt: (v: number, t: T) => string }> = {
  focus: { label: "Focus", Icon: Timer, fmt: (m, t) => `${(m / 60).toFixed(1)}${t("h")}` },
  habits: { label: "Habits", Icon: Repeat, fmt: (n) => `${Math.round(n)}` },
  tasks: { label: "Tasks", Icon: ListChecks, fmt: (n) => `${Math.round(n)}` },
  journal: { label: "Journal", Icon: BookOpen, fmt: (n) => `${Math.round(n)}` },
  running: { label: "Running", Icon: Footprints, fmt: (km) => `${km.toFixed(1)} km` },
  sleep: { label: "Sleep", Icon: Moon, fmt: (h, t) => `${h.toFixed(1)}${t("h")}` },
  prayer: { label: "Prayer", Icon: Sunrise, fmt: (n) => `${Math.round(n)}` },
  mood: { label: "Mood", Icon: Smile, fmt: (v) => `${v.toFixed(1)}/5` },
};

/** "+18%" / "new" with its tone. */
export function deltaOf(d: DomainResult, t: T): { text: string; tone: string } {
  const tone = d.direction === "up" ? "text-emerald-400" : d.direction === "down" ? "text-amber-400" : "text-muted";
  return { text: d.changePct == null ? t("new") : `${d.changePct > 0 ? "+" : ""}${d.changePct}%`, tone };
}

export function AreaTiles({ domains, totals }: { domains: DomainResult[]; totals: { current: Totals; previous: Totals } }) {
  const { t } = useT();
  if (!domains.length) return null;
  return (
    <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      {domains.map((d) => {
        const { Icon, label, fmt } = AREA_META[d.key];
        const cur = totals.current[d.key];
        const prev = totals.previous[d.key];
        const delta = deltaOf(d, t);
        return (
          <li key={d.key} className="rounded-2xl bg-white/[0.035] px-3.5 py-3">
            <div className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted">
                <Icon size={13} className="shrink-0" />
                <span className="truncate">{t(label)}</span>
              </span>
              <span className={`shrink-0 text-xs font-semibold tabular-nums ${delta.tone}`}>{delta.text}</span>
            </div>
            <div className="mt-1.5 text-xl font-bold tabular-nums tracking-tight">{cur != null ? fmt(cur, t) : "—"}</div>
            <div className="mt-0.5 text-[11px] tabular-nums text-muted">
              {t("before")} {prev != null ? fmt(prev, t) : "—"}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
