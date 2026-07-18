"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Play, Pause, RotateCcw, Check, X, Search, Flag, Target, FolderKanban } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { useCollection } from "@/hooks/useCollection";
import { GlassCard } from "@/components/ui/GlassCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { fieldClass } from "@/components/ui/Modal";
import { PressButton } from "@/components/ui/PressButton";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { toast } from "@/lib/toast";
import { captureLifeEvent } from "@/lib/life-events";
import type { FocusSession, Goal, Project } from "@/lib/types";

const PRESETS = [25, 50, 90];
const STORAGE = "isa_focus_v1";
const PREF = "isa_focus_pref";
type SavedTimer = { label: string; duration: number; endAt?: number; left?: number; goalId?: string; projectId?: string };

// Below this, an ended session is NOT counted as a completed focus session.
const MIN_COMPLETE_SECONDS = 60;

function fmt(total: number) {
  const m = Math.floor(total / 60).toString().padStart(2, "0");
  const s = (total % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}
function ymd(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }

export default function FocusPage() {
  const { user } = useAuth();
  const sessions = useCollection<FocusSession>("focus_sessions");
  const goals = useCollection<Goal>("goals");
  const projects = useCollection<Project>("projects");

  const [label, setLabel] = useState("Deep work");
  const [goalId, setGoalId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [duration, setDuration] = useState(25 * 60);
  const [customMin, setCustomMin] = useState("");
  const [left, setLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [completeModal, setCompleteModal] = useState<{ seconds: number } | null>(null);
  const [note, setNote] = useState("");

  const tick = useRef<ReturnType<typeof setInterval> | null>(null);
  const leftRef = useRef(left); leftRef.current = left;
  const restored = useRef(false);
  const endAtRef = useRef<number | null>(null);
  const completedRef = useRef(false);
  const savingRef = useRef(false);
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);
  const pausesRef = useRef(0);
  const startedAtRef = useRef<number | null>(null);

  // load remembered preferred duration
  useEffect(() => {
    const p = localStorage.getItem(PREF);
    if (p) { const min = Number(p); if (min > 0) { setDuration(min * 60); setLeft(min * 60); } }
  }, []);

  const logSession = async (seconds: number, opts: { completed?: boolean; note?: string | null; sessionLabel?: string } = {}) => {
    if (!user || seconds < 30 || savingRef.current) return;
    savingRef.current = true; setBusy(true);
    const start = startedAtRef.current ? new Date(startedAtRef.current).toISOString() : null;
    const { error } = await supabase.from("focus_sessions").insert({
      user_id: user.id, label: (opts.sessionLabel ?? label).trim() || "Focus", duration_seconds: seconds,
      goal_id: goalId || null, project_id: projectId || null, note: opts.note ?? null,
      pauses: pausesRef.current, completed: opts.completed ?? true, started_at: start, ended_at: new Date().toISOString(),
    });
    if (error) toast("Couldn't save your focus session.", "error");
    else {
      toast(`Focus session saved — ${Math.round(seconds / 60)} min ✓`, "success");
      void captureLifeEvent({
        type: "FocusSessionCompleted", payload: { label: label.trim() || "Focus", minutes: Math.round(seconds / 60), completed: opts.completed ?? true },
        links: goalId ? { goalIds: [goalId] } : undefined,
        context: { metricValue: seconds, outcome: "progress", linkedToActiveGoal: !!goalId },
      });
      sessions.refresh();
    }
    savingRef.current = false; setBusy(false);
    pausesRef.current = 0; startedAtRef.current = null;
  };

  const complete = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    if (tick.current) clearInterval(tick.current);
    endAtRef.current = null; setRunning(false);
    localStorage.removeItem(STORAGE); syncAlarm(false);
    // Measure the REAL elapsed time — never assume the full planned duration.
    const elapsed = Math.max(0, Math.min(duration, duration - leftRef.current));
    if (elapsed < MIN_COMPLETE_SECONDS) {
      // Too short to be a completed session: save as interrupted, or discard.
      if (elapsed >= 30) { logSession(elapsed, { completed: false }); toast("Saved as an interrupted session.", "info"); }
      else toast("Too short to count as a focus session.", "info");
      completedRef.current = false; setLeft(duration);
      return;
    }
    setLeft(0);
    setCompleteModal({ seconds: elapsed }); // confirm what was accomplished — real duration
  };

  useEffect(() => {
    if (!user || restored.current) return;
    restored.current = true;
    try {
      const raw = localStorage.getItem(STORAGE); if (!raw) return;
      const s = JSON.parse(raw) as SavedTimer; if (!s.duration) return;
      setLabel(s.label || "Focus"); setDuration(s.duration);
      if (s.goalId) setGoalId(s.goalId); if (s.projectId) setProjectId(s.projectId);
      if (s.endAt) {
        const remaining = Math.round((s.endAt - Date.now()) / 1000);
        if (remaining > 0) { endAtRef.current = s.endAt; completedRef.current = false; setLeft(remaining); setRunning(true); }
        else { completedRef.current = true; localStorage.removeItem(STORAGE); setLeft(0); logSession(s.duration, { sessionLabel: s.label }); }
      } else if (typeof s.left === "number") setLeft(s.left);
    } catch { localStorage.removeItem(STORAGE); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const syncAlarm = (on: boolean) => {
    if (!user) return;
    if (on) supabase.from("focus_alarms").upsert({ user_id: user.id, label: label.trim() || "Focus", duration_s: duration, end_at: new Date(Date.now() + leftRef.current * 1000).toISOString() }).then(() => {});
    else supabase.from("focus_alarms").delete().eq("user_id", user.id).then(() => {});
  };

  useEffect(() => {
    if (!restored.current && !running) return;
    if (running) {
      endAtRef.current = Date.now() + leftRef.current * 1000; completedRef.current = false;
      localStorage.setItem(STORAGE, JSON.stringify({ label, duration, endAt: endAtRef.current, goalId, projectId } satisfies SavedTimer));
      syncAlarm(true);
    } else {
      endAtRef.current = null;
      if (leftRef.current > 0 && leftRef.current < duration) localStorage.setItem(STORAGE, JSON.stringify({ label, duration, left: leftRef.current, goalId, projectId } satisfies SavedTimer));
      syncAlarm(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  useEffect(() => {
    const resync = () => {
      if (!running || !endAtRef.current) return;
      const remaining = Math.max(0, Math.round((endAtRef.current - Date.now()) / 1000));
      setLeft(remaining); if (remaining <= 0) complete();
    };
    document.addEventListener("visibilitychange", resync); window.addEventListener("focus", resync);
    return () => { document.removeEventListener("visibilitychange", resync); window.removeEventListener("focus", resync); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  useEffect(() => {
    if (!running) { wakeLockRef.current?.release().catch(() => {}); wakeLockRef.current = null; return; }
    let cancelled = false;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock?.request("screen").then((wl) => { if (cancelled) wl.release().catch(() => {}); else wakeLockRef.current = wl; }).catch(() => {});
    return () => { cancelled = true; };
  }, [running]);

  useEffect(() => {
    if (!running) return;
    const step = () => { if (!endAtRef.current) return; const remaining = Math.max(0, Math.round((endAtRef.current - Date.now()) / 1000)); setLeft(remaining); if (remaining <= 0) complete(); };
    step(); tick.current = setInterval(step, 1000);
    return () => { if (tick.current) clearInterval(tick.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const chooseDuration = (min: number) => {
    setRunning(false); localStorage.removeItem(STORAGE); localStorage.setItem(PREF, String(min));
    setDuration(min * 60); setLeft(min * 60);
  };
  const toggle = () => {
    if (running) pausesRef.current += 1; // pausing
    else if (!startedAtRef.current) startedAtRef.current = Date.now(); // first start
    setRunning((r) => !r);
  };
  const reset = () => { setRunning(false); localStorage.removeItem(STORAGE); syncAlarm(false); setLeft(duration); pausesRef.current = 0; startedAtRef.current = null; };
  const saveNow = () => {
    if (savingRef.current) return;
    const elapsed = duration - left;
    if (elapsed >= 30) logSession(elapsed, { completed: false });
    localStorage.removeItem(STORAGE); syncAlarm(false); setLeft(duration);
  };
  const finishModal = () => {
    const s = completeModal; if (!s) return;
    logSession(s.seconds, { completed: true, note: note.trim() || null });
    setCompleteModal(null); setNote(""); setLeft(duration);
  };

  const progress = duration > 0 ? (duration - left) / duration : 0;
  const R = 130, C = 2 * Math.PI * R;

  // ── Stats ──
  const stats = useMemo(() => {
    const d = sessions.data;
    const today = ymd(new Date());
    const dayKey = (s: FocusSession) => ymd(new Date(s.created_at));
    const secToday = d.filter((s) => dayKey(s) === today).reduce((a, s) => a + s.duration_seconds, 0);
    const weekAgo = ymd(new Date(Date.now() - 6 * 86400000));
    const week = d.filter((s) => dayKey(s) >= weekAgo);
    const secWeek = week.reduce((a, s) => a + s.duration_seconds, 0);
    const longest = d.reduce((m, s) => Math.max(m, s.duration_seconds), 0);
    const avg = d.length ? Math.round(d.reduce((a, s) => a + s.duration_seconds, 0) / d.length) : 0;
    const daysSet = new Set(d.map(dayKey));
    let streak = 0; for (let i = daysSet.has(today) ? 0 : 1; i < 400; i++) { if (daysSet.has(ymd(new Date(Date.now() - i * 86400000)))) streak++; else break; }
    return { secToday, secWeek, longest, avg, streak, count: d.length };
  }, [sessions.data]);

  const filtered = sessions.data.filter((s) => !query.trim() || s.label.toLowerCase().includes(query.trim().toLowerCase()) || (s.note ?? "").toLowerCase().includes(query.trim().toLowerCase()));

  const goalName = (id: string | null) => goals.data.find((g) => g.id === id)?.title;
  const projName = (id: string | null) => projects.data.find((p) => p.id === id)?.title;

  return (
    <div>
      {/* ── Distraction-free overlay while running ── */}
      {running && (
        <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-[color:var(--color-bg)] px-6">
          <p className="mb-2 text-xs uppercase tracking-widest text-muted">Focusing on</p>
          <h2 className="mb-10 max-w-md text-center text-2xl font-semibold">{label || "Deep work"}</h2>
          <div className="relative flex items-center justify-center">
            <svg viewBox="0 0 300 300" className="h-auto w-[280px] max-w-full -rotate-90">
              <circle cx="150" cy="150" r={R} fill="none" stroke="var(--color-line)" strokeWidth="8" />
              <motion.circle cx="150" cy="150" r={R} fill="none" stroke="var(--color-fg)" strokeWidth="8" strokeLinecap="round"
                strokeDasharray={C} animate={{ strokeDashoffset: C * (1 - progress) }} transition={{ ease: "linear", duration: 0.4 }} />
            </svg>
            <span className="absolute font-mono text-6xl font-bold tabular-nums">{fmt(left)}</span>
          </div>
          <div className="mt-12 flex items-center gap-4">
            <PressButton onClick={toggle} className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 text-fg"><Pause size={22} /></PressButton>
            <PressButton onClick={complete} className="flex h-12 items-center gap-2 rounded-full bg-accent px-6 text-sm font-semibold text-white"><Check size={16} /> Finish</PressButton>
          </div>
        </div>
      )}

      <PageHeader title="Focus" subtitle="Enter a quiet workspace. One thing, full attention." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* Setup + timer */}
        <GlassCard className="flex flex-col items-center p-8">
          <div className="mb-2 text-xs uppercase tracking-wider text-muted">What are you working on?</div>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. LC Website"
            className={`${fieldClass} mb-3 max-w-xs text-center text-lg`} />
          <div className="mb-6 flex w-full max-w-xs flex-col gap-2">
            <select value={goalId} onChange={(e) => setGoalId(e.target.value)} className={fieldClass}>
              <option value="">Link a goal (optional)</option>
              {goals.data.filter((g) => !g.archived).map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
            </select>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={fieldClass}>
              <option value="">Link a project (optional)</option>
              {projects.data.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </div>

          <div className="relative flex items-center justify-center">
            <svg viewBox="0 0 300 300" className="h-auto w-[260px] max-w-full -rotate-90">
              <circle cx="150" cy="150" r={R} fill="none" stroke="var(--color-line)" strokeWidth="10" />
              <motion.circle cx="150" cy="150" r={R} fill="none" stroke="var(--color-fg)" strokeWidth="10" strokeLinecap="round"
                strokeDasharray={C} animate={{ strokeDashoffset: C * (1 - progress) }} transition={{ ease: "linear", duration: 0.4 }} />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="font-mono text-5xl font-bold tabular-nums">{fmt(left)}</span>
              <span className="mt-1 text-xs text-muted">{Math.round(progress * 100)}% complete</span>
            </div>
          </div>

          <div className="mt-8 flex items-center gap-3">
            <PressButton onClick={toggle} className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-lg shadow-accent/30"><Play size={22} className="ml-0.5" /></PressButton>
            <PressButton onClick={reset} title="Reset" className="flex h-12 w-12 items-center justify-center rounded-full bg-white/5 text-muted hover:text-fg"><RotateCcw size={18} /></PressButton>
            {!running && left > 0 && duration - left >= 30 && (
              <PressButton onClick={saveNow} disabled={busy} className="flex h-12 items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-black disabled:opacity-50"><Check size={16} />{busy ? "Saving…" : `Save ${Math.round((duration - left) / 60)}m`}</PressButton>
            )}
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
            {PRESETS.map((m) => (
              <button key={m} onClick={() => chooseDuration(m)} className={`rounded-full px-4 py-1.5 text-sm transition ${duration === m * 60 ? "bg-accent-soft text-fg ring-1 ring-inset ring-accent/30" : "text-muted hover:text-fg"}`}>{m}m</button>
            ))}
            <div className="flex items-center gap-1">
              <input type="number" min={1} value={customMin} onChange={(e) => setCustomMin(e.target.value)} placeholder="custom" className={`${fieldClass} h-8 w-20 py-1 text-center text-sm`} />
              <button onClick={() => { const n = Number(customMin); if (n > 0) chooseDuration(n); }} className="rounded-full bg-white/10 px-3 py-1.5 text-sm text-fg">Set</button>
            </div>
          </div>
        </GlassCard>

        {/* Stats */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Focused today" value={Math.floor(stats.secToday / 60)} unit="min" />
            <Stat label="This week" value={Math.floor(stats.secWeek / 60)} unit="min" />
            <Stat label="Longest" value={Math.floor(stats.longest / 60)} unit="min" />
            <Stat label="Streak" value={stats.streak} unit={stats.streak === 1 ? "day" : "days"} />
            <Stat label="Avg session" value={Math.floor(stats.avg / 60)} unit="min" />
            <Stat label="Sessions" value={stats.count} unit="" />
          </div>
          <GlassCard className="p-4">
            <p className="text-xs text-muted">Deep Work Score, best focus hours & smart break suggestions are a <span className="text-fg/80">Pro</span> feature — unlocking as ISA gathers your history.</p>
          </GlassCard>
        </div>
      </div>

      {/* History */}
      {sessions.data.length > 0 && (
        <div className="mt-8">
          <div className="mb-3 flex items-center gap-2 rounded-xl border border-line bg-white/[0.02] px-3 py-2">
            <Search size={15} className="text-muted" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search sessions…" className="min-w-0 flex-1 bg-transparent text-sm text-fg placeholder:text-muted/60" />
          </div>
          <div className="space-y-2">
            {filtered.slice(0, 20).map((s) => {
              const open = expanded === s.id;
              return (
                <GlassCard key={s.id} className="p-4">
                  <button onClick={() => setExpanded(open ? null : s.id)} className="flex w-full items-center gap-3 text-left">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${s.completed ? "bg-emerald-400" : "bg-amber-400"}`} />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{s.label}</span>
                    <span className="shrink-0 text-sm tabular-nums text-muted">{Math.round(s.duration_seconds / 60)}m</span>
                    <span className="shrink-0 text-xs text-muted">{new Date(s.created_at).toLocaleDateString([], { month: "short", day: "numeric" })}</span>
                  </button>
                  {open && (
                    <div className="mt-2 space-y-1 border-t border-line pt-2 text-xs text-muted">
                      {s.note && <p className="text-fg/80">“{s.note}”</p>}
                      {goalName(s.goal_id) && <p className="flex items-center gap-1.5"><Target size={12} /> {goalName(s.goal_id)}</p>}
                      {projName(s.project_id) && <p className="flex items-center gap-1.5"><FolderKanban size={12} /> {projName(s.project_id)}</p>}
                      <p className="flex items-center gap-1.5"><Flag size={12} /> {s.completed ? "Completed" : "Partial"} · {s.pauses} pause{s.pauses === 1 ? "" : "s"}</p>
                    </div>
                  )}
                </GlassCard>
              );
            })}
          </div>
        </div>
      )}

      {/* Completion modal */}
      {completeModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-6" onClick={() => finishModal()}>
          <GlassCard className="w-full max-w-md p-6" >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold">What did you accomplish?</h3>
              <button onClick={() => finishModal()} className="text-muted hover:text-fg"><X size={18} /></button>
            </div>
            <textarea autoFocus rows={3} value={note} onChange={(e) => setNote(e.target.value)} onClick={(e) => e.stopPropagation()}
              placeholder="Finished homepage · Read 18 pages · Completed Unit 6…" className={`${fieldClass} resize-none`} />
            <PressButton onClick={finishModal} className="mt-4 w-full rounded-xl bg-accent py-2.5 text-sm font-semibold text-white">Save session</PressButton>
          </GlassCard>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <GlassCard className="p-4">
      <div className="text-2xl font-bold tabular-nums"><AnimatedNumber value={value} />{unit && <span className="text-sm font-medium text-muted"> {unit}</span>}</div>
      <div className="text-xs text-muted">{label}</div>
    </GlassCard>
  );
}
