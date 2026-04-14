/**
 * DAL — download_jobs, download_job_items, download_job_events
 * Centralizes all download-related queries and cache invalidation.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { queryKeys } from "@/lib/queryKeys";
import type { QueryClient } from "@tanstack/react-query";

export interface DownloadJob {
  id: string;
  country_code: string;
  country_name: string;
  network_name: string;
  status: string;
  job_type: string;
  wca_ids: number[];
  processed_ids: number[];
  current_index: number;
  total_count: number;
  delay_seconds: number;
  last_processed_wca_id: number | null;
  last_processed_company: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  contacts_found_count: number;
  contacts_missing_count: number;
  last_contact_result: string | null;
  failed_ids: number[];
}

// ── Job Reads ──

export async function findDownloadJobs(limit = 50): Promise<DownloadJob[]> {
  const { data, error } = await supabase
    .from("download_jobs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []) as DownloadJob[];
}

export async function findActiveJobs(): Promise<DownloadJob[]> {
  const { data, error } = await supabase
    .from("download_jobs")
    .select("*")
    .in("status", ["pending", "running"])
    .limit(10);
  if (error) throw error;
  return (data || []) as DownloadJob[];
}

export async function getDownloadJob(id: string): Promise<DownloadJob | null> {
  const { data, error } = await supabase
    .from("download_jobs")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as DownloadJob | null;
}

export interface JobStatusResult { id: string; status: string; updated_at: string; [k: string]: unknown }

export async function findJobsByStatusSelect(statuses: string[], select = "id, status, updated_at", limit = 10): Promise<JobStatusResult[]> {
  const { data, error } = await supabase
    .from("download_jobs")
    .select(select)
    .in("status", statuses)
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as JobStatusResult[];
}

export async function findJobByCountryAndNetwork(countryCode: string, networkName: string, statuses: string[]) {
  const { data, error } = await supabase
    .from("download_jobs")
    .select("id, status, updated_at")
    .eq("country_code", countryCode)
    .eq("network_name", networkName)
    .in("status", statuses)
    .limit(1);
  if (error) throw error;
  return data?.[0] ?? null;
}

export async function findRunningJobs() {
  const { data, error } = await supabase
    .from("download_jobs")
    .select("id, country_name, current_index, updated_at")
    .eq("status", "running");
  if (error) throw error;
  return data ?? [];
}

// ── Job Writes ──

export async function updateDownloadJob(
  id: string,
  updates: Partial<Pick<DownloadJob, "status" | "error_message" | "current_index" | "delay_seconds" |
    "last_processed_wca_id" | "last_processed_company" | "last_contact_result" |
    "contacts_found_count" | "contacts_missing_count">> & { processed_ids?: number[]; completed_at?: string; failed_ids?: unknown }
) {
  const payload: Record<string, unknown> = { ...updates };
  if (updates.processed_ids) {
    payload.processed_ids = updates.processed_ids as unknown as Json;
  }
  const { error } = await supabase
    .from("download_jobs")
    .update(payload)
    .eq("id", id);
  if (error) throw error;
}

/** Claim a job (set running) with status guard, returns true if claimed */
export async function claimDownloadJob(jobId: string) {
  const { data } = await supabase
    .from("download_jobs")
    .update({ status: "running", error_message: null })
    .eq("id", jobId)
    .in("status", ["pending", "paused", "running"])
    .select("id");
  return !!(data?.length);
}

export async function createDownloadJob(params: {
  country_code: string;
  country_name: string;
  network_name: string;
  wca_ids: number[];
  total_count: number;
  delay_seconds: number;
  status: string;
  job_type?: string;
  user_id?: string;
}): Promise<string> {
  const { data, error } = await supabase
    .from("download_jobs")
    .insert({
      ...params,
      wca_ids: params.wca_ids as unknown as Json,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function deleteJobsByStatus(statuses: string[]): Promise<number> {
  const { data: jobs } = await supabase
    .from("download_jobs")
    .select("id")
    .in("status", statuses);
  if (!jobs || jobs.length === 0) return 0;
  const { error } = await supabase
    .from("download_jobs")
    .delete()
    .in("status", statuses);
  if (error) throw error;
  return jobs.length;
}

// ── Job Items ──

export interface JobItemResult { status: string; contacts_found: number; contacts_missing: number; [k: string]: unknown }

export async function getJobItemsByJobId(jobId: string, select = "status, contacts_found, contacts_missing"): Promise<JobItemResult[]> {
  const { data, error } = await supabase
    .from("download_job_items")
    .select(select)
    .eq("job_id", jobId);
  if (error) throw error;
  return (data ?? []) as unknown as JobItemResult[];
}

export async function getJobItemById(itemId: string, select = "attempt_count"): Promise<unknown> {
  const { data, error } = await supabase
    .from("download_job_items")
    .select(select)
    .eq("id", itemId)
    .single();
  if (error) throw error;
  return data as unknown as Record<string, unknown>;
}

export async function updateJobItem(itemId: string, updates: Record<string, unknown>) {
  const { error } = await supabase
    .from("download_job_items")
    .update(updates)
    .eq("id", itemId);
  if (error) throw error;
}

export async function updateJobItemsByJobIdAndStatus(jobId: string, fromStatus: string | string[], updates: Record<string, unknown>) {
  let q = supabase.from("download_job_items").update(updates).eq("job_id", jobId);
  if (Array.isArray(fromStatus)) q = q.in("status", fromStatus);
  else q = q.eq("status", fromStatus);
  const { error } = await q;
  if (error) throw error;
}

export async function insertJobItems(items: Array<{ job_id: string; wca_id: number; position: number; status: string }>) {
  for (let i = 0; i < items.length; i += 500) {
    const { error } = await supabase.from("download_job_items").insert(items.slice(i, i + 500));
    if (error) throw error;
  }
}

// ── Job Events ──

export async function insertJobEvent(event: { job_id: string; item_id?: string; event_type: string; payload?: Record<string, unknown> }) {
  const { error } = await supabase.from("download_job_events").insert({
    job_id: event.job_id,
    item_id: event.item_id || undefined,
    event_type: event.event_type,
    payload: (event.payload || {}) as Json,
  });
  if (error) throw error;
}

// ── Dead partners ──

export async function findDeadPartnerIds(wcaIds: number[]) {
  const { data, error } = await supabase
    .from("partners_no_contacts")
    .select("wca_id")
    .in("wca_id", wcaIds)
    .eq("resolved", false);
  if (error) throw error;
  return (data ?? []).map(r => r.wca_id);
}

// ── Cache ──

export function invalidateDownloadJobs(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: queryKeys.downloadJobs });
}
