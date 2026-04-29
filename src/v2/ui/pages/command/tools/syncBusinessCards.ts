/**
 * Tool: sync-business-cards — Write/approval. Sync dei BCA dal feed condiviso.
 */
import { invokeEdge } from "@/lib/api/invokeEdge";
import type { Tool, ToolResult, ToolContext } from "./types";

export const syncBusinessCardsTool: Tool = {
  id: "sync-business-cards",
  label: "Sync biglietti da visita",
  description: "Sincronizza i Business Card dal feed condiviso e li matcha ai partner esistenti.",
  match: (p) => /\b(sync|sincronizza|aggiorna|importa)\b[^.]{0,30}\b(business\s*card|bca|biglietti)\b/i.test(p),

  execute: async (_prompt, context?: ToolContext): Promise<ToolResult> => {
    if (!context?.confirmed) {
      return {
        kind: "approval",
        title: "Sincronizzare i biglietti da visita?",
        description: "Importa i BCA dal feed condiviso e tenta il matching automatico ai partner.",
        details: [
          { label: "Sorgente", value: "feed BCA condiviso" },
          { label: "Effetto", value: "insert/update business_cards + match" },
        ],
        governance: { role: "OPERATORE", permission: "WRITE:BUSINESS_CARDS", policy: "POLICY v1.0 · BCA-SHARED" },
        pendingPayload: {},
        toolId: "sync-business-cards",
      };
    }
    const res = await invokeEdge<{ imported?: number; matched?: number; message?: string; error?: string }>(
      "sync-business-cards",
      { body: {}, context: "command:sync-business-cards" },
    );
    return {
      kind: "result",
      title: res?.error ? "Sync fallita" : "Sync biglietti completata",
      message: res?.error ?? res?.message ?? `Importati: ${res?.imported ?? 0} · Matched: ${res?.matched ?? 0}`,
      meta: { count: res?.imported ?? 0, sourceLabel: "Edge · sync-business-cards" },
    };
  },
};