/**
 * tmweAudit.ts — helper non-bloccante per scrivere in tmwe_request_audit.
 * Usato dalle nuove edge function TMWE (match/link/sync/quote).
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface TmweAuditRow {
  op_name: string;
  identity: "user" | "system";
  caller_user_id: string | null;
  partner_id?: string | null;
  status: number;
  latency_ms?: number;
  error_message?: string | null;
}

export async function logTmweAudit(svc: SupabaseClient, row: TmweAuditRow): Promise<void> {
  try {
    await svc.from("tmwe_request_audit").insert({
      op_name: row.op_name,
      identity: row.identity,
      caller_user_id: row.caller_user_id,
      partner_id: row.partner_id ?? null,
      status: row.status,
      latency_ms: row.latency_ms ?? null,
      error_message: row.error_message ?? null,
    });
  } catch {
    // non-blocking
  }
}

/**
 * Indica se l'operatore ha completato OAuth TMWE.
 * Usato dalle edge che richiedono identity=user per restituire un errore
 * comprensibile (TMWE_NOT_CONNECTED) invece di un 500 generico.
 */
export function notConnectedResponse(corsHeaders: Record<string, string>): Response {
  return new Response(
    JSON.stringify({
      error: "TMWE_NOT_CONNECTED",
      message: "L'operatore non ha collegato il proprio account TMWE. Connetti TMWE per procedere.",
    }),
    { status: 412, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}