/**
 * DAL — bulk_jobs / bulk_job_events
 * SSOT per lo stato dei job bulk (registry + log eventi).
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { toJsonValue } from "@/lib/jsonGuards";
import { toRecord } from "@/lib/records";

export type BulkJobStatus = "pending" | "running" | "completed" | "completed_with_errors" | "failed" | "cancelled";

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

type BulkJobDbRow = Database["public"]["Tables"]["bulk_jobs"]["Row"];

/** Normalizza la riga DB (payload Json) nel tipo di dominio. */
function mapBulkJobRow(row: BulkJobDbRow): BulkJobRow {
  return {
    id: row.id,
    scope: row.scope,
    source_view: row.source_view,
    total: row.total ?? 0,
    processed: row.processed ?? 0,
    success_count: row.success_count ?? 0,
    error_count: row.error_count ?? 0,
    status: row.status as BulkJobStatus,
    payload: toRecord(row.payload),
    error_message: row.error_message,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
    completed_at: row.completed_at,
  };
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
      payload: toJsonValue(input.payload ?? {}),
      created_by: input.created_by,
      status: "pending",
    })
    .select("*")
    .maybeSingle();
  if (error || !data) throw new Error(error?.message ?? "createBulkJob failed");
  return mapBulkJobRow(data);
}

export async function updateBulkJob(
  id: string,
  patch: Partial<
    Pick<BulkJobRow, "processed" | "success_count" | "error_count" | "status" | "error_message" | "completed_at">
  >,
): Promise<void> {
  const { error } = await supabase
    .from("bulk_jobs")
    .update(patch as Database["public"]["Tables"]["bulk_jobs"]["Update"])
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function appendBulkJobEvent(
  jobId: string,
  eventType: string,
  payload: Record<string, unknown> = {},
): Promise<void> {
  const { error } = await supabase
    .from("bulk_job_events")
    .insert({ job_id: jobId, event_type: eventType, payload: toJsonValue(payload) });
  if (error) throw new Error(error.message);
}

export async function getBulkJob(id: string): Promise<BulkJobRow | null> {
  const { data, error } = await supabase.from("bulk_jobs").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapBulkJobRow(data) : null;
}
