"use client";

// ISA — ambient atmosphere. Two large, heavily-blurred colour fields that drift
// almost imperceptibly behind the whole app, plus the mountain horizon. It gives
// the dashboard depth and life without a single pixel of visual noise — you feel
// motion more than you see it. GPU-only (transform/opacity), and it goes still
// for anyone who prefers reduced motion.

import { motion, useReducedMotion } from "framer-motion";
import { MountainBg } from "./MountainBg";

export function Atmosphere() {
  const reduce = useReducedMotion();
  const drift = (a: number[], b: number[]) =>
    reduce ? undefined : { x: a, y: b };

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <motion.div
        className="absolute left-1/2 top-[-18%] h-[540px] w-[540px] -translate-x-1/2 rounded-full will-change-transform"
        style={{
          background: "radial-gradient(circle, var(--color-accent), transparent 68%)",
          opacity: 0.1,
          filter: "blur(90px)",
        }}
        animate={drift([0, 46, -22, 0], [0, 30, 12, 0])}
        transition={{ duration: 30, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-[-14%] right-[-8%] h-[480px] w-[480px] rounded-full will-change-transform"
        style={{
          background: "radial-gradient(circle, #4F8CFF, transparent 70%)",
          opacity: 0.06,
          filter: "blur(100px)",
        }}
        animate={drift([0, -34, 18, 0], [0, -22, 6, 0])}
        transition={{ duration: 38, repeat: Infinity, ease: "easeInOut" }}
      />
      <MountainBg />
    </div>
  );
}
