// ISA — Conversation & Action Layer · Public API (subsystem #6)
// The conversational interface to everything ISA already knows and can do. ISA
// thinks first (deterministic intent → context → reasoning → answer); the LLM is
// the optional last step that only phrases ISA's findings. Import from
// "@/lib/conversation".
//
// NOTE: ./llm is SERVER-ONLY (holds model keys) and is intentionally NOT exported
// here — only the /api/ask route imports it.

export type * from "./types";

// Pipeline
export { ask, userTurn } from "./engine";
export type { AskOptions } from "./engine";
export { detectIntent } from "./intent";
export { extractEntities } from "./entities";
export { reason } from "./reasoning";
export { resolveNavigation } from "./navigation";

// Actions
export { detectAction, executeAction } from "./actions";

// Composition & provider (client)
export { buildGenerationRequest, composeTurn, deterministicText } from "./compose";
export { speakViaServer, REMOTE_ENDPOINT } from "./provider";

// Conversation memory
export { noteConversation } from "./memory";

// React
export { useAskIsa } from "./hooks";
export type { UseAskIsa } from "./hooks";
