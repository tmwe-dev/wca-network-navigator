/**
 * Tool: deduplicate-partners — Write/approval. Backed by edge `deduplicate-partners`.
 */
import { invokeEdge } from "@/lib/api/invokeEdge";
import type { Tool, ToolResult, ToolContext } from "./types";

export const deduplicatePartnersTool: Tool = {
  id: "deduplicate-partners",
  label: "Deduplica partner",
  description: "Trova e fonde partner duplicati (overlap >70%). Mantiene il record più recente.",
  match: (p) => /\b(dedup(?:lica|licate|lication)?|fondi|merge)\b[^.]{0,30}\b(partner|aziende|company)\b/i.test(p),

  execute: async (_prompt, context?: ToolContext): Promise<ToolResult> => {
    if (!context?.confirmed) {
      return {
        kind: "approval",
        title: "Eseguire deduplica partner?",
        description: "Verranno fusi i partner con sovrapposizione >70% (governance CRM duplicate).",
        details: [
          { label: "Soglia overlap", value: "70%" },
          { label: "Strategia", value: "keep latest, soft-link transferred_to_partner_id" },
        ],
        governance: { role: "DIRETTORE", permission: "WRITE:PARTNERS_BULK", policy: "POLICY v1.0 · CRM-DEDUP" },
        pendingPayload: {},
        toolId: "deduplicate-partners",
      };
    }
    const res = await invokeEdge<{ merged?: number; reviewed?: number; message?: string; error?: string }>(
      "deduplicate-partners",
      { body: {}, context: "command:deduplicate-partners" },
    );
    return {
      kind: "result",
      title: res?.error ? "Deduplica fallita" : "Deduplica completata",
      message: res?.error ?? res?.message ?? `Esaminati: ${res?.reviewed ?? 0} · Fusi: ${res?.merged ?? 0}`,
      meta: { count: res?.merged ?? 0, sourceLabel: "Edge · deduplicate-partners" },
    };
  },
};