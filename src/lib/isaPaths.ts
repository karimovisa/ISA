/**
 * ISA mark geometry — clean, legible I · S · A on a shared baseline (the life
 * line). The runner travels the baseline; the letters form as it passes.
 * viewBox 900×240, stroke 10.
 */

export const ISA_VIEWBOX = "0 0 900 240";
export const ISA_STROKE = 10;
export const BASELINE_Y = 190;

/** The life line the runner travels along. */
export const BASELINE_PATH = "M120 190 H780";

/** I — vertical identity stroke. */
export const I_PATH = "M170 60 L170 190";

/** S — a clean two-bowl S (process). */
export const S_PATH =
  "M402 96 C402 68 318 66 318 104 C318 138 402 130 402 164 C402 196 322 198 306 170";

/** A — the mountain peak (aim). */
export const A_PATH = "M500 190 L620 55 L740 190";

/** A — crossbar. */
export const A_BAR = "M558 132 L682 132";

/** Runner travel range along the baseline (x). */
export const RUN_FROM = 120;
export const RUN_TO = 760;
