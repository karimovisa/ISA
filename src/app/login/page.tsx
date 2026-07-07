"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Eye,
  EyeOff,
  Target,
  Timer,
  Repeat,
  BookOpen,
  Flame,
  Moon,
  BarChart3,
  Mountain,
} from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { useT } from "@/lib/i18n";
import { SetupNotice } from "@/components/layout/SetupNotice";
import { IsaLogo } from "@/components/brand/IsaLogo";
import { fieldClass, primaryBtnClass } from "@/components/ui/Modal";
import { PressButton } from "@/components/ui/PressButton";

export default function LoginPage() {
  const router = useRouter();
  const { session, loading } = useAuth();
  const { t } = useT();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && session) router.replace("/");
  }, [loading, session, router]);

  if (!isSupabaseConfigured) return <SetupNotice />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return; // guard against duplicate submissions
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.replace("/");
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name.trim() } },
        });
        if (error) throw error;
        if (data.session) {
          router.replace("/");
        } else {
          setNotice("Account created. Check your email to confirm, then sign in.");
          setMode("signin");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <div className="grid w-full max-w-4xl items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
        {/* Pitch — what ISA is and what regular use gives you.
            Below the form on mobile, left column on desktop. */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="order-2 lg:order-1"
        >
          <h2 className="text-balance text-2xl font-bold tracking-tight sm:text-3xl">
            {t("Your personal operating system.")}
          </h2>
          <p className="mt-3 max-w-md text-sm text-muted sm:text-base">
            {t(
              "One quiet place for everything that moves you forward — built like an ascent: you climb a little every day."
            )}
          </p>

          <ul className="mt-6 space-y-3">
            {[
              { Icon: Target, text: "Goals as summits — every climb tracked in percent." },
              { Icon: Timer, text: "Focus timer that logs your deep-work sessions itself." },
              { Icon: Repeat, text: "Daily habits with streaks and a 7-day grid." },
              { Icon: BookOpen, text: "A two-minute journal with mood, mapped on a calendar." },
            ].map(({ Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-sm text-fg/85">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.06]">
                  <Icon size={14} className="text-fg" />
                </span>
                {t(text)}
              </li>
            ))}
          </ul>

          <div className="mt-7 border-t border-line pt-5">
            <p className="text-xs font-medium uppercase tracking-wider text-muted">
              {t("Keep showing up, and ISA gives back")}
            </p>
            <ul className="mt-3 grid gap-2.5 text-sm text-fg/80 sm:grid-cols-2">
              <li className="flex items-center gap-2.5">
                <Flame size={14} className="shrink-0 text-accent" />{" "}
                {t("Streaks that build momentum")}
              </li>
              <li className="flex items-center gap-2.5">
                <Moon size={14} className="shrink-0 text-accent" />{" "}
                {t("An Energy Score from your sleep")}
              </li>
              <li className="flex items-center gap-2.5">
                <BarChart3 size={14} className="shrink-0 text-accent" />{" "}
                {t("A weekly review every Sunday")}
              </li>
              <li className="flex items-center gap-2.5">
                <Mountain size={14} className="shrink-0 text-accent" />{" "}
                {t("The Ascent — progress as altitude")}
              </li>
            </ul>
          </div>
        </motion.section>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="order-1 mx-auto w-full max-w-sm lg:order-2"
        >
        <div className="mb-8 flex flex-col items-center text-center">
          <IsaLogo className="w-32 text-fg" glow />
          <div className="mt-4 flex items-center gap-2 text-[0.6rem] font-medium uppercase tracking-[0.35em] text-muted">
            <span className="text-fg/70">Focus</span>
            <span className="text-accent">·</span>
            <span className="text-fg/70">Process</span>
            <span className="text-accent">·</span>
            <span className="text-fg/70">Peak</span>
          </div>
          <p className="mt-4 text-sm text-muted">
            {mode === "signin"
              ? t("Welcome back. Sign in to your space.")
              : t("Create your personal operating system.")}
          </p>
        </div>

        <form onSubmit={submit} className="glass reflect space-y-4 rounded-3xl p-6">
          <AnimatePresence initial={false}>
            {mode === "signup" && (
              <motion.input
                key="name"
                type="text"
                required
                placeholder={t("First name")}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={fieldClass}
                autoComplete="given-name"
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.2 }}
              />
            )}
          </AnimatePresence>
          <div>
            <label htmlFor="email" className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted">
              {t("Email")}
            </label>
            <input
              id="email"
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={fieldClass}
              autoComplete="email"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted">
              {t("Password")}
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPw ? "text" : "password"}
                required
                minLength={6}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${fieldClass} pr-11`}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                aria-label={showPw ? "Hide password" : "Show password"}
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted transition hover:text-fg"
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}
          {notice && <p className="text-xs text-emerald-400">{notice}</p>}

          <PressButton type="submit" disabled={busy} className={primaryBtnClass}>
            {busy
              ? t("Please wait…")
              : mode === "signin"
                ? t("Sign in")
                : t("Create account")}
          </PressButton>
        </form>

        <p className="mt-5 text-center text-xs text-muted">
          {mode === "signin"
            ? t("No account yet?")
            : t("Already have an account?")}{" "}
          <button
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError(null);
              setNotice(null);
            }}
            className="font-medium text-accent hover:underline"
          >
            {mode === "signin" ? t("Create one") : t("Sign in")}
          </button>
        </p>
        </motion.div>
      </div>
    </div>
  );
}
