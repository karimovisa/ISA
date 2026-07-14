"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Trash2, Pencil, Search, ChevronDown, Sparkles, Lock } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { GlassCard } from "@/components/ui/GlassCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { labelClass } from "@/components/ui/Modal";
import { MoodPicker } from "@/components/sections/MoodPicker";
import { PressButton } from "@/components/ui/PressButton";
import { useEntitlements } from "@/components/EntitlementProvider";
import { todayISO } from "@/lib/datetime";
import { toast } from "@/lib/toast";
import { useT } from "@/lib/i18n";
import { MOOD_COLORS, MOOD_LABELS } from "@/lib/mood";
import { captureLifeEvent } from "@/lib/life-events";
import type { JournalEntry, MoodLog } from "@/lib/types";

const PAGE = 8;
const wordsOf = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

export default function JournalPage() {
  const { user } = useAuth();
  const { t } = useT();
  const { canUse } = useEntitlements();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [moods, setMoods] = useState<Record<string, number>>({});
  const [draft, setDraft] = useState({ did_today: "", learned: "", tomorrow: "" });
  const [editingDate, setEditingDate] = useState<string | null>(null); // null = today
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [moodFilter, setMoodFilter] = useState<number | null>(null);
  const [visible, setVisible] = useState(PAGE);
  const startedAt = useRef<number | null>(null);

  const today = todayISO();
  const activeDate = editingDate ?? today;
  const draftKey = `isa_journal_draft_${activeDate}`;

  const load = useCallback(async () => {
    const [{ data: js }, { data: ms }] = await Promise.all([
      supabase.from("journal_entries").select("*").order("entry_date", { ascending: false }),
      supabase.from("mood_logs").select("date, mood_score"),
    ]);
    const list = (js as JournalEntry[]) ?? [];
    setEntries(list);
    setMoods(Object.fromEntries(((ms as Pick<MoodLog, "date" | "mood_score">[]) ?? []).map((m) => [m.date, m.mood_score])));
    if (editingDate === null) {
      const todays = list.find((e) => e.entry_date === today);
      const cached = typeof window !== "undefined" ? localStorage.getItem(draftKey) : null;
      if (todays) setDraft({ did_today: todays.did_today ?? "", learned: todays.learned ?? "", tomorrow: todays.tomorrow ?? "" });
      else if (cached) setDraft(JSON.parse(cached));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today]);
  useEffect(() => { load(); }, [load]);

  // Auto-save draft (debounced) while writing today's entry.
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
    if (error) { toast("Couldn't save your entry — please try again.", "error"); return; }
    localStorage.removeItem(draftKey);
    const mins = startedAt.current ? Math.round((Date.now() - startedAt.current) / 60000) : 0;
    startedAt.current = null;
    setSaved(true); setTimeout(() => setSaved(false), 1800);
    toast("Journal entry saved ✓", "success");
    void captureLifeEvent({ type: "JournalCreated", occurredAt: activeDate, payload: { words, writeMinutes: mins }, context: { outcome: "consistency" } });
    // Clear the editor so it's ready for the next entry, then refresh the list
    // (don't call load() — it would re-populate the editor with what we just saved).
    setEditingDate(null);
    setDraft({ did_today: "", learned: "", tomorrow: "" });
    const { data } = await supabase
      .from("journal_entries")
      .select("*")
      .order("entry_date", { ascending: false });
    setEntries((data as JournalEntry[]) ?? []);
  };

  const editEntry = (e: JournalEntry) => {
    setEditingDate(e.entry_date);
    setDraft({ did_today: e.did_today ?? "", learned: e.learned ?? "", tomorrow: e.tomorrow ?? "" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const cancelEdit = () => { setEditingDate(null); setDraft({ did_today: "", learned: "", tomorrow: "" }); };
  const removeEntry = async (id: string) => { await supabase.from("journal_entries").delete().eq("id", id); load(); };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      if (moodFilter != null && moods[e.entry_date] !== moodFilter) return false;
      if (!q) return true;
      const hay = `${e.entry_date} ${e.did_today ?? ""} ${e.learned ?? ""} ${e.tomorrow ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [entries, moods, query, moodFilter]);

  return (
    <div>
      <PageHeader title="Journal" subtitle="Your life, in your words — and ISA's long-term memory." />

      {/* Writer */}
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
        <GlassCard className="p-6 sm:p-8">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-sm font-medium uppercase tracking-wider text-muted">
              {editingDate ? `${t("Editing")} · ${editingDate}` : t("Today")}
            </h2>
            <div className="flex items-center gap-3 text-xs text-muted">
              <span>{words} {t("words")}</span>
              <span>· {readMin} {t("min read")}</span>
              {editingDate && <button onClick={cancelEdit} className="text-accent">{t("Cancel")}</button>}
            </div>
          </div>
          <textarea rows={7} value={draft.did_today} onChange={(e) => setDraft({ ...draft, did_today: e.target.value })}
            placeholder={t("Write about your day — what happened, what's on your mind, anything…")}
            className="w-full resize-none rounded-2xl border border-line bg-white/[0.02] p-4 text-[15px] leading-relaxed text-fg/90 placeholder:text-muted/50 focus:border-accent/50" />
          <div className="mt-5 grid gap-5 border-t border-line pt-5 sm:grid-cols-2">
            <div>
              <label className={labelClass}>{t("What did I learn? (optional)")}</label>
              <textarea rows={2} value={draft.learned} onChange={(e) => setDraft({ ...draft, learned: e.target.value })}
                placeholder={t("Write freely…")} className="w-full resize-none border-b border-line bg-transparent pb-2 text-sm text-fg/90 placeholder:text-muted/50 focus:border-accent/50" />
            </div>
            <div>
              <label className={labelClass}>{t("What will I do tomorrow? (optional)")}</label>
              <textarea rows={2} value={draft.tomorrow} onChange={(e) => setDraft({ ...draft, tomorrow: e.target.value })}
                placeholder={t("Write freely…")} className="w-full resize-none border-b border-line bg-transparent pb-2 text-sm text-fg/90 placeholder:text-muted/50 focus:border-accent/50" />
            </div>
          </div>
          {!editingDate && <div className="mt-6 border-t border-line pt-5"><MoodPicker /></div>}
          <PressButton onClick={save} disabled={busy}
            className="mt-7 flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50">
            {saved ? <Check size={16} /> : null}{saved ? t("Saved") : busy ? t("Saving…") : t("Save entry")}
          </PressButton>
        </GlassCard>
      </motion.div>

      {/* Pro reflection placeholder */}
      <GlassCard className="mt-4 flex items-center gap-3 p-4">
        <Sparkles size={16} className="shrink-0 text-accent" />
        <p className="flex-1 text-xs text-muted">
          {canUse("monthly_review")
            ? t("ISA is reading your entries into weekly & monthly reflections and personal memories.")
            : t("AI reflections & memory extraction (people, places, lessons) are a Pro feature.")}
        </p>
        {!canUse("monthly_review") && <Lock size={13} className="shrink-0 text-muted" />}
      </GlassCard>

      {/* Search + history */}
      {entries.length > 0 && (
        <div className="mt-10">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex flex-1 items-center gap-2 rounded-xl border border-line bg-white/[0.02] px-3 py-2">
              <Search size={15} className="text-muted" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("Search entries, dates, words…")}
                className="min-w-0 flex-1 bg-transparent text-sm text-fg placeholder:text-muted/60" />
            </div>
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((m) => (
                <button key={m} onClick={() => setMoodFilter(moodFilter === m ? null : m)} title={MOOD_LABELS[m]}
                  className="h-6 w-6 rounded-full transition" style={{ backgroundColor: MOOD_COLORS[m], opacity: moodFilter === null || moodFilter === m ? 1 : 0.3, boxShadow: moodFilter === m ? "0 0 0 2px rgba(255,255,255,0.5)" : undefined }} />
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {filtered.slice(0, visible).map((e) => {
              const mood = moods[e.entry_date];
              const isOpen = expanded === e.id;
              const preview = (e.did_today ?? e.learned ?? e.tomorrow ?? "").slice(0, 140);
              return (
                <motion.div key={e.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <GlassCard className="group p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2.5">
                        {mood != null && <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: MOOD_COLORS[mood] }} title={MOOD_LABELS[mood]} />}
                        <span className="text-sm font-medium text-accent">
                          {e.entry_date === today ? t("Today") : new Date(e.entry_date).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
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
                      <p className="mt-2 line-clamp-2 text-sm text-fg/80">{preview}{preview.length >= 140 ? "…" : ""}</p>
                    ) : (
                      <AnimatePresence>
                        <motion.dl initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-3 space-y-2 overflow-hidden text-sm">
                          {e.did_today && <div><dt className="text-xs text-muted">{t("Today")}</dt><dd className="whitespace-pre-wrap text-fg/85">{e.did_today}</dd></div>}
                          {e.learned && <div><dt className="text-xs text-muted">{t("Learned")}</dt><dd className="whitespace-pre-wrap text-fg/85">{e.learned}</dd></div>}
                          {e.tomorrow && <div><dt className="text-xs text-muted">{t("Tomorrow")}</dt><dd className="whitespace-pre-wrap text-fg/85">{e.tomorrow}</dd></div>}
                        </motion.dl>
                      </AnimatePresence>
                    )}
                  </GlassCard>
                </motion.div>
              );
            })}
          </div>
          {filtered.length === 0 && <p className="py-8 text-center text-sm text-muted">{t("No entries match your search.")}</p>}
          {visible < filtered.length && (
            <button onClick={() => setVisible((v) => v + PAGE)} className="mt-4 w-full rounded-xl border border-line py-2.5 text-sm text-muted transition hover:text-fg">
              {t("Load more")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
