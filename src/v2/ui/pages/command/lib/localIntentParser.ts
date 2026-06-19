/**
 * localIntentParser — Parser di intento DETERMINISTICO (zero AI).
 *
 * Obiettivo: coprire l'80% delle query operative di routine (conteggi ed
 * elenchi per entità, opzionalmente filtrati per paese) SENZA passare dal
 * planner AI. Questo rende Command immune ai rate-limit (429) dell'AI gateway
 * per le richieste standard.
 *
 * Generalizza il vecchio `deterministicPartnerCountryPlan` (solo partner+paese)
 * a tutte le entità whitelisted, con tolleranza a refusi e dettato vocale.
 *
 * Ritorna un QueryPlan pronto, oppure null se la richiesta è ambigua/complessa
 * (in quel caso il chiamante ricade sul planner AI).
 */
import type { QueryPlan } from "./safeQueryExecutor";

/** Mappa nome paese (IT/EN + varianti vocali) → ISO country_code. */
export const COUNTRY_CODE_BY_NAME: Record<string, string> = {
  malta: "MT", italia: "IT", italy: "IT", francia: "FR", france: "FR",
  spagna: "ES", spain: "ES", germania: "DE", germany: "DE",
  "regno unito": "GB", uk: "GB", inghilterra: "GB", olanda: "NL", "paesi bassi": "NL",
  netherlands: "NL", belgio: "BE", belgium: "BE", portogallo: "PT", portugal: "PT",
  grecia: "GR", greece: "GR", svizzera: "CH", switzerland: "CH", austria: "AT",
  polonia: "PL", poland: "PL", romania: "RO", turchia: "TR", turkey: "TR",
  "stati uniti": "US", usa: "US", "united states": "US", canada: "CA", brasile: "BR",
  america: "US", "negli stati uniti": "US", "nord america": "US",
  brazil: "BR", cina: "CN", china: "CN", giappone: "JP", japan: "JP", india: "IN",
  emirati: "AE", uae: "AE", egitto: "EG", egypt: "EG", marocco: "MA", morocco: "MA",
  australia: "AU", singapore: "SG", "hong kong": "HK",
};

/**
 * Mappa pattern entità → tabella whitelisted. Ordine importante: la prima che
 * matcha vince. `partners` include refusi/dettato comuni ("parte", "pannelli").
 */
const ENTITY_PATTERNS: ReadonlyArray<{ table: string; re: RegExp }> = [
  { table: "partners", re: /\b(part(?:ner|ners|e|i)?|pannell\w*)\b/i },
  { table: "imported_contacts", re: /\bcontatt\w*\b/i },
  { table: "activities", re: /\battivit\w*\b/i },
  { table: "outreach_queue", re: /\b(outreach|in coda)\b/i },
  { table: "campaign_jobs", re: /\bcampagn\w*\b/i },
  { table: "channel_messages", re: /\bmessagg\w*\b/i },
];

const COUNT_RE = /\b(quanti|quante|totale|numero di|numero|conteggio|count)\b/i;
const LIST_RE = /\b(elenco|elenc\w*|lista|liste|mostra|mostrami|dammi|vedi|visualizza|fammi vedere|fai vedere)\b/i;

const TABLE_LABEL: Record<string, string> = {
  partners: "partner",
  imported_contacts: "contatti",
  activities: "attività",
  outreach_queue: "outreach in coda",
  campaign_jobs: "campagne",
  channel_messages: "messaggi",
};

const ALLOWED_CONTEXT_TABLES = new Set(Object.keys(TABLE_LABEL));

function detectContext(hint?: string): { table: string; mode: "count" | "list" } | null {
  if (!hint) return null;
  const table = hint.match(/tabella=([a-z_]+)/i)?.[1];
  const mode = hint.match(/mode=(count|list)/i)?.[1] as "count" | "list" | undefined;
  if (!table || !mode || !ALLOWED_CONTEXT_TABLES.has(table)) return null;
  return { table, mode };
}

function detectEntity(lower: string): string | null {
  for (const { table, re } of ENTITY_PATTERNS) {
    if (re.test(lower)) return table;
  }
  return null;
}

function detectCountry(lower: string): { label: string; code: string } | null {
  const hit = Object.entries(COUNTRY_CODE_BY_NAME).find(([name]) =>
    new RegExp(`\\b${name}\\b`, "i").test(lower),
  );
  return hit ? { label: hit[0], code: hit[1] } : null;
}

/** Colonne note-valide per partners (le altre tabelle: executor sceglie le prime 10 reali). */
const PARTNER_COLUMNS = ["id", "company_name", "city", "country_code", "email", "website", "lead_status"];

/**
 * Costruisce un QueryPlan deterministico, o null se la richiesta non è una
 * query di routine riconoscibile senza AI.
 */
export function parseLocalIntent(prompt: string, contextHint?: string): QueryPlan | null {
  const lower = prompt.toLowerCase();
  const context = detectContext(contextHint);
  const table = detectEntity(lower) ?? context?.table ?? null;
  if (!table) return null;

  const country = table === "partners" ? detectCountry(lower) : null;
  const isList = LIST_RE.test(lower);
  const isCount = !isList && (COUNT_RE.test(lower) || context?.mode === "count");

  // Serve almeno un segnale chiaro: conteggio, elenco, oppure un filtro paese.
  if (!isCount && !isList && !country) return null;

  const label = TABLE_LABEL[table] ?? table;
  const filters = country ? [{ column: "country_code", op: "eq" as const, value: country.code }] : [];
  const limit = isCount ? 25 : 200;
  const scope = country ? ` · ${country.label}` : isCount ? " · totale" : "";

  return {
    table,
    // Per partners forniamo colonne note; per le altre lasciamo decidere l'executor.
    columns: table === "partners" ? PARTNER_COLUMNS : undefined,
    filters,
    limit,
    title: isCount ? `Conteggio ${label}${scope}` : `${label.charAt(0).toUpperCase()}${label.slice(1)}${scope}`,
    rationale: "Piano deterministico locale: query di routine eseguita senza planner AI (immune al rate-limit).",
  };
}
