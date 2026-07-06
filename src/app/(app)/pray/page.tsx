"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { MoonStar, Check, Lock, X } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { PressButton } from "@/components/ui/PressButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { PrayerStats } from "@/components/sections/PrayerStats";
import { usePrayer } from "@/hooks/usePrayer";
import { enablePush } from "@/lib/push";
import { toast } from "@/lib/toast";
import {
  PRAYER_LABELS,
  STATUS_TONE,
  prayerState,
  type PrayerState,
} from "@/lib/prayer";
import type { PrayerName } from "@/lib/types";

export default function PrayPage() {
  const p = usePrayer();

  if (p.prefsLoading) {
    return (
      <div>
        <PageHeader title="Namoz" subtitle="Besh mahal — kuzatib boring." />
        <div className="glass h-64 animate-pulse rounded-3xl" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Namoz" subtitle="Besh mahal — kuzatib boring." />
      {!p.prefs?.activated ? (
        <PrayLocked onActivate={p.savePrefs} />
      ) : (
        <Checklist p={p} />
      )}
    </div>
  );
}

function PrayLocked({
  onActivate,
}: {
  onActivate: (patch: {
    wants_to_pray?: boolean;
    activated?: boolean;
    notifications_enabled?: boolean;
  }) => Promise<void>;
}) {
  const [justOn, setJustOn] = useState(false);
  const [busy, setBusy] = useState(false);

  const activate = async () => {
    setBusy(true);
    await onActivate({ wants_to_pray: true, activated: true });
    setBusy(false);
    setJustOn(true);
  };

  const notify = async (yes: boolean) => {
    setBusy(true);
    if (yes) {
      const res = await enablePush();
      await onActivate({ notifications_enabled: res.ok });
      toast(res.ok ? "Eslatmalar yoqildi." : "Sozlamalardan qayta urinib ko'ring.", res.ok ? "success" : "info");
    } else {
      await onActivate({ notifications_enabled: false });
    }
    setBusy(false);
  };

  if (justOn) {
    return (
      <GlassCard className="max-w-md p-6">
        <h3 className="font-medium">Namoz vaqtlari eslatib turilsinmi?</h3>
        <p className="mt-1 text-sm text-muted">
          Har namoz kirganda telefoningizga xabar boradi.
        </p>
        <div className="mt-4 flex gap-2">
          <PressButton
            onClick={() => notify(true)}
            disabled={busy}
            className="flex-1 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
          >
            Ha, eslatib turing
          </PressButton>
          <PressButton
            onClick={() => notify(false)}
            disabled={busy}
            className="flex-1 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-medium text-fg transition hover:bg-white/15"
          >
            Yo'q
          </PressButton>
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="flex max-w-md flex-col items-center px-6 py-14 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.06]">
        <Lock size={24} className="text-muted" />
      </div>
      <h3 className="text-base font-medium">Namoz bo'limi yopiq</h3>
      <p className="mt-1.5 max-w-xs text-sm text-muted">
        Agar namoz o'qisangiz, bu bo'limni faollashtiring.
      </p>
      <PressButton
        onClick={activate}
        disabled={busy}
        className="mt-5 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
      >
        Faollashtirish
      </PressButton>
    </GlassCard>
  );
}

const ROW_STATE: Record<PrayerState, string> = {
  "past-done": "opacity-100",
  "past-missed": "opacity-100",
  current: "opacity-100",
  future: "opacity-45",
};

function Checklist({ p }: { p: ReturnType<typeof usePrayer> }) {
  if (p.timesLoading) {
    return <div className="glass h-72 animate-pulse rounded-3xl" />;
  }
  if (!p.active) {
    return (
      <EmptyState
        icon={MoonStar}
        title="Vaqtlar hali yuklanmagan"
        description="Namoz vaqtlari har kuni avtomatik yangilanadi. Biroz kuting yoki keyinroq qaytib keling."
      />
    );
  }

  const active = p.active;
  const rows = p.prayers.map((name: PrayerName) => {
    const log = p.logFor(name);
    const ticked = Boolean(log?.ticked_at);
    const state = prayerState(name, active, p.effNow, ticked);
    return { name, log, ticked, state };
  });

  const done = rows.filter((r) => r.ticked).length;
  const missed = rows.filter((r) => r.state === "past-missed").length;

  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
      <GlassCard className="p-6">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MoonStar size={18} className="text-accent" />
            <h3 className="text-sm font-medium">Sirdaryo · bugun</h3>
          </div>
          <span className="text-xs tabular-nums text-muted">
            {done}/5 o'qildi{missed > 0 ? ` · ${missed} qazo` : ""}
          </span>
        </div>

        <ul className="space-y-2">
          {rows.map(({ name, log, state }) => {
            const time = active[name].slice(0, 5);
            const interactive = state === "current";
            return (
              <li
                key={name}
                className={`flex items-center gap-3 rounded-2xl border border-line px-4 py-3 transition ${ROW_STATE[state]} ${
                  interactive ? "bg-accent-soft" : "bg-white/[0.02]"
                }`}
              >
                <button
                  disabled={!interactive}
                  onClick={() => p.tick(name)}
                  aria-label={`${PRAYER_LABELS[name]} belgilash`}
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition ${
                    state === "past-done"
                      ? "border-transparent bg-emerald-500/90 text-white"
                      : state === "past-missed"
                        ? "border-transparent bg-red-500/80 text-white"
                        : interactive
                          ? "border-accent text-transparent hover:bg-accent hover:text-white"
                          : "border-white/20 text-transparent"
                  }`}
                >
                  {state === "past-missed" ? (
                    <X size={14} strokeWidth={3} />
                  ) : (
                    <Check size={14} strokeWidth={3} />
                  )}
                </button>

                <span className="flex-1 text-sm font-medium text-fg">
                  {PRAYER_LABELS[name]}
                </span>

                {state === "past-done" && log ? (
                  <span className={`text-xs font-medium ${STATUS_TONE[log.status]}`}>
                    {log.status}
                  </span>
                ) : state === "past-missed" ? (
                  <span className="text-xs font-medium text-red-400">qazo</span>
                ) : state === "current" ? (
                  <span className="text-xs font-medium text-accent">hozir</span>
                ) : null}

                <span className="w-12 text-right text-sm tabular-nums text-muted">
                  {time}
                </span>
              </li>
            );
          })}
        </ul>
      </GlassCard>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <PrayerStats />
      </motion.div>
    </div>
  );
}
