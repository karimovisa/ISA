"use client";

import { useEffect, useState } from "react";
import { Check, Sparkles, Rocket, ArrowUpRight } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { GlassCard } from "@/components/ui/GlassCard";
import { PressButton } from "@/components/ui/PressButton";
import { useEntitlements } from "@/components/EntitlementProvider";
import { FEATURES, PLAN_LABELS, STATUS_LABELS } from "@/lib/entitlements";
import { getPricing, getAiReadyStats, formatUzs, type Pricing, type AiReadyStats } from "@/lib/billing";

const openUpgrade = () => window.dispatchEvent(new Event("isa:open-upgrade"));

export function SubscriptionSection() {
  const { plan, status, entitlements, loading } = useEntitlements();
  const [sub, setSub] = useState<{ founding_member?: boolean; expires_at?: string | null } | null>(null);
  const [price, setPrice] = useState<Pricing | null>(null);
  const [stats, setStats] = useState<AiReadyStats | null>(null);

  useEffect(() => {
    supabase.from("subscriptions").select("founding_member,expires_at").maybeSingle().then(({ data }) => setSub(data as never));
    getPricing().then(setPrice);
    getAiReadyStats().then(setStats);
  }, []);

  const feats = entitlements?.features ?? {};
  const isPro = plan !== "free";
  const ready = stats ? [
    ["Life events", stats.life_events], ["Memories", stats.memories], ["Patterns", stats.patterns],
    ["Connections", stats.connections], ["Insights", stats.insights], ["Timeline", stats.timeline],
  ] as [string, number][] : [];

  return (
    <GlassCard className="p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-muted">Subscription</h3>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="text-2xl font-bold">{PLAN_LABELS[plan] ?? plan}</span>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-muted">{STATUS_LABELS[status] ?? status}</span>
            {sub?.founding_member && (
              <span className="flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent"><Rocket size={11} /> Founding Member</span>
            )}
          </div>
        </div>
        {!isPro && (
          <PressButton onClick={openUpgrade} className="flex shrink-0 items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110">
            <Sparkles size={15} /> Unlock Pro
          </PressButton>
        )}
      </div>

      {sub?.expires_at && (
        <p className="mb-3 text-xs text-muted">Renews {new Date(sub.expires_at).toLocaleDateString()}</p>
      )}

      {/* AI-Ready — real numbers from the engine */}
      {!isPro && ready.length > 0 && (
        <button onClick={openUpgrade} className="mb-4 block w-full rounded-2xl border border-line bg-white/[0.02] p-4 text-left transition hover:bg-white/[0.04]">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-fg/80"><Sparkles size={12} className="text-accent" /> Your AI is ready <ArrowUpRight size={12} className="ml-auto text-muted" /></p>
          <div className="grid grid-cols-3 gap-2">
            {ready.map(([l, v]) => (
              <div key={l} className="text-center"><div className="text-base font-bold tabular-nums">{v}</div><div className="text-[10px] text-muted">{l}</div></div>
            ))}
          </div>
        </button>
      )}

      {/* Feature list — Pro items read "Ready", never "Locked" */}
      {loading ? (
        <div className="h-24 animate-pulse rounded-2xl bg-white/5" />
      ) : (
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {Object.entries(FEATURES).map(([key, label]) => {
            const on = feats[key]?.enabled;
            return (
              <div key={key} className="flex items-center gap-2 text-sm">
                {on ? <Check size={15} className="shrink-0 text-emerald-400" /> : <Sparkles size={13} className="shrink-0 text-accent/70" />}
                <span className={on ? "text-fg/90" : "text-muted"}>{label}</span>
                {!on && <span className="ml-auto text-[10px] font-medium text-accent">Ready</span>}
              </div>
            );
          })}
        </div>
      )}

      {!isPro && (
        <p className="mt-4 text-center text-xs text-muted">
          Everything above stays free forever. Pro unlocks the intelligence — {price ? formatUzs(price.amount) : ""}/mo, launch price locked.
        </p>
      )}
    </GlassCard>
  );
}
