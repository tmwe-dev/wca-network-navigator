/**
 * Tool: deep-search-partner — Deep search partner CLIENT-SIDE.
 *
 * NOTA: la edge function `deep-search-partner` è stata DEPRECATA (410 Gone).
 * La ricerca avviene ora interamente client-side tramite il DAL partners
 * (stesso backend usato da partner-search) e, quando disponibile, dalla
 * Partner Connect extension. Nessuna chiamata a edge function.
 */
import type { Tool, ToolResult } from "./types";
import { fetchPartnersPaginated } from "@/v2/io/supabase/queries/partners";

const STOPWORDS = new Set([
  "trova", "cerca", "deep", "search", "partner", "partners", "a", "fondo",
  "mi", "il", "la", "lo", "le", "di", "in", "per", "wca", "network",
  "i", "gli", "un", "una", "che", "da", "con", "su", "del", "dei",
  "tutti", "tutto", "miei", "mia", "mio",
]);

function extractTerms(prompt: string): string {
  return prompt
    .toLowerCase()
    .replace(/[^a-zàèéìòùü0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOPWORDS.has(w))
    .join(" ");
}

export const deepSearchPartnerTool: Tool = {
  id: "deep-search-partner",
  label: "Deep search partner",
  description: "Cerca in profondità partner nel database WCA (client-side)",
  match: (p) => /trova partner|cerca a fondo|deep.?search.*partner/i.test(p),

  execute: async (prompt): Promise<ToolResult> => {
    const search = extractTerms(prompt);

    const result = await fetchPartnersPaginated({
      search: search || undefined,
      limit: 25,
    });

    if (result._tag === "Err") {
      throw new Error(result.error.message);
    }

    const { partners, total } = result.value;

    const rows = partners.map((p) => ({
      id: p.id,
      companyName: p.companyName,
      countryName: p.countryName,
      city: p.city,
      leadStatus: p.leadStatus,
      email: p.email,
      rating: p.rating,
    }));

    return {
      kind: "table",
      title: "DEEP SEARCH PARTNER · RISULTATI",
      columns: [
        { key: "companyName", label: "Azienda" },
        { key: "countryName", label: "Paese" },
        { key: "city", label: "Città" },
        { key: "leadStatus", label: "Stato" },
        { key: "email", label: "Email" },
        { key: "rating", label: "Rating" },
      ],
      rows,
      meta: {
        count: total,
        sourceLabel: "Client-side · DAL partners",
      },
      selectable: true,
      idField: "id",
      liveSource: "partners",
      bulkActions: [
        { id: "outreach", label: "Programma outreach", promptTemplate: "Programma outreach per i partner con id: {ids}" },
        { id: "enrich", label: "Arricchisci dati", promptTemplate: "Arricchisci i dati dei partner con id: {ids}" },
        { id: "score", label: "Calcola lead-score", promptTemplate: "Calcola lead-score per i partner con id: {ids}" },
      ],
    };
  },
};
