"use client";

import { Sparkles } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { PressButton } from "@/components/ui/PressButton";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/cn";

type IconType = React.ComponentType<{ size?: number; className?: string }>;

/**
 * An empty page is a teaching moment, not a dead end. `learns` states what ISA
 * will begin to understand once this area has data — the reason to bother.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  learns,
  actionLabel,
  onAction,
  className,
}: {
  icon: IconType;
  title: string;
  description?: string;
  /** "ISA will begin learning …" — the value of adding the first record. */
  learns?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}) {
  const { t } = useT();
  return (
    <GlassCard
      className={cn(
        "flex flex-col items-center justify-center px-6 py-12 text-center",
        className
      )}
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.06]">
        <Icon size={26} className="text-muted" />
      </div>
      <h3 className="text-base font-medium text-fg">{t(title)}</h3>
      {description && (
        <p className="mt-1.5 max-w-xs text-sm text-muted">{t(description)}</p>
      )}

      {learns && (
        <div className="mt-4 flex max-w-sm items-start gap-2 rounded-2xl border border-line bg-white/[0.02] p-3 text-left">
          <Sparkles size={13} className="mt-0.5 shrink-0 text-accent" />
          <p className="text-xs leading-relaxed text-muted">{t(learns)}</p>
        </div>
      )}

      {actionLabel && onAction && (
        <PressButton
          onClick={onAction}
          className="mt-5 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
        >
          {t(actionLabel)}
        </PressButton>
      )}
    </GlassCard>
  );
}
