"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { SetupNotice } from "@/components/layout/SetupNotice";
import { IsaLogo } from "@/components/brand/IsaLogo";
import { fieldClass, primaryBtnClass } from "@/components/ui/Modal";

export default function LoginPage() {
  const router = useRouter();
  const { session, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && session) router.replace("/");
  }, [loading, session, router]);

  if (!isSupabaseConfigured) return <SetupNotice />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-sm"
      >
        <div className="mb-8 flex flex-col items-center text-center">
          <IsaLogo className="w-32 text-white" glow />
          <div className="mt-4 flex items-center gap-2 text-[0.6rem] font-medium uppercase tracking-[0.35em] text-muted">
            <span className="text-white/70">Focus</span>
            <span className="text-accent">·</span>
            <span className="text-white/70">Process</span>
            <span className="text-accent">·</span>
            <span className="text-white/70">Peak</span>
          </div>
          <p className="mt-4 text-sm text-muted">
            {mode === "signin"
              ? "Welcome back. Sign in to your space."
              : "Create your personal operating system."}
          </p>
        </div>

        <form onSubmit={submit} className="glass reflect space-y-4 rounded-3xl p-6">
          <AnimatePresence initial={false}>
            {mode === "signup" && (
              <motion.input
                key="name"
                type="text"
                required
                placeholder="First name"
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
          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={fieldClass}
            autoComplete="email"
          />
          <input
            type="password"
            required
            minLength={6}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={fieldClass}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
          />

          {error && <p className="text-xs text-red-400">{error}</p>}
          {notice && <p className="text-xs text-emerald-400">{notice}</p>}

          <button type="submit" disabled={busy} className={primaryBtnClass}>
            {busy
              ? "Please wait…"
              : mode === "signin"
                ? "Sign in"
                : "Create account"}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-muted">
          {mode === "signin" ? "No account yet?" : "Already have an account?"}{" "}
          <button
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError(null);
              setNotice(null);
            }}
            className="font-medium text-accent hover:underline"
          >
            {mode === "signin" ? "Create one" : "Sign in"}
          </button>
        </p>
      </motion.div>
    </div>
  );
}
