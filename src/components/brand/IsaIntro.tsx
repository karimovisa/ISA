"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { IsaLogo } from "@/components/brand/IsaLogo";
import { IsaRunner } from "@/components/brand/IsaRunner";

// viewBox 900×240, baseline y=190. The runner draws the flat line, fades before
// the S; then the S draws, then the mountain A (same height as S, no crossbar).
const FLAT = "M160 190 L400 190";
// S authored bottom-up so it "grows" out of the line the runner just drew.
const S_PATH =
  "M400 170 C416 198 496 196 496 164 C496 130 412 138 412 104 C412 66 496 68 496 96";
const MOUNTAIN = "M540 190 L600 66 L660 190";
const RUN_FROM = 175;
const RUN_TO = 392;
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
          {/* 0.5–1.9 — the runner draws the flat line (pathLength synced to it) */}
          <motion.path
            d={FLAT}
            {...drawn}
            transition={{ duration: T(1.4), delay: T(0.5), ease: EASE }}
          />

          {/* the runner rides the drawing tip, then fades out before the S */}
          <motion.g
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 1, 0] }}
            transition={{
              duration: T(1.7),
              delay: T(0.5),
              times: [0, 0.1, 0.72, 1],
              ease: "linear",
            }}
          >
            <motion.g
              initial={{ x: RUN_FROM }}
              animate={{ x: RUN_TO }}
              transition={{ duration: T(1.4), delay: T(0.5), ease: EASE }}
            >
              <g transform={`translate(0 ${BASELINE_Y})`}>
                <motion.g
                  animate={{ y: [0, -5, 0] }}
                  transition={{ duration: 0.28, repeat: 5, ease: "easeInOut" }}
                >
                  <g transform="scale(5)">
                    <IsaRunner />
                  </g>
                </motion.g>
              </g>
            </motion.g>
          </motion.g>

          {/* 2.0–2.9 — the line curves up into the S */}
          <motion.path
            d={S_PATH}
            {...drawn}
            transition={{ duration: T(0.9), delay: T(2.0), ease: EASE }}
          />

          {/* 2.9–4.2 — the mountain A rises (same size as S, no crossbar) */}
          <motion.path
            d={MOUNTAIN}
            {...drawn}
            transition={{ duration: T(1.3), delay: T(2.9), ease: EASE }}
          />
        </svg>

        {/* 4.2–5.0 — light sweep across the finished mark */}
        <motion.div
          className="pointer-events-none absolute inset-y-0 w-1/3"
          style={{
            background:
              "linear-gradient(105deg, transparent, rgba(255,255,255,0.55), transparent)",
            mixBlendMode: "screen",
          }}
          initial={{ x: "-60%", opacity: 0 }}
          animate={{ x: ["-60%", "320%"], opacity: [0, 1, 0] }}
          transition={{ duration: T(0.8), delay: T(4.2), ease: EASE }}
        />
        <motion.div
          className="pointer-events-none absolute -inset-10 rounded-full"
          style={{
            background:
              "radial-gradient(closest-side, rgba(255,255,255,0.10), transparent)",
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: T(0.6), delay: T(4.4), ease: EASE }}
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
