import { ISA_VIEWBOX, ISA_STROKE, I_PATH, S_PATH, A_PATH, A_BAR } from "@/lib/isaPaths";
import { cn } from "@/lib/cn";

/**
 * The final, static ISA mark — no runner. Exact isa-logo.svg geometry, pure
 * line art that scales from a favicon to a hero. Inherits `currentColor`.
 */
export function IsaLogo({
  className,
  glow = false,
  strokeWidth = ISA_STROKE,
}: {
  className?: string;
  glow?: boolean;
  strokeWidth?: number;
}) {
  return (
    <svg
      viewBox={ISA_VIEWBOX}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="ISA"
      className={cn(glow && "isa-glow", className)}
    >
      <path d={I_PATH} />
      <path d={S_PATH} />
      <path d={A_PATH} />
      <path d={A_BAR} />
    </svg>
  );
}
