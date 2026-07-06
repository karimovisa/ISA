"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { GlassCard } from "@/components/ui/GlassCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { labelClass } from "@/components/ui/Modal";
import { MoodPicker } from "@/components/sections/MoodPicker";
import { PressButton } from "@/components/ui/PressButton";
import { todayISO } from "@/lib/datetime";
import type { JournalEntry } from "@/lib/types";

// did_today is the main free-write; the other two are optional reflection.
const PROMPTS = [
  { key: "did_today", label: "What did I do today?" },
  { key: "learned", label: "What did I learn?" },
  { key: "tomorrow", label: "What will I do tomorrow?" },
] as const;

const OPTIONAL = [
  { key: "learned", label: "What did I learn? (optional)" },
  { key: "tomorrow", label: "What will I do tomorrow? (optional)" },
] as const;

export default function JournalPage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [draft, setDraft] = useState({
    did_today: "",
    learned: "",
    tomorrow: "",
  });
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const today = todayISO();

  const load = async () => {
    const { data } = await supabase
      .from("journal_entries")
      .select("*")
      .order("entry_date", { ascending: false });
    if (data) {
      setEntries(data as JournalEntry[]);
      const todays = (data as JournalEntry[]).find(
        (e) => e.entry_date === today
      );
      if (todays) {
        setDraft({
          did_today: todays.did_today ?? "",
          learned: todays.learned ?? "",
          tomorrow: todays.tomorrow ?? "",
        });
      }
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    if (!user) return;
    setBusy(true);
    await supabase.from("journal_entries").upsert(
      {
        user_id: user.id,
        entry_date: today,
        ...draft,
      },
      { onConflict: "user_id,entry_date" }
    );
    setBusy(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
    load();
  };

  const removeEntry = async (id: string) => {
    await supabase.from("journal_entries").delete().eq("id", id);
    load();
  };

  const past = entries.filter((e) => e.entry_date !== today);

  return (
    <div>
      <PageHeader
        title="Journal"
        subtitle="Write your day. Clear your head."
      />

      {/* Today's reflection */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <GlassCard className="p-6 sm:p-8">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-sm font-medium uppercase tracking-wider text-muted">
              Today
            </h2>
            <span className="text-xs text-muted">{today}</span>
          </div>
          <div className="space-y-6">
            {/* Main free-write — just your day, thoughts, anything. */}
            <div>
              <label className={labelClass}>Today</label>
              <textarea
                rows={7}
                value={draft.did_today}
                onChange={(e) =>
                  setDraft({ ...draft, did_today: e.target.value })
                }
                placeholder="Write about your day — what happened, what's on your mind, anything…"
                className="w-full resize-none rounded-2xl border border-line bg-white/[0.02] p-4 text-[15px] leading-relaxed text-fg/90 placeholder:text-muted/50 focus:border-accent/50"
              />
            </div>

            {/* Optional reflection — only if you want to go deeper. */}
            <div className="grid gap-5 border-t border-line pt-5 sm:grid-cols-2">
              {OPTIONAL.map((p) => (
                <div key={p.key}>
                  <label className={labelClass}>{p.label}</label>
                  <textarea
                    rows={2}
                    value={draft[p.key]}
                    onChange={(e) =>
                      setDraft({ ...draft, [p.key]: e.target.value })
                    }
                    placeholder="Write freely…"
                    className="w-full resize-none border-b border-line bg-transparent pb-2 text-sm leading-relaxed text-fg/90 placeholder:text-muted/50 focus:border-accent/50"
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="mt-6 border-t border-line pt-5">
            <MoodPicker />
          </div>
          <PressButton
            onClick={save}
            disabled={busy}
            className="mt-7 flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white transition duration-200 hover:brightness-110 hover:shadow-[0_8px_24px_-8px_rgba(79,140,255,0.55)] disabled:opacity-50"
          >
            {saved ? <Check size={16} /> : null}
            {saved ? "Saved" : busy ? "Saving…" : "Save entry"}
          </PressButton>
        </GlassCard>
      </motion.div>

      {/* Past entries */}
      {past.length > 0 && (
        <div className="mt-10">
          <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-muted">
            Past entries
          </h2>
          <div className="space-y-4">
            {past.map((e, i) => (
              <motion.div
                key={e.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.04 }}
              >
                <GlassCard className="group p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs font-medium text-accent">
                      {new Date(e.entry_date).toLocaleDateString([], {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                    <button
                      onClick={() => removeEntry(e.id)}
                      className="rounded-lg p-1.5 text-muted opacity-0 transition hover:text-red-400 group-hover:opacity-100"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <dl className="space-y-2 text-sm">
                    {PROMPTS.map((p) =>
                      e[p.key] ? (
                        <div key={p.key}>
                          <dt className="text-xs text-muted">{p.label}</dt>
                          <dd className="text-fg/85">{e[p.key]}</dd>
                        </div>
                      ) : null
                    )}
                  </dl>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
