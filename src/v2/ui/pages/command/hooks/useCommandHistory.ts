/**
 * useCommandHistory — Build and manage conversation history for AI context
 */
import { useCallback } from "react";
import type { Message } from "../constants";

export function useCommandHistory(messages: Message[]) {
  /** Build short conversation history for AI context */
  const buildHistory = useCallback((): { role: "user" | "assistant"; content: string }[] => {
    return messages
      // Esclude thinking placeholders e i messaggi tecnici "Automation" /
      // "Orchestratore" (es. "🔧 Ricerca AI · 12286"): inquinano il contesto
      // del modello e gli fanno credere che il numero che vede sia il target.
      .filter((m) => {
        if (m.thinking) return false;
        if (!m.content || !m.content.trim()) return false;
        const agent = m.agentName ?? "";
        if (agent === "Automation" || agent === "Orchestratore") return false;
        return true;
      })
      .slice(-8)
      .map((m) => ({ role: m.role, content: m.content }));
  }, [messages]);

  return { buildHistory };
}
