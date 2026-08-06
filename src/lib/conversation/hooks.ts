"use client";

// ISA — Conversation Layer · React integration (Ask ISA, §1)
// One hook powers the whole conversational surface. It turns ISA's confidence
// into the right amount of friction:
//   • ≥95%  → act immediately (Undo stays available)
//   • 70–95% → one pre-filled confirmation
//   • <70%  → offer a few interpretations as buttons, never a re-type
// The user feels understood with the least possible typing.

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { ask, userTurn } from "./engine";
import { buildProposalFor, defaultValues, executeAction, undoAction } from "./actions";
import { noteConversation } from "./memory";
import type {
  ActionKind, ActionProposal, ActionValues, Clarification, ClarifyOption, ConversationTurn,
} from "./types";

const AUTO_EXECUTE = 0.95; // act without asking above this

type Undoable = { kind: ActionKind; id: string };

export type UseAskIsa = {
  turns: ConversationTurn[];
  busy: boolean;
  pendingAction: ActionProposal | null;
  clarification: Clarification | null;
  undoable: Undoable | null;
  error: string | null;
  send: (message: string) => Promise<void>;
  confirmAction: (values: ActionValues) => Promise<void>;
  cancelAction: () => void;
  chooseClarification: (option: ClarifyOption) => void;
  undo: () => Promise<void>;
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
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [busy, setBusy] = useState(false);
  const [pendingAction, setPendingAction] = useState<ActionProposal | null>(null);
  const [clarification, setClarification] = useState<Clarification | null>(null);
  const [undoable, setUndoable] = useState<Undoable | null>(null);
  const [error, setError] = useState<string | null>(null);

  // LLM phrasing is a Pro nicety; the deterministic answer is always available.
  // ISA always speaks with the model when a key is configured — the natural
  // phrasing is core to the product, not a Pro upsell. (Server still auth-gates.)
  const allowLLM = true;

  // The one place a write happens — shared by auto-execute and explicit confirm.
  const runAction = useCallback(async (proposal: ActionProposal, values: ActionValues) => {
    const res = await executeAction(proposal, values);
    setTurns((t) => [...t, assistantTurn(res.message)]);
    setUndoable(res.ok && res.createdId ? { kind: proposal.kind, id: res.createdId } : null);
    if (!res.ok) setError(res.error);
  }, []);

  const send = useCallback(
    async (message: string) => {
      const text = message.trim();
      if (!text || busy) return;
      setError(null);
      setClarification(null);
      setUndoable(null);
      setBusy(true);
      const history = turns;
      setTurns((t) => [...t, userTurn(text)]);
      try {
        const result = await ask(text, history, { allowLLM });
        const a = result.answer;
        void noteConversation(text, a);

        // Only jump to a page when the user actually asked to open one ("open
        // money"). A question or coaching reply may CARRY a deep link, but ISA
        // should ANSWER in the chat — not yank the user out of the conversation.
        // (That link is still offered as a tappable chip under the answer.)
        if (a.navigation && a.intent === "navigate") {
          setTurns((t) => [...t, result.turn]);
          router.push(a.navigation.deepLink);
        } else if (a.action && a.action.confidence >= AUTO_EXECUTE) {
          // High confidence: act now, skip the "detected" label, keep Undo.
          await runAction(a.action, defaultValues(a.action));
        } else {
          setTurns((t) => [...t, result.turn]);
          if (a.action) setPendingAction(a.action);
          else if (a.clarification) setClarification(a.clarification);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
        setTurns((t) => [...t, assistantTurn("I hit a snag reaching your data. Try again in a moment.")]);
      } finally {
        setBusy(false);
      }
    },
    [busy, turns, allowLLM, router, runAction]
  );

  const confirmAction = useCallback(async (values: ActionValues) => {
    if (!pendingAction || busy) return;
    setBusy(true);
    const proposal = pendingAction;
    setPendingAction(null);
    try {
      await runAction(proposal, values);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That action failed.");
    } finally {
      setBusy(false);
    }
  }, [pendingAction, busy, runAction]);

  const cancelAction = useCallback(() => {
    if (!pendingAction) return;
    setPendingAction(null);
    setTurns((t) => [...t, assistantTurn("No problem — I won't record that.")]);
  }, [pendingAction]);

  // A tapped interpretation becomes a pre-filled confirmation — never a re-type.
  const chooseClarification = useCallback((option: ClarifyOption) => {
    setClarification(null);
    const proposal = buildProposalFor(option.kind, option.title);
    if (proposal) setPendingAction(proposal);
  }, []);

  const undo = useCallback(async () => {
    if (!undoable || busy) return;
    setBusy(true);
    const target = undoable;
    setUndoable(null);
    try {
      const ok = await undoAction(target.kind, target.id);
      setTurns((t) => [...t, assistantTurn(ok ? "Undone." : "Couldn't undo that.")]);
    } finally {
      setBusy(false);
    }
  }, [undoable, busy]);

  const reset = useCallback(() => {
    setTurns([]);
    setPendingAction(null);
    setClarification(null);
    setUndoable(null);
    setError(null);
  }, []);

  return {
    turns, busy, pendingAction, clarification, undoable, error,
    send, confirmAction, cancelAction, chooseClarification, undo, reset,
  };
}
