/**
 * lastQueryResultContext — Memoria singleton dell'ultima query AI riuscita.
 *
 * Serve come ponte tra il tool `ai-query` e il tool `compose-email`:
 * dopo "quanti partner in Arabia Saudita", se l'utente dice
 * "scrivi una mail a tutti quanti", `compose-email` deve poter EREDITARE
 * il country dell'ultima query anche se il prompt corrente non lo nomina.
 *
 * Stesso pattern di `composerContext`: singleton modulo + TTL 5 min.
 */

export interface LastQueryResultContext {
  readonly table: string;
  readonly countryCode: string | null;
  readonly rowCount: number;
  readonly ts: number;
}

const TTL_MS = 5 * 60_000;

let last: LastQueryResultContext | null = null;

export function setLastQueryResultContext(
  ctx: Omit<LastQueryResultContext, "ts">,
): void {
  // Preserva l'ultimo countryCode conosciuto se la nuova query non ne
  // specifica uno (es. ricerca per città senza filtro paese). Senza questo,
  // dopo "partner di Malta" → "marsa" → "questi partner", il bridge
  // ai-query→compose-email perderebbe Malta e tornerebbe 0 risultati.
  const previousCountry = last && last.table === ctx.table ? last.countryCode : null;
  const countryCode = ctx.countryCode ?? previousCountry;
  last = { ...ctx, countryCode, ts: Date.now() };
}

export function getLastQueryResultContext(): LastQueryResultContext | null {
  if (!last) return null;
  if (Date.now() - last.ts > TTL_MS) {
    last = null;
    return null;
  }
  return last;
}

export function clearLastQueryResultContext(): void {
  last = null;
}

/**
 * Estrae il `country_code` (se presente) dai filtri di un QueryContext.
 * Supporta varianti `country_code`, `country`, e operatori `eq`/`in`.
 */
export function extractCountryCodeFromFilters(
  filters: ReadonlyArray<{ column: string; op: string; value: unknown }>,
): string | null {
  for (const f of filters) {
    const col = f.column.toLowerCase();
    if (col !== "country_code" && col !== "country") continue;
    if (typeof f.value === "string" && f.value.length === 2) {
      return f.value.toUpperCase();
    }
    if (Array.isArray(f.value) && f.value.length === 1 && typeof f.value[0] === "string") {
      return (f.value[0] as string).toUpperCase();
    }
  }
  return null;
}