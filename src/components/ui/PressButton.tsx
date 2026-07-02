"use client";

import { motion, type HTMLMotionProps } from "framer-motion";

/**
 * The one sanctioned button feel: a 1px lift on hover, a firm press on tap.
 * Fast (150ms), no bounce — product-register motion.
 */
export function PressButton({
  children,
  ...props
}: HTMLMotionProps<"button">) {
  return (
    <motion.button
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
      {...props}
    >
      {children}
    </motion.button>
  );
}
