"use client";

import { useT, LANGS, type Lang } from "@/lib/i18n";
import { cn } from "@/lib/cn";

const LABEL: Record<Lang, string> = { en: "English", uz: "O'zbekcha", ru: "Русский" };

/** Always-visible EN/UZ/RU switch, pinned top-right on every page (incl. login). */
export function LanguageToggle() {
  const { lang, setLang } = useT();
  return (
    <div
      className="glass fixed right-3 z-50 flex items-center rounded-full p-0.5 text-[11px] font-semibold"
      style={{ top: "calc(0.6rem + env(safe-area-inset-top))" }}
    >
      {LANGS.map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          aria-label={LABEL[l]}
          aria-pressed={lang === l}
          className={cn(
            "rounded-full px-2 py-1 uppercase tracking-wide transition-colors",
            lang === l ? "bg-accent text-white" : "text-muted hover:text-fg"
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
