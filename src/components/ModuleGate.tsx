"use client";

// ISA — progressive disclosure, applied in ONE place. AppShell wraps every app
// route, so gating by pathname here avoids touching ten pages.
//
// Guided, never locked: every gate explains WHY the module is worth opening now
// and offers "open it anyway". ISA advises; the human decides.

import { useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Lock, ArrowLeft, Sparkles } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { GlassCard } from "@/components/ui/GlassCard";
import { PressButton } from "@/components/ui/PressButton";
import { useT } from "@/lib/i18n";
import {
  ROUTE_MODULE, UNLOCK_DAY, UNLOCK_WHY, accountAgeDays, isUnlocked,
  readUnlockOverrides, unlockEarly, type ModuleKey,
} from "@/lib/unlock";

const LABEL: Record<ModuleKey, string> = {
  goals: "Goals", habits: "Habits", focus: "Focus", journal: "Journal", ideas: "Ideas",
  running: "Running", prayer: "Prayer", money: "Money", calendar: "Calendar",
  projects: "Projects", progress: "Progress",
};

export function ModuleGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useT();
  const [overrides, setOverrides] = useState<string[]>(() => readUnlockOverrides());

  const mod = ROUTE_MODULE[pathname ?? ""];
  // While the session is still loading, created_at is unknown → never gate, so
  // the page can't flash a lock at an existing user.
  const age = accountAgeDays(user?.created_at);

  if (!mod || isUnlocked(mod, age, overrides)) return <>{children}</>;

  const day = UNLOCK_DAY[mod];
  const inDays = Math.max(1, day - age);

  const openNow = () => {
    unlockEarly(mod);
    setOverrides(readUnlockOverrides());
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="mx-auto max-w-md py-8"
    >
      <GlassCard className="p-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.06]">
          <Lock size={20} className="text-muted" />
        </div>

        <h1 className="mt-4 text-xl font-semibold">{t(LABEL[mod])}</h1>
        <p className="mt-1 text-xs uppercase tracking-wider text-accent">
          {t("Opens in {n} days", { n: inDays })}
        </p>

        <p className="mt-4 text-sm leading-relaxed text-muted">{t(UNLOCK_WHY[mod])}</p>

        <div className="mt-5 flex items-start gap-2 rounded-2xl border border-line bg-white/[0.02] p-3 text-left">
          <Sparkles size={14} className="mt-0.5 shrink-0 text-accent" />
          <p className="text-xs leading-relaxed text-muted">
            {t("ISA introduces itself a piece at a time so nothing feels overwhelming — but this is your life, not a game. Open it whenever you want.")}
          </p>
        </div>

        <div className="mt-5 flex flex-col gap-2">
          <PressButton
            onClick={openNow}
            className="w-full rounded-xl bg-accent py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
          >
            {t("Open it anyway")}
          </PressButton>
          <PressButton
            onClick={() => router.push("/")}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-line py-2.5 text-sm text-muted transition hover:text-fg"
          >
            <ArrowLeft size={14} /> {t("Back to dashboard")}
          </PressButton>
        </div>
      </GlassCard>
    </motion.div>
  );
}
