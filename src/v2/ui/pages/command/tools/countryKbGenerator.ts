/**
 * Tool: country-kb-generator — Write/approval. Genera/aggiorna scheda KB per un paese.
 */
import { invokeEdge } from "@/lib/api/invokeEdge";
import type { Tool, ToolResult, ToolContext } from "./types";

function extractCountry(prompt: string): string | null {
  const m = prompt.match(/\b(?:scheda|kb|paese|country)\s+(?:per\s+|di\s+|del\s+|della\s+)?([A-ZÀ-Ý][A-Za-zÀ-ÿ\s]{2,40})\b/);
  return m ? m[1].trim() : null;
}

export const countryKbGeneratorTool: Tool = {
  id: "country-kb-generator",
  label: "Genera scheda paese (KB)",
  description: "Crea/aggiorna la scheda KB di un paese (mercato, regolamenti, lingua, hub logistici).",
  match: (p) => /\b(genera|crea|aggiorna)\b[^.]{0,30}\b(scheda|kb)\b[^.]{0,20}\b(paese|country)\b/i.test(p),

  execute: async (prompt, context?: ToolContext): Promise<ToolResult> => {
    const country = extractCountry(prompt);
    if (!context?.confirmed) {
      return {
        kind: "approval",
        title: "Generare scheda paese?",
        description: "L'AI compilerà una scheda KB strutturata e la salverà tra le entry KB.",
        details: [
          { label: "Paese", value: country ?? "(da specificare)" },
        ],
        governance: { role: "DIRETTORE", permission: "WRITE:KB_ENTRIES", policy: "POLICY v1.0 · KB-COUNTRY" },
        pendingPayload: { country },
        toolId: "country-kb-generator",
      };
    }
    const p = context.payload ?? {};
    if (!p.country) {
      return {
        kind: "result",
        title: "Paese mancante",
        message: "Specifica il paese (es. 'genera scheda paese Vietnam').",
        meta: { count: 0, sourceLabel: "country-kb-generator" },
      };
    }
    const res = await invokeEdge<{ kb_entry_id?: string; message?: string; error?: string }>(
      "country-kb-generator",
      { body: { country: String(p.country) }, context: "command:country-kb-generator" },
    );
    return {
      kind: "result",
      title: res?.error ? "Generazione fallita" : `Scheda generata: ${String(p.country)}`,
      message: res?.error ?? res?.message ?? `KB entry creata${res?.kb_entry_id ? ` (id: ${res.kb_entry_id})` : ""}.`,
      meta: { count: 1, sourceLabel: "Edge · country-kb-generator" },
    };
  },
};