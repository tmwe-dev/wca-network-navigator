import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type DownloadJob = Tables<"download_jobs">;
export type DownloadJobInsert = TablesInsert<"download_jobs">;
export type DownloadJobUpdate = TablesUpdate<"download_jobs">;

/** Statuses that indicate a job is still in progress. */
const ACTIVE_STATUSES = ["pending", "running", "paused"] as const;

/**
 * Centralized data access for the `download_jobs` table.
 * Mirrors patterns from src/lib/download/jobState.ts but as a pure data layer.
 */
export const downloadJobRepository = {
  /** Fetch a single download job by ID. Returns null if not found. */
  async findById(id: string) {
    const { data, error } = await supabase
      .from("download_jobs")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  /**
   * Fetch active jobs (pending / running / paused).
   * Optionally limited to a specific number of results.
   */
  async findActive(limit = 10) {
    const { data, error } = await supabase
      .from("download_jobs")
      .select("*")
      .in("status", [...ACTIVE_STATUSES])
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  },

  /** Create a new download job. Returns the inserted row. */
  async create(job: DownloadJobInsert) {
    const { data, error } = await supabase
      .from("download_jobs")
      .insert(job)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  /**
   * Update a job's status and optional fields.
   * A thin wrapper that keeps status transitions explicit.
   */
  async updateStatus(
    id: string,
    status: string,
    extra?: Partial<Omit<DownloadJobUpdate, "id" | "status">>,
  ) {
    const payload: DownloadJobUpdate = { status, ...extra };
    const { data, error } = await supabase
      .from("download_jobs")
      .update(payload)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};
