"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Target,
  BarChart3,
  BookOpen,
  Timer,
  Repeat,
  CalendarDays,
  Settings,
  LogOut,
  Command,
  Wallet,
  Sparkles,
  Brain,
  Plus,
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";
import { useAuth } from "@/components/auth/AuthProvider";
import { useT } from "@/lib/i18n";
import { IsaLogo } from "@/components/brand/IsaLogo";
import { MosqueIcon } from "@/components/ui/MosqueIcon";
import { useNavOrder } from "@/components/NavOrderProvider";
import { ROUTE_MODULE, accountAgeDays, isUnlocked, readUnlockOverrides } from "@/lib/unlock";

export const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/ask", label: "Ask ISA", icon: Sparkles },
  { href: "/knows", label: "What ISA knows", icon: Brain },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/money", label: "Money", icon: Wallet },
  { href: "/progress", label: "Progress", icon: BarChart3 },
  { href: "/journal", label: "Journal", icon: BookOpen },
  { href: "/focus", label: "Focus", icon: Timer },
  { href: "/habits", label: "Habits", icon: Repeat },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/pray", label: "Pray", icon: MosqueIcon },
];

// Both surfaces read the SAME order (Settings → Navigation). The sidebar shows
// all of it; the bottom bar takes the first MOBILE_SLOTS and ⌘K holds the rest.
const NAV_BY_HREF = Object.fromEntries(NAV.map((n) => [n.href, n]));

function NavLink({
  href,
  label,
  Icon,
  active,
}: {
  href: string;
  label: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
  active: boolean;
}) {
  const { t } = useT();
  return (
    <Link
      href={href}
      title={t(label)}
      data-tour={`nav-${href}`}
      className={cn(
        "group relative flex h-11 w-11 items-center justify-center rounded-2xl transition-colors",
        active ? "text-fg" : "text-muted hover:text-fg"
      )}
    >
      {active && (
        <motion.span
          layoutId="nav-active"
          className="absolute inset-0 rounded-2xl bg-accent-soft ring-1 ring-inset ring-accent/30"
          transition={{ type: "spring", stiffness: 400, damping: 32 }}
        />
      )}
      <Icon
        size={20}
        className="relative z-10 transition-transform duration-200 group-hover:scale-110"
      />
      {/* Desktop tooltip */}
      <span className="pointer-events-none absolute left-14 z-20 hidden whitespace-nowrap rounded-lg bg-white/10 px-2.5 py-1 text-xs text-fg opacity-0 backdrop-blur transition-opacity group-hover:opacity-100 md:block">
        {t(label)}
      </span>
    </Link>
  );
}

type NavEntry = { href: string; label: string; icon: React.ComponentType<{ size?: number; className?: string }> };

function MobileTab({
  item,
  active,
  t,
}: {
  item: NavEntry;
  active: boolean;
  t: (s: string) => string;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      data-tour={`nav-${item.href}`}
      className="flex flex-col items-center gap-1 pb-0.5"
    >
      <Icon size={20} className={active ? "text-fg" : "text-muted"} />
      <span
        className={cn(
          "max-w-full truncate px-0.5 text-[10px] font-medium leading-none",
          active ? "text-fg" : "text-muted"
        )}
      >
        {t(item.label)}
      </span>
      <span
        className={cn(
          "mt-0.5 h-0.5 w-5 rounded-full transition-colors",
          active ? "bg-[var(--color-fg)]" : "bg-transparent"
        )}
      />
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { signOut, user } = useAuth();
  const { t } = useT();
  const { order } = useNavOrder();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  // Progressive disclosure: a module the account hasn't reached yet stays out of
  // the nav. Existing accounts are past the last unlock day, so nothing hides.
  const [overrides] = useState<string[]>(() => readUnlockOverrides());
  const age = accountAgeDays(user?.created_at);
  const visible = (href: string) => {
    const mod = ROUTE_MODULE[href];
    return !mod || isUnlocked(mod, age, overrides);
  };

  // The user's order drives both surfaces; anything the order doesn't mention
  // (a newly shipped page) still appears, appended, so nothing goes missing.
  const ordered = [
    ...order.map((href) => NAV_BY_HREF[href]).filter(Boolean),
    ...NAV.filter((n) => !order.includes(n.href)),
  ];
  const nav = ordered.filter((n) => visible(n.href));
  // Mobile: three pages flank the centered "+"; everything else lives in ⌘K.
  const barNav = nav.slice(0, 3);
  const openCapture = () => window.dispatchEvent(new CustomEvent("isa:open-capture"));

  return (
    <>
      {/* Desktop rail */}
      <aside className="fixed left-0 top-0 z-40 hidden h-dvh w-20 flex-col items-center justify-between py-6 md:flex">
        <Link
          href="/"
          aria-label="ISA — home"
          className="text-fg transition-opacity hover:opacity-80"
        >
          <IsaLogo className="w-12" />
        </Link>
        <nav
          data-tour="nav-bar"
          className="glass flex flex-col items-center gap-1 rounded-3xl p-2"
        >
          {nav.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              label={item.label}
              Icon={item.icon}
              active={isActive(item.href)}
            />
          ))}
        </nav>
        <div className="flex flex-col items-center gap-1">
          <Link
            href="/settings"
            title={t("Settings")}
            data-tour="nav-/settings"
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-2xl transition-colors",
              isActive("/settings") ? "text-fg" : "text-muted hover:text-fg"
            )}
          >
            <Settings size={20} />
          </Link>
          <button
            onClick={signOut}
            title={t("Sign out")}
            className="flex h-11 w-11 items-center justify-center rounded-2xl text-muted transition-colors hover:text-fg"
          >
            <LogOut size={20} />
          </button>
        </div>
      </aside>

      {/* Mobile bottom bar — a quiet mountain range with a centered orange "+".
          Three pages + the ⌘K menu flank the universal create action. The peaks
          are a subtle silhouette (icons stay fully legible); the raised "+"
          pokes above the bar's top edge. Everything else lives in ⌘K. */}
      <div
        data-tour="nav-bar"
        className="fixed inset-x-0 bottom-0 z-40 md:hidden"
        style={{
          // Fine-tune the peaks: how far bases sink behind the pill, peak width
          // vs the pill, and the mountain layer height.
          "--peaks-drop": "18px",
          "--peaks-scale": "1",
          "--peaks-h": "128px",
        } as React.CSSProperties}
      >
        {/* Mountain peaks rising BEHIND the pill. The photo is pure black behind
            the peaks; background-blend-mode: screen against the app's own bg
            colour knocks that black out (no stacking-context issue, unlike
            mix-blend on a fixed element). Bases hide behind the opaque pill. */}
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-0 left-1/2 z-0 -translate-x-1/2"
          style={{
            width: "calc(min(430px, 100vw) * var(--peaks-scale))",
            height: "var(--peaks-h)",
            transform: "translateY(var(--peaks-drop))",
            backgroundColor: "var(--color-bg)",
            backgroundImage: "url('/nav/peaks.jpg')",
            backgroundBlendMode: "screen",
            backgroundSize: "100% auto",
            backgroundPosition: "center bottom",
            backgroundRepeat: "no-repeat",
          }}
        />
        <nav
          className="glass relative z-10 mx-auto max-w-[430px] rounded-t-3xl px-2 pt-2.5"
          style={{ paddingBottom: "calc(0.45rem + env(safe-area-inset-bottom))" }}
        >
          <div className="relative z-10 grid grid-cols-5 items-end">
            {barNav.slice(0, 2).map((item) => (
              <MobileTab key={item.href} item={item} active={isActive(item.href)} t={t} />
            ))}

            {/* Neutral glass "+" — the universal create action (matches the peaks mockup) */}
            <div className="flex justify-center">
              <button
                onClick={openCapture}
                aria-label={t("Add")}
                data-tour="nav-add"
                className="-mt-7 flex h-14 w-14 items-center justify-center rounded-full border border-white/25 bg-[var(--color-surface-strong)] text-fg shadow-[0_10px_28px_-8px_rgba(0,0,0,0.7)] ring-4 ring-[var(--color-bg)] backdrop-blur transition active:scale-95"
              >
                <Plus size={26} strokeWidth={2.2} />
              </button>
            </div>

            {barNav[2] && <MobileTab item={barNav[2]} active={isActive(barNav[2].href)} t={t} />}

            {/* ⌘K palette — every other page + quick search */}
            <button
              onClick={() => window.dispatchEvent(new CustomEvent("isa:open-palette"))}
              aria-label="Menu and search"
              data-tour="nav-menu"
              className="flex flex-col items-center gap-1 pb-0.5 text-muted transition-colors hover:text-fg"
            >
              <Command size={20} />
              <span className="max-w-full truncate px-0.5 text-[10px] font-medium leading-none">{t("Menu")}</span>
            </button>
          </div>
        </nav>
      </div>
    </>
  );
}
