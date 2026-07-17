"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

/**
 * ONE order for every page ISA has. The sidebar renders it in full; the mobile
 * bottom bar takes the first MOBILE_SLOTS of it and the rest live in ⌘K — so
 * desktop and mobile can never disagree, and reordering here moves both.
 *
 * Previously this held only the 6 bottom-bar items, which is why the Settings
 * editor couldn't list (or reorder) anything else.
 */
export const DEFAULT_NAV_ORDER = [
  "/",
  "/ask",
  "/goals",
  "/habits",
  "/journal",
  "/focus",
  "/progress",
  "/knows",
  "/money",
  "/projects",
  "/ideas",
  "/calendar",
  "/pray",
];

/** How many of the ordered pages fit in the mobile bottom bar (+ the Menu key). */
export const MOBILE_SLOTS = 5;

const STORAGE_KEY = "isa_nav_order";

function sanitize(order: unknown): string[] {
  if (!Array.isArray(order)) return DEFAULT_NAV_ORDER;
  const known = order.filter(
    (h): h is string => typeof h === "string" && DEFAULT_NAV_ORDER.includes(h)
  );
  // Any missing/new item (e.g. a future default changes) is appended so
  // nothing silently disappears from the bar.
  const missing = DEFAULT_NAV_ORDER.filter((h) => !known.includes(h));
  return [...known, ...missing];
}

const Ctx = createContext<{
  order: string[];
  setOrder: (order: string[]) => void;
}>({
  order: DEFAULT_NAV_ORDER,
  setOrder: () => {},
});

export function NavOrderProvider({ children }: { children: React.ReactNode }) {
  const [order, setOrderState] = useState<string[]>(DEFAULT_NAV_ORDER);

  useEffect(() => {
    try {
      const cached = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (cached) setOrderState(sanitize(cached));
    } catch {
      // ignore bad cache
    }
    supabase
      .from("profiles")
      .select("nav_order")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.nav_order) {
          const clean = sanitize(data.nav_order);
          setOrderState(clean);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
        }
      });
  }, []);

  const setOrder = async (next: string[]) => {
    const clean = sanitize(next);
    setOrderState(clean);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user)
      await supabase
        .from("profiles")
        .upsert({ user_id: user.id, nav_order: clean });
  };

  return <Ctx.Provider value={{ order, setOrder }}>{children}</Ctx.Provider>;
}

export const useNavOrder = () => useContext(Ctx);
