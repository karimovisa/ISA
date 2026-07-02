"use client";

import { motion } from "framer-motion";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="mb-8 flex flex-wrap items-end justify-between gap-4"
    >
      <div>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2 max-w-xl text-sm text-muted sm:text-base">
            {subtitle}
          </p>
        )}
      </div>
      {action}
    </motion.div>
  );
}

export function AddButton({
  onClick,
  label,
}: {
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className="glass glass-hover flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium text-fg"
    >
      <span className="text-lg leading-none text-accent">+</span>
      {label}
    </button>
  );
}
