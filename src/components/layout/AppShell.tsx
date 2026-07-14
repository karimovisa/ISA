"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Sun, Moon, SunMoon, MessageCircle } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useTheme, type GirlsMode } from "@/components/ThemeProvider";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { Sidebar } from "@/components/layout/Sidebar";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { OnboardingPrayerModal } from "@/components/sections/OnboardingPrayerModal";
import { OnboardingGate } from "@/components/onboarding/OnboardingGate";
import { SetupNotice } from "@/components/layout/SetupNotice";
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


/** Ask ISA — always one tap away, like Messages. Sits opposite the theme toggle
 *  on phones and above it on desktop, so the two never collide. */
function AskIsaButton() {
  const pathname = usePathname();
  if (pathname === "/ask") return null;
  return (
    <Link
      href="/ask"
      aria-label="Ask ISA"
      title="Ask ISA"
      className="fixed right-4 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-30 flex h-12 w-12 items-center justify-center rounded-full bg-accent text-white shadow-[0_10px_30px_-8px_rgba(0,0,0,0.6)] transition hover:brightness-110 active:scale-95 md:bottom-[9.5rem]"
    >
      <MessageCircle size={21} strokeWidth={2.2} />
    </Link>
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
        {children}
      </main>
      <Sidebar />
      <CommandPalette />
      <DayNightToggle />
      <AskIsaButton />
      <OnboardingPrayerModal />
      <OnboardingGate />
    </div>
  );
}
