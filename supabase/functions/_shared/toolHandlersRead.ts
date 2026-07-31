/**
 * Read-only tool handlers for AI assistants.
 * Aggregatore: gli handler vivono nei moduli di dominio
 * (partners / crm / jobs) con firme e comportamento invariati.
 * Vol. I §5 — Guardrails: ogni modulo ha un unico scopo.
 */

import { createPartnerReadHandlers } from "./toolHandlersReadPartners.ts";
import { createCrmReadHandlers } from "./toolHandlersReadCrm.ts";
import { createJobReadHandlers } from "./toolHandlersReadJobs.ts";

// Permissive client type — `createClient` without a Database generic
// infers `never` for every table, breaking all .from()/.rpc() calls below.
// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

export function createReadHandlers(supabase: SupabaseClient) {
  return {
    ...createPartnerReadHandlers(supabase),
    ...createCrmReadHandlers(supabase),
    ...createJobReadHandlers(supabase),
  };
}
