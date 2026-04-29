/**
 * Tool: apply-email-rules — Write/approval. Esegue le regole di categorizzazione inbox.
 */
import { invokeEdge } from "@/lib/api/invokeEdge";
import type { Tool, ToolResult, ToolContext } from "./types";

export const applyEmailRulesTool: Tool = {
  id: "apply-email-rules",
  label: "Applica regole email",
  description: "Riapplica le regole di categorizzazione/routing alle email in inbox.",
  match: (p) => /\b(applica|esegui|riapplica|run)\b[^.]{0,30}\b(regole|rules)\b[^.]{0,20}\b(email|inbox|mail)\b/i.test(p),

  execute: async (_prompt, context?: ToolContext): Promise<ToolResult> => {
    if (!context?.confirmed) {
      return {
        kind: "approval",
        title: "Applicare regole email a tutta l'inbox?",
        description: "Le email verranno ri-categorizzate secondo le regole correnti.",
        details: [
          { label: "Scope", value: "inbox attiva" },
          { label: "Effetto", value: "categoria, label, routing" },
        ],
        governance: { role: "OPERATORE", permission: "WRITE:EMAIL_RULES", policy: "POLICY v1.0 · EMAIL-LEARNING-LOOP" },
        pendingPayload: {},
        toolId: "apply-email-rules",
      };
    }
    const res = await invokeEdge<{ processed?: number; matched?: number; message?: string; error?: string }>(
      "apply-email-rules",
      { body: {}, context: "command:apply-email-rules" },
    );
    return {
      kind: "result",
      title: res?.error ? "Applicazione fallita" : "Regole applicate",
      message: res?.error ?? res?.message ?? `Email processate: ${res?.processed ?? 0} · matched: ${res?.matched ?? 0}`,
      meta: { count: res?.processed ?? 0, sourceLabel: "Edge · apply-email-rules" },
    };
  },
};