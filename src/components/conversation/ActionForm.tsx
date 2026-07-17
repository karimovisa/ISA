"use client";

// ISA — the template a detected intent turns into. The user taps a chip instead
// of typing; every field is pre-filled from what they already said. Confirming is
// one button — ISA proposes, the human disposes.

import { useState } from "react";
import { Check, X } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { PressButton } from "@/components/ui/PressButton";
import { fieldClass } from "@/components/ui/Modal";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/cn";
import type { ActionProposal, ActionValues } from "@/lib/conversation";

export function ActionForm({
  proposal,
  busy,
  onConfirm,
  onCancel,
}: {
  proposal: ActionProposal;
  busy: boolean;
  onConfirm: (values: ActionValues) => void;
  onCancel: () => void;
}) {
  const { t } = useT();
  const [values, setValues] = useState<ActionValues>(
    Object.fromEntries(proposal.form.map((f) => [f.key, f.value]))
  );

  const set = (k: string, v: string) => setValues((prev) => ({ ...prev, [k]: v }));
  const missing = proposal.form.some((f) => f.required && !values[f.key]?.trim());

  return (
    <GlassCard className="border border-accent/40 p-4">
      {/* Short, never a paragraph. */}
      <p className="mb-3 text-sm font-semibold text-accent">{t(proposal.headline)}</p>

      <div className="space-y-3">
        {proposal.form.map((f) => (
          <div key={f.key}>
            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-muted">
              {t(f.label)}
            </label>

            {/* Quick-pick chips — the fast path. */}
            {f.options && f.options.length > 0 && (
              <div className="mb-1.5 flex flex-wrap gap-1.5">
                {f.options.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => set(f.key, o.value)}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs transition",
                      values[f.key] === o.value
                        ? "bg-accent text-white"
                        : "border border-line bg-white/[0.03] text-fg/80 hover:bg-white/[0.07]"
                    )}
                  >
                    {t(o.label)}
                  </button>
                ))}
              </div>
            )}

            {/* The exact value — always editable, never a dead end. */}
            {f.type !== "choice" && (
              <div className="relative">
                <input
                  type={f.type === "number" ? "number" : f.type === "date" ? "date" : f.type === "time" ? "time" : "text"}
                  value={values[f.key] ?? ""}
                  onChange={(e) => set(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  inputMode={f.type === "number" ? "decimal" : undefined}
                  className={cn(fieldClass, f.suffix && "pr-14")}
                />
                {f.suffix && (
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">
                    {f.suffix}
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {proposal.warnings.map((w) => (
        <p key={w} className="mt-2 text-xs text-amber-400">{t(w)}</p>
      ))}

      <div className="mt-4 flex gap-2">
        <PressButton
          onClick={() => onConfirm(values)}
          disabled={busy || missing}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-accent py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
        >
          <Check size={15} /> {t(proposal.confirmLabel)}
        </PressButton>
        <PressButton
          onClick={onCancel}
          className="flex items-center gap-1.5 rounded-xl border border-line px-3 py-2.5 text-sm text-muted transition hover:text-fg"
        >
          <X size={15} />
        </PressButton>
      </div>
    </GlassCard>
  );
}
