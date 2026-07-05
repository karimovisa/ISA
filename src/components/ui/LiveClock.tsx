"use client";

import { useEffect, useState } from "react";
import { formatTime } from "@/lib/datetime";

/** Self-contained live time — isolated so it doesn't re-render its parent. */
export function LiveClock({ className }: { className?: string }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return <div className={className}>{now ? formatTime(now) : " "}</div>;
}
