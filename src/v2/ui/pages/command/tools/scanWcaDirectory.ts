import type { Tool, ToolResult } from "./types";
import { fetchPartnersPaginated } from "@/v2/io/supabase/queries/partners";

/**
 * Scan partner database by country.
 *
 * NB: Il sistema NON effettua più scansioni live verso directory WCA esterne.
 * Tutta la conoscenza partner risiede nelle tabelle Supabase (sincronizzate
 * dall'estensione Partner Connect). Questo tool interroga direttamente il DB.
 */

const COUNTRY_MAP: Record<string, { code: string; label: string }> = {
  "stati uniti": { code: "US", label: "Stati Uniti" },
  "stati uniti damerica": { code: "US", label: "Stati Uniti" },
  "stati uniti d'america": { code: "US", label: "Stati Uniti" },
  usa: { code: "US", label: "Stati Uniti" },
  us: { code: "US", label: "Stati Uniti" },
  "united states": { code: "US", label: "Stati Uniti" },
  america: { code: "US", label: "Stati Uniti" },
  cina: { code: "CN", label: "Cina" },
  china: { code: "CN", label: "Cina" },
  india: { code: "IN", label: "India" },
  germania: { code: "DE", label: "Germania" },
  germany: { code: "DE", label: "Germania" },
  italia: { code: "IT", label: "Italia" },
  italy: { code: "IT", label: "Italia" },
  spagna: { code: "ES", label: "Spagna" },
  francia: { code: "FR", label: "Francia" },
  france: { code: "FR", label: "Francia" },
  brasile: { code: "BR", label: "Brasile" },
  messico: { code: "MX", label: "Messico" },
  turchia: { code: "TR", label: "Turchia" },
  vietnam: { code: "VN", label: "Vietnam" },
  emirati: { code: "AE", label: "Emirati Arabi" },
  uk: { code: "GB", label: "Regno Unito" },
  "regno unito": { code: "GB", label: "Regno Unito" },
};

function normalizePrompt(prompt: string): string {
  return prompt
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractCountry(prompt: string): { code: string; label: string } | null {
  const normalized = normalizePrompt(prompt);

  for (const [key, value] of Object.entries(COUNTRY_MAP)) {
    if (normalized.includes(key)) return value;
  }

  // Fallback: 2-letter ISO code as standalone word
  const explicitCode = normalized.match(/\b([a-z]{2})\b/);
  if (explicitCode) {
    const code = explicitCode[1].toUpperCase();
    return { code, label: code };
  }

  return null;
}

export const scanWcaDirectoryTool: Tool = {
  id: "scan-wca-directory",
  label: "Scansione partner per paese",
  description: "Mostra tutti i partner registrati nel database per un paese specifico",
  match: (prompt) => {
    const p = normalizePrompt(prompt);
    return /(scan|scansiona|cerca|mappa|recupera|mostra|elenco|elenca|lista).*(directory|partner|paese|stati uniti|usa|us\b|cina|india)/i.test(
      p,
    ) || /\b(directory|partner)\b.*(usa|us|stati uniti|cina|india|germania)/i.test(p);
  },

  execute: async (prompt): Promise<ToolResult> => {
    const country = extractCountry(prompt);

    if (!country) {
      return {
        kind: "result",
        title: "Paese mancante",
        message:
          "Specifica il paese da scansionare nel database, ad esempio: 'Mostra partner US' o 'Scansiona partner Cina'.",
        meta: { count: 0, sourceLabel: "Command · parser" },
      };
    }

    const result = await fetchPartnersPaginated({
      countryCode: country.code,
      sort: "rating",
      limit: 100,
    });

    if (result._tag === "Err") {
      throw new Error(result.error.message);
    }

    const { partners, total } = result.value;

    if (total === 0) {
      return {
        kind: "result",
        title: `Nessun partner per ${country.label}`,
        message: `Il database non contiene partner attivi con country_code "${country.code}". Verifica che la sincronizzazione Partner Connect sia stata eseguita.`,
        meta: { count: 0, sourceLabel: "Supabase · partners" },
      };
    }

    return {
      kind: "table",
      title: `PARTNER · ${country.label.toUpperCase()} (${total} totali)`,
      columns: [
        { key: "companyName", label: "Partner" },
        { key: "city", label: "Città" },
        { key: "leadStatus", label: "Stato" },
        { key: "email", label: "Email" },
        { key: "rating", label: "Rating" },
      ],
      rows: partners.map((p) => ({
        id: p.id,
        companyName: p.companyName,
        city: p.city ?? "—",
        leadStatus: p.leadStatus ?? "new",
        email: p.email ?? "—",
        rating: p.rating ?? "—",
      })),
      meta: {
        count: total,
        sourceLabel: `Supabase · partners (${country.code})`,
      },
      selectable: true,
      idField: "id",
      liveSource: "partners",
      bulkActions: [
        { id: "outreach", label: "Programma outreach", promptTemplate: "Programma outreach per i partner con id: {ids}" },
        { id: "campaign", label: "Aggiungi a campagna", promptTemplate: "Crea campagna per i partner con id: {ids}" },
        { id: "enrich", label: "Arricchisci dati", promptTemplate: "Arricchisci i dati dei partner con id: {ids}" },
        { id: "score", label: "Calcola lead-score", promptTemplate: "Calcola lead-score per i partner con id: {ids}" },
      ],
    };
  },
};
