"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { PressButton } from "@/components/ui/PressButton";
import { MosqueIcon } from "@/components/ui/MosqueIcon";
import { supabase } from "@/lib/supabase/client";
import { enablePush } from "@/lib/push";
import { toast } from "@/lib/toast";
import type { PrayerPreferences } from "@/lib/types";

const btnPrimary =
  "flex-1 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50";
const btnGhost =
  "flex-1 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-medium text-fg transition hover:bg-white/15 disabled:opacity-50";

export function OnboardingPrayerModal() {
  // Lightweight: only reads/writes prayer_preferences (no times/logs), since
  // this mounts on every page.
  const [prefs, setPrefs] = useState<PrayerPreferences | null>(null);
  const [prefsLoading, setPrefsLoading] = useState(true);
  const [step, setStep] = useState<"ask" | "notify">("ask");
  const [why, setWhy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    supabase
      .from("prayer_preferences")
      .select("*")
      .maybeSingle()
      .then(({ data }) => {
        setPrefs((data as PrayerPreferences) ?? null);
        setPrefsLoading(false);
      });
  }, []);

  const savePrefs = async (patch: Partial<PrayerPreferences>) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase
      .from("prayer_preferences")
      .upsert(
        { user_id: user.id, updated_at: new Date().toISOString(), ...patch },
        { onConflict: "user_id" }
      )
      .select()
      .single();
    if (error) {
      toast("Couldn't save.", "error");
      return;
    }
    setPrefs(data as PrayerPreferences);
  };

  const show =
    !closed && !prefsLoading && (prefs === null || prefs.wants_to_pray === null);

  const yesPray = async () => {
    setBusy(true);
    await savePrefs({ wants_to_pray: true, activated: true });
    setBusy(false);
    setStep("notify");
  };

  const noPray = async () => {
    setBusy(true);
    await savePrefs({ wants_to_pray: false, activated: false });
    setBusy(false);
    setClosed(true);
  };

  const enableNotify = async () => {
    setBusy(true);
    const res = await enablePush();
    await savePrefs({ notifications_enabled: res.ok });
    setBusy(false);
    if (res.ok) toast("Prayer reminders enabled.", "success");
    else toast("Couldn't enable — try again from Settings.", "info");
    setClosed(true);
  };

  const skipNotify = async () => {
    setBusy(true);
    await savePrefs({ notifications_enabled: false });
    setBusy(false);
    setClosed(true);
  };

  return (
    <Modal
      open={show}
      onClose={() => {}}
      title={step === "ask" ? "Do you pray?" : "Prayer reminders?"}
    >
      <div className="space-y-5">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft">
          <MosqueIcon size={22} className="text-accent" />
        </div>

        {step === "ask" ? (
          <>
            <p className="text-sm text-muted">
              ISA helps you keep the five daily prayers — times, check-offs and
              stats, all in one place.
            </p>
            {why && (
              <p className="rounded-xl bg-white/[0.04] p-3 text-sm text-fg/90">
                Praying unlocks helpful tools here. Tap “Yes”.
              </p>
            )}
            <div className="flex gap-2">
              <PressButton onClick={yesPray} disabled={busy} className={btnPrimary}>
                Yes
              </PressButton>
              <PressButton onClick={noPray} disabled={busy} className={btnGhost}>
                No
              </PressButton>
              <PressButton
                onClick={() => setWhy(true)}
                disabled={busy}
                className={btnGhost}
              >
                Why?
              </PressButton>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-muted">
              Want a notification when each prayer begins?
            </p>
            <div className="flex gap-2">
              <PressButton
                onClick={enableNotify}
                disabled={busy}
                className={btnPrimary}
              >
                Yes, remind me
              </PressButton>
              <PressButton
                onClick={skipNotify}
                disabled={busy}
                className={btnGhost}
              >
                No
              </PressButton>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
