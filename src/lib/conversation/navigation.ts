// ISA — Conversation Layer · Conversational navigation (§12)
// "Open Money", "show my habits", "go to Focus" → a real deep link. Uses the
// Intelligence Layer's single route map, so conversation and UI never disagree.

import { deepLink, moduleLabel } from "@/lib/intelligence";
import type { IntelModule } from "@/lib/intelligence";
import { extractEntities } from "./entities";

/** Resolve a navigation target from a message, or null if none is named. */
export function resolveNavigation(
  message: string
): { module: IntelModule; deepLink: string; label: string } | null {
  const mod = extractEntities(message).module;
  if (!mod) return null;
  return { module: mod, deepLink: deepLink(mod), label: moduleLabel(mod) };
}
