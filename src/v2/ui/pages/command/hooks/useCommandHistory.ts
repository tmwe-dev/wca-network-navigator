/**
 * useCommandHistory — Build and manage conversation history for AI context
 */
import { useCallback } from "react";
import type { Message } from "../constants";

export function useCommandHistory(messages: Message[]) {
  /** Build short conversation history for AI context */
  const buildHistory = useCallback((): { role: "user" | "assistant"; content: string }[] => {
    return messages
      .filter((m) => !m.thinking && m.content)
      .slice(-6)
      .map((m) => ({ role: m.role, content: m.content }));
  }, [messages]);

  return { buildHistory };
}
