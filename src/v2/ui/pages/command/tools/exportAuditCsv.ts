/**
 * Tool: export-audit-csv — Read-only. Export CSV dell'audit log.
 */
import { invokeEdge } from "@/lib/api/invokeEdge";
import type { Tool, ToolResult } from "./types";

export const exportAuditCsvTool: Tool = {
  id: "export-audit-csv",
  label: "Export audit CSV",
  description: "Genera un CSV dell'audit log (azioni, supervisore AI, decisioni).",
  match: (p) => /\b(export(?:a)?|esporta|scarica|download)\b[^.]{0,30}\b(audit|log\s+azioni)\b/i.test(p),

  execute: async (): Promise<ToolResult> => {
    const res = await invokeEdge<{ url?: string; rows?: number; message?: string; error?: string }>(
      "export-audit-csv",
      { body: {}, context: "command:export-audit-csv" },
    );
    return {
      kind: "result",
      title: res?.error ? "Export fallito" : "Export audit pronto",
      message: res?.error
        ?? (res?.url
          ? `CSV: ${res.url} (${res.rows ?? 0} righe)`
          : res?.message ?? "Export completato."),
      meta: { count: res?.rows ?? 0, sourceLabel: "Edge · export-audit-csv" },
    };
  },
};