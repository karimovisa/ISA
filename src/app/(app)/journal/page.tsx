"use client";

// ISA — Journaling. A calm, distraction-free writing space, not a notes app.
// Two-column: a single large editor (Apple-Notes calm) with a glass writing card,
// and a quiet sidebar of streak / goals / memory / recent. Monochrome with one
// accent. Colors follow the app theme (Midnight ≈ the requested dark palette).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarDays, Flame, ChevronRight, Sparkles, Check, Pencil, Trash2, Search,
  ChevronDown, Brain, Lock, PenLine, Angry, Frown, Meh, Smile, Laugh,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { PressButton } from "@/components/ui/PressButton";
import { useEntitlements } from "@/components/EntitlementProvider";
import { todayISO } from "@/lib/datetime";
import { toast } from "@/lib/toast";
import { useT } from "@/lib/i18n";
import { MOOD_LABELS } from "@/lib/mood";
import { captureLifeEvent } from "@/lib/life-events";
import type { JournalEntry, MoodLog } from "@/lib/types";

const CARD = "rounded-[28px] border border-line bg-[var(--color-card)]";
const wordsOf = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const entryWords = (e: JournalEntry) => wordsOf(`${e.did_today ?? ""} ${e.learned ?? ""} ${e.tomorrow ?? ""}`);

const MOOD_FACES = [Angry, Frown, Meh, Smile, Laugh];
const TABS = ["Today", "Archive", "Insights", "Statistics"] as const;
type Tab = (typeof TABS)[number];

const CHIPS: { label: string; prompt: string }[] = [
  { label: "Goals", prompt: "Goals:\n" },
  { label: "Gratitude", prompt: "Grateful for:\n" },
  { label: "Lessons", prompt: "What I learned:\n" },
  { label: "Ideas", prompt: "Ideas:\n" },
  { label: "Mood", prompt: "How I feel:\n" },
];

const dayMs = 86_400_000;
const startOf = (d: string | number) => new Date(new Date(d).setHours(0, 0, 0, 0)).getTime();

function longestStreak(entries: JournalEntry[]): number {
  const days = [...new Set(entries.map((e) => startOf(e.entry_date)))].sort((a, b) => a - b);
  let max = 0, cur = 0, prev: number | null = null;
  for (const d of days) {
    cur = prev != null && d - prev === dayMs ? cur + 1 : 1;
    max = Math.max(max, cur);
    prev = d;
  }
  return max;
}
function currentStreak(entries: JournalEntry[]): number {
  const days = new Set(entries.map((e) => startOf(e.entry_date)));
  const today = startOf(Date.now());
  let cursor = days.has(today) ? today : today - dayMs;
  if (!days.has(cursor)) return 0;
  let n = 0;
  while (days.has(cursor)) { n++; cursor -= dayMs; }
  return n;
}

export default function JournalPage() {
  const { user } = useAuth();
  const { t } = useT();
  const { canUse } = useEntitlements();

  const [tab, setTab] = useState<Tab>("Today");
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [moods, setMoods] = useState<Record<string, number>>({});
  const [draft, setDraft] = useState({ did_today: "", learned: "", tomorrow: "" });
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const startedAt = useRef<number | null>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);

  const today = todayISO();
  const activeDate = editingDate ?? today;
  const draftKey = `isa_journal_draft_${activeDate}`;
  const todayMood = moods[today] ?? null;

  const load = useCallback(async () => {
    const [{ data: js }, { data: ms }] = await Promise.all([
      supabase.from("journal_entries").select("*").order("entry_date", { ascending: false }),
      supabase.from("mood_logs").select("date, mood_score"),
    ]);
    setEntries((js as JournalEntry[]) ?? []);
    setMoods(Object.fromEntries(((ms as Pick<MoodLog, "date" | "mood_score">[]) ?? []).map((m) => [m.date, m.mood_score])));
    if (editingDate === null) {
      // Only restore an in-progress draft — never re-hydrate a saved entry.
      const cached = typeof window !== "undefined" ? localStorage.getItem(draftKey) : null;
      if (cached) setDraft(JSON.parse(cached));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!startedAt.current && (draft.did_today || draft.learned || draft.tomorrow)) startedAt.current = Date.now();
    const id = setTimeout(() => {
      if (draft.did_today || draft.learned || draft.tomorrow) localStorage.setItem(draftKey, JSON.stringify(draft));
    }, 800);
    return () => clearTimeout(id);
  }, [draft, draftKey]);

  const words = wordsOf(draft.did_today) + wordsOf(draft.learned) + wordsOf(draft.tomorrow);
  const readMin = Math.max(1, Math.ceil(words / 200));

  const save = async () => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("journal_entries").upsert(
      { user_id: user.id, entry_date: activeDate, ...draft }, { onConflict: "user_id,entry_date" });
    setBusy(false);
    if (error) { toast(t("Couldn't save your entry — please try again."), "error"); return; }
    localStorage.removeItem(draftKey);
    const mins = startedAt.current ? Math.round((Date.now() - startedAt.current) / 60000) : 0;
    startedAt.current = null;
    setSaved(true); setTimeout(() => setSaved(false), 1800);
    toast(t("Journal entry saved ✓"), "success");
    void captureLifeEvent({ type: "JournalCreated", occurredAt: activeDate, payload: { words, writeMinutes: mins }, context: { outcome: "consistency" } });
    setEditingDate(null);
    setDraft({ did_today: "", learned: "", tomorrow: "" });
    const { data } = await supabase.from("journal_entries").select("*").order("entry_date", { ascending: false });
    setEntries((data as JournalEntry[]) ?? []);
  };

  const setMood = async (score: number) => {
    if (!user) return;
    const next = todayMood === score ? null : score;
    setMoods((m) => ({ ...m, [today]: next as number }));
    if (next == null) {
      await supabase.from("mood_logs").delete().eq("date", today);
      return;
    }
    await supabase.from("mood_logs").upsert({ user_id: user.id, date: today, mood_score: next }, { onConflict: "user_id,date" });
    void captureLifeEvent({ type: "MoodLogged", occurredAt: today, payload: { mood: next }, emotionalImpact: (next - 3) / 2, context: { outcome: "informational" } });
  };

  const insertChip = (prompt: string) => {
    setDraft((d) => ({ ...d, did_today: d.did_today ? `${d.did_today.replace(/\s*$/, "")}\n\n${prompt}` : prompt }));
    requestAnimationFrame(() => { const el = editorRef.current; if (el) { el.focus(); el.selectionStart = el.selectionEnd = el.value.length; } });
  };

  const editEntry = (e: JournalEntry) => {
    setTab("Today");
    setEditingDate(e.entry_date);
    setDraft({ did_today: e.did_today ?? "", learned: e.learned ?? "", tomorrow: e.tomorrow ?? "" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const cancelEdit = () => { setEditingDate(null); setDraft({ did_today: "", learned: "", tomorrow: "" }); };
  const removeEntry = async (id: string) => { await supabase.from("journal_entries").delete().eq("id", id); load(); };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) => `${e.entry_date} ${e.did_today ?? ""} ${e.learned ?? ""} ${e.tomorrow ?? ""}`.toLowerCase().includes(q));
  }, [entries, query]);

  const streak = currentStreak(entries);
  const longest = longestStreak(entries);
  const avgWords = entries.length ? Math.round(entries.reduce((s, e) => s + entryWords(e), 0) / entries.length) : 0;
  const monthKey = today.slice(0, 7);
  const thisMonth = entries.filter((e) => e.entry_date.startsWith(monthKey)).length;

  const memory = useMemo(() => {
    const old = entries.filter((e) => Date.now() - new Date(e.entry_date).getTime() > 3 * dayMs && (e.did_today || e.learned));
    if (!old.length) return null;
    const target = Date.now() - 14 * dayMs;
    return old.reduce((best, e) =>
      Math.abs(new Date(e.entry_date).getTime() - target) < Math.abs(new Date(best.entry_date).getTime() - target) ? e : best);
  }, [entries]);

  const fmtDate = (d: string, opts: Intl.DateTimeFormatOptions = { weekday: "long", month: "long", day: "numeric" }) =>
    new Date(d).toLocaleDateString([], opts);

  return (
    <div className="mx-auto max-w-[1500px]">
      {/* Header */}
      <motion.header initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-[52px] lg:leading-[1.05]">{t("Journaling")}</h1>
        <p className="mt-3 max-w-xl text-[15px] text-muted sm:text-[17px]">
          {t("Your life, in your words — and ISA's long-term memory.")}
        </p>
        <div className="mt-6 flex gap-6 border-b border-line">
          {TABS.map((tb) => (
            <button key={tb} onClick={() => setTab(tb)} className="relative -mb-px pb-3 text-sm font-medium transition"
              style={{ color: tab === tb ? "var(--color-fg)" : "var(--color-muted)" }}>
              {t(tb)}
              {tab === tb && <motion.span layoutId="jtab" className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-accent" />}
            </button>
          ))}
        </div>
      </motion.header>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_400px]">
        {/* ── LEFT ── */}
        <div className="min-w-0">
          {tab === "Today" && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
              <div className={`${CARD} p-6 sm:p-8`}>
                {/* top row */}
                <div className="mb-6 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/[0.04]">
                      <CalendarDays size={18} className="text-accent" />
                    </span>
                    <div>
                      <div className="text-[15px] font-semibold">{editingDate ? fmtDate(editingDate) : t("Today's journal")}</div>
                      <div className="text-xs text-muted">{fmtDate(activeDate)}{editingDate && ` · ${t("Editing")}`}</div>
                    </div>
                  </div>
                  {/* mood — outlined faces, monochrome */}
                  <div className="flex items-center gap-1">
                    {MOOD_FACES.map((Face, i) => {
                      const score = i + 1;
                      const on = todayMood === score;
                      return (
                        <button key={score} onClick={() => setMood(score)} title={MOOD_LABELS[score]}
                          className="flex h-9 w-9 items-center justify-center rounded-full transition"
                          style={on ? { background: "color-mix(in srgb, var(--color-accent) 16%, transparent)" } : undefined}>
                          <Face size={19} className={on ? "text-accent" : "text-muted transition hover:text-fg"} strokeWidth={on ? 2.2 : 1.8} />
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* editor */}
                <div className="relative">
                  <textarea
                    ref={editorRef}
                    value={draft.did_today}
                    onChange={(e) => setDraft({ ...draft, did_today: e.target.value })}
                    placeholder={t("Start writing…")}
                    className="min-h-[360px] w-full resize-none rounded-[22px] border border-line bg-white/[0.02] p-6 text-[17px] leading-[1.75] text-fg/90 placeholder:text-muted/40 focus:border-accent/40 focus:outline-none"
                  />
                  <span className="pointer-events-none absolute bottom-4 right-5 text-xs tabular-nums text-muted/70">
                    {words} {t("words")} · {readMin} {t("min read")}
                  </span>
                </div>

                {/* quick inserts */}
                <div className="mt-5 flex flex-wrap gap-2">
                  {CHIPS.map((c) => (
                    <button key={c.label} onClick={() => insertChip(t(c.prompt))}
                      className="rounded-full border border-line bg-white/[0.02] px-3.5 py-1.5 text-xs text-fg/80 transition hover:bg-white/[0.06]">
                      {t(c.label)}
                    </button>
                  ))}
                </div>

                {/* bottom actions */}
                <div className="mt-7 flex items-center justify-between gap-3">
                  <PressButton onClick={save} disabled={busy}
                    className="flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50">
                    {saved ? <Check size={16} /> : null}{saved ? t("Saved") : busy ? t("Saving…") : t("Save entry")}
                  </PressButton>
                  {editingDate && <button onClick={cancelEdit} className="text-sm text-muted transition hover:text-fg">{t("Cancel")}</button>}
                </div>
              </div>

              {/* Journal Insights */}
              <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
                <StatCard Icon={Flame} label={t("Longest streak")} value={String(longest)} sub={t("days")} />
                <StatCard Icon={PenLine} label={t("Total entries")} value={String(entries.length)} sub={t("entries")} />
                <StatCard Icon={Sparkles} label={t("Avg words")} value={String(avgWords)} sub={t("per entry")} />
                <StatCard Icon={CalendarDays} label={t("This month")} value={String(thisMonth)} sub={t("entries")} />
              </div>
            </motion.div>
          )}

          {tab === "Archive" && (
            <div>
              <div className="mb-4 flex items-center gap-2 rounded-2xl border border-line bg-white/[0.02] px-4 py-2.5">
                <Search size={16} className="text-muted" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("Search entries, dates, words…")}
                  className="min-w-0 flex-1 bg-transparent text-sm text-fg placeholder:text-muted/60 focus:outline-none" />
              </div>
              <div className="space-y-3">
                {filtered.map((e) => {
                  const mood = moods[e.entry_date];
                  const isOpen = expanded === e.id;
                  const preview = (e.did_today ?? e.learned ?? e.tomorrow ?? "").slice(0, 160);
                  return (
                    <div key={e.id} className={`${CARD} group p-5`}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2.5">
                          {mood != null && <span className="text-accent">{moodFace(mood)}</span>}
                          <span className="text-sm font-medium text-accent">
                            {e.entry_date === today ? t("Today") : fmtDate(e.entry_date, { weekday: "short", month: "short", day: "numeric" })}
                          </span>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <button onClick={() => editEntry(e)} className="rounded-lg p-1.5 text-muted transition hover:text-fg"><Pencil size={14} /></button>
                          <button onClick={() => removeEntry(e.id)} className="rounded-lg p-1.5 text-muted transition hover:text-red-400"><Trash2 size={14} /></button>
                          <button onClick={() => setExpanded(isOpen ? null : e.id)} className="rounded-lg p-1.5 text-muted transition hover:text-fg">
                            <motion.span animate={{ rotate: isOpen ? 180 : 0 }}><ChevronDown size={15} /></motion.span>
                          </button>
                        </div>
                      </div>
                      {!isOpen ? (
                        <p className="mt-2 line-clamp-2 text-sm text-fg/80">{preview}{preview.length >= 160 ? "…" : ""}</p>
                      ) : (
                        <dl className="mt-3 space-y-2 text-sm">
                          {e.did_today && <div><dt className="text-xs text-muted">{t("Today")}</dt><dd className="whitespace-pre-wrap text-fg/85">{e.did_today}</dd></div>}
                          {e.learned && <div><dt className="text-xs text-muted">{t("Learned")}</dt><dd className="whitespace-pre-wrap text-fg/85">{e.learned}</dd></div>}
                          {e.tomorrow && <div><dt className="text-xs text-muted">{t("Tomorrow")}</dt><dd className="whitespace-pre-wrap text-fg/85">{e.tomorrow}</dd></div>}
                        </dl>
                      )}
                    </div>
                  );
                })}
                {filtered.length === 0 && <p className="py-12 text-center text-sm text-muted">{t("No entries match your search.")}</p>}
              </div>
            </div>
          )}

          {tab === "Insights" && (
            <div className={`${CARD} p-6 sm:p-8`}>
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/[0.04]"><Brain size={18} className="text-accent" /></span>
                <h2 className="text-lg font-semibold">{t("Reflections")}</h2>
              </div>
              <p className="mt-4 text-[15px] leading-relaxed text-muted">
                {canUse("monthly_review")
                  ? t("ISA is reading your entries into weekly & monthly reflections and personal memories.")
                  : t("AI reflections & memory extraction (people, places, lessons) are a Pro feature.")}
              </p>
              {!canUse("monthly_review") && (
                <span className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs text-muted">
                  <Lock size={12} /> {t("Pro")}
                </span>
              )}
            </div>
          )}

          {tab === "Statistics" && (
            <div className="grid grid-cols-2 gap-4">
              <StatCard Icon={Flame} label={t("Current streak")} value={String(streak)} sub={t("days")} />
              <StatCard Icon={Flame} label={t("Longest streak")} value={String(longest)} sub={t("days")} />
              <StatCard Icon={PenLine} label={t("Total entries")} value={String(entries.length)} sub={t("entries")} />
              <StatCard Icon={Sparkles} label={t("Avg words")} value={String(avgWords)} sub={t("per entry")} />
            </div>
          )}
        </div>

        {/* ── RIGHT SIDEBAR ── */}
        <aside className="space-y-4">
          {/* Streak */}
          <button onClick={() => setTab("Statistics")} className={`${CARD} flex w-full items-center gap-4 p-5 text-left transition hover:-translate-y-0.5 hover:border-white/10`}>
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.04]"><Flame size={19} className="text-accent" /></span>
            <div className="flex-1">
              <div className="text-2xl font-bold tabular-nums leading-none">{streak}</div>
              <div className="mt-1 text-xs text-muted">{t("Writing streak")}</div>
            </div>
            <ChevronRight size={16} className="text-muted" />
          </button>

          {/* Today's Journal Goals */}
          <div className={`${CARD} p-5`}>
            <h3 className="mb-3 text-sm font-semibold">{t("Today's Journal Goals")}</h3>
            <div className="space-y-2.5">
              <GoalRow done={!!draft.did_today.trim() || entries.some((e) => e.entry_date === today)} label={t("Write today")} />
              <GoalRow done={words >= 50} label={t("Reflect (50+ words)")} />
              <GoalRow done={todayMood != null} label={t("Log your mood")} />
            </div>
          </div>

          {/* Memory Reminder */}
          {memory && (
            <div className={`${CARD} p-5`}>
              <div className="mb-2 flex items-center gap-2">
                <Sparkles size={14} className="text-accent" />
                <h3 className="text-sm font-semibold">{t("Memory Reminder")}</h3>
              </div>
              <p className="text-xs text-muted">{fmtDate(memory.entry_date, { month: "long", day: "numeric" })}</p>
              <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-fg/85">{memory.did_today || memory.learned}</p>
              <button onClick={() => editEntry(memory)} className="mt-3 flex items-center gap-1 text-xs font-medium text-accent">
                {t("View Memory")} <ChevronRight size={13} />
              </button>
            </div>
          )}

          {/* Recent Entries */}
          {entries.length > 0 && (
            <div className={`${CARD} p-5`}>
              <h3 className="mb-3 text-sm font-semibold">{t("Recent Entries")}</h3>
              <div className="space-y-1">
                {entries.slice(0, 3).map((e) => (
                  <button key={e.id} onClick={() => editEntry(e)} className="flex w-full items-center gap-3 rounded-xl py-2 text-left transition hover:bg-white/[0.03]">
                    <span className="text-accent">{moodFace(moods[e.entry_date])}</span>
                    <span className="min-w-0 flex-1 truncate text-sm text-fg/85">{(e.did_today || e.learned || t("Entry")).slice(0, 40)}</span>
                    <span className="shrink-0 text-xs text-muted">{fmtDate(e.entry_date, { month: "short", day: "numeric" })}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function moodFace(score?: number) {
  if (score == null) return <span className="inline-block h-3 w-3 rounded-full border border-line" />;
  const Face = MOOD_FACES[Math.min(4, Math.max(0, score - 1))];
  return <Face size={15} strokeWidth={2} />;
}

function GoalRow({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-5 w-5 items-center justify-center rounded-full border transition"
        style={done ? { borderColor: "var(--color-accent)", background: "color-mix(in srgb, var(--color-accent) 18%, transparent)" } : { borderColor: "var(--color-line)" }}>
        {done && <Check size={12} strokeWidth={3} className="text-accent" />}
      </span>
      <span className={`text-sm ${done ? "text-muted line-through" : "text-fg/85"}`}>{label}</span>
    </div>
  );
}

function StatCard({ Icon, label, value, sub }: { Icon: typeof Flame; label: string; value: string; sub: string }) {
  return (
    <div className={`${CARD} p-5 transition hover:-translate-y-0.5 hover:border-white/10`}>
      <Icon size={17} className="text-muted" />
      <div className="mt-4 text-[2rem] font-bold leading-none tabular-nums">{value}</div>
      <div className="mt-1.5 text-sm font-medium text-fg/90">{label}</div>
      <div className="text-xs text-muted">{sub}</div>
    </div>
  );
}
