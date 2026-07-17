"use client";

// ISA — "What ISA knows about you". Trust is built by showing the working, not by
// claiming intelligence. Every line here is a real fact from the engine, with its
// confidence attached — and the gaps are stated just as plainly as the findings.

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Sparkles, Check, Plus, Brain, Clock } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { useCollection } from "@/hooks/useCollection";
import { supabase } from "@/lib/supabase/client";
import { computeCoverage, coverageVerdict } from "@/lib/coverage";
import {
  loadIntelligenceContext, buildPersonalization, computeAllScores, crossModuleLinks,
  type IntelligenceContext,
} from "@/lib/intelligence";
import { useT } from "@/lib/i18n";
import type { Goal, JournalEntry, FocusSession, Transaction, Habit } from "@/lib/types";

type Fact = { text: string; confidence: number };

const PART = (h: number) => (h < 12 ? "morning" : h < 18 ? "afternoon" : "evening");

function confLabel(c: number, t: (s: string, v?: Record<string, string | number>) => string) {
  if (c >= 0.7) return t("{n}% confidence", { n: Math.round(c * 100) });
  if (c >= 0.4) return t("Moderate confidence");
  return t("Low confidence — needs more data");
}

export default function KnowsPage() {
  const { t } = useT();
  const [ctx, setCtx] = useState<IntelligenceContext | null>(null);
  const [counts, setCounts] = useState({ sleepLogs: 0, moodLogs: 0, runs: 0 });

  const goals = useCollection<Goal>("goals");
  const journal = useCollection<JournalEntry>("journal_entries");
  const focus = useCollection<FocusSession>("focus_sessions");
  const txns = useCollection<Transaction>("transactions");
  const habits = useCollection<Habit>("habits");

  useEffect(() => {
    void loadIntelligenceContext().then(setCtx);
    (async () => {
      const [{ data: sl }, { data: ml }, { data: rl }] = await Promise.all([
        supabase.from("sleep_logs").select("id"),
        supabase.from("mood_logs").select("id"),
        supabase.from("runs").select("id"),
      ]);
      setCounts({
        sleepLogs: ((sl as unknown[]) ?? []).length,
        moodLogs: ((ml as unknown[]) ?? []).length,
        runs: ((rl as unknown[]) ?? []).length,
      });
    })();
  }, []);

  const coverage = computeCoverage({
    goals: goals.data.length,
    habits: habits.data.length,
    focusSessions: focus.data.length,
    journalEntries: journal.data.length,
    transactions: txns.data.length,
    sleepLogs: counts.sleepLogs,
    moodLogs: counts.moodLogs,
    runs: counts.runs,
  });

  // ── Facts, drawn only from what the engine actually derived ──
  const facts: Fact[] = [];
  if (ctx) {
    const p = buildPersonalization(ctx);
    if (p.activeHours.length && p.sample >= 6) {
      const h = p.activeHours[0];
      facts.push({
        text: t("You're most active around {h}:00 — your {part}.", { h, part: t(PART(h)) }),
        confidence: p.explanation.confidence,
      });
    }
    if (p.preferredModules.length) {
      facts.push({
        text: t("You lean on {module} more than anything else.", { module: t(p.preferredModules[0].module) }),
        confidence: Math.min(0.8, 0.4 + p.preferredModules[0].weight),
      });
    }
    if (p.planningStyle !== "unknown")
      facts.push({
        text:
          p.planningStyle === "morning"
            ? t("You act early — mornings are when you move.")
            : p.planningStyle === "evening"
              ? t("You act late — evenings are when you move.")
              : t("Your activity is spread through the day, not clustered."),
        confidence: 0.6,
      });

    for (const s of computeAllScores(ctx).filter((x) => x.confidence >= 0.4).slice(0, 3))
      facts.push({ text: `${t(s.label)}: ${s.value}/100 — ${s.reason}`, confidence: s.confidence });

    for (const l of crossModuleLinks(ctx).slice(0, 3))
      facts.push({ text: l.detail, confidence: l.strength });
  }

  return (
    <div>
      <PageHeader title="What ISA knows" subtitle="Everything here comes from your own data — with its confidence shown." />

      {/* Coverage — the honest headline */}
      <GlassCard className="mb-4 p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Brain size={16} className="text-accent" />
            <h2 className="text-sm font-semibold">{t("Life Coverage")}</h2>
          </div>
          <span className="text-3xl font-bold tabular-nums">{coverage.pct}%</span>
        </div>
        <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
          <motion.div
            className="h-full rounded-full bg-accent"
            initial={{ width: 0 }}
            animate={{ width: `${coverage.pct}%` }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
        <p className="text-xs leading-relaxed text-muted">{t(coverageVerdict(coverage.pct))}</p>

        <div className="mt-4 grid gap-1.5 sm:grid-cols-2">
          {coverage.areas.map((a) => (
            <div key={a.key} className="flex items-center gap-2 text-sm">
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                  a.covered ? "bg-accent/20 text-accent" : "bg-white/[0.06] text-muted"
                }`}
              >
                {a.covered ? <Check size={10} strokeWidth={3.5} /> : <Plus size={10} strokeWidth={3} />}
              </span>
              <span className={a.covered ? "text-fg/85" : "text-muted"}>{t(a.label)}</span>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* What's missing, and what it would unlock */}
      {coverage.missing.length > 0 && (
        <GlassCard className="mb-4 p-5">
          <h2 className="mb-1 text-sm font-semibold">{t("What ISA is still missing")}</h2>
          <p className="mb-3 text-xs text-muted">
            {t("Each one you add makes ISA's insights real rather than generic.")}
          </p>
          <div className="space-y-2">
            {coverage.missing.map((a) => (
              <Link key={a.key} href={a.href}>
                <div className="flex items-start gap-3 rounded-2xl border border-line bg-white/[0.02] p-3 transition hover:bg-white/[0.05]">
                  <Plus size={14} className="mt-0.5 shrink-0 text-accent" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{t(a.label)}</p>
                    <p className="text-xs leading-relaxed text-muted">{t(a.unlocks)}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </GlassCard>
      )}

      {/* The findings */}
      <GlassCard className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles size={15} className="text-accent" />
          <h2 className="text-sm font-semibold">{t("What ISA has learned")}</h2>
        </div>

        {!ctx ? (
          <p className="flex items-center gap-2 text-xs text-muted">
            <Clock size={12} /> {t("Reading your history…")}
          </p>
        ) : facts.length === 0 ? (
          <p className="text-sm leading-relaxed text-muted">
            {t("Nothing solid yet — ISA won't invent a pattern it hasn't seen. Keep using it for a week and real findings appear here.")}
          </p>
        ) : (
          <ul className="space-y-3">
            {facts.map((f, i) => (
              <li key={i} className="flex gap-2.5">
                <Check size={14} className="mt-0.5 shrink-0 text-accent" />
                <div className="min-w-0">
                  <p className="text-sm leading-relaxed text-fg/90">{f.text}</p>
                  <p className="mt-0.5 text-[11px] text-muted">{confLabel(f.confidence, t)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </GlassCard>
    </div>
  );
}
