import { cn } from "@/lib/cn";

/**
 * Subtle cinematic mountain range, pure SVG. Sits behind content at low
 * opacity; the brand "peak" atmosphere without shipping an image asset.
 */
export function MountainBackdrop({
  className,
  opacity = 1,
}: {
  className?: string;
  opacity?: number;
}) {
  return (
    <svg
      viewBox="0 0 1200 400"
      preserveAspectRatio="xMidYMax slice"
      fill="none"
      aria-hidden
      className={cn("pointer-events-none select-none", className)}
      style={{ opacity }}
    >
      <defs>
        <linearGradient id="mtn-far" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1c1c1c" />
          <stop offset="100%" stopColor="#050505" />
        </linearGradient>
        <linearGradient id="mtn-near" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#161616" />
          <stop offset="100%" stopColor="#050505" />
        </linearGradient>
        <linearGradient id="mtn-snow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ededed" />
          <stop offset="100%" stopColor="rgba(237,237,237,0)" />
        </linearGradient>
      </defs>

      {/* Far range */}
      <path
        d="M0 400 L0 230 L180 150 L320 220 L470 120 L620 210 L780 110 L940 200 L1080 150 L1200 220 L1200 400 Z"
        fill="url(#mtn-far)"
        opacity={0.6}
      />
      {/* Main peak */}
      <path
        d="M250 400 L600 70 L950 400 Z"
        fill="url(#mtn-near)"
      />
      {/* Ridge highlight down the peak's face */}
      <path
        d="M600 70 L648 210 L706 400"
        stroke="rgba(255,255,255,0.12)"
        strokeWidth={1.5}
        fill="none"
      />
      {/* Snow cap on the main peak */}
      <path
        d="M600 70 L660 130 L628 124 L600 150 L572 122 L540 130 Z"
        fill="url(#mtn-snow)"
      />
      {/* Near range */}
      <path
        d="M0 400 L0 300 L220 210 L420 300 L640 200 L860 300 L1060 230 L1200 300 L1200 400 Z"
        fill="url(#mtn-near)"
      />
    </svg>
  );
}
