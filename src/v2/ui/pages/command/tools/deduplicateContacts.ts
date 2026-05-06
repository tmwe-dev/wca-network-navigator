/**
 * Tool: deduplicate-contacts — Find and merge duplicates (requires approval)
 */
import { invokeAi } from "@/lib/ai/invokeAi";
import type { Tool, ToolResult, ToolContext } from "./types";

export const deduplicateContactsTool: Tool = {
  id: "deduplicate-contacts",
  label: "Deduplica contatti",
  description: "Trova e unisce contatti duplicati nel database CRM",
  match: (p) => /(deduplica|trova duplicati|merge contatti)/i.test(p),

  execute: async (_prompt, context?: ToolContext): Promise<ToolResult> => {
    if (!context?.confirmed) {
      return {
        kind: "approval",
        title: "Avviare deduplicazione contatti?",
        description: "Il sistema analizzerà tutti i contatti per trovare e unire i duplicati.",
        details: [
          { label: "Azione", value: "Scansione e merge duplicati" },
          { label: "Impatto", value: "Tutti i contatti" },
          { label: "Tipo", value: "Operazione batch irreversibile" },
        ],
        governance: { role: "ADMIN", permission: "EXECUTE:DEDUP", policy: "POLICY v1.0 · SOFT-SYNC" },
        pendingPayload: {},
        toolId: "deduplicate-contacts",
      };
    }

    const data = await invokeAi<{ merged?: number; scanned?: number }>("deduplicate-contacts", {
      scope: "command",
      context: { source: "deduplicateContactsTool", mode: "bulk-merge" },
      body: {},
    });

    return {
      kind: "result",
      title: "Deduplicazione completata",
      message: `Trovati e uniti ${data?.merged ?? 0} duplicati su ${data?.scanned ?? 0} contatti analizzati.`,
      meta: { count: data?.merged ?? 0, sourceLabel: "Edge · deduplicate-contacts" },
    };
  },
};
