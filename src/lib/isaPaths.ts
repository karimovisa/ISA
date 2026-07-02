/**
 * Shared geometry for the ISA mark.
 *
 * The story is one continuous line on a baseline:
 *   I  = identity (the runner's resting form, a vertical stroke at the start)
 *   S  = system / process (the path curves into an S)
 *   A  = aim / aspiration (the path rises into a mountain peak)
 *
 * All coordinates live in a single 124×48 viewBox so the static logo and the
 * intro animation stay perfectly aligned.
 */

export const ISA_VIEWBOX = "0 0 124 48";
export const BASELINE_Y = 36;

/** The "life line" the runner travels along. */
export const BASELINE_PATH = "M10 36 H114";

/** I — a vertical stroke at the start (the runner becomes this). */
export const I_PATH = "M18 12 V36";

/** S — the process curve (clean, legible two-bowl S). */
export const S_PATH =
  "M50 16 C50 12 38 12 38 18 C38 23 50 24 50 30 C50 36 38 36 36 31";

/** A — a mountain peak (aim / aspiration). */
export const A_PATH = "M66 36 L86 11 L106 36";

/** A subtle inner ridge so the peak reads as a mountain, not just a letter. */
export const A_RIDGE_PATH = "M86 11 L93 24";

/** Runner travel range along the baseline (x), in viewBox units. */
export const RUN_FROM = 4;
export const RUN_TO = 108;

/**
 * The runner's actual route: it runs along the baseline, then climbs the left
 * face of the mountain to the summit — the same slope as A_PATH's first leg, so
 * the peak literally forms under the runner's feet as it climbs.
 */
export const RUNNER_ROUTE = "M4 36 L66 36 L86 11";

