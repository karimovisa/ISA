"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { IsaLogo } from "@/components/brand/IsaLogo";
import { IsaRunner } from "@/components/brand/IsaRunner";

// viewBox 900×240, baseline y=190. Runner draws the life line, fades, and the
// I rises where it stood; then S; then the mountain A (same size, no crossbar).
const BASELINE = "M120 190 H660";
const I_PATH = "M175 190 L175 66";
const S_PATH =
  "M456 96 C456 68 372 66 372 104 C372 138 456 130 456 164 C456 196 376 198 360 170";
const MOUNTAIN = "M540 190 L600 66 L660 190";
const RUN_FROM = 95;
const RUN_TO = 175;
const BASELINE_Y = 190;

const EASE = [0.65, 0, 0.35, 1] as const; // easeInOutCubic
const KEY = "isa_intro_v2";

export function IsaIntroGate() {
  const [show, setShow] = useState(false);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (localStorage.getItem(KEY)) return;
    setShow(true);
  }, []);

  const finish = () => {
    localStorage.setItem(KEY, "1");
    setShow(false);
  };

  return (
    <AnimatePresence>
      {show &&
        (reduce ? <StaticIntro onDone={finish} /> : <IsaIntro onDone={finish} />)}
    </AnimatePresence>
  );
}

function StaticIntro({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1600);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0a0a0a]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <IsaLogo className="w-[min(70vw,420px)] text-white" glow />
    </motion.div>
  );
}

export function IsaIntro({ onDone }: { onDone: () => void }) {
  const k = useMemo(
    () => (typeof window !== "undefined" && window.innerWidth < 640 ? 0.7 : 1),
    []
  );
  const T = (s: number) => s * k;

  useEffect(() => {
    const t = setTimeout(onDone, T(5000) + 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onDone]);

  const drawn = {
    initial: { pathLength: 0, opacity: 0 },
    animate: { pathLength: 1, opacity: 1 },
  };

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-[#0a0a0a]"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
    >
      <div className="relative w-[min(90vw,760px)]">
        <svg
          viewBox="0 0 900 240"
          fill="none"
          stroke="#ffffff"
          strokeWidth={11}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="isa-glow w-full"
        >
          {/* the life line — drawn as the runner travels it */}
          <motion.path
            d={BASELINE}
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 0.5 }}
            transition={{ duration: T(1.9), delay: T(0.5), ease: EASE }}
          />

          {/* runner rides the tip, then fades as the I rises */}
          <motion.g
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 1, 0] }}
            transition={{
              duration: T(1.7),
              delay: T(0.5),
              times: [0, 0.12, 0.7, 1],
              ease: "linear",
            }}
          >
            <motion.g
              initial={{ x: RUN_FROM }}
              animate={{ x: RUN_TO }}
              transition={{ duration: T(1.2), delay: T(0.5), ease: EASE }}
            >
              <g transform={`translate(0 ${BASELINE_Y}) scale(5)`}>
                <IsaRunner />
              </g>
            </motion.g>
          </motion.g>

          {/* 1.9 — the runner becomes the I */}
          <motion.path
            d={I_PATH}
            {...drawn}
            transition={{ duration: T(0.5), delay: T(1.9), ease: EASE }}
          />
          {/* 2.5 — the process S */}
          <motion.path
            d={S_PATH}
            {...drawn}
            transition={{ duration: T(0.8), delay: T(2.5), ease: EASE }}
          />
          {/* 3.3 — the aim, mountain A */}
          <motion.path
            d={MOUNTAIN}
            {...drawn}
            transition={{ duration: T(1.1), delay: T(3.3), ease: EASE }}
          />
        </svg>

        {/* 4.4 — light sweep + settled glow */}
        <motion.div
          className="pointer-events-none absolute inset-y-0 w-1/3"
          style={{
            background:
              "linear-gradient(105deg, transparent, rgba(255,255,255,0.55), transparent)",
            mixBlendMode: "screen",
          }}
          initial={{ x: "-60%", opacity: 0 }}
          animate={{ x: ["-60%", "320%"], opacity: [0, 1, 0] }}
          transition={{ duration: T(0.8), delay: T(4.4), ease: EASE }}
        />
        <motion.div
          className="pointer-events-none absolute -inset-10 rounded-full"
          style={{
            background:
              "radial-gradient(closest-side, rgba(255,255,255,0.10), transparent)",
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: T(0.6), delay: T(4.6), ease: EASE }}
        />
      </div>

      <button
        onClick={onDone}
        className="absolute bottom-6 right-6 text-xs text-white/35 transition hover:text-white"
      >
        Skip
      </button>
    </motion.div>
  );
}
