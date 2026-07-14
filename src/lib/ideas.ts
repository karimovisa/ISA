// ISA — Idea metadata preparation. Deterministic, computed on create/edit and
// stored in ideas.ai_meta (NOT shown in the UI). Structure is ready for a
// future Pro LLM to fill the score fields; today they stay null (honest).
import type { IdeaStatus } from "@/lib/types";

const STOP = new Set(["the", "and", "for", "with", "that", "this", "have", "from", "your", "about", "into", "will", "would", "could", "should", "them", "then", "than", "make", "want", "need", "just", "like", "some", "more", "very"]);

const CATEGORY_KEYWORDS: Record<string, string> = {
  business: "Business", startup: "Business", product: "Business", money: "Business", revenue: "Business",
  app: "Product", feature: "Product", design: "Product", website: "Product", ui: "Product",
  learn: "Learning", study: "Learning", book: "Learning", course: "Learning", read: "Learning",
  health: "Health", fitness: "Health", run: "Health", workout: "Health",
  video: "Content", film: "Content", write: "Content", blog: "Content", reel: "Content",
  travel: "Life", family: "Life", home: "Life", goal: "Life",
};

export type IdeaMeta = {
  keywords: string[];
  category: string | null;
  // Prepared for future Pro AI — null until the model layer exists.
  importance: number | null;
  relevance: number | null;
  innovation: number | null;
  business: number | null;
  referenced_later: number;
  prepared_at: string;
};

/** Extract deterministic keywords + a coarse category. No fabricated scores. */
export function prepareIdeaMeta(content: string, tag: string | null): IdeaMeta {
  const words = content.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 3 && !STOP.has(w));
  const counts = new Map<string, number>();
  for (const w of words) counts.set(w, (counts.get(w) ?? 0) + 1);
  const keywords = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([w]) => w);
  if (tag) keywords.unshift(tag.toLowerCase());

  let category: string | null = tag ?? null;
  const lc = content.toLowerCase();
  for (const [k, v] of Object.entries(CATEGORY_KEYWORDS)) if (lc.includes(k)) { category = v; break; }

  return {
    keywords: [...new Set(keywords)].slice(0, 8),
    category,
    importance: null, relevance: null, innovation: null, business: null,
    referenced_later: 0,
    prepared_at: new Date().toISOString(),
  };
}

export const IDEA_STATUSES: { id: IdeaStatus; label: string; tone: string }[] = [
  { id: "new", label: "New", tone: "text-muted bg-white/10" },
  { id: "active", label: "Active", tone: "text-accent bg-accent/15" },
  { id: "in_progress", label: "In Progress", tone: "text-amber-300 bg-amber-300/10" },
  { id: "implemented", label: "Implemented", tone: "text-emerald-300 bg-emerald-300/10" },
  { id: "archived", label: "Archived", tone: "text-muted bg-white/5" },
];
export const statusMeta = (s: IdeaStatus) => IDEA_STATUSES.find((x) => x.id === s) ?? IDEA_STATUSES[0];
