"use client";

import { motion } from "framer-motion";

export function ProgressBar({
  value,
  showLabel = false,
}: {
  value: number;
  showLabel?: boolean;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="w-full">
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
        <motion.div
          className="h-full rounded-full"
          style={{
            background:
              "linear-gradient(90deg, #22c55e 0%, #4f8cff 100%)",
            boxShadow: "0 0 16px rgba(79,140,255,0.45)",
          }}
          initial={{ width: 0 }}
          animate={{ width: `${clamped}%` }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
      {showLabel && (
        <div className="mt-1.5 text-right text-xs text-muted">{clamped}%</div>
      )}
    </div>
  );
}
