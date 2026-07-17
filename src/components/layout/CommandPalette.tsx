"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Search, ArrowRight, LayoutDashboard, Target, FolderKanban,
  Lightbulb, BarChart3, BookOpen, Timer, Repeat, CalendarDays, Settings,
  LogOut, Wallet, Star, Clock, PenLine, Sparkles, Lock, Brain, ListTodo,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { ROUTE_MODULE, accountAgeDays, isUnlocked, readUnlockOverrides } from "@/lib/unlock";
import { useEntitlements } from "@/components/EntitlementProvider";
import { useT } from "@/lib/i18n";
import { MosqueIcon } from "@/components/ui/MosqueIcon";
import { todayISO } from "@/lib/datetime";
import { nearestDeadline } from "@/lib/stats";
import { toast } from "@/lib/toast";
import type { Goal, Todo, Project, Habit, Idea, JournalEntry, Transaction, FocusSession } from "@/lib/types";

type NavItem = { id: string; label: string; href: string; icon: React.ComponentType<{ size?: number; className?: string }>; keywords?: string };
type SearchHit = { id: string; type: string; label: string; href: string; icon: React.ComponentType<{ size?: number; className?: string }> };

const GROUPS: { title: string; items: NavItem[] }[] = [
  { title: "Productivity", items: [
    { id: "nav-dash", label: "Dashboard", href: "/", icon: LayoutDashboard, keywords: "home" },
    { id: "nav-goals", label: "Goals", href: "/goals", icon: Target },
    { id: "nav-habits", label: "Tasks & Habits", href: "/habits", icon: Repeat, keywords: "todo task streak" },
    { id: "nav-projects", label: "Projects", href: "/projects", icon: FolderKanban },
  ]},
  { title: "Personal", items: [
    { id: "nav-journal", label: "Journal", href: "/journal", icon: BookOpen, keywords: "diary" },
    { id: "nav-focus", label: "Focus", href: "/focus", icon: Timer, keywords: "deep work timer" },
    { id: "nav-calendar", label: "Calendar", href: "/calendar", icon: CalendarDays },
    { id: "nav-pray", label: "Prayer", href: "/pray", icon: MosqueIcon, keywords: "namoz salah" },
    { id: "nav-ideas", label: "Ideas", href: "/ideas", icon: Lightbulb, keywords: "notes" },
  ]},
  { title: "Finance", items: [
    { id: "nav-money", label: "Money", href: "/money", icon: Wallet, keywords: "budget expense income" },
  ]},
  { title: "Insights", items: [
    { id: "nav-ask", label: "Ask ISA", href: "/ask", icon: Sparkles, keywords: "chat ai assistant so'rash" },
    { id: "nav-knows", label: "What ISA knows", href: "/knows", icon: Brain, keywords: "coverage facts confidence biladi" },
    { id: "nav-progress", label: "Progress", href: "/progress", icon: BarChart3, keywords: "charts analytics" },
  ]},
  { title: "System", items: [
    { id: "nav-settings", label: "Settings", href: "/settings", icon: Settings, keywords: "theme plan subscription" },
    { id: "nav-signout", label: "Sign out", href: "__signout", icon: LogOut, keywords: "logout exit" },
  ]},
];
const ALL_NAV = GROUPS.flatMap((g) => g.items);
const navById = (id: string) => ALL_NAV.find((n) => n.id === id);

// Creating lives in exactly one place — the global "+" (QuickCapture). The
// palette searches and navigates; it no longer offers a second, divergent way to
// add things.
const QUICK_NAV = [
  { id: "qn-journal", label: "Journal", href: "/journal", icon: PenLine },
  { id: "qn-focus", label: "Focus", href: "/focus", icon: Timer },
];

const AI_ACTIONS = ["Review Today", "Plan Tomorrow", "Analyze Spending", "Weekly Summary", "Monthly Reflection"];

type Bundle = {
  goals: Goal[]; todos: Todo[]; projects: Project[]; habits: Habit[]; ideas: Idea[];
  journal: JournalEntry[]; txns: Transaction[]; focus: FocusSession[]; habitDoneToday: number;
};

export function CommandPalette() {
  const router = useRouter();
  const { signOut, user } = useAuth();
  const { canUse } = useEntitlements();
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [favs, setFavs] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = useCallback(() => { setOpen(false); setQuery(""); }, []);

  // Don't list a module the account hasn't reached yet. (A search hit still
  // resolves — ModuleGate then offers to open it early, so nothing dead-ends.)
  const [unlockOverrides] = useState<string[]>(() => readUnlockOverrides());
  const accountAge = accountAgeDays(user?.created_at);
  const groups = GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => {
      const m = ROUTE_MODULE[i.href];
      return !m || isUnlocked(m, accountAge, unlockOverrides);
    }),
  })).filter((g) => g.items.length > 0);

  useEffect(() => {
    try { setFavs(JSON.parse(localStorage.getItem("isa_favs") || "[]")); setRecent(JSON.parse(localStorage.getItem("isa_recent") || "[]")); } catch {}
    const onKey = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((v) => !v); } };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey); window.addEventListener("isa:open-palette", onOpen);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("isa:open-palette", onOpen); };
  }, []);

  useEffect(() => { if (open) requestAnimationFrame(() => inputRef.current?.focus()); }, [open]);

  // Load searchable bundle when the palette opens.
  useEffect(() => {
    if (!open || bundle) return;
    (async () => {
      const today = todayISO();
      const [g, td, pr, hb, id, jr, tx, fs, hl] = await Promise.all([
        supabase.from("goals").select("id,title,percentage,deadline,archived,created_at"),
        supabase.from("todos").select("id,title,done,date,priority"),
        supabase.from("projects").select("id,title,status,percentage"),
        supabase.from("habits").select("id,name,is_active,frequency_type,frequency_config"),
        supabase.from("ideas").select("id,content,tag"),
        supabase.from("journal_entries").select("id,entry_date,did_today,learned,tomorrow"),
        supabase.from("transactions").select("id,type,amount,category,note,date"),
        supabase.from("focus_sessions").select("id,label,note,duration_seconds,created_at"),
        supabase.from("habit_logs").select("habit_id,completed,date").eq("date", today),
      ]);
      const doneToday = ((hl.data as { completed: boolean }[]) ?? []).filter((x) => x.completed).length;
      setBundle({
        goals: (g.data as Goal[]) ?? [], todos: (td.data as Todo[]) ?? [], projects: (pr.data as Project[]) ?? [],
        habits: (hb.data as Habit[]) ?? [], ideas: (id.data as Idea[]) ?? [], journal: (jr.data as JournalEntry[]) ?? [],
        txns: (tx.data as Transaction[]) ?? [], focus: (fs.data as FocusSession[]) ?? [], habitDoneToday: doneToday,
      });
    })();
  }, [open, bundle]);

  // Universal search across everything.
  const hits = useMemo<SearchHit[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q || !bundle) return [];
    const out: SearchHit[] = [];
    const push = (arr: { id: string }[], text: (x: never) => string, type: string, href: string, icon: SearchHit["icon"]) => {
      for (const x of arr) { if (text(x as never).toLowerCase().includes(q)) out.push({ id: `${type}-${x.id}`, type, label: text(x as never), href, icon }); if (out.length > 40) break; }
    };
    push(bundle.goals, (x: Goal) => x.title, "Goal", "/goals", Target);
    push(bundle.todos, (x: Todo) => x.title, "Task", "/habits", ListTodo);
    push(bundle.projects, (x: Project) => x.title, "Project", "/projects", FolderKanban);
    push(bundle.habits, (x: Habit) => x.name, "Habit", "/habits", Repeat);
    push(bundle.ideas, (x: Idea) => x.content, "Idea", "/ideas", Lightbulb);
    push(bundle.journal, (x: JournalEntry) => `${x.entry_date} ${x.did_today ?? ""} ${x.learned ?? ""}`.trim(), "Journal", "/journal", BookOpen);
    push(bundle.txns, (x: Transaction) => `${x.note ?? x.category} ${x.amount}`, "Money", "/money", Wallet);
    push(bundle.focus, (x: FocusSession) => `${x.label} ${x.note ?? ""}`.trim(), "Focus", "/focus", Timer);
    // nav matches too
    for (const n of ALL_NAV) if (`${n.label} ${n.keywords ?? ""}`.toLowerCase().includes(q)) out.push({ id: n.id, type: "Go to", label: n.label, href: n.href, icon: n.icon });
    return out.slice(0, 40);
  }, [query, bundle]);

  const goTo = useCallback((href: string, navId?: string) => {
    close();
    if (href === "__signout") { signOut(); return; }
    if (navId) { const next = [navId, ...recent.filter((r) => r !== navId)].slice(0, 3); setRecent(next); localStorage.setItem("isa_recent", JSON.stringify(next)); }
    router.push(href);
  }, [close, router, signOut, recent]);

  const toggleFav = (id: string) => {
    const next = favs.includes(id) ? favs.filter((f) => f !== id) : [...favs, id];
    setFavs(next); localStorage.setItem("isa_favs", JSON.stringify(next));
  };

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); close(); return; }
    if (e.key === "Enter" && hits[0]) { e.preventDefault(); goTo(hits[0].href, hits[0].type === "Go to" ? hits[0].id : undefined); }
  };

  const aiAction = () => toast(canUse("ai_coach") ? "ISA is preparing this…" : "Ask ISA is a Pro feature.", "info");

  // ── Today card values ──
  const today = todayISO();
  const tasksLeft = bundle?.todos.filter((x) => x.date === today && !x.done).length ?? 0;
  const activeHabits = bundle?.habits.filter((h) => h.is_active).length ?? 0;
  const habitsMissing = Math.max(0, activeHabits - (bundle?.habitDoneToday ?? 0));
  const journalPending = bundle ? !bundle.journal.some((j) => j.entry_date === today) : false;
  const nd = bundle ? nearestDeadline(bundle.goals.filter((g) => !g.archived) as Goal[]) : null;

  return (
    <>
      <button onClick={() => setOpen(true)} className="glass fixed bottom-5 left-24 z-30 hidden items-center gap-2 rounded-full px-3.5 py-2 text-xs text-muted transition-colors hover:text-fg md:flex">
        <Search size={14} /><span>{t("Search")}</span>
        <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-fg">⌘K</kbd>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-[10vh]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={close} />
            <motion.div className="glass reflect relative z-10 w-full max-w-lg overflow-hidden rounded-2xl"
              style={{ background: "color-mix(in srgb, var(--color-bg) 94%, transparent)" }}
              initial={{ opacity: 0, scale: 0.97, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98, y: 6 }} transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}>

              {/* Input */}
              <div className="flex items-center gap-3 border-b border-line px-4 py-3.5">
                <Search size={18} className="shrink-0 text-muted" />
                <input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={onInputKey}
                  placeholder={t("Search anything, or jump to…")}
                  className="flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-muted/60" />
              </div>

              {query.trim() ? (
                /* ── Search results ── */
                <ul className="max-h-[60vh] overflow-y-auto p-2">
                  {hits.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">{t("No matches")}</li>}
                  {hits.map((h) => (
                    <li key={h.id}>
                      <button onClick={() => goTo(h.href, h.type === "Go to" ? h.id : undefined)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-fg/80 transition-colors hover:bg-accent-soft hover:text-fg">
                        <h.icon size={16} className="shrink-0 text-muted" />
                        <span className="min-w-0 flex-1 truncate">{h.label}</span>
                        <span className="shrink-0 text-[10px] uppercase tracking-wider text-muted">{h.type}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                /* ── Control center (no query) ── */
                <div className="max-h-[64vh] overflow-y-auto p-3">
                  {/* Today */}
                  <div className="mb-3 rounded-xl border border-line bg-white/[0.02] p-3">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted">{t("Today")}</p>
                    <div className="grid grid-cols-2 gap-1.5 text-xs text-fg/85">
                      <span>• {tasksLeft} {t("tasks remaining")}</span>
                      <span>• {habitsMissing} {t("habits missing")}</span>
                      <span>• {journalPending ? t("Journal pending") : t("Journaled ✓")}</span>
                      <span>• {nd ? `${nd.title} · ${nd.daysLeft}d` : t("No deadline")}</span>
                    </div>
                  </div>

                  {/* Jump to — creating lives in the global "+" only. */}
                  <Section label={t("Jump to")}>
                    <div className="grid grid-cols-4 gap-1.5">
                      {QUICK_NAV.map((a) => (
                        <button key={a.id} onClick={() => goTo(a.href)} className="flex flex-col items-center gap-1 rounded-xl p-2.5 text-[11px] text-fg/80 transition hover:bg-white/5">
                          <a.icon size={16} className="text-accent" />{t(a.label)}
                        </button>
                      ))}
                    </div>
                  </Section>

                  {/* Favorites */}
                  {favs.length > 0 && (
                    <Section label={t("Favorites")}>
                      {favs.map((id) => { const n = navById(id); return n ? <NavRow key={id} n={n} t={t} onGo={() => goTo(n.href, n.id)} starred onStar={() => toggleFav(id)} /> : null; })}
                    </Section>
                  )}

                  {/* Recent */}
                  {recent.length > 0 && (
                    <Section label={t("Recent")} icon={Clock}>
                      {recent.map((id) => { const n = navById(id); return n ? <NavRow key={id} n={n} t={t} onGo={() => goTo(n.href, n.id)} starred={favs.includes(id)} onStar={() => toggleFav(id)} /> : null; })}
                    </Section>
                  )}

                  {/* Grouped nav */}
                  {groups.map((grp) => (
                    <Section key={grp.title} label={t(grp.title)}>
                      {grp.items.map((n) => <NavRow key={n.id} n={n} t={t} onGo={() => goTo(n.href, n.id)} starred={favs.includes(n.id)} onStar={() => toggleFav(n.id)} />)}
                    </Section>
                  ))}

                  {/* AI quick actions (Pro) */}
                  <Section label={t("Ask ISA")} icon={Sparkles}>
                    <div className="flex flex-wrap gap-1.5">
                      {AI_ACTIONS.map((a) => (
                        <button key={a} onClick={aiAction} className="flex items-center gap-1 rounded-full border border-line px-3 py-1.5 text-xs text-fg/80 transition hover:bg-white/5">
                          {t(a)}{!canUse("ai_coach") && <Lock size={11} className="text-muted" />}
                        </button>
                      ))}
                    </div>
                  </Section>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function Section({ label, icon: Icon, children }: { label: string; icon?: React.ComponentType<{ size?: number; className?: string }>; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <p className="mb-1 flex items-center gap-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted">{Icon && <Icon size={11} />}{label}</p>
      {children}
    </div>
  );
}

function NavRow({ n, t, onGo, starred, onStar }: { n: NavItem; t: (s: string) => string; onGo: () => void; starred: boolean; onStar: () => void }) {
  return (
    <div className="group flex items-center rounded-xl transition hover:bg-white/5">
      <button onClick={onGo} className="flex flex-1 items-center gap-3 px-3 py-2 text-left text-sm text-fg/80">
        <n.icon size={16} className="text-muted" /><span className="flex-1">{t(n.label)}</span>
        <ArrowRight size={13} className="text-muted opacity-0 transition group-hover:opacity-100" />
      </button>
      {n.href !== "__signout" && (
        <button onClick={onStar} className="shrink-0 px-2 text-muted transition hover:text-amber-300" aria-label="Pin">
          <Star size={13} className={starred ? "fill-amber-300 text-amber-300" : ""} />
        </button>
      )}
    </div>
  );
}
