"use client";

import { useT, LANGS, type Lang } from "@/lib/i18n";
import { cn } from "@/lib/cn";

const LABEL: Record<Lang, string> = { en: "English", uz: "O'zbekcha", ru: "Русский" };

/** Always-visible EN/UZ/RU switch, pinned top-right on every page (incl. login). */
export function LanguageToggle() {
  const { lang, setLang } = useT();
  return (
    <div
      className="glass fixed right-3 z-50 flex items-center rounded-full p-0.5 text-[10px] font-medium opacity-80 transition-opacity hover:opacity-100"
      style={{ top: "calc(0.6rem + env(safe-area-inset-top))" }}
    >
      {LANGS.map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          aria-label={LABEL[l]}
          aria-pressed={lang === l}
          className={cn(
            "rounded-full px-1.5 py-0.5 uppercase tracking-wide transition-colors",
            lang === l ? "bg-white/15 text-fg" : "text-muted/70 hover:text-fg"
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
