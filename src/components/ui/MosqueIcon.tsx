/** Minimal mosque icon matching lucide's stroke style (24×24, currentColor). */
export function MosqueIcon({
  size = 24,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M3 21h18" />
      <path d="M5 21v-8" />
      <path d="M19 21v-8" />
      <path d="M5 13a7 7 0 0 1 14 0" />
      <path d="M12 6V3" />
      <path d="M10.5 4.5h3" />
      <path d="M9.5 21v-3a2.5 2.5 0 0 1 5 0v3" />
    </svg>
  );
}
