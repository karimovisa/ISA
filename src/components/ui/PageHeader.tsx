"use client";

import { motion } from "framer-motion";
import { HelpCircle } from "lucide-react";
import { useT } from "@/lib/i18n";
import { HELP } from "@/lib/help";

export function PageHeader({
  title,
  subtitle,
  action,
  help,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  help?: string;
}) {
  const { t } = useT();
  const helpKey = (help ?? title).toLowerCase();
  const hasHelp = helpKey in HELP;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="mb-8 flex items-start justify-between gap-3"
    >
      <div className="min-w-0">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {t(title)}
        </h1>
        {subtitle && (
          <p className="mt-2 max-w-xl text-sm text-muted sm:text-base">
            {t(subtitle)}
          </p>
        )}
      </div>
      {/* The help "?" always stays at the END of the TITLE row (top-right),
          never dropping below it. On mobile the action button stacks underneath
          the "?" (flex-col-reverse); on desktop they share the row with "?" last. */}
      <div className="mt-1 flex shrink-0 flex-col-reverse items-end gap-2 sm:flex-row sm:items-center">
        {action}
        {hasHelp && (
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("isa:open-help", { detail: helpKey }))}
            aria-label={t("Help")}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line text-muted transition hover:bg-white/5 hover:text-fg"
          >
            <HelpCircle size={17} />
          </button>
        )}
      </div>
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
  const { t } = useT();
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.96 }}
      transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
      className="glass flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium text-fg transition-colors duration-200 hover:border-white/20 hover:bg-white/[0.08]"
    >
      <span className="text-lg leading-none text-accent">+</span>
      {t(label)}
    </motion.button>
  );
}
