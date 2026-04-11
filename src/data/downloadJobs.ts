/**
 * DAL — download_jobs
 * Centralizes all download_jobs queries and cache invalidation.
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

// ── Reads ──

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

// ── Writes ──

export async function updateDownloadJob(
  id: string,
  updates: Partial<Pick<DownloadJob, "status" | "error_message" | "current_index" | "delay_seconds" |
    "last_processed_wca_id" | "last_processed_company" | "last_contact_result" |
    "contacts_found_count" | "contacts_missing_count">> & { processed_ids?: number[] }
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

// ── Cache ──

export function invalidateDownloadJobs(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: queryKeys.downloadJobs });
}
