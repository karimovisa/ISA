"use client";

import { GlassCard } from "@/components/ui/GlassCard";
import { PressButton } from "@/components/ui/PressButton";
import { cn } from "@/lib/cn";

type IconType = React.ComponentType<{ size?: number; className?: string }>;

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: {
  icon: IconType;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}) {
  return (
    <GlassCard
      className={cn(
        "flex flex-col items-center justify-center px-6 py-16 text-center",
        className
      )}
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.06]">
        <Icon size={26} className="text-muted" />
      </div>
      <h3 className="text-base font-medium text-fg">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-xs text-sm text-muted">{description}</p>
      )}
      {actionLabel && onAction && (
        <PressButton
          onClick={onAction}
          className="mt-5 rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-fg transition hover:bg-white/15"
        >
          {actionLabel}
        </PressButton>
      )}
    </GlassCard>
  );
}
