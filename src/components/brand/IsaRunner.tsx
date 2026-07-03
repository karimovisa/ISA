/**
 * A single clean running silhouette (mid-stride flight pose), line-art to match
 * the mark. Static — the intro sells motion via translation + trail, which reads
 * far more natural than crossfading limb poses. Drawn around the feet at (0,0),
 * ~16 units tall, facing right.
 */
export function IsaRunner() {
  const limb = {
    stroke: "white",
    strokeWidth: 2.1,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    fill: "none",
  };

  return (
    <g>
      {/* soft shadow underneath (5%) */}
      <ellipse cx={0.5} cy={0.6} rx={4.2} ry={0.8} fill="white" opacity={0.05} />

      {/* speed trail */}
      <g stroke="white" strokeWidth={0.7} strokeLinecap="round" opacity={0.22}>
        <line x1={-5} y1={-9} x2={-11} y2={-9} />
        <line x1={-5} y1={-5} x2={-13} y2={-5} />
      </g>

      {/* head */}
      <circle cx={4.4} cy={-13.6} r={2.1} fill="white" stroke="none" />
      {/* torso — forward lean */}
      <path d="M3.6 -11.4 L1.2 -5.6" {...limb} strokeWidth={2.4} />
      {/* front arm — bent, driving up */}
      <path d="M3.2 -10.6 L6.2 -8.8 L8 -11.4" {...limb} />
      {/* back arm — bent, swinging back */}
      <path d="M3.2 -10.6 L0.2 -9.2 L-1.6 -11.4" {...limb} />
      {/* front leg — knee up, reaching forward */}
      <path d="M1.2 -5.6 L5.2 -4.2 L6.6 -0.2" {...limb} />
      {/* back leg — trailing, extended */}
      <path d="M1.2 -5.6 L-2 -4 L-5 -1.2" {...limb} />
    </g>
  );
}
