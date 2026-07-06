/**
 * ISA mark geometry — clean I · S · A on a shared baseline (the life line).
 * Matches the intro's final frame: mountain A is the same size as the S, with
 * no crossbar. viewBox tightly frames the content (x 120–660, y 66–190).
 */

export const ISA_VIEWBOX = "205 46 471 162";
export const ISA_STROKE = 14;

/** The life line. */
export const BASELINE_PATH = "M221 190 H660";

/** I — vertical identity stroke. x=276 so I→S gap equals the S→A gap (84). */
export const I_PATH = "M276 190 L276 66";

/** S — clean two-bowl S (process). */
export const S_PATH =
  "M456 96 C456 68 372 66 372 104 C372 138 456 130 456 164 C456 196 376 198 360 170";

/** A — mountain peak (aim), same size as the S, no crossbar. */
export const A_PATH = "M540 190 L600 66 L660 190";
