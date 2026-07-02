"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Target,
  FolderKanban,
  Lightbulb,
  BarChart3,
  ArrowUpRight,
  Quote,
  Flame,
  Timer,
  CalendarClock,
  X,
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useClock } from "@/hooks/useClock";
import { useCollection } from "@/hooks/useCollection";
import { GlassCard } from "@/components/ui/GlassCard";
import { AscentProgress } from "@/components/ui/AscentProgress";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { greetingFor, formatTime, formatDate } from "@/lib/datetime";
import { quoteOfTheDay } from "@/lib/quotes";
import { seedDefaults } from "@/lib/seed";
import {
  journalStreak,
  focusMinutesThisWeek,
  nearestDeadline,
} from "@/lib/stats";
import type { Goal, Idea, Project, JournalEntry, FocusSession } from "@/lib/types";

export default function DashboardPage() {
  const { user, displayName } = useAuth();
  const now = useClock();
  const reduce = useReducedMotion();
  const goals = useCollection<Goal>("goals");
  const projects = useCollection<Project>("projects");
  const ideas = useCollection<Idea>("ideas");
  const journal = useCollection<JournalEntry>("journal_entries");
  const focus = useCollection<FocusSession>("focus_sessions");
  const [welcomed, setWelcomed] = useState(false);

  useEffect(() => {
    if (!user) return;
    seedDefaults(user.id).then((seeded) => {
      if (seeded) {
        goals.refresh();
        projects.refresh();
        ideas.refresh();
        setWelcomed(true);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const quote = quoteOfTheDay();
  const overall =
    goals.data.length > 0
      ? Math.round(
          goals.data.reduce((s, g) => s + (g.percentage ?? 0), 0) /
            goals.data.length
        )
      : 0;
  const activeProjects = projects.data.filter((p) => p.status === "active").length;
  const streak = journalStreak(journal.data);
  const weeklyMin = focusMinutesThisWeek(focus.data);
  const deadline = nearestDeadline(goals.data);

  const ease: [number, number, number, number] = [0.22, 1, 0.36, 1];
  const rise = (delay = 0) => ({
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5, delay, ease },
  });

  const cards: {
    href: string;
    label: string;
    Icon: typeof Target;
    value: number;
    suffix?: string;
    sub: string;
    tint: string;
  }[] = [
    {
      href: "/goals",
      label: "Goals",
      Icon: Target,
      value: goals.data.length,
      sub: `${overall}% overall progress`,
      tint: "from-white/[0.05]",
    },
    {
      href: "/projects",
      label: "Projects",
      Icon: FolderKanban,
      value: projects.data.length,
      sub: `${activeProjects} active`,
      tint: "from-white/[0.05]",
    },
    {
      href: "/ideas",
      label: "Ideas",
      Icon: Lightbulb,
      value: ideas.data.length,
      sub: "in your vault",
      tint: "from-white/[0.05]",
    },
    {
      href: "/progress",
      label: "Progress",
      Icon: BarChart3,
      value: overall,
      suffix: "%",
      sub: "weekly momentum",
      tint: "from-white/[0.05]",
    },
  ];

  return (
    <div>
      {/* First-run welcome */}
      <AnimatePresence>
        {welcomed && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mb-6 flex items-center justify-between gap-3 rounded-2xl border border-accent/20 bg-accent-soft px-4 py-3"
          >
            <p className="text-sm text-white/90">
              Welcome to your space, {displayName}. We seeded a few starters —
              edit or delete anything.
            </p>
            <button
              onClick={() => setWelcomed(false)}
              className="rounded-lg p-1 text-muted transition hover:text-white"
              aria-label="Dismiss"
            >
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Greeting */}
      <motion.section {...rise(0)} className="mb-8">
        <p className="text-sm text-muted">{now ? formatDate(now) : " "}</p>
        <h1 className="mt-2 text-balance text-4xl font-bold tracking-tight sm:text-5xl">
          {now ? greetingFor(now) : "Welcome"}, {displayName}.
        </h1>
        <p className="mt-3 text-base text-muted sm:text-lg">
          You are getting closer to your goals.
        </p>
        <div className="mt-4 font-mono text-3xl font-semibold tabular-nums tracking-tight text-white/90">
          {now ? formatTime(now) : " "}
        </div>
      </motion.section>

      {/* Momentum strip */}
      <motion.div {...rise(0.06)}>
        <GlassCard className="mb-6 grid grid-cols-1 divide-y divide-white/[0.06] p-0 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <Momentum
            Icon={Flame}
            color="text-white/85"
            label="Journaling streak"
            main={<AnimatedNumber value={streak} />}
            unit={streak === 1 ? "day" : "days"}
          />
          <Momentum
            Icon={Timer}
            color="text-white/85"
            label="Focus this week"
            main={<AnimatedNumber value={weeklyMin} />}
            unit="min"
          />
          <Momentum
            Icon={CalendarClock}
            color="text-white/85"
            label="Next deadline"
            main={
              deadline ? (
                <AnimatedNumber value={deadline.daysLeft} />
              ) : (
                <span className="text-muted">—</span>
              )
            }
            unit={deadline ? `days · ${deadline.title}` : "set a deadline"}
          />
        </GlassCard>
      </motion.div>

      {/* Quote */}
      <motion.div {...rise(0.12)}>
        <GlassCard className="mb-8 flex items-start gap-4 p-6">
          <Quote className="mt-0.5 shrink-0 text-accent" size={22} />
          <div>
            <p className="text-balance text-base text-white/90 sm:text-lg">
              {quote.text}
            </p>
            <p className="mt-2 text-xs uppercase tracking-wider text-muted">
              {quote.author}
            </p>
          </div>
        </GlassCard>
      </motion.div>

      {/* Four cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {cards.map((c, i) => (
          <motion.div key={c.href} {...rise(0.16 + i * 0.05)}>
            <Link href={c.href} className="block">
              <GlassCard
                hover
                className={`group relative overflow-hidden bg-gradient-to-br ${c.tint} to-transparent p-6`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
                    <c.Icon size={20} className="text-white" />
                  </div>
                  <ArrowUpRight
                    size={20}
                    className="text-muted transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-white"
                  />
                </div>
                <div className="mt-8">
                  <div className="text-4xl font-bold tracking-tight">
                    <AnimatedNumber value={c.value} suffix={c.suffix ?? ""} />
                  </div>
                  <div className="mt-1 text-sm font-medium text-white">
                    {c.label}
                  </div>
                  <div className="text-xs text-muted">{c.sub}</div>
                </div>
              </GlassCard>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* The ascent — overall progress as altitude */}
      <motion.div {...rise(0.4)}>
        <GlassCard className="mt-6 p-6">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <span className="text-sm font-medium">The ascent</span>
              <p className="text-xs text-muted">
                Your overall progress toward the summit
              </p>
            </div>
            <span className="text-2xl font-bold tabular-nums">
              <AnimatedNumber value={overall} suffix="%" />
            </span>
          </div>
          <AscentProgress value={overall} />
        </GlassCard>
      </motion.div>
    </div>
  );
}

function Momentum({
  Icon,
  color,
  label,
  main,
  unit,
}: {
  Icon: typeof Flame;
  color: string;
  label: string;
  main: React.ReactNode;
  unit: string;
}) {
  return (
    <div className="flex items-center gap-4 p-6">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/[0.06]">
        <Icon size={20} className={color} />
      </div>
      <div className="min-w-0">
        <div className="text-xs uppercase tracking-wider text-muted">
          {label}
        </div>
        <div className="mt-0.5 flex items-baseline gap-1.5">
          <span className="text-2xl font-bold">{main}</span>
          <span className="truncate text-xs text-muted">{unit}</span>
        </div>
      </div>
    </div>
  );
}
