"use client";

// ISA — Conversation Layer · React integration (Ask ISA, §1)
// One hook powers the whole conversational surface: it holds the turns, runs the
// pipeline, gates the optional LLM phrasing on the subscription, handles the
// action confirm/cancel round-trip, and auto-navigates when ISA is asked to open
// a module. The user feels like they're talking to ISA — because they are.

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useEntitlements } from "@/components/EntitlementProvider";
import { ask, userTurn } from "./engine";
import { executeAction } from "./actions";
import { noteConversation } from "./memory";
import type { ActionProposal, ActionValues, ConversationTurn } from "./types";

export type UseAskIsa = {
  turns: ConversationTurn[];
  busy: boolean;
  pendingAction: ActionProposal | null;
  error: string | null;
  send: (message: string) => Promise<void>;
  confirmAction: (values: ActionValues) => Promise<void>;
  cancelAction: () => void;
  reset: () => void;
};

let seq = 0;
const assistantTurn = (text: string): ConversationTurn => ({
  id: `a-${Date.now()}-${seq++}`,
  role: "assistant",
  text,
  at: new Date().toISOString(),
});

export function useAskIsa(): UseAskIsa {
  const router = useRouter();
  const { canUse } = useEntitlements();
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [busy, setBusy] = useState(false);
  const [pendingAction, setPendingAction] = useState<ActionProposal | null>(null);
  const [error, setError] = useState<string | null>(null);

  // LLM phrasing is a Pro nicety; the deterministic answer is always available.
  const allowLLM = canUse("ai_coach") || canUse("nl_search");

  const send = useCallback(
    async (message: string) => {
      const text = message.trim();
      if (!text || busy) return;
      setError(null);
      setBusy(true);
      const history = turns;
      setTurns((t) => [...t, userTurn(text)]);
      try {
        const result = await ask(text, history, { allowLLM });
        setTurns((t) => [...t, result.turn]);
        if (result.answer.action) setPendingAction(result.answer.action);
        if (result.answer.navigation) router.push(result.answer.navigation.deepLink);
        void noteConversation(text, result.answer);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
        setTurns((t) => [...t, assistantTurn("I hit a snag reaching your data. Try again in a moment.")]);
      } finally {
        setBusy(false);
      }
    },
    [busy, turns, allowLLM, router]
  );

  const confirmAction = useCallback(async (values: ActionValues) => {
    if (!pendingAction || busy) return;
    setBusy(true);
    const proposal = pendingAction;
    setPendingAction(null);
    try {
      const res = await executeAction(proposal, values);
      setTurns((t) => [...t, assistantTurn(res.message)]);
      if (!res.ok) setError(res.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That action failed.");
    } finally {
      setBusy(false);
    }
  }, [pendingAction, busy]);

  const cancelAction = useCallback(() => {
    if (!pendingAction) return;
    setPendingAction(null);
    setTurns((t) => [...t, assistantTurn("No problem — I won't record that.")]);
  }, [pendingAction]);

  const reset = useCallback(() => {
    setTurns([]);
    setPendingAction(null);
    setError(null);
  }, []);

  return { turns, busy, pendingAction, error, send, confirmAction, cancelAction, reset };
}
