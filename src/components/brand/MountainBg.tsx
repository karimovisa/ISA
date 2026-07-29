// ISA — Dashboard atmosphere. A whisper of a mountain range that lives in the
// BACKGROUND, never inside a card. Pure SVG (no image), theme-aware via the fg
// token, blurred and barely-there so it reads as depth, not decoration. A bottom
// fade dissolves any hard edge — you feel the horizon more than you see it.

export function MountainBg() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[440px] overflow-hidden"
      style={{
        opacity: 0.045,
        transform: "scale(1.1)",
        filter: "blur(2px)",
        WebkitMaskImage: "linear-gradient(to bottom, black 30%, transparent 100%)",
        maskImage: "linear-gradient(to bottom, black 30%, transparent 100%)",
      }}
    >
      <svg viewBox="0 0 1440 440" preserveAspectRatio="xMidYMax slice" className="h-full w-full">
        {/* far ridge */}
        <path
          d="M0 440 L0 300 L170 150 L300 250 L460 110 L620 260 L800 150 L1000 250 L1180 130 L1320 240 L1440 180 L1440 440 Z"
          fill="var(--color-fg)"
        />
        {/* near ridge */}
        <path
          d="M0 440 L0 340 L210 250 L420 330 L590 230 L790 340 L1010 250 L1230 340 L1440 270 L1440 440 Z"
          fill="var(--color-fg)"
          opacity="0.55"
        />
      </svg>
    </div>
  );
}
