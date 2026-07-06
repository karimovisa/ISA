"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Target,
  FolderKanban,
  Lightbulb,
  BarChart3,
  BookOpen,
  Timer,
  Repeat,
  CalendarDays,
  MoonStar,
  Settings,
  LogOut,
  MoreHorizontal,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/cn";
import { useAuth } from "@/components/auth/AuthProvider";
import { IsaLogo } from "@/components/brand/IsaLogo";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/ideas", label: "Ideas", icon: Lightbulb },
  { href: "/progress", label: "Progress", icon: BarChart3 },
  { href: "/journal", label: "Journal", icon: BookOpen },
  { href: "/focus", label: "Focus", icon: Timer },
  { href: "/habits", label: "Habits", icon: Repeat },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/pray", label: "Pray", icon: MoonStar },
];

// Mobile: 5 primary items in the bar, the rest live behind "More".
const PRIMARY = ["/", "/goals", "/habits", "/journal", "/focus", "/progress"];
const MOBILE_MAIN = NAV.filter((n) => PRIMARY.includes(n.href));
const MOBILE_REST = [
  ...NAV.filter((n) => !PRIMARY.includes(n.href)),
  { href: "/settings", label: "Settings", icon: Settings },
];

function NavLink({
  href,
  label,
  Icon,
  active,
}: {
  href: string;
  label: string;
  Icon: typeof Target;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      title={label}
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
        {label}
      </span>
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { signOut } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

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
        <nav className="glass flex flex-col items-center gap-1 rounded-3xl p-2">
          {NAV.map((item) => (
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
            title="Settings"
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-2xl transition-colors",
              isActive("/settings") ? "text-fg" : "text-muted hover:text-fg"
            )}
          >
            <Settings size={20} />
          </Link>
          <button
            onClick={signOut}
            title="Sign out"
            className="flex h-11 w-11 items-center justify-center rounded-2xl text-muted transition-colors hover:text-fg"
          >
            <LogOut size={20} />
          </button>
        </div>
      </aside>

      {/* Mobile "More" sheet */}
      <AnimatePresence>
        {moreOpen && (
          <motion.div
            className="fixed inset-0 z-40 md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setMoreOpen(false)}
            />
            <motion.div
              className="glass reflect absolute inset-x-3 rounded-3xl p-4"
              style={{ bottom: "calc(5rem + env(safe-area-inset-bottom))" }}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
            >
              <div className="grid grid-cols-3 gap-2">
                {MOBILE_REST.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMoreOpen(false)}
                      className={cn(
                        "flex flex-col items-center gap-1.5 rounded-2xl px-2 py-3 text-xs transition-colors",
                        isActive(item.href)
                          ? "bg-accent-soft text-fg"
                          : "text-muted hover:text-fg"
                      )}
                    >
                      <Icon size={20} />
                      {item.label}
                    </Link>
                  );
                })}
                <button
                  onClick={() => {
                    setMoreOpen(false);
                    signOut();
                  }}
                  className="flex flex-col items-center gap-1.5 rounded-2xl px-2 py-3 text-xs text-muted transition-colors hover:text-fg"
                >
                  <LogOut size={20} />
                  Sign out
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile bottom bar */}
      <nav
        className="glass fixed inset-x-3 z-40 flex items-center justify-around rounded-3xl px-1 py-1.5 md:hidden"
        style={{ bottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
      >
        {MOBILE_MAIN.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMoreOpen(false)}
              className={cn(
                "relative flex h-11 flex-1 items-center justify-center rounded-2xl transition-colors",
                active ? "text-fg" : "text-muted"
              )}
            >
              {active && (
                <motion.span
                  layoutId="nav-active-mobile"
                  className="absolute inset-0 rounded-2xl bg-accent-soft ring-1 ring-inset ring-accent/30"
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              )}
              <Icon size={20} className="relative z-10" />
            </Link>
          );
        })}
        <button
          onClick={() => setMoreOpen((v) => !v)}
          aria-label="More"
          className={cn(
            "relative flex h-11 flex-1 items-center justify-center rounded-2xl transition-colors",
            moreOpen ? "text-fg" : "text-muted"
          )}
        >
          {moreOpen ? <X size={20} /> : <MoreHorizontal size={20} />}
        </button>
      </nav>
    </>
  );
}
