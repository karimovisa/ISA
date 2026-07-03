"use client";

import { useEffect, useState } from "react";

/**
 * Line-art runner with a real 2-frame run cycle. Frames are swapped discretely
 * (not crossfaded), which reads as running instead of a ghosting flail. Drawn
 * around the feet at (0,0), ~16 units tall, facing right.
 */
export function IsaRunner() {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setFrame((f) => f ^ 1), 130);
    return () => clearInterval(id);
  }, []);

  const limb = {
    stroke: "white",
    strokeWidth: 2.1,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    fill: "none",
  };

  return (
    <g>
      {/* soft shadow */}
      <ellipse cx={0.5} cy={0.6} rx={4.2} ry={0.8} fill="white" opacity={0.05} />
      {/* speed trail */}
      <g stroke="white" strokeWidth={0.7} strokeLinecap="round" opacity={0.2}>
        <line x1={-5} y1={-9} x2={-11} y2={-9} />
        <line x1={-5} y1={-5} x2={-13} y2={-5} />
      </g>

      {/* head + torso (static) */}
      <circle cx={4.4} cy={-13.6} r={2.1} fill="white" stroke="none" />
      <path d="M3.6 -11.4 L1.2 -5.6" {...limb} strokeWidth={2.4} />

      {frame === 0 ? (
        <>
          {/* spread stride */}
          <path d="M1.2 -5.6 L4.6 -3 L6.6 -0.4" {...limb} />
          <path d="M1.2 -5.6 L-1.8 -3.6 L-4.4 -1.4" {...limb} />
          <path d="M3.2 -10.6 L5.8 -9 L7.4 -11" {...limb} />
          <path d="M3.2 -10.6 L0.4 -9.4 L-1.2 -11" {...limb} />
        </>
      ) : (
        <>
          {/* passing / recovery */}
          <path d="M1.2 -5.6 L2.4 -2.6 L2.2 0.4" {...limb} />
          <path d="M1.2 -5.6 L-1.8 -4.4 L-0.6 -6.6" {...limb} />
          <path d="M3.2 -10.6 L1 -9.2 L-0.6 -10.8" {...limb} />
          <path d="M3.2 -10.6 L5.2 -9.2 L6.6 -11" {...limb} />
        </>
      )}
    </g>
  );
}
