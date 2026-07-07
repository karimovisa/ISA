"use client";

import { useT, type Lang } from "@/lib/i18n";
import { cn } from "@/lib/cn";

/** Always-visible EN/UZ switch, pinned top-right on every page (incl. login). */
export function LanguageToggle() {
  const { lang, setLang } = useT();
  return (
    <div
      className="glass fixed right-3 z-50 flex items-center rounded-full p-0.5 text-[11px] font-semibold"
      style={{ top: "calc(0.6rem + env(safe-area-inset-top))" }}
    >
      {(["en", "uz"] as const).map((l: Lang) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          aria-label={l === "en" ? "English" : "O'zbekcha"}
          aria-pressed={lang === l}
          className={cn(
            "rounded-full px-2.5 py-1 uppercase tracking-wide transition-colors",
            lang === l
              ? "bg-accent text-white"
              : "text-muted hover:text-fg"
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
