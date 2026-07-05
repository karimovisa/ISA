import {
  ISA_VIEWBOX,
  ISA_STROKE,
  BASELINE_PATH,
  I_PATH,
  S_PATH,
  A_PATH,
} from "@/lib/isaPaths";
import { cn } from "@/lib/cn";

/**
 * The final, static ISA mark — no runner. Clean line art (I · S · A on the life
 * line) that scales from a favicon to a hero. Inherits `currentColor`.
 */
export function IsaLogo({
  className,
  withBaseline = true,
  glow = false,
  strokeWidth = ISA_STROKE,
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
      {withBaseline && <path d={BASELINE_PATH} opacity={0.22} />}
      <path d={I_PATH} />
      <path d={S_PATH} />
      <path d={A_PATH} />
    </svg>
  );
}
