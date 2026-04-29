/**
 * Tool: kb-ingest-document — Triggers ingestion of an already-uploaded document
 * (base64) into the Knowledge Base. Write tool → requires approval.
 * Note: in Command we cannot upload binaries; this tool surfaces the request and
 * delegates to the dedicated KB upload UI when no contentBase64 is provided.
 */
import { invokeEdge } from "@/lib/api/invokeEdge";
import type { Tool, ToolResult, ToolContext } from "./types";

function extractFileName(prompt: string): string | null {
  const m = prompt.match(/["“”']([^"“”']+\.(?:pdf|docx?|md|txt))["“”']/i);
  if (m) return m[1];
  const m2 = prompt.match(/\b([\w.-]+\.(?:pdf|docx?|md|txt))\b/i);
  return m2 ? m2[1] : null;
}

function extractTags(prompt: string): string[] {
  const m = prompt.match(/tag[s]?[:=]\s*([^\n]+)/i);
  if (!m) return [];
  return m[1].split(/[,;]/).map((t) => t.trim()).filter(Boolean);
}

interface IngestResp {
  success?: boolean;
  chunks_created?: number;
  total_chars?: number;
  kb_ids?: string[];
  message?: string;
  error?: string;
}

export const kbIngestDocumentTool: Tool = {
  id: "kb-ingest-document",
  label: "Ingestisci documento KB",
  description: "Indicizza un documento (PDF/DOCX/MD/TXT) nella Knowledge Base con embedding e chunking.",
  match: (p) => /\b(?:ingest|indicizza|carica|aggiungi)\b[^.]{0,40}\b(?:knowledge|kb|knowledge\s*base)\b|\bkb[-\s]ingest\b/i.test(p),

  execute: async (prompt, context?: ToolContext): Promise<ToolResult> => {
    if (!context?.confirmed) {
      const fileName = extractFileName(prompt);
      const tags = extractTags(prompt);
      return {
        kind: "approval",
        title: "Ingerire documento nella KB?",
        description: "Il documento sarà estratto, chunked, embedded e salvato in kb_entries.",
        details: [
          { label: "File", value: fileName ?? "(carica prima dalla pagina KB)" },
          { label: "Tags", value: tags.length > 0 ? tags.join(", ") : "auto-imported" },
          { label: "Pipeline", value: "Extract → Chunk → Embed → kb_entries" },
        ],
        governance: { role: "DIRETTORE", permission: "WRITE:KB_ENTRIES", policy: "POLICY v1.0 · KB-INGEST" },
        pendingPayload: { fileName, tags },
        toolId: "kb-ingest-document",
      };
    }

    const p = context.payload ?? {};
    if (!p.contentBase64) {
      return {
        kind: "result",
        title: "Upload richiesto",
        message: `Per ingerire "${String(p.fileName ?? "il documento")}" nella KB, caricalo dalla pagina Knowledge Base. Da Command non posso ricevere allegati binari.`,
        meta: { count: 0, sourceLabel: "kb-ingest-document" },
      };
    }

    const res = await invokeEdge<IngestResp>("kb-ingest-document", {
      body: {
        fileName: String(p.fileName ?? "documento"),
        contentBase64: String(p.contentBase64),
        mimeType: String(p.mimeType ?? "application/octet-stream"),
        tags: Array.isArray(p.tags) ? p.tags : [],
      },
      context: "command:kb-ingest-document",
    });

    if (!res || res.error) {
      return {
        kind: "result",
        title: "Ingest fallito",
        message: res?.error ?? "Errore durante l'ingestion.",
        meta: { count: 0, sourceLabel: "Edge · kb-ingest-document" },
      };
    }

    return {
      kind: "result",
      title: "Documento ingerito",
      message: `Creati ${res.chunks_created ?? 0} chunk (${res.total_chars ?? 0} caratteri totali).`,
      meta: { count: res.chunks_created ?? 1, sourceLabel: "Edge · kb-ingest-document" },
    };
  },
};