/**
 * Predicate condiviso per il pattern strangler B4.x (view canonica
 * `message_intelligence_v` con fallback trasparente su `channel_messages`).
 *
 * Il fallback DEVE scattare SOLO per errori compatibili con
 * "view/schema non disponibile" (view assente, schema cache stale,
 * relazione/colonna inesistente). Errori di autenticazione, RLS/permission,
 * rete e timeout devono essere PROPAGATI e non mascherati, altrimenti
 * mascheriamo bug reali dietro un fallback silenzioso.
 */

export interface ViewLikeError {
  code?: string | null;
  message?: string | null;
  name?: string | null;
}

// PostgreSQL / PostgREST codes that indicate the view/schema itself is
// unavailable — safe to fall back to the legacy table.
const SCHEMA_ERROR_CODES = new Set<string>([
  "42P01", // undefined_table (relation does not exist)
  "42703", // undefined_column
  "PGRST200", // schema cache: relation/column not found
  "PGRST202", // could not find function/relation in schema cache
  "PGRST204", // column not found in schema cache
  "PGRST205", // could not find the table
]);

// Message fragments that unambiguously indicate a schema/view-missing
// condition even when the code is not populated (rare, but observed with
// some PostgREST versions).
const SCHEMA_MESSAGE_RX = /(does not exist|schema cache|could not find (?:the )?(?:table|relation|column))/i;

/**
 * True SE (e solo se) l'errore è compatibile con view/colonna non disponibile.
 * Ritorna false per auth/RLS/network/timeout/qualsiasi altro errore.
 */
export function isViewSchemaError(err: ViewLikeError | null | undefined): boolean {
  if (!err) return false;
  const code = (err.code ?? "").toString();
  if (code && SCHEMA_ERROR_CODES.has(code)) return true;
  // Refuse to fall back on known non-schema categories even if the message
  // vagamente combacia.
  if (code === "42501" || code.startsWith("PGRST301") || code === "PGRST301") return false;
  const msg = (err.message ?? "").toString();
  if (!msg) return false;
  if (/permission denied|not authorized|jwt|unauthorized|rls/i.test(msg)) return false;
  if (/network|fetch failed|timeout|aborted/i.test(msg)) return false;
  return SCHEMA_MESSAGE_RX.test(msg);
}
