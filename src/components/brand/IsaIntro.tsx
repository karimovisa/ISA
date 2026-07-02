"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, animate, motion, useReducedMotion } from "framer-motion";
import {
  ISA_VIEWBOX,
  ISA_STROKE,
  I_PATH,
  S_PATH,
  A_PATH,
  A_BAR,
  ROUTE,
} from "@/lib/isaPaths";
import { MountainBackdrop } from "@/components/brand/MountainBackdrop";
import { IsaRunner } from "@/components/brand/IsaRunner";

// easeInOutCubic — intentional, no bounce, no elastic.
const EASE = [0.65, 0, 0.35, 1] as const;
const SESSION_KEY = "isa_intro_seen";

// Master draw window (path + runner share it exactly).
const DRAW_DELAY = 0.3;
const DRAW_DUR = 3.7;

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
    const t = setTimeout(onDone, 5800); // draw done ~4.2s, hold ~1s + buffer
    return () => clearTimeout(t);
  }, [onDone]);

  // Runner rides the exact drawing tip of ROUTE, staying upright with a hint of lean.
  useEffect(() => {
    const route = routeRef.current;
    const g = runnerRef.current;
    if (!route || !g) return;
    const total = route.getTotalLength();
    const controls = animate(0, 1, {
      delay: DRAW_DELAY,
      duration: DRAW_DUR,
      ease: EASE,
      onUpdate: (p) => {
        const d = p * total;
        const pt = route.getPointAtLength(d);
        const ahead = route.getPointAtLength(Math.min(d + 2, total));
        const lean =
          (Math.atan2(ahead.y - pt.y, ahead.x - pt.x) * 180) / Math.PI;
        g.setAttribute(
          "transform",
          `translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)}) rotate(${(
            lean * 0.12
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
      {/* Faint mountain atmosphere (brand continuity, ~10%) */}
      <motion.div
        className="absolute inset-x-0 bottom-0 h-[58%]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.1 }}
        transition={{ duration: 1, delay: 0.2, ease: EASE }}
      >
        <MountainBackdrop className="h-full w-full" />
      </motion.div>

      {/* Subtle white bloom — the only glow */}
      <motion.div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[40vh] w-[62vw] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background:
            "radial-gradient(closest-side, rgba(255,255,255,0.08), transparent)",
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.6, delay: 0.3, ease: EASE }}
      />

      {/* The mark */}
      <div className="relative flex flex-col items-center px-6">
        <svg
          viewBox={ISA_VIEWBOX}
          fill="none"
          stroke="#ffffff"
          strokeWidth={ISA_STROKE}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="isa-glow w-[min(88vw,720px)]"
        >
          {/* hidden route the runner samples */}
          <path ref={routeRef} d={ROUTE} stroke="none" fill="none" />

          {/* 0.3s → the continuous line draws itself (S then A) */}
          <motion.path
            d={ROUTE}
            {...drawn}
            transition={{ duration: DRAW_DUR, delay: DRAW_DELAY, ease: EASE }}
          />
          {/* 3.6s → the A's crossbar */}
          <motion.path
            d={A_BAR}
            {...drawn}
            transition={{ duration: 0.4, delay: 3.6, ease: EASE }}
          />

          {/* runner rides the drawing tip, then fades into the I */}
          <motion.g
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 1, 0] }}
            transition={{
              duration: 3.6,
              delay: 0.8,
              times: [0, 0.08, 0.94, 1],
              ease: "linear",
            }}
          >
            <g ref={runnerRef} transform="translate(90 120)">
              <motion.g
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 0.3, repeat: Infinity, ease: "easeInOut" }}
              >
                <g transform="scale(4.4)">
                  <IsaRunner />
                </g>
              </motion.g>
            </g>
          </motion.g>

          {/* 4.2s → the identity crystallizes as the I */}
          <motion.path
            d={I_PATH}
            {...drawn}
            transition={{ duration: 0.6, delay: 4.2, ease: EASE }}
          />
          {/* soft light where the I forms */}
          <motion.line
            x1={90}
            y1={50}
            x2={90}
            y2={190}
            stroke="#ffffff"
            strokeWidth={22}
            strokeLinecap="round"
            style={{ filter: "blur(8px)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.5, 0] }}
            transition={{ duration: 0.8, delay: 4.2, ease: EASE }}
          />
        </svg>

        {/* Tagline */}
        <motion.div
          className="mt-10 flex items-center gap-3 text-[0.72rem] font-medium uppercase tracking-[0.42em] text-white/70"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 4.6, ease: EASE }}
        >
          <span>Focus</span>
          <span className="text-white/40">·</span>
          <span>Process</span>
          <span className="text-white/40">·</span>
          <span>Peak</span>
        </motion.div>
      </div>

      <button
        onClick={onDone}
        className="absolute bottom-8 right-8 text-xs text-white/40 transition hover:text-white"
      >
        Skip
      </button>
    </motion.div>
  );
}
