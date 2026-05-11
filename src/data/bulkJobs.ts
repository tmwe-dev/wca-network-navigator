/**
 * DAL — bulk_jobs / bulk_job_events
 * SSOT per lo stato dei job bulk (registry + log eventi).
 */
import { supabase } from "@/integrations/supabase/client";

export type BulkJobStatus =
  | "pending"
  | "running"
  | "completed"
  | "completed_with_errors"
  | "failed"
  | "cancelled";

export interface BulkJobRow {
  id: string;
  scope: string;
  source_view: string | null;
  total: number;
  processed: number;
  success_count: number;
  error_count: number;
  status: BulkJobStatus;
  payload: Record<string, unknown>;
  error_message: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export async function createBulkJob(input: {
  scope: string;
  source_view?: string;
  total: number;
  payload?: Record<string, unknown>;
  created_by: string;
}): Promise<BulkJobRow> {
  const { data, error } = await supabase
    .from("bulk_jobs")
    .insert({
      scope: input.scope,
      source_view: input.source_view ?? null,
      total: input.total,
      payload: (input.payload ?? {}) as never,
      created_by: input.created_by,
      status: "pending",
    })
    .select("*")
    .maybeSingle();
  if (error || !data) throw new Error(error?.message ?? "createBulkJob failed");
  return data as unknown as BulkJobRow;
}

export async function updateBulkJob(
  id: string,
  patch: Partial<Pick<BulkJobRow, "processed" | "success_count" | "error_count" | "status" | "error_message" | "completed_at">>,
): Promise<void> {
  const { error } = await supabase.from("bulk_jobs").update(patch as never).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function appendBulkJobEvent(
  jobId: string,
  eventType: string,
  payload: Record<string, unknown> = {},
): Promise<void> {
  const { error } = await supabase
    .from("bulk_job_events")
    .insert({ job_id: jobId, event_type: eventType, payload: payload as never });
  if (error) throw new Error(error.message);
}

export async function getBulkJob(id: string): Promise<BulkJobRow | null> {
  const { data, error } = await supabase.from("bulk_jobs").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as unknown as BulkJobRow) ?? null;
}