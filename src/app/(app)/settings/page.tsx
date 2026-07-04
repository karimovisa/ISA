"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Check } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { GlassCard } from "@/components/ui/GlassCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { PressButton } from "@/components/ui/PressButton";
import { enablePush, sendTestPush, pushSupported } from "@/lib/push";
import { useTheme, type Theme } from "@/components/ThemeProvider";

const THEMES: { id: Theme; label: string; bg: string; accent: string; text: string }[] = [
  { id: "boys", label: "Boys", bg: "#101820", accent: "#D97B3F", text: "#F5F0E8" },
  { id: "girls", label: "Girls", bg: "#4A0619", accent: "#FFBDC5", text: "#FFBDC5" },
];

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [supported, setSupported] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    setSupported(pushSupported());
    supabase
      .from("notification_settings")
      .select("push_enabled")
      .maybeSingle()
      .then(({ data }) => {
        const permOn =
          typeof Notification !== "undefined" &&
          Notification.permission === "granted";
        setEnabled(Boolean(data?.push_enabled) && permOn);
      });
  }, []);

  const enable = async () => {
    setBusy(true);
    setNote(null);
    const res = await enablePush();
    setBusy(false);
    if (res.ok) {
      setEnabled(true);
      setNote("Push notifications enabled.");
    } else {
      const map: Record<string, string> = {
        unsupported: "This browser doesn't support push notifications.",
        not_configured: "Push isn't configured yet (missing VAPID key).",
        denied: "Permission was denied. Enable it in browser settings.",
        save_failed: "Could not save your subscription. Try again.",
      };
      setNote(map[res.error ?? ""] || "Something went wrong.");
    }
  };

  const test = async () => {
    setBusy(true);
    await sendTestPush();
    setBusy(false);
    setNote("Test notification sent — check your device.");
  };

  return (
    <div>
      <PageHeader title="Settings" subtitle="Your space, your rules." />

      <GlassCard className="mb-6 max-w-xl p-6">
        <h3 className="mb-1 font-medium">Theme</h3>
        <p className="mb-4 text-sm text-muted">Pick the palette for your space.</p>
        <div className="grid grid-cols-2 gap-4">
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              className={`overflow-hidden rounded-2xl border text-left transition ${
                theme === t.id
                  ? "border-accent ring-1 ring-accent"
                  : "border-line hover:border-white/20"
              }`}
            >
              <div className="flex h-20 items-center gap-2 px-4" style={{ background: t.bg }}>
                <span className="h-6 w-6 rounded-full" style={{ background: t.accent }} />
                <span className="text-sm font-medium" style={{ color: t.text }}>
                  {t.label}
                </span>
              </div>
              <div className="flex items-center justify-between px-4 py-2 text-xs">
                <span className="text-muted">{t.label} theme</span>
                {theme === t.id && <span className="text-accent">Active</span>}
              </div>
            </button>
          ))}
        </div>
      </GlassCard>

      <GlassCard className="max-w-xl p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/[0.06]">
            {enabled ? (
              <Bell size={20} className="text-fg" />
            ) : (
              <BellOff size={20} className="text-muted" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-medium">Push notifications</h3>
            <p className="mt-1 text-sm text-muted">
              Gentle reminders for journaling, habits, and your weekly review —
              even when ISA is closed.
            </p>

            <div className="mt-4 flex flex-wrap gap-3">
              {!enabled ? (
                <PressButton
                  onClick={enable}
                  disabled={busy || !supported}
                  className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90 disabled:opacity-50"
                >
                  {busy ? "Enabling…" : "Enable notifications"}
                </PressButton>
              ) : (
                <>
                  <span className="flex items-center gap-2 rounded-xl bg-emerald-400/10 px-4 py-2.5 text-sm font-medium text-emerald-300">
                    <Check size={15} /> Enabled
                  </span>
                  <PressButton
                    onClick={test}
                    disabled={busy}
                    className="rounded-xl bg-white/10 px-4 py-2.5 text-sm font-medium text-fg transition hover:bg-white/15 disabled:opacity-50"
                  >
                    Send test
                  </PressButton>
                </>
              )}
            </div>

            {note && <p className="mt-3 text-xs text-muted">{note}</p>}

            <div className="mt-5 space-y-1 border-t border-line pt-4 text-xs text-muted">
              <p>· Android &amp; Desktop: works in any modern browser.</p>
              <p>· iPhone/iPad: first “Add to Home Screen”, then open from there.</p>
            </div>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
