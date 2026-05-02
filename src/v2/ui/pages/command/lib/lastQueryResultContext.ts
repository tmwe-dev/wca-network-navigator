/**
 * lastQueryResultContext — memoria short-term dell'ultimo risultato del Query
 * Planner contenente partner. Permette ai tool successivi (es. compose-email)
 * di ereditare la lista di partner appena trovati quando l'utente conferma
 * con un follow-up generico ("vai avanti", "procedi", "prepara la bozza").
 *
 * Stesso pattern (singleton modulo, TTL 5 min) di `composerContext.ts`.
 */

export interface LastQueryResultContext {
  readonly partnerIds: ReadonlyArray<string>;
  readonly countryCode: string | null;
  readonly countryLabel: string | null;
  readonly originalPrompt: string;
  /** Tabella della query (es. "partners"). Opzionale per retro-compat. */
  readonly table?: string | null;
  /** Filtri reali applicati (city, country_code, lead_status, …). */
  readonly filters?: ReadonlyArray<{ column: string; op: string; value: unknown }>;
  /** Conteggio totale (anche se non sono presenti partnerIds). */
  readonly count?: number | null;
  /** Etichetta human del set selezionato, es. "partner ad Amman". */
  readonly selectionLabel?: string | null;
  readonly ts: number;
}

const TTL_MS = 5 * 60_000;

let lastCtx: LastQueryResultContext | null = null;

export function setLastQueryResultContext(ctx: Omit<LastQueryResultContext, "ts">): void {
  // Manteniamo il contesto se abbiamo partnerIds, country, o filtri reali
  // (es. city=Amman senza country_code).
  const hasFilters = (ctx.filters?.length ?? 0) > 0;
  if (ctx.partnerIds.length === 0 && !ctx.countryCode && !hasFilters) return;
  lastCtx = { ...ctx, ts: Date.now() };
}

export function getLastQueryResultContext(): LastQueryResultContext | null {
  if (!lastCtx) return null;
  if (Date.now() - lastCtx.ts > TTL_MS) {
    lastCtx = null;
    return null;
  }
  return lastCtx;
}

export function clearLastQueryResultContext(): void {
  lastCtx = null;
}

/* ─── Extractors ──────────────────────────────────────────────────────── */

/**
 * Estrae partner_id da un ToolResult del Query Planner.
 * Supporta:
 *  - kind:"table" con rows che hanno colonna `id` o `partner_id` (table=partners)
 *  - kind:"multi" con almeno una part `table === "partners"`
 */
export function extractPartnerIdsFromResult(result: unknown): string[] {
  if (!result || typeof result !== "object") return [];
  const r = result as { kind?: string; rows?: unknown; parts?: unknown; meta?: unknown };
  // table singolo
  if (r.kind === "table" && Array.isArray(r.rows)) {
    const meta = r.meta as { sourceLabel?: string } | undefined;
    const looksLikePartners =
      typeof meta?.sourceLabel === "string" && /partner/i.test(meta.sourceLabel);
    if (!looksLikePartners) return [];
    return collectIds(r.rows as Array<Record<string, unknown>>);
  }
  // multi
  if (r.kind === "multi" && Array.isArray(r.parts)) {
    const out: string[] = [];
    for (const p of r.parts as Array<{ table?: string; rows?: Array<Record<string, unknown>> }>) {
      if (p.table === "partners" && Array.isArray(p.rows)) {
        out.push(...collectIds(p.rows));
      }
    }
    return out;
  }
  return [];
}

function collectIds(rows: Array<Record<string, unknown>>): string[] {
  const out: string[] = [];
  for (const row of rows) {
    const id = row.id ?? row.partner_id;
    if (typeof id === "string" && id.length > 0) out.push(id);
  }
  return out;
}

/**
 * Heuristic: il prompt è una conferma per "procedere" sul contesto precedente?
 *  - "vai avanti", "procedi", "prosegui", "continua"
 *  - "ok procedi", "fai pure", "go", "avanti"
 *  - "prepara la bozza", "scrivi la lettera", "fai la mail"
 */
export function isProceedIntent(prompt: string): boolean {
  const p = (prompt ?? "").toLowerCase().trim();
  if (p.length === 0) return false;
  return (
    /\b(vai\s+avanti|procedi|prosegui|continua|avanti|fai\s+pure|go\b|ok\s+procedi)\b/i.test(p) ||
    /\b(prepara|prepari|preparare|fai|scrivi|componi|genera)\s+(?:la|il|un|una|\d+)?\s*(bozza|lettera|lettere|mail|email|messaggio|messaggi)\b/i.test(p) ||
    /\b(?:questi|quei|quelli|tutti\s+questi)\s+partner\b/i.test(p) ||
    /\b(vai\s+avanti\s+con\s+(la\s+)?(bozza|lettera))\b/i.test(p) ||
    // Inviti generici: "prepara un invito", "invitali", "mandagli un invito"
    /\b(prepara|prepari|preparare|fai|scrivi|manda|mandagli|invia|inviagli)\s+(?:un|una|gli|loro|\d+)?\s*(invito|inviti|invit[oa]|lettera|lettere)\b/i.test(p) ||
    /\binvit(?:ali|a|i|iamo)\b/i.test(p) ||
    // "a tutti", "tutti ospiti", "quelli selezionati/trovati/visti"
    /\b(a\s+tutti|ognuno|ciascuno|tutti\s+ospiti|quelli\s+(selezionati|trovati|visti|sopra|elencati))\b/i.test(p)
  );
}