// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DATA ENRICHMENT & SEARCH TOOLS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const ENRICHMENT_TOOLS: Record<string, unknown> = {
  deep_search_partner: {
    type: "function",
    function: {
      name: "deep_search_partner",
      description: "Legge i dati di arricchimento già disponibili per un partner (Base + Deep Search + Sherlock). NON esegue nuove ricerche — restituisce snapshot read-only e suggerisce all'utente di eseguire arricchimento da Email Forge o Settings → Arricchimento.",
      parameters: { type: "object", properties: { partner_id: { type: "string" }, company_name: { type: "string" }, force: { type: "boolean" } } },
    },
  },
  deep_search_contact: {
    type: "function",
    function: {
      name: "deep_search_contact",
      description: "LEGACY — Deep Search lato edge è deprecata. Restituisce snapshot read-only del contatto, l'esecuzione effettiva avviene client-side via Partner Connect.",
      parameters: { type: "object", properties: { contact_id: { type: "string" }, contact_name: { type: "string" } } },
    },
  },
  enrich_partner_website: {
    type: "function",
    function: {
      name: "enrich_partner_website",
      description: "LEGACY — Arricchimento base del sito web del partner. Preferire il Deep Search client-side (useDeepSearchLocal) o l'arricchimento da Settings → Arricchimento.",
      parameters: { type: "object", properties: { partner_id: { type: "string" }, company_name: { type: "string" } } },
    },
  },
  generate_aliases: {
    type: "function",
    function: {
      name: "generate_aliases",
      description: "Generate aliases for partner companies or contacts.",
      parameters: {
        type: "object",
        properties: { partner_ids: { type: "array", items: { type: "string" } }, country_code: { type: "string" }, type: { type: "string" }, limit: { type: "number" } },
      },
    },
  },
  detect_language: {
    type: "function",
    function: {
      name: "detect_language",
      description: "Detect language for a country code.",
      parameters: { type: "object", properties: { country_code: { type: "string" } }, required: ["country_code"] },
    },
  },
};
