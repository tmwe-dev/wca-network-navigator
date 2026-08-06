/**
 * DAL — diagnostica di sistema (badge admin).
 * Estratto 1:1 da `SystemDiagnosticsBadge`: stesse RPC, stessa semantica
 * errori (nessun throw, fallback neutro) e stessi payload.
 */
import { supabase } from "@/integrations/supabase/client";
import { createLogger } from "@/lib/log";

const log = createLogger("systemDiagnostics");

export interface DiagnosticsPayload {
  agent_tasks_pending: number;
  email_queue_pending: number;
  extension_pending: number;
  cron_active: number;
  last_email_sync: string | null;
  generated_at: string;
}

/** Json → record navigabile senza cast di fuga. */
function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function num(value: unknown): number {
  return typeof value === "number" ? value : 0;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export async function fetchSystemDiagnostics(): Promise<DiagnosticsPayload | null> {
  const { data, error } = await supabase.rpc("get_system_diagnostics");
  if (error) {
    log.warn("[SystemDiagnosticsBadge] rpc error:", { error: error.message });
    return null;
  }
  const r = asRecord(data);
  return {
    agent_tasks_pending: num(r.agent_tasks_pending),
    email_queue_pending: num(r.email_queue_pending),
    extension_pending: num(r.extension_pending),
    cron_active: num(r.cron_active),
    last_email_sync: nullableString(r.last_email_sync),
    generated_at: nullableString(r.generated_at) ?? "",
  };
}

export async function fetchSystemPaused(): Promise<boolean> {
  const { data, error } = await supabase.rpc("get_system_paused");
  if (error) return false;
  return Boolean(data);
}

export async function fetchInboundActivityCounts(): Promise<{ total: number; orphans: number }> {
  const { data, error } = await supabase.rpc("count_inbound_activities");
  if (error || !data) return { total: 0, orphans: 0 };
  const r = asRecord(data);
  return { total: num(r.total), orphans: num(r.orphans) };
}

/** Mette in pausa / riattiva il sistema. Errori propagati. */
export async function setSystemPaused(paused: boolean): Promise<void> {
  const { error } = await supabase.rpc("set_system_paused", { p_paused: paused });
  if (error) throw error;
}

/** Pulizia attività inbound; ritorna il numero di righe eliminate. Errori propagati. */
export async function purgeInboundActivities(onlyOrphans: boolean): Promise<{ deleted: number }> {
  const { data, error } = await supabase.rpc("purge_inbound_activities", {
    p_only_orphans: onlyOrphans,
  });
  if (error) throw error;
  return { deleted: num(asRecord(data).deleted) };
}

/** Verifica accessibilità di uno storage bucket (diagnostics). Errori propagati. */
export async function listStorageBucketRoot(bucket: string, limit = 1): Promise<void> {
  const { error } = await supabase.storage.from(bucket).list("", { limit });
  if (error) throw error;
}
