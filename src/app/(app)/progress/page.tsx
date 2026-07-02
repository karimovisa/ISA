"use client";

import { useMemo, useState } from "react";
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
  Cell,
} from "recharts";
import { Plus } from "lucide-react";
import { useCollection } from "@/hooks/useCollection";
import { GlassCard } from "@/components/ui/GlassCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { fieldClass } from "@/components/ui/Modal";
import { todayISO } from "@/lib/datetime";
import type { FocusSession, Project, RunLog } from "@/lib/types";

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
  const runs = useCollection<RunLog>("runs");
  const projects = useCollection<Project>("projects");
  const [distance, setDistance] = useState("");

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
      const minutes = focus.data
        .filter((s) => new Date(s.created_at).toDateString() === d.key)
        .reduce((sum, s) => sum + s.duration_seconds, 0) / 60;
      // simple score: weighted by minutes, capped at 100
      return { day: d.label, score: Math.min(100, Math.round(minutes + sessions * 5)) };
    });
  }, [days, focus.data]);

  const runData = useMemo(() => {
    return days.map((d) => {
      const km = runs.data
        .filter((r) => new Date(r.log_date).toDateString() === d.key)
        .reduce((sum, r) => sum + Number(r.distance_km), 0);
      return { day: d.label, km: +km.toFixed(1) };
    });
  }, [days, runs.data]);

  const projectData = useMemo(
    () =>
      projects.data.map((p) => ({
        name: p.title.length > 12 ? p.title.slice(0, 12) + "…" : p.title,
        percentage: p.percentage,
      })),
    [projects.data]
  );

  const logRun = async (e: React.FormEvent) => {
    e.preventDefault();
    const km = Number(distance);
    if (!km || km <= 0) return;
    await runs.add({ log_date: todayISO(), distance_km: km });
    setDistance("");
  };

  const totalStudy = studyData.reduce((s, d) => s + d.hours, 0);
  const totalRun = runData.reduce((s, d) => s + d.km, 0);

  return (
    <div>
      <PageHeader
        title="Progress"
        subtitle="The numbers behind the momentum. Last 7 days."
      />

      {/* Summary tiles */}
      <div className="mb-6 grid grid-cols-2 gap-5 sm:grid-cols-4">
        <Stat label="Study (7d)" value={`${totalStudy.toFixed(1)}h`} />
        <Stat label="Running (7d)" value={`${totalRun.toFixed(1)}km`} />
        <Stat label="Sessions" value={`${focus.data.length}`} />
        <Stat label="Projects" value={`${projects.data.length}`} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Study hours */}
        <ChartCard title="Study hours" delay={0}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={studyData}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.05)"
                vertical={false}
              />
              <XAxis dataKey="day" stroke="#a0a0a0" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#a0a0a0" fontSize={12} tickLine={false} axisLine={false} width={28} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
              <Bar dataKey="hours" radius={[6, 6, 0, 0]} fill="#4f8cff" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Weekly productivity */}
        <ChartCard title="Weekly productivity" delay={0.05}>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={productivityData}>
              <defs>
                <linearGradient id="prodGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="day" stroke="#a0a0a0" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#a0a0a0" fontSize={12} tickLine={false} axisLine={false} width={28} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="score" stroke="#22c55e" strokeWidth={2} fill="url(#prodGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Running distance */}
        <ChartCard
          title="Running distance"
          delay={0.1}
          action={
            <form onSubmit={logRun} className="flex items-center gap-2">
              <input
                type="number"
                step="0.1"
                min="0"
                value={distance}
                onChange={(e) => setDistance(e.target.value)}
                placeholder="km"
                className={`${fieldClass} h-9 w-20 px-3 py-1 text-sm`}
              />
              <button
                type="submit"
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-white transition hover:brightness-110"
              >
                <Plus size={16} />
              </button>
            </form>
          }
        >
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={runData}>
              <defs>
                <linearGradient id="runGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4f8cff" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#4f8cff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="day" stroke="#a0a0a0" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#a0a0a0" fontSize={12} tickLine={false} axisLine={false} width={28} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="km" stroke="#4f8cff" strokeWidth={2} fill="url(#runGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Project progress */}
        <ChartCard title="Project progress" delay={0.15}>
          {projectData.length === 0 ? (
            <div className="flex h-[220px] items-center justify-center text-sm text-muted">
              No projects yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={projectData} layout="vertical" margin={{ left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} stroke="#a0a0a0" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" stroke="#a0a0a0" fontSize={11} tickLine={false} axisLine={false} width={84} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Bar dataKey="percentage" radius={[0, 6, 6, 0]}>
                  {projectData.map((_, i) => (
                    <Cell key={i} fill={i % 2 === 0 ? "#4f8cff" : "#22c55e"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
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
  action,
}: {
  title: string;
  children: React.ReactNode;
  delay: number;
  action?: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
    >
      <GlassCard className="p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h3 className="text-sm font-medium">{title}</h3>
          {action}
        </div>
        {children}
      </GlassCard>
    </motion.div>
  );
}
