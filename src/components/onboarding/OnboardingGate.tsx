"use client";

import { useCallback, useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { Modal } from "@/components/ui/Modal";
import { PressButton } from "@/components/ui/PressButton";
import { useT } from "@/lib/i18n";
import { SpotlightTour, type TourStep } from "@/components/onboarding/SpotlightTour";

// One walkthrough of the real nav. Steps whose target isn't visible on the
// current viewport are skipped automatically (mobile bar vs desktop rail).
const NAV_TOUR: TourStep[] = [
  {
    selector: '[data-tour="nav-bar"]',
    title: "Your navigation",
    body: "Every part of ISA is one tap away from here.",
  },
  {
    selector: '[data-tour="nav-/"]',
    title: "Dashboard",
    body: "Your day at a glance — momentum, sleep, to-dos and a daily quote.",
  },
  {
    selector: '[data-tour="nav-/habits"]',
    title: "Habits",
    body: "Check in each day and build streaks. A missed day breaks the streak.",
  },
  {
    selector: '[data-tour="nav-/money"]',
    title: "Money",
    body: "Track income, expenses and savings goals — with one-tap quick-add.",
  },
  {
    selector: '[data-tour="nav-/pray"]',
    title: "Prayer",
    body: "Follow the five daily prayers and keep your record.",
  },
  {
    selector: '[data-tour="nav-/focus"]',
    title: "Focus",
    body: "A distraction-free timer that logs your deep-work sessions for you.",
  },
  {
    selector: '[data-tour="nav-/settings"]',
    title: "Settings",
    body: "Theme, language, notifications, reminders and your data live here.",
  },
  {
    selector: '[data-tour="nav-menu"]',
    title: "Menu",
    body: "On your phone, Money, Prayer, Settings and more open from this Menu.",
  },
];

export function OnboardingGate() {
  const { user } = useAuth();
  const { t } = useT();
  const [welcome, setWelcome] = useState(false);
  const [tour, setTour] = useState(false);

  // Show the welcome modal once, when the profile has never been onboarded.
  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("onboarded_at")
      .maybeSingle()
      .then(({ data, error }) => {
        if (!error && (!data || data.onboarded_at === null)) setWelcome(true);
      });
  }, [user]);

  // The Help (?) button re-launches the tour on demand.
  useEffect(() => {
    const onStart = () => setTour(true);
    window.addEventListener("isa:start-tour", onStart);
    return () => window.removeEventListener("isa:start-tour", onStart);
  }, []);

  const markOnboarded = useCallback(async () => {
    if (!user) return;
    await supabase
      .from("profiles")
      .upsert(
        { user_id: user.id, onboarded_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
  }, [user]);

  const startTour = () => {
    setWelcome(false);
    void markOnboarded();
    // Restart the tour from the beginning when launched from the welcome modal.
    try {
      localStorage.removeItem("isa_tour_step");
    } catch {}
    setTour(true);
  };

  const skip = () => {
    setWelcome(false);
    void markOnboarded();
  };

  return (
    <>
      <Modal open={welcome} onClose={skip} title={t("Welcome to ISA")}>
        <div className="space-y-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft">
            <Sparkles size={22} className="text-accent" />
          </div>
          <p className="text-sm leading-relaxed text-muted">
            {t(
              "Your Personal Life Operating System. Let's take a quick tour so nothing stays hidden."
            )}
          </p>
          <div className="flex gap-2 pt-1">
            <PressButton
              onClick={startTour}
              className="flex-1 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
            >
              {t("Start tour")}
            </PressButton>
            <PressButton
              onClick={skip}
              className="flex-1 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-medium text-fg transition hover:bg-white/15"
            >
              {t("Skip for now")}
            </PressButton>
          </div>
        </div>
      </Modal>

      <SpotlightTour
        steps={NAV_TOUR}
        open={tour}
        onClose={() => setTour(false)}
      />
    </>
  );
}
