/**
 * Tool: pending-action-executor — Write/approval. Esegue una pending action approvata.
 */
import { invokeEdge } from "@/lib/api/invokeEdge";
import type { Tool, ToolResult, ToolContext } from "./types";

function extractActionId(prompt: string): string | null {
  const uuid = prompt.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  return uuid ? uuid[0] : null;
}

export const pendingActionExecutorTool: Tool = {
  id: "pending-action-executor",
  label: "Esegui azione pending",
  description: "Esegue una pending_action già approvata (per id) tramite pending-action-executor.",
  match: (p) => /\b(esegui|run|trigger)\b[^.]{0,30}\b(pending\s*action|azione\s+pending|azione\s+approvata)\b/i.test(p),

  execute: async (prompt, context?: ToolContext): Promise<ToolResult> => {
    const actionId = extractActionId(prompt);
    if (!context?.confirmed) {
      return {
        kind: "approval",
        title: "Eseguire azione pending?",
        description: "L'azione approvata verrà eseguita immediatamente dall'executor.",
        details: [
          { label: "Action ID", value: actionId ?? "(da specificare)" },
        ],
        governance: { role: "DIRETTORE", permission: "EXECUTE:PENDING_ACTIONS", policy: "POLICY v1.0 · DECISION-ENGINE" },
        pendingPayload: { action_id: actionId },
        toolId: "pending-action-executor",
      };
    }
    const p = context.payload ?? {};
    if (!p.action_id) {
      return {
        kind: "result",
        title: "Action ID mancante",
        message: "Specifica l'UUID della pending_action.",
        meta: { count: 0, sourceLabel: "pending-action-executor" },
      };
    }
    const res = await invokeEdge<{ status?: string; message?: string; error?: string }>(
      "pending-action-executor",
      { body: { action_id: String(p.action_id) }, context: "command:pending-action-executor" },
    );
    return {
      kind: "result",
      title: res?.error ? "Esecuzione fallita" : `Azione: ${res?.status ?? "ok"}`,
      message: res?.error ?? res?.message ?? "Azione eseguita.",
      meta: { count: 1, sourceLabel: "Edge · pending-action-executor" },
    };
  },
};