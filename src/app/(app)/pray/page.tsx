"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Bell, BellOff, Check, Lock, X } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { PressButton } from "@/components/ui/PressButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { MosqueIcon } from "@/components/ui/MosqueIcon";
import { PrayerStats } from "@/components/sections/PrayerStats";
import { usePrayer } from "@/hooks/usePrayer";
import { enablePush } from "@/lib/push";
import { toast } from "@/lib/toast";
import {
  PRAYER_LABELS,
  STATUS_TONE,
  STATUS_LABEL,
  prayerState,
  nextPrayer,
  fmtCountdown,
  type PrayerState,
} from "@/lib/prayer";
import { todayISO } from "@/lib/datetime";
import { useT } from "@/lib/i18n";
import type { PrayerName } from "@/lib/types";

export default function PrayPage() {
  const p = usePrayer();

  if (p.prefsLoading) {
    return (
      <div>
        <PageHeader title="Prayer" subtitle="Five daily prayers — keep track." />
        <div className="glass h-64 animate-pulse rounded-3xl" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Prayer" subtitle="Five daily prayers — keep track." />
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
  const { t } = useT();
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
      toast(res.ok ? "Reminders enabled." : "Enable it later from Settings.", res.ok ? "success" : "info");
    } else {
      await onActivate({ notifications_enabled: false });
    }
    setBusy(false);
  };

  if (justOn) {
    return (
      <GlassCard className="max-w-md p-6">
        <h3 className="font-medium">{t("Get prayer reminders?")}</h3>
        <p className="mt-1 text-sm text-muted">
          {t("You'll get a notification when each prayer begins.")}
        </p>
        <div className="mt-4 flex gap-2">
          <PressButton
            onClick={() => notify(true)}
            disabled={busy}
            className="flex-1 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
          >
            {t("Yes, remind me")}
          </PressButton>
          <PressButton
            onClick={() => notify(false)}
            disabled={busy}
            className="flex-1 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-medium text-fg transition hover:bg-white/15"
          >
            {t("No")}
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
      <h3 className="text-base font-medium">{t("Prayer is locked")}</h3>
      <p className="mt-1.5 max-w-xs text-sm text-muted">
        {t("If you pray, activate this section to start tracking.")}
      </p>
      <PressButton
        onClick={activate}
        disabled={busy}
        className="mt-5 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
      >
        {t("Activate")}
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

function ReminderToggle({ p }: { p: ReturnType<typeof usePrayer> }) {
  const { t } = useT();
  const [busy, setBusy] = useState(false);
  const on = Boolean(p.prefs?.notifications_enabled);

  const toggle = async () => {
    setBusy(true);
    if (on) {
      await p.savePrefs({ notifications_enabled: false });
      toast(t("Reminders off."), "info");
    } else {
      const res = await enablePush();
      await p.savePrefs({ notifications_enabled: res.ok });
      toast(
        res.ok ? t("Reminders enabled.") : t("Couldn't enable — check browser notification permission."),
        res.ok ? "success" : "info"
      );
    }
    setBusy(false);
  };

  return (
    <button
      onClick={toggle}
      disabled={busy}
      aria-label={on ? t("Turn off prayer reminders") : t("Turn on prayer reminders")}
      title={on ? t("Reminders on") : t("Reminders off")}
      className={`flex h-8 w-8 items-center justify-center rounded-full border transition disabled:opacity-50 ${
        on
          ? "border-accent/40 bg-accent-soft text-accent"
          : "border-line text-muted hover:bg-white/[0.06]"
      }`}
    >
      {on ? <Bell size={15} /> : <BellOff size={15} />}
    </button>
  );
}

function Checklist({ p }: { p: ReturnType<typeof usePrayer> }) {
  const { t } = useT();
  if (p.timesLoading) {
    return <div className="glass h-72 animate-pulse rounded-3xl" />;
  }
  if (!p.active) {
    return (
      <EmptyState
        icon={MosqueIcon}
        title="Times not loaded yet"
        description="Prayer times refresh automatically every day. Check back in a moment."
      />
    );
  }

  const active = p.active;
  const dayLabel =
    p.activeDate === todayISO()
      ? t("today")
      : new Date(p.activeDate).toLocaleDateString([], {
          weekday: "short",
          month: "short",
          day: "numeric",
        });
  const next = nextPrayer(active, p.effNow);
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
            <MosqueIcon size={18} className="text-accent" />
            <h3 className="text-sm font-medium">Sirdaryo · {dayLabel}</h3>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs tabular-nums text-muted">
              {done}/5 {t("done")}
              {missed > 0 ? ` · ${missed} ${t("missed")}` : ""}
            </span>
            <ReminderToggle p={p} />
          </div>
        </div>

        {/* Next prayer countdown */}
        <div className="mb-4 flex items-baseline justify-between rounded-2xl bg-accent-soft px-4 py-3">
          <span className="text-xs uppercase tracking-wider text-muted">
            {t("Next")} · {PRAYER_LABELS[next.name]}
          </span>
          <span className="text-lg font-bold tabular-nums text-fg">
            {fmtCountdown(next.inMin)}
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
                    {t(STATUS_LABEL[log.status])}
                  </span>
                ) : state === "past-missed" ? (
                  <span className="text-xs font-medium text-red-400">
                    {t("missed")}
                  </span>
                ) : state === "current" ? (
                  <span className="text-xs font-medium text-accent">
                    {t("now")}
                  </span>
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
