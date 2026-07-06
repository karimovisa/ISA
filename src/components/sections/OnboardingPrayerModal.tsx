"use client";

import { useState } from "react";
import { MoonStar } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { PressButton } from "@/components/ui/PressButton";
import { usePrayer } from "@/hooks/usePrayer";
import { enablePush } from "@/lib/push";
import { toast } from "@/lib/toast";

const btnPrimary =
  "flex-1 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50";
const btnGhost =
  "flex-1 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-medium text-fg transition hover:bg-white/15 disabled:opacity-50";

export function OnboardingPrayerModal() {
  const { prefs, prefsLoading, savePrefs } = usePrayer();
  const [step, setStep] = useState<"ask" | "notify">("ask");
  const [why, setWhy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [closed, setClosed] = useState(false);

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
    if (res.ok) toast("Namoz eslatmalari yoqildi.", "success");
    else toast("Bildirishnoma yoqilmadi — Sozlamalardan qayta urinib ko'ring.", "info");
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
      title={step === "ask" ? "Namoz o'qiysizmi?" : "Eslatib turilsinmi?"}
    >
      <div className="space-y-5">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft">
          <MoonStar size={22} className="text-accent" />
        </div>

        {step === "ask" ? (
          <>
            <p className="text-sm text-muted">
              ISA sizga 5 mahal namozni kuzatishda yordam beradi — vaqtlar,
              belgilash va statistika bilan.
            </p>
            {why && (
              <p className="rounded-xl bg-white/[0.04] p-3 text-sm text-fg/90">
                Namoz o'qisangiz sizga qulayliklar bor. “Ha” tugmasini bosing.
              </p>
            )}
            <div className="flex gap-2">
              <PressButton onClick={yesPray} disabled={busy} className={btnPrimary}>
                Ha
              </PressButton>
              <PressButton onClick={noPray} disabled={busy} className={btnGhost}>
                Yo'q
              </PressButton>
              <PressButton
                onClick={() => setWhy(true)}
                disabled={busy}
                className={btnGhost}
              >
                Nega?
              </PressButton>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-muted">
              Har namoz kirganda telefoningizga eslatma yuboraylikmi?
            </p>
            <div className="flex gap-2">
              <PressButton
                onClick={enableNotify}
                disabled={busy}
                className={btnPrimary}
              >
                Ha, eslatib turing
              </PressButton>
              <PressButton
                onClick={skipNotify}
                disabled={busy}
                className={btnGhost}
              >
                Yo'q
              </PressButton>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
