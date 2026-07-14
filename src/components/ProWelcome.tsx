"use client";

// ISA — shown once, the first time an account is actually Pro. It doesn't sell
// anything (they already have it) — it tells them, plainly, what ISA can now do
// for them. Calm and honest: no confetti, no hype.

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Sparkles, X } from "lucide-react";
import { useEntitlements } from "@/components/EntitlementProvider";
import { PressButton } from "@/components/ui/PressButton";

const KEY = "isa_pro_welcomed_v1";

const UNLOCKED: [string, string][] = [
  ["AI Coach", "Kunlik, shaxsiy murabbiy — ma'lumotlaringizga asoslangan."],
  ["Bashoratlar", "Maqsad, pul va odatlaringiz qayoqqa ketayotganini oldindan ko'rasiz."],
  ["Chuqur tahlil", "Uyqu, fokus, pul va kayfiyat o'rtasidagi bog'liqliklar."],
  ["Oylik va yillik hisobot", "Hayotingizning to'liq manzarasi, bir joyda."],
  ["Tabiiy tilda qidiruv", "\"Qachon eng samarali edim?\" — shunchaki so'rang."],
];

export function ProWelcome() {
  const { plan, loading } = useEntitlements();
  // Read the "already welcomed" flag once, lazily — no effect, no re-render loop.
  const [seen] = useState(() => (typeof window === "undefined" ? true : !!localStorage.getItem(KEY)));
  const [dismissed, setDismissed] = useState(false);

  const show = !loading && plan === "pro" && !seen && !dismissed;

  const close = () => {
    if (typeof window !== "undefined") localStorage.setItem(KEY, "1");
    setDismissed(true);
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={close}
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.25 }}
            onClick={(e) => e.stopPropagation()}
            className="glass relative w-full max-w-md rounded-3xl p-6"
          >
            <button
              onClick={close}
              aria-label="Yopish"
              className="absolute right-4 top-4 rounded-lg p-1 text-muted transition hover:text-fg"
            >
              <X size={16} />
            </button>

            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/15">
              <Sparkles size={20} className="text-accent" />
            </div>

            <h2 className="mt-4 text-xl font-semibold">ISA Pro ochildi</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">
              Rahmat. ISA endi shunchaki hayotingizni saqlamaydi — uni tushuna boshlaydi.
              Qanchalik ko&apos;p foydalansangiz, sizni shunchalik yaxshi biladi.
            </p>

            <ul className="mt-5 space-y-3 border-t border-line pt-5">
              {UNLOCKED.map(([title, detail]) => (
                <li key={title} className="flex gap-3">
                  <Check size={15} className="mt-0.5 shrink-0 text-accent" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-fg">{title}</p>
                    <p className="text-xs leading-relaxed text-muted">{detail}</p>
                  </div>
                </li>
              ))}
            </ul>

            <PressButton
              onClick={close}
              className="mt-6 w-full rounded-xl bg-accent py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
            >
              Boshladik
            </PressButton>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
