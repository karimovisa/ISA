"use client";

import { useEffect, useState } from "react";
import { Reorder } from "framer-motion";
import { Bell, BellOff, Check, GripVertical, Sparkles, Shield, Globe, Info, Trash2, RotateCcw } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useEntitlements } from "@/components/EntitlementProvider";
import { useAuth } from "@/components/auth/AuthProvider";
import { GlassCard } from "@/components/ui/GlassCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { PressButton } from "@/components/ui/PressButton";
import { enablePush, sendTestPush, pushSupported } from "@/lib/push";
import { useTheme, type Theme } from "@/components/ThemeProvider";
import { useNavOrder } from "@/components/NavOrderProvider";
import { NAV } from "@/components/layout/Sidebar";
import { useT } from "@/lib/i18n";
import { DataExport } from "@/components/sections/DataExport";
import { ReminderOverview } from "@/components/sections/ReminderOverview";
import { SubscriptionSection } from "@/components/sections/SubscriptionSection";

const THEMES: { id: Theme; label: string; bg: string; accent: string; text: string }[] = [
  { id: "boys", label: "Boys", bg: "#101820", accent: "#D97B3F", text: "#F5F0E8" },
  { id: "girls", label: "Girls", bg: "#FFF8FB", accent: "#FF5C8A", text: "#2B1B24" },
];

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { order: navOrder, setOrder: setNavOrder } = useNavOrder();
  const { t: tr, lang, setLang } = useT();
  const { canUse } = useEntitlements();
  const { signOut } = useAuth();
  const [supported, setSupported] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  // iOS Safari only allows push for sites opened from the Home Screen icon.
  const [ios, setIos] = useState(false);
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    setIos(/iPad|iPhone|iPod/.test(navigator.userAgent));
    setStandalone(
      window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as unknown as { standalone?: boolean }).standalone === true
    );
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

  const clearCache = () => {
    if (!confirm("Clear cached data and reload? Your data is safe on the server.")) return;
    try { localStorage.clear(); } catch {}
    location.reload();
  };
  const deleteAccount = () => {
    if (!confirm("Delete your account? This signs you out. For full data erasure, contact support.")) return;
    signOut();
  };

  const AI_ITEMS: [string, string][] = [
    ["AI Coach", "ai_coach"], ["Weekly Reviews", "weekly_review"], ["Monthly Reviews", "monthly_review"],
    ["Yearly Reviews", "yearly_review"], ["Predictions", "ai_predictions"], ["Pattern Detection", "pattern_detection"],
    ["Memory Engine", "memory_engine"], ["Behavior Analysis", "deep_analytics"], ["Smart Suggestions", "ai_coach"],
  ];

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Settings" subtitle="Your space, your rules." />

      <div className="mb-6">
        <SubscriptionSection />
      </div>

      <GlassCard className="mb-6 p-6">
        <h3 className="mb-1 font-medium">{tr("Appearance")}</h3>
        <p className="mb-4 text-sm text-muted">
          {tr("Themes and accent. Wallpapers coming soon.")}
        </p>
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
                <span className="text-muted">{t.label}</span>
                {theme === t.id && (
                  <span className="text-accent">{tr("Active")}</span>
                )}
              </div>
            </button>
          ))}
        </div>
      </GlassCard>

      <GlassCard className="mb-6 p-6">
        <h3 className="mb-1 font-medium">{tr("Bottom menu order")}</h3>
        <p className="mb-4 text-sm text-muted">
          {tr("Reorder the icons in your mobile bottom bar.")}
        </p>
        <Reorder.Group axis="y" values={navOrder} onReorder={setNavOrder} className="space-y-2">
          {navOrder.map((href) => {
            const item = NAV.find((n) => n.href === href);
            if (!item) return null;
            const Icon = item.icon;
            return (
              <Reorder.Item
                key={href}
                value={href}
                className="flex cursor-grab items-center gap-3 rounded-xl bg-white/[0.04] px-3 py-2.5 active:cursor-grabbing"
              >
                <GripVertical size={16} className="shrink-0 text-muted" />
                <Icon size={18} className="shrink-0 text-muted" />
                <span className="flex-1 text-sm font-medium">{tr(item.label)}</span>
              </Reorder.Item>
            );
          })}
        </Reorder.Group>
      </GlassCard>

      {/* 4 — AI */}
      <GlassCard className="mb-6 p-6">
        <div className="mb-1 flex items-center gap-2">
          <Sparkles size={16} className="text-accent" />
          <h3 className="font-medium">{tr("AI")}</h3>
        </div>
        <p className="mb-4 text-sm text-muted">{tr("Control how ISA helps you.")}</p>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {AI_ITEMS.map(([label, key], n) => {
            const on = canUse(key);
            return (
              <div key={`${key}-${n}`} className="flex items-center gap-2 text-sm">
                {on ? <Check size={15} className="shrink-0 text-emerald-400" /> : <Sparkles size={13} className="shrink-0 text-accent/70" />}
                <span className={on ? "text-fg/90" : "text-muted"}>{tr(label)}</span>
                <span className={`ml-auto text-[10px] font-medium ${on ? "text-emerald-400" : "text-accent"}`}>{on ? tr("Enabled") : tr("Ready")}</span>
              </div>
            );
          })}
        </div>
      </GlassCard>

      <GlassCard className="p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/[0.06]">
            {enabled ? (
              <Bell size={20} className="text-fg" />
            ) : (
              <BellOff size={20} className="text-muted" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-medium">{tr("Push notifications")}</h3>
            <p className="mt-1 text-sm text-muted">
              {tr(
                "Gentle reminders for journaling, habits, and your weekly review — even when ISA is closed."
              )}
            </p>

            <div className="mt-4 flex flex-wrap gap-3">
              {!enabled ? (
                <PressButton
                  onClick={enable}
                  disabled={busy || !supported}
                  className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90 disabled:opacity-50"
                >
                  {busy ? tr("Enabling…") : tr("Enable notifications")}
                </PressButton>
              ) : (
                <>
                  <span className="flex items-center gap-2 rounded-xl bg-emerald-400/10 px-4 py-2.5 text-sm font-medium text-emerald-300">
                    <Check size={15} /> {tr("Enabled")}
                  </span>
                  <PressButton
                    onClick={test}
                    disabled={busy}
                    className="rounded-xl bg-white/10 px-4 py-2.5 text-sm font-medium text-fg transition hover:bg-white/15 disabled:opacity-50"
                  >
                    {tr("Send test")}
                  </PressButton>
                </>
              )}
            </div>

            {note && <p className="mt-3 text-xs text-muted">{note}</p>}

            {ios && !standalone ? (
              <div className="mt-5 rounded-2xl border border-accent/25 bg-accent-soft p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-fg">
                  iPhone setup — 4 steps
                </p>
                <p className="mt-1 text-xs text-muted">
                  iOS only allows notifications for apps on your Home Screen, so
                  the button above won&apos;t work from a Safari tab.
                </p>
                <ol className="mt-3 space-y-2.5 text-sm text-fg/90">
                  <li className="flex gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] font-semibold">1</span>
                    <span>
                      In Safari, tap the <strong>Share</strong> button (square
                      with an arrow, bottom center).
                    </span>
                  </li>
                  <li className="flex gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] font-semibold">2</span>
                    <span>
                      Scroll down and tap <strong>Add to Home Screen</strong>,
                      then <strong>Add</strong>.
                    </span>
                  </li>
                  <li className="flex gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] font-semibold">3</span>
                    <span>
                      Close Safari and open ISA from the <strong>new icon on
                      your Home Screen</strong> — not from Safari.
                    </span>
                  </li>
                  <li className="flex gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] font-semibold">4</span>
                    <span>
                      Come back to Settings there, tap{" "}
                      <strong>Enable notifications</strong> and choose{" "}
                      <strong>Allow</strong>.
                    </span>
                  </li>
                </ol>
                <p className="mt-3 text-xs text-muted">
                  Requires iOS 16.4 or newer. This also installs ISA as a
                  full-screen app that works offline.
                </p>
              </div>
            ) : (
              <div className="mt-5 space-y-1 border-t border-line pt-4 text-xs text-muted">
                {ios && standalone ? (
                  <p>
                    You&apos;re in the Home Screen app — just tap Enable and
                    choose Allow.
                  </p>
                ) : (
                  <>
                    <p>· Android &amp; Desktop: works in any modern browser.</p>
                    <p>
                      · iPhone/iPad: first &ldquo;Add to Home Screen&rdquo;, then
                      open from there.
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </GlassCard>

      <ReminderOverview />

      {/* 7 — Privacy */}
      <GlassCard className="mb-6 p-6">
        <div className="mb-1 flex items-center gap-2"><Shield size={16} className="text-accent" /><h3 className="font-medium">{tr("Privacy")}</h3></div>
        <p className="mb-4 text-sm text-muted">{tr("Your data stays yours — always.")}</p>
        <div className="space-y-2">
          <button onClick={clearCache} className="flex w-full items-center gap-3 rounded-xl bg-white/[0.04] px-3 py-2.5 text-sm transition hover:bg-white/[0.07]"><RotateCcw size={16} className="text-muted" />{tr("Clear cache")}</button>
          <button onClick={deleteAccount} className="flex w-full items-center gap-3 rounded-xl bg-white/[0.04] px-3 py-2.5 text-sm text-red-300 transition hover:bg-red-500/10"><Trash2 size={16} />{tr("Delete account")}</button>
        </div>
        <p className="mt-3 text-xs text-muted">{tr("ISA never sends your data to an external AI model without your explicit consent. Full privacy policy coming soon.")}</p>
      </GlassCard>

      {/* 8 — Backup & Restore */}
      <DataExport />

      {/* 9 — Language */}
      <GlassCard className="mb-6 mt-6 p-6">
        <div className="mb-1 flex items-center gap-2"><Globe size={16} className="text-accent" /><h3 className="font-medium">{tr("Language")}</h3></div>
        <p className="mb-4 text-sm text-muted">{tr("Changes instantly.")}</p>
        <div className="flex flex-wrap gap-2">
          {(["en", "uz"] as const).map((l) => (
            <button key={l} onClick={() => setLang(l)} className={`rounded-xl px-4 py-2 text-sm font-medium transition ${lang === l ? "bg-accent text-white" : "bg-white/5 text-muted hover:text-fg"}`}>{l === "en" ? "English" : "O'zbek"}</button>
          ))}
          <span className="rounded-xl bg-white/5 px-4 py-2 text-sm text-muted/50">Русский · soon</span>
        </div>
      </GlassCard>

      {/* 10 — About ISA */}
      <GlassCard className="mb-6 p-6">
        <div className="mb-1 flex items-center gap-2"><Info size={16} className="text-accent" /><h3 className="font-medium">{tr("About ISA")}</h3></div>
        <p className="mt-1 text-sm text-muted">ISA OS · v1.0</p>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-accent">
          <a href="mailto:karimov.islom7@icloud.com" className="hover:underline">{tr("Support")}</a>
          <a href="https://islom-os.vercel.app" className="hover:underline">{tr("Website")}</a>
        </div>
        <p className="mt-3 text-xs text-muted">Run. Process. Aim.</p>
      </GlassCard>
    </div>
  );
}
