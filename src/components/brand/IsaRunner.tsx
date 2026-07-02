"use client";

import { motion } from "framer-motion";

/**
 * Pictogram-style runner (Olympic-icon feel) for the intro animation only —
 * it never appears in the final mark. Solid white limbs built from thick
 * rounded strokes, proper sprint biomechanics: forward lean, opposite
 * arm/leg drive, trailing heel kicked up.
 *
 * Drawn around the feet at (0,0), ~16 units tall, facing right. Two poses
 * crossfade for the run cycle. Place inside an SVG and translate the group.
 */
export function IsaRunner() {
  const cycle = { duration: 0.3, repeat: Infinity, ease: "linear" as const };
  const limb = {
    stroke: "white",
    strokeWidth: 2.1,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    fill: "none",
  };

  return (
    <g>
      {/* soft shadow underneath (5%) */}
      <ellipse cx={0.5} cy={0.6} rx={4.2} ry={0.8} fill="white" opacity={0.05} />

      {/* tiny light trail */}
      <motion.g
        stroke="white"
        strokeWidth={0.7}
        strokeLinecap="round"
        animate={{ opacity: [0.28, 0.08, 0.28] }}
        transition={{ duration: 0.4, repeat: Infinity }}
      >
        <line x1={-5} y1={-9} x2={-10} y2={-9} />
        <line x1={-5} y1={-5} x2={-12} y2={-5} />
      </motion.g>

      {/* ===== Pose A — full stride (flight phase) ===== */}
      <motion.g animate={{ opacity: [1, 0, 1] }} transition={cycle}>
        {/* head */}
        <circle cx={4.4} cy={-13.6} r={2.1} fill="white" stroke="none" />
        {/* torso — strong forward lean */}
        <path d="M3.6 -11.4 L1.2 -5.6" {...limb} strokeWidth={2.4} />
        {/* front arm — bent, driving up */}
        <path d="M3.2 -10.6 L6.2 -8.8 L8 -11.4" {...limb} />
        {/* back arm — bent, swinging back */}
        <path d="M3.2 -10.6 L0.2 -9.2 L-1.6 -11.4" {...limb} />
        {/* front leg — knee up, reaching forward */}
        <path d="M1.2 -5.6 L5.2 -4.2 L6.6 -0.2" {...limb} />
        {/* back leg — trailing, heel kicked up */}
        <path d="M1.2 -5.6 L-2 -4 L-5 -1.2" {...limb} />
      </motion.g>

      {/* ===== Pose B — legs crossing (support phase) ===== */}
      <motion.g animate={{ opacity: [0, 1, 0] }} transition={cycle}>
        {/* head */}
        <circle cx={4} cy={-13.9} r={2.1} fill="white" stroke="none" />
        {/* torso */}
        <path d="M3.2 -11.7 L1 -5.8" {...limb} strokeWidth={2.4} />
        {/* arms mid-swing (opposite of pose A) */}
        <path d="M2.8 -10.8 L5.4 -9.6 L6.4 -7.4" {...limb} />
        <path d="M2.8 -10.8 L0 -10 L-1.2 -8" {...limb} />
        {/* support leg — under the body */}
        <path d="M1 -5.8 L2.4 -2.8 L2.2 0.4" {...limb} />
        {/* recovery leg — heel snapped up behind */}
        <path d="M1 -5.8 L-2.2 -4.6 L-2.8 -7.4" {...limb} />
      </motion.g>
    </g>
  );
}
