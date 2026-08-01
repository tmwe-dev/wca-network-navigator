/**
 * liveSchemaLoader — carica lo schema reale (colonne + enum) dal DB
 * via la RPC `ai_introspect_schema`. Cache 5 minuti in memoria edge.
 *
 * Sostituisce ogni descrizione hardcoded dello schema nei system prompt AI.
 * Quando il DB cambia (nuova colonna, nuovo enum value), l'AI lo vede al
 * massimo dopo 5 minuti — zero modifiche TS, zero deploy.
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY") ?? "";

const CACHE_TTL_MS = 5 * 60 * 1000;

export interface LiveColumn {
  name: string;
  type: string; // "string" | "number" | "boolean" | "date" | "uuid" | "json" | "enum:<name>"
  nullable: boolean;
  enum_values: string[] | null;
}

export interface LiveTable {
  table: string;
  columns: LiveColumn[];
}

interface CacheEntry {
  fetchedAt: number;
  data: LiveTable[];
  rendered: string;
}

const cache = new Map<string, CacheEntry>();

/**
 * Recupera lo schema vivo dal DB. Cache 5 min per chiave (lista tabelle).
 * In caso di errore, ritorna stringa vuota: l'AI deve potersi arrangiare
 * comunque (cadrà sui nomi delle tabelle nella whitelist).
 */
export async function loadLiveSchema(tables: readonly string[]): Promise<{
  tables: LiveTable[];
  rendered: string;
}> {
  const key = [...tables].sort().join(",");
  const cached = cache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return { tables: cached.data, rendered: cached.rendered };
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return { tables: [], rendered: "" };
  }

  try {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/ai_introspect_schema`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ table_names: tables }),
    });
    if (!resp.ok) {
      await resp.text().catch(() => "");
      return { tables: [], rendered: "" };
    }
    const data = (await resp.json()) as LiveTable[];
    const rendered = renderForPrompt(data);
    cache.set(key, { fetchedAt: Date.now(), data, rendered });
    return { tables: data, rendered };
  } catch {
    return { tables: [], rendered: "" };
  }
}

/** Formato compatto, leggibile dall'LLM. Mostra colonna, tipo, enum se presente. */
function renderForPrompt(tables: LiveTable[]): string {
  if (!tables.length) return "";
  const lines: string[] = [];
  for (const t of tables) {
    lines.push(`📊 ${t.table}`);
    for (const c of t.columns) {
      const enumPart =
        c.enum_values && c.enum_values.length
          ? ` [${c.enum_values.join("|")}]`
          : "";
      const nul = c.nullable ? "" : " *";
      lines.push(`  - ${c.name}: ${c.type}${enumPart}${nul}`);
    }
    lines.push("");
  }
  lines.push("Legenda: tipo enum:<name> = colonna a valori fissi (usa SOLO i valori elencati). Asterisco * = NOT NULL.");
  return lines.join("\n");
}

export function clearLiveSchemaCache(): void {
  cache.clear();
}