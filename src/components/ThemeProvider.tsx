"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export type Theme = "boys" | "girls";

const Ctx = createContext<{ theme: Theme; setTheme: (t: Theme) => void }>({
  theme: "boys",
  setTheme: () => {},
});

const apply = (t: Theme) =>
  document.documentElement.setAttribute("data-theme", t);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("boys");

  useEffect(() => {
    const cached = (localStorage.getItem("isa_theme") as Theme) || "boys";
    apply(cached);
    setThemeState(cached);
    supabase
      .from("profiles")
      .select("theme_preference")
      .maybeSingle()
      .then(({ data }) => {
        const t = (data?.theme_preference as Theme) || cached;
        apply(t);
        setThemeState(t);
        localStorage.setItem("isa_theme", t);
      });
  }, []);

  const setTheme = async (t: Theme) => {
    apply(t);
    setThemeState(t);
    localStorage.setItem("isa_theme", t);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user)
      await supabase
        .from("profiles")
        .upsert({ user_id: user.id, theme_preference: t });
  };

  return <Ctx.Provider value={{ theme, setTheme }}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);
