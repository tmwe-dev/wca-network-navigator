import type { Tool, ToolResult } from "./types";
import { fetchPartnersPaginated } from "@/v2/io/supabase/queries/partners";

const MATCH_KEYWORDS = ["partner", "spedizion", "wca", "network", "cerca", "mostra"];

const STOPWORDS = new Set([
  "partner", "parter", "spedizion", "spedizionieri", "cerca", "mostra", "trova",
  "mi", "il", "la", "lo", "le", "di", "a", "in", "per", "wca", "network",
  "i", "gli", "un", "una", "che", "da", "con", "su", "non", "del", "dei",
  "al", "ai", "dal", "nel", "sono", "più", "attivi", "attivo", "inattivi",
  "nuovi", "nuovo", "miei", "mia", "mio", "tutti", "tutto",
  "stati", "uniti", "america", "usa", "cina", "india", "germania",
  "italia", "spagna", "francia", "brasile", "messico", "turchia",
]);

const COUNTRY_HINTS: Record<string, string> = {
  "stati uniti": "US", usa: "US", "united states": "US", america: "US",
  cina: "CN", china: "CN", india: "IN", germania: "DE", germany: "DE",
  italia: "IT", italy: "IT", spagna: "ES", francia: "FR", france: "FR",
  brasile: "BR", messico: "MX", turchia: "TR", vietnam: "VN",
  emirati: "AE", uk: "GB", "regno unito": "GB",
};

function extractCountryCode(prompt: string): string | undefined {
  const lower = prompt.toLowerCase();
  for (const [key, code] of Object.entries(COUNTRY_HINTS)) {
    if (lower.includes(key)) return code;
  }
  // Standalone 2-letter ISO code (preceded/followed by space or end)
  const match = lower.match(/(?:^|\s)([a-z]{2})(?:\s|$|[.,!?])/);
  if (match) return match[1].toUpperCase();
  return undefined;
}

function extractSearchTerms(prompt: string): string {
  const words = prompt
    .toLowerCase()
    .replace(/[^a-zàèéìòùü0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOPWORDS.has(w));
  return words.join(" ");
}

export const partnerSearchTool: Tool = {
  id: "partner-search",
  label: "Ricerca partner",
  description: "Cerca partner nel database (filtra per paese se rilevato nel prompt)",

  match(prompt: string): boolean {
    const lower = prompt.toLowerCase();
    if (lower.includes("email") || lower.includes("follow-up") || lower.includes("followup")) return false;
    if (lower.includes("agent") || lower.includes("riepilogo") || lower.includes("report") || lower.includes("performance")) return false;
    return MATCH_KEYWORDS.some((kw) => lower.includes(kw));
  },

  async execute(prompt: string): Promise<ToolResult> {
    const countryCode = extractCountryCode(prompt);
    const search = extractSearchTerms(prompt);

    const result = await fetchPartnersPaginated({
      countryCode,
      search: !countryCode && search ? search : undefined,
      sort: "rating",
      limit: 50,
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
      title: "PARTNER · RICERCA LIVE",
      columns: [
        { key: "companyName", label: "Partner" },
        { key: "countryName", label: "Paese" },
        { key: "city", label: "Città" },
        { key: "leadStatus", label: "Stato" },
        { key: "email", label: "Email" },
        { key: "rating", label: "Rating" },
      ],
      rows,
      meta: {
        count: total,
        sourceLabel: "Supabase · partners",
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
