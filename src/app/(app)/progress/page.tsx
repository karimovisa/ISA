"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { useCollection } from "@/hooks/useCollection";
import { GlassCard } from "@/components/ui/GlassCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { RunningSection } from "@/components/sections/RunningSection";
import { WeeklyReviewHistory } from "@/components/sections/WeeklyReviewHistory";
import type { FocusSession, Project } from "@/lib/types";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function last7Days(): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push({ key: d.toDateString(), label: DAY_LABELS[d.getDay()] });
  }
  return out;
}

const tooltipStyle = {
  background: "rgba(20,20,22,0.95)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 12,
  fontSize: 12,
};

export default function ProgressPage() {
  const focus = useCollection<FocusSession>("focus_sessions");
  const projects = useCollection<Project>("projects");

  const days = useMemo(() => last7Days(), []);

  const studyData = useMemo(() => {
    return days.map((d) => {
      const seconds = focus.data
        .filter((s) => new Date(s.created_at).toDateString() === d.key)
        .reduce((sum, s) => sum + s.duration_seconds, 0);
      return { day: d.label, hours: +(seconds / 3600).toFixed(2) };
    });
  }, [days, focus.data]);

  const productivityData = useMemo(() => {
    return days.map((d) => {
      const sessions = focus.data.filter(
        (s) => new Date(s.created_at).toDateString() === d.key
      ).length;
      const minutes =
        focus.data
          .filter((s) => new Date(s.created_at).toDateString() === d.key)
          .reduce((sum, s) => sum + s.duration_seconds, 0) / 60;
      return { day: d.label, score: Math.min(100, Math.round(minutes + sessions * 5)) };
    });
  }, [days, focus.data]);

  const projectData = useMemo(
    () =>
      projects.data.map((p) => ({
        name: p.title.length > 12 ? p.title.slice(0, 12) + "…" : p.title,
        percentage: p.percentage,
      })),
    [projects.data]
  );

  const totalStudy = studyData.reduce((s, d) => s + d.hours, 0);

  return (
    <div>
      <PageHeader
        title="Progress"
        subtitle="The numbers behind the momentum. Last 7 days."
      />

      {/* Running */}
      <div className="mb-6">
        <RunningSection />
      </div>

      {/* Summary tiles */}
      <div className="mb-6 grid grid-cols-3 gap-3 sm:gap-5">
        <Stat label="Focus (7d)" value={`${totalStudy.toFixed(1)}h`} />
        <Stat label="Focus sessions" value={`${focus.data.length}`} />
        <Stat label="Projects" value={`${projects.data.length}`} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Focus hours */}
        <ChartCard title="Focus hours" delay={0}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={studyData}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--color-line)"
                vertical={false}
              />
              <XAxis dataKey="day" stroke="var(--color-muted)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--color-muted)" fontSize={12} tickLine={false} axisLine={false} width={28} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
              <Bar dataKey="hours" radius={[6, 6, 0, 0]} fill="var(--color-fg)" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Weekly productivity */}
        <ChartCard title="Weekly productivity" delay={0.05}>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={productivityData}>
              <defs>
                <linearGradient id="prodGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-fg)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--color-fg)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" vertical={false} />
              <XAxis dataKey="day" stroke="var(--color-muted)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--color-muted)" fontSize={12} tickLine={false} axisLine={false} width={28} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="score" stroke="var(--color-fg)" strokeWidth={2} fill="url(#prodGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Project progress */}
        <ChartCard title="Project progress" delay={0.1} className="lg:col-span-2">
          {projectData.length === 0 ? (
            <div className="flex h-[220px] items-center justify-center text-sm text-muted">
              No projects yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={projectData} layout="vertical" margin={{ left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} stroke="var(--color-muted)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" stroke="var(--color-muted)" fontSize={11} tickLine={false} axisLine={false} width={84} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Bar dataKey="percentage" radius={[0, 6, 6, 0]} fill="var(--color-fg)" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <div className="mt-6">
        <WeeklyReviewHistory />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <GlassCard className="p-5">
      <div className="text-xs uppercase tracking-wider text-muted">{label}</div>
      <div className="mt-1.5 text-2xl font-bold tabular-nums">{value}</div>
    </GlassCard>
  );
}

function ChartCard({
  title,
  children,
  delay,
  className,
}: {
  title: string;
  children: React.ReactNode;
  delay: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className={className}
    >
      <GlassCard className="p-6">
        <h3 className="mb-5 text-sm font-medium">{title}</h3>
        {children}
      </GlassCard>
    </motion.div>
  );
}
