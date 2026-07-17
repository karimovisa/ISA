"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Sun, Moon, SunMoon } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useTheme, type GirlsMode } from "@/components/ThemeProvider";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { Sidebar } from "@/components/layout/Sidebar";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { OnboardingPrayerModal } from "@/components/sections/OnboardingPrayerModal";
import { OnboardingGate } from "@/components/onboarding/OnboardingGate";
import { SetupNotice } from "@/components/layout/SetupNotice";
import { QuickCapture } from "@/components/QuickCapture";
import { ModuleGate } from "@/components/ModuleGate";
import { IsaLogo } from "@/components/brand/IsaLogo";
import { MountainBackdrop } from "@/components/brand/MountainBackdrop";

function Splash() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <motion.div
        className="text-fg"
        animate={{ opacity: [0.45, 1, 0.45] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
      >
        <IsaLogo className="w-28" glow />
      </motion.div>
    </div>
  );
}

// Girls-theme day/night control: auto → day → night → auto.
const NEXT_MODE: Record<GirlsMode, GirlsMode> = {
  auto: "day",
  day: "night",
  night: "auto",
};
const MODE_META = {
  auto: { Icon: SunMoon, label: "Auto (by time of day)" },
  day: { Icon: Sun, label: "Day" },
  night: { Icon: Moon, label: "Night" },
} as const;

function DayNightToggle() {
  const { theme, girlsMode, setGirlsMode } = useTheme();
  if (theme !== "girls") return null;
  const { Icon, label } = MODE_META[girlsMode];
  return (
    <button
      onClick={() => setGirlsMode(NEXT_MODE[girlsMode])}
      title={`Theme: ${label} — tap to change`}
      aria-label={`Theme mode: ${label}`}
      className="glass fixed left-4 right-auto z-30 flex h-10 w-10 items-center justify-center rounded-full text-fg transition hover:bg-white/10 md:left-auto md:right-4"
      style={{ bottom: "calc(5.25rem + env(safe-area-inset-bottom))" }}
    >
      <Icon size={17} />
    </button>
  );
}


export function AppShell({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    if (!loading && !session) router.replace("/login");
  }, [loading, session, router]);

  if (!isSupabaseConfigured) return <SetupNotice />;
  if (loading) return <Splash />;
  if (!session) return <Splash />;

  return (
    <div className="min-h-dvh md:pl-20">
      {/* Brand atmosphere: faint mountain range pinned to the bottom */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 -z-10 h-[38vh] opacity-[0.07]">
        <MountainBackdrop className="h-full w-full" />
      </div>
      {/* Top padding clears the fixed EN/UZ toggle (and the notch) so a page's
          own header controls are never hidden underneath it. */}
      <main className="mx-auto w-full max-w-6xl px-5 pb-28 pt-[calc(3.75rem+env(safe-area-inset-top))] sm:px-8 md:pb-12 md:pt-12">
        <ModuleGate>{children}</ModuleGate>
      </main>
      <Sidebar />
      <CommandPalette />
      <DayNightToggle />
      <QuickCapture />
      <OnboardingPrayerModal />
      <OnboardingGate />
    </div>
  );
}
