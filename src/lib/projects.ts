// ISA — Project intelligence. Deterministic health + prepared AI metadata.
import type { Project, ProjectTask, ProjectStatus } from "@/lib/types";

export const PROJECT_STATUSES: { id: ProjectStatus; label: string; tone: string }[] = [
  { id: "active", label: "Active", tone: "text-emerald-300 bg-emerald-300/10" },
  { id: "on_hold", label: "On Hold", tone: "text-amber-300 bg-amber-300/10" },
  { id: "completed", label: "Completed", tone: "text-accent bg-accent/15" },
  { id: "archived", label: "Archived", tone: "text-muted bg-white/5" },
];
// Legacy values map onto the new set for display.
const LEGACY: Record<string, ProjectStatus> = { planning: "active", paused: "on_hold", done: "completed" };
export const normalizeStatus = (s: string): ProjectStatus => (LEGACY[s] ?? s) as ProjectStatus;
export const statusMeta = (s: string) => {
  const n = normalizeStatus(s);
  return PROJECT_STATUSES.find((x) => x.id === n) ?? PROJECT_STATUSES[0];
};

export type ProjectHealth = "excellent" | "good" | "attention" | "at_risk" | "stalled";
export const HEALTH_META: Record<ProjectHealth, { label: string; tone: string }> = {
  excellent: { label: "Excellent", tone: "text-emerald-300" },
  good: { label: "Good", tone: "text-fg/80" },
  attention: { label: "Needs Attention", tone: "text-amber-300" },
  at_risk: { label: "At Risk", tone: "text-orange-300" },
  stalled: { label: "Stalled", tone: "text-red-300" },
};

const daysBetween = (a: number, b: number) => Math.round((b - a) / 86_400_000);

/** Health ≠ progress. Blends recent activity, progress, and deadline distance. */
export function projectHealth(project: Project, tasks: ProjectTask[], pct: number): ProjectHealth {
  const now = Date.now();
  const lastActivity = project.last_activity_at ? new Date(project.last_activity_at).getTime() : new Date(project.created_at).getTime();
  const idleDays = daysBetween(lastActivity, now);
  const daysLeft = project.target_date ? daysBetween(now, new Date(project.target_date).getTime()) : null;

  if (normalizeStatus(project.status) === "completed" || pct >= 100) return "excellent";
  if (idleDays >= 21) return "stalled";
  if (daysLeft != null && daysLeft < 0) return "at_risk";
  if (daysLeft != null && daysLeft <= 7 && pct < 60) return "at_risk";
  if (idleDays >= 10) return "attention";
  if (daysLeft != null && daysLeft <= 21 && pct < 40) return "attention";
  if (idleDays <= 3 && pct >= 40) return "excellent";
  return "good";
}

/** Deterministic metadata for the future AI layer (stored in projects.ai_meta,
 *  never shown). Scores stay null until the model exists — honest. */
export function prepareProjectMeta(title: string): Record<string, unknown> {
  const keywords = [...new Set(title.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 3))].slice(0, 6);
  return {
    keywords,
    importance: null, priority: null, completion_confidence: null, risk_score: null,
    momentum: null, productivity: null, estimated_completion: null,
    prepared_at: new Date().toISOString(),
  };
}
