"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/cn";

type GlassCardProps = HTMLMotionProps<"div"> & {
  hover?: boolean;
  reflect?: boolean;
};

export function GlassCard({
  className,
  hover = false,
  reflect = true,
  children,
  ...props
}: GlassCardProps) {
  return (
    <motion.div
      className={cn(
        "glass rounded-3xl",
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
