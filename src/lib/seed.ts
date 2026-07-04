import { supabase } from "@/lib/supabase/client";

/**
 * Seeds the signed-in user's account with the starter data from the spec,
 * but only the first time (when a table is still empty). Safe to call on
 * every dashboard mount.
 */
export async function seedDefaults(userId: string): Promise<boolean> {
  // Plain select (HEAD/count-only requests were returning 503 on this project).
  const { data: existing } = await supabase.from("goals").select("id").limit(1);
  if (existing && existing.length > 0) return false;

  const goals = [
    {
      title: "IELTS 7.0",
      percentage: 62,
      deadline: "2026-10-01",
      motivation: "A global door opens with every band.",
    },
    {
      title: "Running",
      percentage: 40,
      deadline: "2026-12-01",
      motivation: "Discipline built one kilometer at a time.",
    },
    {
      title: "Personal Brand",
      percentage: 25,
      deadline: "2026-12-31",
      motivation: "Show the world what you build.",
    },
    {
      title: "Website Development",
      percentage: 55,
      deadline: "2026-09-01",
      motivation: "Ship beautiful things, consistently.",
    },
  ];

  const projects = [
    { title: "Birthday Website", status: "active", percentage: 90, tasks_total: 10, tasks_done: 9 },
    { title: "Video Project", status: "active", percentage: 45, tasks_total: 8, tasks_done: 4 },
    { title: "Life OS", status: "active", percentage: 30, tasks_total: 12, tasks_done: 4 },
    { title: "Content Creation", status: "planning", percentage: 15, tasks_total: 6, tasks_done: 1 },
  ];

  const ideas = [
    { content: "Wheat field cinematic reel.", tag: "Video" },
    { content: "Minimal fashion brand.", tag: "Brand" },
    { content: "Running motivation video.", tag: "Video" },
    { content: "AI productivity project.", tag: "Product" },
  ];

  await Promise.all([
    supabase.from("goals").insert(goals.map((g) => ({ ...g, user_id: userId }))),
    supabase.from("projects").insert(projects.map((p) => ({ ...p, user_id: userId }))),
    supabase.from("ideas").insert(ideas.map((i) => ({ ...i, user_id: userId }))),
  ]);

  return true;
}
