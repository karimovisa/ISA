"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/cn";

type GlassCardProps = HTMLMotionProps<"div"> & {
  hover?: boolean;
  reflect?: boolean;
  /** Opacity tier of the shared card material. "dense" (~0.8) for data-dense
   *  cards (charts/stats), "ambient" (~0.45) for quiet ones; default ~0.55. */
  tier?: "dense" | "ambient";
};

export function GlassCard({
  className,
  hover = false,
  reflect = true,
  tier,
  children,
  ...props
}: GlassCardProps) {
  return (
    <motion.div
      className={cn(
        "card",
        tier === "dense" && "card-dense",
        tier === "ambient" && "card-ambient",
        hover && "glass-hover cursor-default",
        reflect && "reflect",
        className
      )}
      {...props}
    >
      {children}
    </motion.div>
  );
}
