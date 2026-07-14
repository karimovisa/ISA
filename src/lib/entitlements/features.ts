// ISA — Entitlements · feature registry + labels. Feature keys mirror the
// plan_features table; the PLAN → feature matrix itself lives in the DB.
export const FEATURES = {
  core_modules: "Core modules",
  memory_engine: "Memory engine",
  basic_insights: "Basic insights",
  weekly_review: "Weekly review",
  export_json: "Data export (JSON)",
  ai_summaries: "AI summaries",
  exports: "Exports",
  pattern_detection: "Pattern detection",
  ai_predictions: "Predictions",
  ai_coach: "AI coach",
  monthly_review: "Monthly review",
  yearly_review: "Yearly review",
  deep_analytics: "Deep analytics",
  nl_search: "Natural-language search",
  export_pdf: "PDF export",
  unlimited_history: "Unlimited history",
} as const;

export type FeatureKey = keyof typeof FEATURES;

export const PLAN_LABELS: Record<string, string> = {
  free: "Free", pro: "Pro", education: "Education", family: "Family",
  team: "Team", lifetime: "Lifetime", enterprise: "Enterprise",
};
export const STATUS_LABELS: Record<string, string> = {
  active: "Active", trial: "Trial", expired: "Expired",
  cancelled: "Cancelled", paused: "Paused", lifetime: "Lifetime",
};
