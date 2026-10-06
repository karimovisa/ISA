// ISA — Conversation Layer · Chat history (client)
// Ask ISA threads persist in Supabase (ai_conversations / ai_messages, RLS-scoped)
// so a refresh never wipes the conversation and the model always sees the real
// thread. Every call is best-effort: a failed write never breaks the chat.

import { supabase } from "@/lib/supabase/client";
import type { ConversationTurn, Role } from "./types";

const CONV = "ai_conversations";
const MSG = "ai_messages";
const LOAD_LIMIT = 100;

type MessageRow = { id: string; role: Role; content: string; created_at: string };

export type ConversationSummary = { id: string; title: string; updated_at: string };

/** Past threads, newest first — the Ask ISA archive. */
export async function listConversations(limit = 30): Promise<ConversationSummary[]> {
  const { data } = await supabase
    .from(CONV)
    .select("id,title,updated_at")
    .order("updated_at", { ascending: false })
    .limit(limit);
  return (data as ConversationSummary[] | null) ?? [];
}

/** One thread's messages, oldest first. */
export async function loadMessages(conversationId: string): Promise<ConversationTurn[]> {
  const { data } = await supabase
    .from(MSG)
    .select("id,role,content,created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(LOAD_LIMIT);
  return ((data as MessageRow[] | null) ?? [])
    .reverse()
    .map((m) => ({ id: m.id, role: m.role, text: m.content, at: m.created_at }));
}

/** The most recent thread, oldest message first. Null when there is none. */
export async function loadLatestConversation(): Promise<{ id: string; turns: ConversationTurn[] } | null> {
  const [latest] = await listConversations(1);
  if (!latest) return null;
  return { id: latest.id, turns: await loadMessages(latest.id) };
}

/** Delete a thread and its messages (cascade). */
export async function deleteConversation(conversationId: string): Promise<boolean> {
  const { error } = await supabase.from(CONV).delete().eq("id", conversationId);
  return !error;
}

/** Open a new thread titled by its first message. Returns its id, or null. */
export async function startConversation(firstMessage: string): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from(CONV)
    .insert({ user_id: user.id, title: firstMessage.slice(0, 80) })
    .select("id")
    .single();
  return error ? null : (data.id as string);
}

/** Append one message and bump the thread so it stays the latest. */
export async function appendMessage(conversationId: string, role: Role, content: string): Promise<void> {
  if (!content.trim()) return;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from(MSG).insert({ conversation_id: conversationId, user_id: user.id, role, content });
  await supabase.from(CONV).update({ updated_at: new Date().toISOString() }).eq("id", conversationId);
}
