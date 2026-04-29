/**
 * Tool: analyze-import-structure — Read-only. Pre-analisi struttura file di import.
 */
import { invokeEdge } from "@/lib/api/invokeEdge";
import type { Tool, ToolResult } from "./types";

function extractFileRef(prompt: string): string | null {
  const url = prompt.match(/https?:\/\/[^\s"'<>]+\.(?:csv|xlsx?|json|tsv)/i);
  if (url) return url[0];
  const path = prompt.match(/import_log[_\s-]*id[:\s]+([0-9a-f-]{36})/i);
  return path ? path[1] : null;
}

export const analyzeImportStructureTool: Tool = {
  id: "analyze-import-structure",
  label: "Analizza struttura import",
  description: "Pre-analizza un file CSV/XLSX/JSON di import: colonne, tipi, righe, candidate mapping.",
  match: (p) => /\b(analizza|ispeziona|leggi|preview)\b[^.]{0,30}\b(import|file|csv|xlsx|excel|struttura)\b/i.test(p),

  execute: async (prompt): Promise<ToolResult> => {
    const ref = extractFileRef(prompt);
    const res = await invokeEdge<{
      columns?: Array<{ name?: string; type?: string; sample?: string }>;
      rowCount?: number;
      mapping?: Record<string, string>;
      message?: string;
      error?: string;
    }>("analyze-import-structure", {
      body: ref?.startsWith("http") ? { file_url: ref } : ref ? { import_log_id: ref } : { query: prompt },
      context: "command:analyze-import-structure",
    });
    if (res?.error) {
      return {
        kind: "result",
        title: "Analisi import fallita",
        message: res.error,
        meta: { count: 0, sourceLabel: "Edge · analyze-import-structure" },
      };
    }
    const rows = (res?.columns ?? []).map((c, i) => ({
      id: String(i + 1),
      name: c.name ?? "—",
      type: c.type ?? "—",
      mapped: res?.mapping?.[c.name ?? ""] ?? "—",
      sample: (c.sample ?? "").slice(0, 80),
    }));
    if (rows.length === 0) {
      return {
        kind: "result",
        title: "Struttura import",
        message: res?.message ?? "Nessuna colonna rilevata. Specifica file_url o import_log_id.",
        meta: { count: 0, sourceLabel: "Edge · analyze-import-structure" },
      };
    }
    return {
      kind: "table",
      title: `Struttura import — ${res?.rowCount ?? "?"} righe`,
      columns: [
        { key: "name", label: "Colonna" },
        { key: "type", label: "Tipo" },
        { key: "mapped", label: "Mapping" },
        { key: "sample", label: "Esempio" },
      ],
      rows,
      meta: { count: rows.length, sourceLabel: "Edge · analyze-import-structure" },
    };
  },
};