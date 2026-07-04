"use client";

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
  LogOut,
} from "lucide-react";
import { motion } from "framer-motion";
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
        active ? "text-white" : "text-muted hover:text-white"
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
      <span className="pointer-events-none absolute left-14 z-20 hidden whitespace-nowrap rounded-lg bg-white/10 px-2.5 py-1 text-xs text-white opacity-0 backdrop-blur transition-opacity group-hover:opacity-100 md:block">
        {label}
      </span>
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { signOut } = useAuth();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <>
      {/* Desktop rail */}
      <aside className="fixed left-0 top-0 z-40 hidden h-dvh w-20 flex-col items-center justify-between py-6 md:flex">
        <Link
          href="/"
          aria-label="ISA — home"
          className="text-white transition-opacity hover:opacity-80"
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
        <button
          onClick={signOut}
          title="Sign out"
          className="flex h-11 w-11 items-center justify-center rounded-2xl text-muted transition-colors hover:text-white"
        >
          <LogOut size={20} />
        </button>
      </aside>

      {/* Mobile bottom bar */}
      <nav
        className="glass fixed inset-x-3 z-40 flex items-center justify-around rounded-3xl px-1 py-1.5 md:hidden"
        style={{ bottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
      >
        {NAV.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex h-11 w-11 items-center justify-center rounded-2xl transition-colors",
                active ? "text-white" : "text-muted"
              )}
            >
              {active && (
                <motion.span
                  layoutId="nav-active-mobile"
                  className="absolute inset-0 rounded-2xl bg-accent-soft ring-1 ring-inset ring-accent/30"
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              )}
              <Icon size={19} className="relative z-10" />
            </Link>
          );
        })}
      </nav>
    </>
  );
}
