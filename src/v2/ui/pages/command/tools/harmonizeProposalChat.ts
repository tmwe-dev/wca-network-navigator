/**
 * Tool: harmonize-proposal-chat — Write/approval. Armonizza proposta multi-turno.
 */
import { invokeEdge } from "@/lib/api/invokeEdge";
import type { Tool, ToolResult, ToolContext } from "./types";

function extractChatRef(prompt: string): string | null {
  const uuid = prompt.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  return uuid ? uuid[0] : null;
}

export const harmonizeProposalChatTool: Tool = {
  id: "harmonize-proposal-chat",
  label: "Armonizza proposta chat",
  description: "Consolida e armonizza una proposta commerciale costruita in chat (per chat_id).",
  match: (p) => /\b(armonizza|consolida|harmonize|finalizza)\b[^.]{0,30}\b(proposta|proposal|chat|conversazione)\b/i.test(p),

  execute: async (prompt, context?: ToolContext): Promise<ToolResult> => {
    const chatId = extractChatRef(prompt);
    if (!context?.confirmed) {
      return {
        kind: "approval",
        title: "Armonizzare proposta?",
        description: "L'AI consoliderà i turni della chat in una proposta finale strutturata.",
        details: [{ label: "Chat ID", value: chatId ?? "(da specificare)" }],
        governance: { role: "COMMERCIALE", permission: "WRITE:PROPOSALS", policy: "POLICY v1.0 · PROPOSAL-HARMONIZE" },
        pendingPayload: { chat_id: chatId },
        toolId: "harmonize-proposal-chat",
      };
    }
    const p = context.payload ?? {};
    if (!p.chat_id) {
      return {
        kind: "result",
        title: "Chat ID mancante",
        message: "Specifica l'UUID della chat proposta.",
        meta: { count: 0, sourceLabel: "harmonize-proposal-chat" },
      };
    }
    const res = await invokeEdge<{ proposal_id?: string; summary?: string; error?: string }>(
      "harmonize-proposal-chat",
      { body: { chat_id: String(p.chat_id) }, context: "command:harmonize-proposal-chat" },
    );
    return {
      kind: "result",
      title: res?.error ? "Armonizzazione fallita" : "Proposta armonizzata",
      message: res?.error ?? res?.summary ?? `Proposta consolidata${res?.proposal_id ? ` (id: ${res.proposal_id})` : ""}.`,
      meta: { count: 1, sourceLabel: "Edge · harmonize-proposal-chat" },
    };
  },
};