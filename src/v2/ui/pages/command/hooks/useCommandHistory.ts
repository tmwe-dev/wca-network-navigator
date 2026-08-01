/**
 * useCommandHistory — Build and manage conversation history for AI context.
 *
 * Now merges DB-persisted history (multi-turn memory via useConversation) with
 * the current React-state messages, so the planner/AI always sees the full
 * conversational context — not just the last 6 transient turns.
 */
import { useCallback } from "react";
import type { Message } from "../constants";
import type { ConversationMessage } from "@/v2/io/supabase/queries/conversations";

export function useCommandHistory(
  messages: Message[],
  persistedMessages: ConversationMessage[] = [],
) {
  /**
   * Build conversation history merging DB history (persistent memory)
   * with the current React state. Deduplicates by (role, content) and caps
   * the result so we don't blow the planner context window.
   */
  const buildHistory = useCallback((): { role: "user" | "assistant"; content: string }[] => {
    const fromDb = persistedMessages
      .filter((m) => (m.role === "user" || m.role === "assistant") && m.content)
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    const fromState = messages
      .filter((m) => !m.thinking && m.content)
      .map((m) => ({ role: m.role, content: m.content }));

    // Merge then dedupe consecutive identical messages (DB rehydrate + RAM duplicate).
    const merged = [...fromDb, ...fromState];
    const deduped: { role: "user" | "assistant"; content: string }[] = [];
    for (const m of merged) {
      const last = deduped[deduped.length - 1];
      if (last && last.role === m.role && last.content === m.content) continue;
      deduped.push(m);
    }
    // Keep last 20 turns: enough to remember the previous query + filters
    // without exploding the prompt.
    return deduped.slice(-20);
  }, [messages, persistedMessages]);

  return { buildHistory };
}
