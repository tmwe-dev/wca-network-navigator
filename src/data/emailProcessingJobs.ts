/**
 * DAL — Email Processing Jobs (Funnemail job ledger)
 *
 * Tabella creata nello Sprint 1 Funnemail. Ogni inbound email ha una riga
 * con il proprio stage corrente (received → scouted → ... → completed/dlq).
 * INSERT/UPDATE solo lato service_role (edge functions); SELECT per owner.
 */
import { supabase } from "@/integrations/supabase/client";

export type EmailProcessingStage =
  | "received"
  | "scouted"
  | "classified"
  | "routed"
  | "policy_applied"
  | "completed"
  | "failed"
  | "dlq";

export interface EmailProcessingJobRow {
  id: string;
  message_id: string;
  user_id: string | null;
  stage: EmailProcessingStage;
  attempts: number;
  last_error: string | null;
  started_at: string;
  completed_at: string | null;
  payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ListEmailProcessingJobsFilters {
  stage?: EmailProcessingStage | null;
  limit?: number;
}

const TABLE = "email_processing_jobs" as const;

export async function listEmailProcessingJobs(
  filters: ListEmailProcessingJobsFilters = {},
): Promise<EmailProcessingJobRow[]> {
  let q = supabase.from(TABLE as never).select("*");
  if (filters.stage) q = q.eq("stage", filters.stage);
  q = q.order("started_at", { ascending: false }).limit(filters.limit ?? 100);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as EmailProcessingJobRow[];
}

export async function getEmailProcessingJob(
  messageId: string,
): Promise<EmailProcessingJobRow | null> {
  const { data, error } = await supabase
    .from(TABLE as never)
    .select("*")
    .eq("message_id", messageId)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as unknown as EmailProcessingJobRow | null;
}