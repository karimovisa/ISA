/**
 * Exact ISA mark geometry (from isa-logo.svg — do not redesign).
 * One continuous white line on a 900×240 canvas forms I → S → A.
 */

export const ISA_VIEWBOX = "0 0 900 240";
export const ISA_STROKE = 10;

/** I — vertical identity stroke. */
export const I_PATH = "M90 50 L90 190";

/** The continuous line from the I through the S. */
export const S_PATH =
  "M90 120 C140 120 170 120 210 120 C290 120 290 50 210 50 C130 50 130 190 210 190 C290 190 290 120 360 120";

/** The line rising into the A (mountain). */
export const A_PATH = "M360 120 C420 120 470 120 510 120 L600 50 L690 190";

/** The A's crossbar. */
export const A_BAR = "M635 120 L565 120";

/**
 * The runner's route = the whole continuous line (S into A) as one path, so the
 * runner rides the exact drawing tip from the I, through the S, up the A.
 */
export const ROUTE =
  "M90 120 C140 120 170 120 210 120 C290 120 290 50 210 50 C130 50 130 190 210 190 C290 190 290 120 360 120 C420 120 470 120 510 120 L600 50 L690 190";
