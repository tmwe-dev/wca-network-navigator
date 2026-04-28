/**
 * P2.3 — Validazione applicativa Zod per JSON columns critiche.
 *
 * NOTA: NON usiamo CHECK constraint a livello DB perché:
 *  - le shape evolvono (deep_search aggiunge campi nel tempo)
 *  - CHECK su jsonb è rigido e blocca migrazioni
 *
 * Questi schema sono "permissive": validano i campi noti ma accettano
 * extra keys (`.passthrough()`) per non rompere upstream.
 * Errori di validazione sono LOGGATI ma NON bloccano la write,
 * salvo `parseStrict()` esplicito.
 */
import { z } from "zod";

// ============================================================
// partners.enrichment_data
// ============================================================
export const PartnerEnrichmentDataSchema = z
  .object({
    source_url: z.string().url().nullish(),
    summary_it: z.string().nullish(),
    summary_en: z.string().nullish(),
    key_routes: z.array(z.string()).nullish(),
    key_markets: z.array(z.string()).nullish(),
    fleet_details: z.string().nullish(),
    founding_year: z.number().int().nullish(),
    has_own_fleet: z.boolean().nullish(),
    warehouse_sqm: z.number().nullish(),
    employee_count: z.number().int().nullish(),
    has_warehouses: z.boolean().nullish(),
    revenue_estimate: z.union([z.string(), z.number()]).nullish(),
    warehouse_details: z.string().nullish(),
    additional_services: z.array(z.string()).nullish(),
    deep_search_at: z.string().nullish(),
    deep_search_by: z.string().nullish(),
    deep_search_quality: z.enum(["fast", "standard", "premium"]).nullish(),
  })
  .passthrough();

export type PartnerEnrichmentData = z.infer<typeof PartnerEnrichmentDataSchema>;

// ============================================================
// agents.assigned_tools
// ============================================================
const TOOL_NAME_REGEX = /^[a-z][a-z0-9_]{1,63}$/;

export const AssignedToolsSchema = z
  .array(z.string().regex(TOOL_NAME_REGEX, "tool name must be snake_case"))
  .max(100, "too many tools assigned (max 100)");

export type AssignedTools = z.infer<typeof AssignedToolsSchema>;

// ============================================================
// Helpers (safe parse + log)
// ============================================================

export interface SafeParseResult<T> {
  ok: boolean;
  data: T;
  errors?: string[];
}

function logValidationError(field: string, errors: z.ZodIssue[]): void {
  if (typeof console !== "undefined") {
    // eslint-disable-next-line no-console
    console.warn(`[jsonValidators] ${field} validation failed`, {
      errors: errors.map((e) => ({ path: e.path.join("."), message: e.message })),
    });
  }
}

/**
 * Validazione non bloccante: ritorna data passthrough anche in caso di errore.
 * Usare in WRITE path quando vogliamo loggare ma non bloccare.
 */
export function safeParsePartnerEnrichment(
  raw: unknown,
): SafeParseResult<PartnerEnrichmentData> {
  const result = PartnerEnrichmentDataSchema.safeParse(raw);
  if (result.success) return { ok: true, data: result.data };
  logValidationError("partners.enrichment_data", result.error.issues);
  return {
    ok: false,
    data: (raw ?? {}) as PartnerEnrichmentData,
    errors: result.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`),
  };
}

export function safeParseAssignedTools(raw: unknown): SafeParseResult<AssignedTools> {
  const result = AssignedToolsSchema.safeParse(raw);
  if (result.success) return { ok: true, data: result.data };
  logValidationError("agents.assigned_tools", result.error.issues);
  // Sanitize: tieni solo i tool che matchano regex
  const filtered = Array.isArray(raw)
    ? (raw as unknown[]).filter(
        (t): t is string => typeof t === "string" && TOOL_NAME_REGEX.test(t),
      )
    : [];
  return {
    ok: false,
    data: filtered,
    errors: result.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`),
  };
}

/**
 * Versioni strict che lanciano se invalid. Usare solo in critical-path
 * dove preferiamo fallire piuttosto che corrompere il DB.
 */
export function parsePartnerEnrichmentStrict(raw: unknown): PartnerEnrichmentData {
  return PartnerEnrichmentDataSchema.parse(raw);
}

export function parseAssignedToolsStrict(raw: unknown): AssignedTools {
  return AssignedToolsSchema.parse(raw);
}