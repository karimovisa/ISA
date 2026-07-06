"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export type Theme = "boys" | "girls";
/** Girls sub-mode: auto flips day/night by local time; day/night pin it. */
export type GirlsMode = "auto" | "day" | "night";

const isDayNow = () => {
  const h = new Date().getHours();
  return h >= 6 && h < 19;
};

const resolve = (t: Theme, m: GirlsMode) =>
  t === "boys"
    ? "boys"
    : (m === "auto" ? isDayNow() : m === "day")
      ? "girls-day"
      : "girls-night";

const apply = (t: Theme, m: GirlsMode) =>
  document.documentElement.setAttribute("data-theme", resolve(t, m));

const Ctx = createContext<{
  theme: Theme;
  setTheme: (t: Theme) => void;
  girlsMode: GirlsMode;
  setGirlsMode: (m: GirlsMode) => void;
}>({
  theme: "boys",
  setTheme: () => {},
  girlsMode: "auto",
  setGirlsMode: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("boys");
  const [girlsMode, setGirlsModeState] = useState<GirlsMode>("auto");

  useEffect(() => {
    const mode =
      (localStorage.getItem("isa_girls_mode") as GirlsMode) || "auto";
    setGirlsModeState(mode);
    const cached = (localStorage.getItem("isa_theme") as Theme) || "boys";
    apply(cached, mode);
    setThemeState(cached);
    supabase
      .from("profiles")
      .select("theme_preference")
      .maybeSingle()
      .then(({ data }) => {
        const t: Theme =
          data?.theme_preference === "girls" ? "girls" : cached;
        apply(t, mode);
        setThemeState(t);
        localStorage.setItem("isa_theme", t);
      });
  }, []);

  // While girls+auto is active, re-check each minute so the palette flips
  // live at 06:00 / 19:00 without a refresh.
  useEffect(() => {
    if (theme !== "girls" || girlsMode !== "auto") return;
    const id = setInterval(() => apply("girls", "auto"), 60_000);
    return () => clearInterval(id);
  }, [theme, girlsMode]);

  const setTheme = async (t: Theme) => {
    apply(t, girlsMode);
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

  const setGirlsMode = (m: GirlsMode) => {
    setGirlsModeState(m);
    localStorage.setItem("isa_girls_mode", m);
    apply(theme, m);
  };

  return (
    <Ctx.Provider value={{ theme, setTheme, girlsMode, setGirlsMode }}>
      {children}
    </Ctx.Provider>
  );
}

export const useTheme = () => useContext(Ctx);
