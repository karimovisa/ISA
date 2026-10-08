"use client";

// ISA — Reflection, the end of the daily ritual (live → do → reflect). The
// person writes; ISA doesn't. A gentle opening ("Today, I just …") invites the
// first words, and the text is saved as today's journal entry — no trip to the
// Journal page. An optional one-tap verdict feeds the reports' "how the days felt".

import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { todayISO } from "@/lib/datetime";
import { captureLifeEvent } from "@/lib/life-events";
import { invalidateContext } from "@/lib/intelligence";
import { useT } from "@/lib/i18n";

type Verdict = "good" | "ok" | "off";
const VERDICTS: { v: Verdict; label: string }[] = [
  { v: "good", label: "Good day" },
  { v: "ok", label: "It was okay" },
  { v: "off", label: "Not my best" },
];
const GREEN = "#86A97F";

export function Reflection() {
  const { user } = useAuth();
  const { t } = useT();
  const today = todayISO();
  const opener = t("Today, I just ");
  const [text, setText] = useState("");
  const [saved, setSaved] = useState<string | null>(null); // what's in the journal now
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    void Promise.all([
      supabase.from("journal_entries").select("did_today").eq("entry_date", today).maybeSingle(),
      supabase.from("daily_checkins").select("verdict").eq("date", today).maybeSingle(),
    ]).then(([j, c]) => {
      if (!alive) return;
      const existing = (j.data as { did_today: string | null } | null)?.did_today ?? null;
      setSaved(existing);
      setText(existing ?? "");
      setVerdict(((c.data as { verdict: Verdict } | null)?.verdict as Verdict) ?? null);
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, [user, today]);

  // Grow with the writing, like paper.
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [text]);

  const chooseVerdict = async (v: Verdict) => {
    if (!user) return;
    setVerdict(v);
    await supabase
      .from("daily_checkins")
      .upsert({ user_id: user.id, date: today, verdict: v, reason: null }, { onConflict: "user_id,date" });
    void captureLifeEvent({
      type: "ReflectionAdded",
      occurredAt: today,
      payload: { verdict: v, reason: null },
      emotionalImpact: v === "good" ? 0.5 : v === "off" ? -0.4 : 0,
      context: { outcome: v === "off" ? "informational" : "consistency" },
      provenance: "dashboard reflection",
    });
    invalidateContext();
  };

  const body = text.trim();
  const unchanged = body === (saved ?? "").trim();
  const onlyOpener = body === opener.trim();
  const canSave = !!body && !onlyOpener && !unchanged && !busy;

  const save = async () => {
    if (!user || !canSave) return;
    setBusy(true);
    const { error } = await supabase
      .from("journal_entries")
      .upsert({ user_id: user.id, entry_date: today, did_today: body }, { onConflict: "user_id,entry_date" });
    if (!error) {
      if (saved == null) {
        const words = body.split(/\s+/).filter(Boolean).length;
        void captureLifeEvent({ type: "JournalCreated", occurredAt: today, payload: { words, source: "dashboard reflection" }, context: { outcome: "consistency" } });
      }
      setSaved(body);
      invalidateContext();
    }
    setBusy(false);
  };

  if (!loaded) return null;

  return (
    <div>
      <h2 className="text-2xl font-semibold tracking-tight">{t("How did today go?")}</h2>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        {VERDICTS.map((o) => (
          <button
            key={o.v}
            onClick={() => void chooseVerdict(o.v)}
            className={`text-sm transition ${verdict === o.v ? "font-semibold text-fg" : "text-muted hover:text-fg"}`}
          >
            {verdict === o.v && <Check size={13} className="mr-1 inline -translate-y-px" style={{ color: GREEN }} />}
            {t(o.label)}
          </button>
        ))}
      </div>

      <textarea
        ref={area}
        value={text}
        rows={3}
        onFocus={() => {
          // The opener appears when you start, ready for your next word.
          if (!text) setText(opener);
        }}
        onChange={(e) => setText(e.target.value)}
        placeholder={t("Start writing…")}
        className="mt-5 w-full resize-none overflow-hidden bg-transparent text-[17px] leading-relaxed text-fg placeholder:text-muted/60 focus:outline-none"
      />

      <div className="mt-2 flex min-h-8 items-center gap-3">
        {canSave ? (
          <button
            onClick={() => void save()}
            className="rounded-full bg-[var(--color-fg)] px-4 py-1.5 text-sm font-semibold text-[color:var(--color-bg)] transition hover:opacity-90"
          >
            {t(saved == null ? "Save to journal" : "Update journal")}
          </button>
        ) : saved != null && unchanged ? (
          <span className="flex items-center gap-1.5 text-xs text-muted">
            <Check size={13} style={{ color: GREEN }} /> {t("Saved in your journal")}
          </span>
        ) : null}
      </div>
    </div>
  );
}
