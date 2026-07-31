/**
 * DAL — Funnemail Brain view (Sprint 5)
 */
import { supabase } from "@/integrations/supabase/client";

export interface FunnemailBrainRow {
  message_id: string;
  user_id: string | null;
  channel: string | null;
  from_address: string | null;
  subject: string | null;
  received_at: string;
  job_stage: string | null;
  job_attempts: number | null;
  job_last_error: string | null;
  job_completed_at: string | null;
  decision_action: string | null;
  decision_confidence: number | null;
  decision_reasoning: string | null;
  decision_at: string | null;
  funnemail_status: string | null;
  funnemail_sub_status: string | null;
  actions_count: number;
  actions_ok_count: number;
  last_action_at: string | null;
}

export async function listFunnemailBrain(limit = 100): Promise<FunnemailBrainRow[]> {
  const { data, error } = await supabase.from("funnemail_brain_v")
    .select("*")
    .order("received_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  // La view espone tutte le colonne come nullable: scartiamo le righe senza
  // chiavi obbligatorie e normalizziamo i contatori, senza asserzioni di tipo.
  const out: FunnemailBrainRow[] = [];
  for (const row of data ?? []) {
    if (row.message_id == null || row.received_at == null) continue;
    out.push({
      message_id: row.message_id,
      user_id: row.user_id,
      channel: row.channel,
      from_address: row.from_address,
      subject: row.subject,
      received_at: row.received_at,
      job_stage: row.job_stage,
      job_attempts: row.job_attempts,
      job_last_error: row.job_last_error,
      job_completed_at: row.job_completed_at,
      decision_action: row.decision_action,
      decision_confidence: row.decision_confidence,
      decision_reasoning: row.decision_reasoning,
      decision_at: row.decision_at,
      funnemail_status: row.funnemail_status,
      funnemail_sub_status: row.funnemail_sub_status,
      actions_count: row.actions_count ?? 0,
      actions_ok_count: row.actions_ok_count ?? 0,
      last_action_at: row.last_action_at,
    });
  }
  return out;
}
