"use client";

// ISA — Intelligence Layer · React integration
// One hook the UI uses to reach the whole layer. It loads the shared context
// once, derives the calm outputs a surface needs (daily brief, surfaced actions,
// coach, scores), and respects dismissed items. Everything is memoised so a
// screen paint costs one batched Foundation read (Performance Intelligence §17).

import { useCallback, useEffect, useMemo, useState } from "react";
import { loadIntelligenceContext, invalidateContext } from "./context";
import type { IntelligenceContext } from "./context";
import { buildDailyBrief } from "./daily";
import { computeAllScores } from "./scoring";
import { dailyCoach } from "./coach";
import type { CoachMessage, DailyBrief, Score } from "./types";

export type UseIntelligence = {
  loading: boolean;
  context: IntelligenceContext | null;
  brief: DailyBrief | null;
  coach: CoachMessage | null;
  scores: Score[];
  dismiss: (id: string) => void;
  refresh: () => Promise<void>;
};

const DISMISS_KEY = "isa.intel.dismissed";

function readDismissed(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(DISMISS_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

/** Load and expose the Intelligence Layer for the signed-in user. */
export function useIntelligence(): UseIntelligence {
  const [context, setContext] = useState<IntelligenceContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState<string[]>(() => readDismissed());

  const refresh = useCallback(async () => {
    setLoading(true);
    invalidateContext();
    setContext(await loadIntelligenceContext({ force: true }));
    setLoading(false);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const ctx = await loadIntelligenceContext();
      if (alive) {
        setContext(ctx);
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const dismiss = useCallback((id: string) => {
    setDismissed((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      if (typeof window !== "undefined") window.localStorage.setItem(DISMISS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const brief = useMemo(() => (context ? buildDailyBrief(context, dismissed) : null), [context, dismissed]);
  const coach = useMemo(() => (context ? dailyCoach(context) : null), [context]);
  const scores = useMemo(() => (context ? computeAllScores(context) : []), [context]);

  return { loading, context, brief, coach, scores, dismiss, refresh };
}
