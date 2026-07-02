import {
  ISA_VIEWBOX,
  BASELINE_PATH,
  I_PATH,
  S_PATH,
  A_PATH,
  A_RIDGE_PATH,
} from "@/lib/isaPaths";
import { cn } from "@/lib/cn";

/**
 * The final, static ISA mark — no runner. Pure line art that scales from a
 * favicon to a hero. Inherits `currentColor`, so color it with text utilities.
 */
export function IsaLogo({
  className,
  withBaseline = true,
  glow = false,
  strokeWidth = 2.5,
}: {
  className?: string;
  withBaseline?: boolean;
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
      {withBaseline && (
        <path d={BASELINE_PATH} opacity={0.28} />
      )}
      <path d={I_PATH} />
      <path d={S_PATH} />
      <path d={A_PATH} />
      <path d={A_RIDGE_PATH} opacity={0.4} />
    </svg>
  );
}
