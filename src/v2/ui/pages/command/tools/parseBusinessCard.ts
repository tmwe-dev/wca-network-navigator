/**
 * Tool: parse-business-card — Run OCR/AI extraction on a business-card image URL.
 * Write tool → requires approval (consuma crediti AI).
 */
import { invokeEdge } from "@/lib/api/invokeEdge";
import type { Tool, ToolResult, ToolContext } from "./types";

function extractImageUrl(prompt: string): string | null {
  const url = prompt.match(/https?:\/\/\S+\.(?:png|jpe?g|webp|heic)(?:\?\S*)?/i);
  return url ? url[0] : null;
}

interface ParseResp {
  success?: boolean;
  data?: Record<string, unknown>;
  contact?: Record<string, unknown>;
  message?: string;
  error?: string;
}

export const parseBusinessCardTool: Tool = {
  id: "parse-business-card",
  label: "Leggi biglietto da visita",
  description: "Estrae dati strutturati (nome, azienda, email, telefono) da un'immagine di biglietto da visita.",
  match: (p) => /\b(biglietto\s+da\s+visita|business\s*card|leggi\s+(?:il\s+)?biglietto|parse.*card|ocr\s+card)\b/i.test(p),

  execute: async (prompt, context?: ToolContext): Promise<ToolResult> => {
    if (!context?.confirmed) {
      const imageUrl = extractImageUrl(prompt);
      return {
        kind: "approval",
        title: "Analizzare biglietto da visita?",
        description: "L'immagine sarà processata con AI vision (consumo crediti AI).",
        details: [
          { label: "Image URL", value: imageUrl ?? "(URL immagine richiesto nel prompt)" },
          { label: "Pipeline", value: "OCR + AI extraction" },
        ],
        governance: { role: "COMMERCIALE", permission: "EXECUTE:AI_VISION", policy: "POLICY v1.0 · OCR-CARD" },
        pendingPayload: { imageUrl },
        toolId: "parse-business-card",
      };
    }

    const p = context.payload ?? {};
    if (!p.imageUrl) {
      return {
        kind: "result",
        title: "URL mancante",
        message: "Devo ricevere un URL pubblico dell'immagine del biglietto.",
        meta: { count: 0, sourceLabel: "parse-business-card" },
      };
    }

    const res = await invokeEdge<ParseResp>("parse-business-card", {
      body: { imageUrl: String(p.imageUrl) },
      context: "command:parse-business-card",
    });

    if (!res || res.error) {
      return {
        kind: "result",
        title: "Parsing fallito",
        message: res?.error ?? "Errore nella lettura del biglietto.",
        meta: { count: 0, sourceLabel: "Edge · parse-business-card" },
      };
    }

    const extracted = res.data ?? res.contact ?? {};
    const lines = Object.entries(extracted)
      .filter(([, v]) => v !== null && v !== "")
      .map(([k, v]) => `${k}: ${String(v)}`)
      .join("\n");

    return {
      kind: "report",
      title: "Biglietto letto",
      sections: [
        { heading: "Dati estratti", body: lines || "Nessun campo riconosciuto." },
      ],
      meta: { count: 1, sourceLabel: "Edge · parse-business-card" },
    };
  },
};