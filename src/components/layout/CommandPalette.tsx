"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Search,
  ArrowRight,
  CornerDownLeft,
  LayoutDashboard,
  Target,
  FolderKanban,
  Lightbulb,
  BarChart3,
  BookOpen,
  Timer,
  Repeat,
  CalendarDays,
  Settings,
  Plus,
  LogOut,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { useT } from "@/lib/i18n";
import { MosqueIcon } from "@/components/ui/MosqueIcon";
import { todayISO } from "@/lib/datetime";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/cn";

type NavItem = {
  kind: "nav";
  id: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  keywords?: string;
};

type AddItem = {
  kind: "add";
  id: string;
  label: string;
  entity: "goal" | "todo" | "habit" | "idea";
  table: string;
  placeholder: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  keywords?: string;
  build: (value: string) => Record<string, unknown>;
};

type Item = NavItem | AddItem;

const NAV: NavItem[] = [
  { kind: "nav", id: "nav-dash", label: "Dashboard", href: "/", icon: LayoutDashboard, keywords: "home" },
  { kind: "nav", id: "nav-goals", label: "Goals", href: "/goals", icon: Target, keywords: "peaks aims" },
  { kind: "nav", id: "nav-projects", label: "Projects", href: "/projects", icon: FolderKanban },
  { kind: "nav", id: "nav-ideas", label: "Ideas", href: "/ideas", icon: Lightbulb, keywords: "notes" },
  { kind: "nav", id: "nav-progress", label: "Progress", href: "/progress", icon: BarChart3, keywords: "charts runs strava" },
  { kind: "nav", id: "nav-journal", label: "Journal", href: "/journal", icon: BookOpen, keywords: "diary reflect" },
  { kind: "nav", id: "nav-focus", label: "Focus", href: "/focus", icon: Timer, keywords: "timer pomodoro" },
  { kind: "nav", id: "nav-habits", label: "Habits", href: "/habits", icon: Repeat, keywords: "streak" },
  { kind: "nav", id: "nav-calendar", label: "Calendar", href: "/calendar", icon: CalendarDays, keywords: "mood month" },
  { kind: "nav", id: "nav-pray", label: "Prayer", href: "/pray", icon: MosqueIcon, keywords: "namoz prayer times salah" },
  { kind: "nav", id: "nav-settings", label: "Settings", href: "/settings", icon: Settings, keywords: "theme push export reminders" },
  { kind: "nav", id: "nav-signout", label: "Sign out", href: "__signout", icon: LogOut, keywords: "logout log out exit" },
];

const ADD: AddItem[] = [
  {
    kind: "add",
    id: "add-goal",
    label: "New goal",
    entity: "goal",
    table: "goals",
    placeholder: "Goal title…",
    icon: Target,
    keywords: "create add peak",
    build: (v) => ({ title: v, percentage: 0, deadline: null, motivation: null }),
  },
  {
    kind: "add",
    id: "add-todo",
    label: "New to-do",
    entity: "todo",
    table: "todos",
    placeholder: "Task for today…",
    icon: Plus,
    keywords: "create add task",
    build: (v) => ({ title: v, date: todayISO(), done: false }),
  },
  {
    kind: "add",
    id: "add-habit",
    label: "New habit",
    entity: "habit",
    table: "habits",
    placeholder: "Habit name…",
    icon: Repeat,
    keywords: "create add streak",
    build: (v) => ({ name: v, icon: null, is_active: true }),
  },
  {
    kind: "add",
    id: "add-idea",
    label: "New idea",
    entity: "idea",
    table: "ideas",
    placeholder: "Capture an idea…",
    icon: Lightbulb,
    keywords: "create add note capture",
    build: (v) => ({ content: v, tag: null }),
  },
];

const ALL: Item[] = [...ADD, ...NAV];

function scoreMatch(item: Item, q: string): boolean {
  if (!q) return true;
  const hay = `${item.label} ${item.keywords ?? ""} ${
    item.kind === "add" ? "add new create" : "go to open"
  }`.toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .every((tok) => hay.includes(tok));
}

export function CommandPalette() {
  const router = useRouter();
  const { signOut } = useAuth();
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [compose, setCompose] = useState<AddItem | null>(null);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setQuery("");
    setActive(0);
    setCompose(null);
    setSaving(false);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    reset();
  }, [reset]);

  // Global ⌘K / Ctrl+K toggle
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("isa:open-palette", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("isa:open-palette", onOpen);
    };
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open, compose]);

  const results = useMemo(
    () => (compose ? [] : ALL.filter((i) => scoreMatch(i, query))),
    [query, compose]
  );

  useEffect(() => {
    setActive(0);
  }, [query]);

  const run = useCallback(
    async (item: Item) => {
      if (item.kind === "nav") {
        close();
        if (item.href === "__signout") signOut();
        else router.push(item.href);
        return;
      }
      // add: enter compose mode
      setCompose(item);
      setQuery("");
    },
    [close, router, signOut]
  );

  const save = useCallback(async () => {
    if (!compose) return;
    const value = query.trim();
    if (!value || saving) return;
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return;
    }
    const { error } = await supabase
      .from(compose.table)
      .insert({ ...compose.build(value), user_id: user.id } as never);
    if (error) toast(`Couldn't save ${compose.entity}`, "error");
    else toast(compose.label.replace("New", "Added"), "success");
    close();
  }, [compose, query, saving, close]);

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      if (compose) {
        setCompose(null);
        setQuery("");
      } else {
        close();
      }
      return;
    }
    if (compose) {
      if (e.key === "Enter") {
        e.preventDefault();
        void save();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = results[active];
      if (item) void run(item);
    }
  };

  return (
    <>
      {/* Desktop hint pill — bottom-left. On mobile the palette opens from the
          "Menu" item in the bottom nav bar (see Sidebar). */}
      <button
        onClick={() => setOpen(true)}
        className="glass fixed bottom-5 left-24 z-30 hidden items-center gap-2 rounded-full px-3.5 py-2 text-xs text-muted transition-colors hover:text-fg md:flex"
      >
        <Search size={14} />
        <span>{t("Search")}</span>
        <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-fg">
          ⌘K
        </kbd>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-[12vh]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={close}
            />
            <motion.div
              className="glass reflect relative z-10 w-full max-w-lg overflow-hidden rounded-2xl"
              style={{
                // Near-solid panel: the translucent glass is unreadable over
                // busy pages, especially in the light (girls) theme.
                background:
                  "color-mix(in srgb, var(--color-bg) 94%, transparent)",
              }}
              initial={{ opacity: 0, scale: 0.97, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 6 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            >
              {/* Input row */}
              <div className="flex items-center gap-3 border-b border-line px-4 py-3.5">
                {compose ? (
                  <compose.icon size={18} className="shrink-0 text-accent" />
                ) : (
                  <Search size={18} className="shrink-0 text-muted" />
                )}
                {compose && (
                  <span className="shrink-0 text-sm font-medium text-fg">
                    {compose.label}
                  </span>
                )}
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={onInputKey}
                  placeholder={
                    compose ? t(compose.placeholder) : t("Search or jump to…")
                  }
                  className="flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-muted/60"
                />
                {compose && (
                  <span className="hidden items-center gap-1 text-[10px] text-muted sm:flex">
                    <CornerDownLeft size={12} /> save
                  </span>
                )}
              </div>

              {/* Results */}
              {!compose && (
                <ul className="max-h-[52vh] overflow-y-auto p-2">
                  {results.length === 0 && (
                    <li className="px-3 py-6 text-center text-sm text-muted">
                      No matches
                    </li>
                  )}
                  {results.map((item, i) => {
                    const Icon = item.icon;
                    const isAdd = item.kind === "add";
                    return (
                      <li key={item.id}>
                        <button
                          onMouseEnter={() => setActive(i)}
                          onClick={() => void run(item)}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
                            i === active
                              ? "bg-accent-soft text-fg"
                              : "text-fg/80 hover:text-fg"
                          )}
                        >
                          <Icon
                            size={16}
                            className={isAdd ? "text-accent" : "text-muted"}
                          />
                          <span className="flex-1">
                            {isAdd && (
                              <span className="text-muted">{t("Add")}: </span>
                            )}
                            {t(item.label)}
                          </span>
                          {i === active && (
                            <ArrowRight size={14} className="text-muted" />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              {compose && (
                <div className="px-4 py-3 text-xs text-muted">
                  Press{" "}
                  <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-fg">
                    Esc
                  </kbd>{" "}
                  to go back · <span className="text-fg/80">Enter</span> to save
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
