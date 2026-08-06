/**
 * DAL — Funnemail Jobs (vista aggregata read-only).
 *
 * Espone `funnemail_jobs_v` introdotta dall'audit Funnemail Cr4:
 * unisce status, sub_status, claim attivo, AI decision, prossimo
 * reminder e ultima escalation per ogni message_id Funnemail.
 *
 * La view è presente nei tipi Supabase generati: nessun cast necessario.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export interface FunnemailJobRow {
  message_id: string;
  user_id: string;
  group_id: string | null;
  status: string;
  sub_status: string | null;
  status_reason: string | null;
  status_changed_by: string | null;
  status_changed_at: string | null;
  has_active_claim: boolean;
  claim_owner: string | null;
  claim_at: string | null;
  claim_released_at: string | null;
  ai_suggested_action: string | null;
  ai_urgency: string | null;
  ai_goes_to_agenda: boolean | null;
  ai_commercial_handoff: boolean | null;
  ai_confidence: number | null;
  ai_folder_slug: string | null;
  next_remind_at: string | null;
  open_reminders_count: number | null;
  last_escalation_level: "L1" | "L2" | "L3" | null;
  last_escalation_at: string | null;
}

const VIEW = "funnemail_jobs_v" as const;

type FunnemailJobViewRow = Database["public"]["Views"]["funnemail_jobs_v"]["Row"];

const ESCALATION_LEVELS = ["L1", "L2", "L3"] as const;

function toEscalationLevel(value: string | null): FunnemailJobRow["last_escalation_level"] {
  return ESCALATION_LEVELS.find((l) => l === value) ?? null;
}

/** Normalizza le righe della view al contratto tipizzato (nessun cast opaco). */
function normalizeJobRows(rows: FunnemailJobViewRow[]): FunnemailJobRow[] {
  return rows.map((row) => ({
    ...row,
    message_id: row.message_id ?? "",
    user_id: row.user_id ?? "",
    status: row.status ?? "",
    has_active_claim: row.has_active_claim ?? false,
    last_escalation_level: toEscalationLevel(row.last_escalation_level),
  }));
}

export interface ListFunnemailJobsFilters {
  status?: string | null;
  ownerId?: string | null;
  groupId?: string | null;
  /** Solo job non presi in carico (claim assente). */
  unclaimedOnly?: boolean;
  limit?: number;
}

/** Lista job aggregati. Visibilità: la view rispetta le RLS sottostanti. */
export async function listFunnemailJobs(filters: ListFunnemailJobsFilters = {}): Promise<FunnemailJobRow[]> {
  let q = supabase.from(VIEW).select("*");
  if (filters.status) q = q.eq("status", filters.status);
  if (filters.ownerId) q = q.eq("claim_owner", filters.ownerId);
  if (filters.groupId) q = q.eq("group_id", filters.groupId);
  if (filters.unclaimedOnly) q = q.eq("has_active_claim", false);
  q = q.order("status_changed_at", { ascending: false }).limit(filters.limit ?? 200);
  const { data, error } = await q;
  if (error) throw error;
  return normalizeJobRows(data ?? []);
}

/** Singolo job aggregato per message_id. */
export async function getFunnemailJob(messageId: string): Promise<FunnemailJobRow | null> {
  const { data, error } = await supabase.from(VIEW).select("*").eq("message_id", messageId).maybeSingle();
  if (error) throw error;
  return data ? normalizeJobRows([data])[0] : null;
}

/** Aggiorna il sub_status fine-grained sul job. */
export async function setFunnemailSubStatus(messageId: string, subStatus: string | null): Promise<void> {
  const { error } = await supabase
    .from("funnemail_message_status")
    .update({ sub_status: subStatus })
    .eq("message_id", messageId);
  if (error) throw error;
}
