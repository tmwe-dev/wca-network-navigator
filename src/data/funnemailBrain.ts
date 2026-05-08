/**
 * DAL — Funnemail Brain view (Sprint 5)
 */
import { untypedFrom } from "@/lib/supabaseUntyped";

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
  const { data, error } = await untypedFrom("funnemail_brain_v")
    .select("*")
    .order("received_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as FunnemailBrainRow[];
}
