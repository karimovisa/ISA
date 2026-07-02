"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, animate, motion, useReducedMotion } from "framer-motion";
import {
  ISA_VIEWBOX,
  BASELINE_PATH,
  I_PATH,
  S_PATH,
  A_PATH,
  A_RIDGE_PATH,
  RUNNER_ROUTE,
} from "@/lib/isaPaths";
import { MountainBackdrop } from "@/components/brand/MountainBackdrop";
import { IsaRunner } from "@/components/brand/IsaRunner";

// easeInOutCubic — the intentional, non-bouncy curve the brief calls for.
const EASE = [0.65, 0, 0.35, 1] as const;
const EASE_IN = [0.4, 0, 1, 1] as const;
const SESSION_KEY = "isa_intro_seen";

/** Plays the intro once per browser session; skipped under reduced motion. */
export function IsaIntroGate() {
  const [show, setShow] = useState(false);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (reduce) return;
    if (sessionStorage.getItem(SESSION_KEY)) return;
    setShow(true);
  }, [reduce]);

  const finish = () => {
    sessionStorage.setItem(SESSION_KEY, "1");
    setShow(false);
  };

  return (
    <AnimatePresence>{show && <IsaIntro onDone={finish} />}</AnimatePresence>
  );
}

function IsaIntro({ onDone }: { onDone: () => void }) {
  const routeRef = useRef<SVGPathElement>(null);
  const runnerRef = useRef<SVGGElement>(null);

  useEffect(() => {
    const t = setTimeout(onDone, 4800);
    return () => clearTimeout(t);
  }, [onDone]);

  // Runner follows the real route (baseline → climb) and leans into the slope.
  useEffect(() => {
    const route = routeRef.current;
    const g = runnerRef.current;
    if (!route || !g) return;
    const total = route.getTotalLength();
    const controls = animate(0, 1, {
      duration: 2.6,
      delay: 0.9,
      ease: EASE,
      onUpdate: (p) => {
        const d = p * total;
        const pt = route.getPointAtLength(d);
        const ahead = route.getPointAtLength(Math.min(d + 1, total));
        const angle =
          (Math.atan2(ahead.y - pt.y, ahead.x - pt.x) * 180) / Math.PI;
        g.setAttribute(
          "transform",
          `translate(${pt.x.toFixed(2)} ${pt.y.toFixed(2)}) rotate(${(
            angle * 0.55
          ).toFixed(2)})`
        );
      },
    });
    return () => controls.stop();
  }, []);

  const drawn = { initial: { pathLength: 0 }, animate: { pathLength: 1 } };

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden"
      style={{ backgroundColor: "#050505" }}
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.7, ease: EASE }}
    >
      {/* Mountain — dark, ~13%, moonlit peaks, tiny parallax drift, no zoom */}
      <motion.div
        className="absolute inset-x-0 bottom-0 h-[62%]"
        initial={{ opacity: 0, x: 0 }}
        animate={{ opacity: 0.13, x: -5 }}
        transition={{
          opacity: { duration: 0.9, delay: 0.2, ease: EASE_IN },
          x: { duration: 4.8, ease: "linear" },
        }}
      >
        <MountainBackdrop className="h-full w-full" />
      </motion.div>

      {/* Subtle white light bloom behind the mark (only glow in the scene) */}
      <motion.div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[38vh] w-[58vw] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background:
            "radial-gradient(closest-side, rgba(255,255,255,0.08), transparent)",
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.6, delay: 0.4, ease: EASE }}
      />
      {/* Final ambient glow that settles behind the completed logo */}
      <motion.div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[30vh] w-[46vw] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background:
            "radial-gradient(closest-side, rgba(255,255,255,0.07), transparent)",
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 4.2, ease: EASE }}
      />

      {/* The mark */}
      <div className="relative flex flex-col items-center">
        <motion.svg
          viewBox={ISA_VIEWBOX}
          fill="none"
          stroke="#ffffff"
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="isa-glow w-[min(76vw,560px)]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, ease: EASE }}
        >
          <defs>
            <filter id="isa-bloom" x="-120%" y="-120%" width="340%" height="340%">
              <feGaussianBlur stdDeviation="1.6" />
            </filter>
          </defs>

          {/* hidden route the runner samples */}
          <path ref={routeRef} d={RUNNER_ROUTE} stroke="none" fill="none" />

          {/* 0.40–0.90 — the life line writes itself */}
          <motion.path
            d={BASELINE_PATH}
            opacity={0.3}
            {...drawn}
            transition={{ duration: 0.5, delay: 0.4, ease: EASE }}
          />

          {/* 1.80–2.60 — the path bends into S as the runner passes */}
          <motion.path
            d={S_PATH}
            {...drawn}
            transition={{ duration: 0.8, delay: 1.8, ease: EASE }}
          />
          {/* 2.60–3.50 — the path rises into the mountain (A) */}
          <motion.path
            d={A_PATH}
            {...drawn}
            transition={{ duration: 0.9, delay: 2.6, ease: EASE }}
          />
          <motion.path
            d={A_RIDGE_PATH}
            opacity={0.4}
            {...drawn}
            transition={{ duration: 0.4, delay: 3.0, ease: EASE }}
          />

          {/* peak shimmer — once, as the summit completes */}
          <motion.circle
            cx={86}
            cy={11}
            r={4}
            fill="#ffffff"
            filter="url(#isa-bloom)"
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: [0, 0.9, 0], scale: [0.4, 1.6, 2.2] }}
            transition={{ duration: 0.7, delay: 3.35, ease: EASE }}
            style={{ transformOrigin: "86px 11px" }}
          />

          {/* runner — dissolves into light near the summit */}
          <motion.g
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 1, 0] }}
            transition={{
              duration: 2.9,
              delay: 0.9,
              times: [0, 0.06, 0.85, 1],
              ease: "linear",
            }}
          >
            <g ref={runnerRef} transform="translate(4 36)">
              <motion.g
                animate={{ y: [0, -1.4, 0] }}
                transition={{ duration: 0.28, repeat: Infinity, ease: "easeInOut" }}
              >
                <IsaRunner />
              </motion.g>
            </g>
          </motion.g>

          {/* 3.50–4.20 — vertical light becomes the I */}
          <motion.ellipse
            cx={18}
            cy={24}
            rx={2}
            ry={12}
            fill="#ffffff"
            filter="url(#isa-bloom)"
            initial={{ opacity: 0, scaleY: 1.4 }}
            animate={{ opacity: [0, 0.8, 0], scaleY: [1.4, 1, 1] }}
            transition={{ duration: 0.7, delay: 3.6, ease: EASE }}
            style={{ transformOrigin: "18px 24px" }}
          />
          <motion.path
            d={I_PATH}
            {...drawn}
            transition={{ duration: 0.6, delay: 3.7, ease: EASE }}
          />
        </motion.svg>

        {/* Tagline */}
        <motion.div
          className="mt-9 flex items-center gap-3 text-[0.72rem] font-medium uppercase tracking-[0.42em] text-white/70"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 4.2, ease: EASE }}
        >
          <span>Focus</span>
          <span className="text-white/40">·</span>
          <span>Process</span>
          <span className="text-white/40">·</span>
          <span>Peak</span>
        </motion.div>
      </div>

      {/* Skip */}
      <button
        onClick={onDone}
        className="absolute bottom-8 right-8 text-xs text-white/40 transition hover:text-white"
      >
        Skip
      </button>
    </motion.div>
  );
}
