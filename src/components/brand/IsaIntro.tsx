"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ISA_VIEWBOX,
  ISA_STROKE,
  BASELINE_Y,
  BASELINE_PATH,
  I_PATH,
  S_PATH,
  A_PATH,
  A_BAR,
  RUN_FROM,
  RUN_TO,
} from "@/lib/isaPaths";
import { MountainBackdrop } from "@/components/brand/MountainBackdrop";
import { IsaRunner } from "@/components/brand/IsaRunner";

// easeInOutCubic — intentional, no bounce, no elastic.
const EASE = [0.65, 0, 0.35, 1] as const;
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
  useEffect(() => {
    const t = setTimeout(onDone, 5800);
    return () => clearTimeout(t);
  }, [onDone]);

  // opacity flips on with the draw so a round-cap dot never shows at pathLength 0.
  const drawn = {
    initial: { pathLength: 0, opacity: 0 },
    animate: { pathLength: 1, opacity: 1 },
  };

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden"
      style={{ backgroundColor: "#050505" }}
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.7, ease: EASE }}
    >
      {/* Faint mountain atmosphere (~10%) */}
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
          {/* 0.3s → the life line writes itself */}
          <motion.path
            d={BASELINE_PATH}
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 0.28 }}
            transition={{ duration: 0.6, delay: 0.3, ease: EASE }}
          />

          {/* 2.0s → the S forms as the runner passes */}
          <motion.path
            d={S_PATH}
            {...drawn}
            transition={{ duration: 0.9, delay: 1.8, ease: EASE }}
          />
          {/* 3.2s → the path rises into the mountain A */}
          <motion.path
            d={A_PATH}
            {...drawn}
            transition={{ duration: 0.9, delay: 3.0, ease: EASE }}
          />
          <motion.path
            d={A_BAR}
            {...drawn}
            transition={{ duration: 0.4, delay: 3.7, ease: EASE }}
          />

          {/* runner runs the baseline, then fades into the I */}
          <motion.g
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 1, 0] }}
            transition={{
              duration: 3.6,
              delay: 0.8,
              times: [0, 0.06, 0.9, 1],
              ease: "linear",
            }}
          >
            <motion.g
              initial={{ x: RUN_FROM }}
              animate={{ x: RUN_TO }}
              transition={{ duration: 3.2, delay: 0.8, ease: EASE }}
            >
              <g transform={`translate(0 ${BASELINE_Y})`}>
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
          </motion.g>

          {/* 4.2s → the identity crystallizes as the I */}
          <motion.path
            d={I_PATH}
            {...drawn}
            transition={{ duration: 0.6, delay: 4.2, ease: EASE }}
          />
          <motion.line
            x1={170}
            y1={60}
            x2={170}
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
