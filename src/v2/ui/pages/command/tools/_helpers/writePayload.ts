/**
 * Shared helpers for WRITE tools — Prompt Freedom doctrine.
 *
 * Regola: il planner passa i params semantici in `context.payload`.
 * I regex sul prompt sono solo un fallback per l'input umano diretto
 * (utente digita in Command senza planner Gemini).
 *
 * Merge policy: chiave per chiave, il valore del planner vince quando
 * non è vuoto; altrimenti si prende il fallback dal prompt.
 */
import {
  resolvePartnerRefById,
  resolvePartnerRefByTerm,
  resolveContactRefById,
  resolveContactRefByTerm,
} from "@/data/commandRefResolvers";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True quando il valore è "significativo" (non undefined/null/stringa vuota). */
function isMeaningful(v: unknown): boolean {
  if (v === undefined || v === null) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.keys(v as object).length > 0;
  return true;
}

/**
 * Merge planner payload (autorevole) con fallback estratto dal prompt.
 * Le chiavi del planner sovrascrivono il fallback solo se hanno un valore.
 */
export function mergePayload<T extends Record<string, unknown>>(
  fromPlanner: Record<string, unknown> | undefined,
  fromPrompt: T,
): T {
  const merged: Record<string, unknown> = { ...fromPrompt };
  if (!fromPlanner) return merged as T;
  for (const [k, v] of Object.entries(fromPlanner)) {
    if (isMeaningful(v)) merged[k] = v;
  }
  return merged as T;
}

/** Vero UUID v4-like. */
export function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

/**
 * Risolve un riferimento a partner (UUID già pronto oppure company_name fuzzy)
 * → id partner. Ritorna null se non trovato o input vuoto.
 */
export async function resolvePartnerRef(
  ref: string | null | undefined,
): Promise<{ id: string; company_name: string } | null> {
  const term = (ref ?? "").trim();
  if (!term) return null;
  if (isUuid(term)) {
    return await resolvePartnerRefById(term);
  }
  return await resolvePartnerRefByTerm(term);
}

/**
 * Risolve un riferimento a contatto (UUID o nome/email fuzzy) → id contatto.
 */
export async function resolveContactRef(ref: string | null | undefined): Promise<{ id: string; name: string } | null> {
  const term = (ref ?? "").trim();
  if (!term) return null;
  if (isUuid(term)) {
    return await resolveContactRefById(term);
  }
  return await resolveContactRefByTerm(term);
}
