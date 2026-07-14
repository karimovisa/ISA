// ISA — Reviews API. Deterministic monthly/yearly reviews built by SQL from the
// AI Foundation (Life Events → Memory → Insights). `narrative` is reserved for a
// future LLM; nothing here calls an external model.
import { supabase } from "@/lib/supabase/client";

export type ReviewPeriod = "monthly" | "yearly";
export type Review = {
  id: string;
  period_type: ReviewPeriod;
  period_key: string;
  payload: Record<string, unknown>;
  narrative: string | null;
  seen_at: string | null;
  created_at: string;
};

export async function retrieveReviews(period: ReviewPeriod, limit = 6): Promise<Review[]> {
  const { data } = await supabase
    .from("ai_reviews")
    .select("*")
    .eq("period_type", period)
    .order("period_key", { ascending: false })
    .limit(limit);
  return (data as Review[]) ?? [];
}

/** Generate/refresh a review (Pro-gated server-side). key = 'YYYY-MM' or 'YYYY'. */
export async function generateReview(period: ReviewPeriod, key: string): Promise<boolean> {
  const { error } =
    period === "monthly"
      ? await supabase.rpc("generate_my_monthly_review", { p_month: key })
      : await supabase.rpc("generate_my_yearly_review", { p_year: Number(key) });
  return !error;
}
