"use client";

import { motion, useReducedMotion } from "framer-motion";

/**
 * Overall progress rendered as an ascent up the brand mountain: a climber dot
 * travels the left face toward the summit as `value` approaches 100.
 */
const BASE = { x: 12, y: 54 };
const PEAK = { x: 152, y: 14 };
const ASCENT = `M${BASE.x} ${BASE.y} L${PEAK.x} ${PEAK.y}`;
const MOUNTAIN = `M${BASE.x} ${BASE.y} L${PEAK.x} ${PEAK.y} L192 54`;

export function AscentProgress({ value }: { value: number }) {
  const reduce = useReducedMotion();
  const t = Math.max(0, Math.min(100, value)) / 100;
  const cx = BASE.x + (PEAK.x - BASE.x) * t;
  const cy = BASE.y + (PEAK.y - BASE.y) * t;
  const summited = t >= 1;

  return (
    <svg viewBox="0 0 204 64" className="w-full" aria-label={`${value}% progress`}>
      {/* ground line */}
      <path d="M4 54 H200" stroke="rgba(255,255,255,0.08)" strokeWidth={1.5} strokeLinecap="round" />
      {/* full mountain outline, faint */}
      <path
        d={MOUNTAIN}
        stroke="rgba(255,255,255,0.16)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* summit marker */}
      <circle cx={PEAK.x} cy={PEAK.y} r={2} fill={summited ? "#ffffff" : "rgba(255,255,255,0.35)"} />

      {/* climbed portion */}
      <motion.path
        d={ASCENT}
        stroke="#ffffff"
        strokeWidth={2.4}
        strokeLinecap="round"
        fill="none"
        style={{ filter: "drop-shadow(0 0 6px rgba(255,255,255,0.35))" }}
        initial={{ pathLength: reduce ? t : 0 }}
        animate={{ pathLength: t }}
        transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
      />

      {/* climber */}
      <motion.g
        initial={reduce ? { x: cx, y: cy } : { x: BASE.x, y: BASE.y }}
        animate={{ x: cx, y: cy }}
        transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
      >
        <motion.circle
          r={7}
          fill="rgba(255,255,255,0.12)"
          animate={reduce ? undefined : { scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        />
        <circle r={3} fill="#ffffff" />
      </motion.g>
    </svg>
  );
}
