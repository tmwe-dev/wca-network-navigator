/**
 * IO Queries: Download Jobs — Result-based
 */
import { supabase } from "@/integrations/supabase/client";
import { type Result, ok, err } from "../../../core/domain/result";
import { ioError, fromUnknown, type AppError } from "../../../core/domain/errors";
import { type DownloadJob } from "../../../core/domain/entities";
import { mapDownloadJobRow } from "../../../core/mappers/download-job-mapper";

export async function fetchDownloadJobs(): Promise<Result<DownloadJob[], AppError>> {
  try {
    const { data, error } = await supabase
      .from("download_jobs")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) return err(ioError("DATABASE_ERROR", error.message, { table: "download_jobs" }, "fetchDownloadJobs"));
    if (!data) return ok([]);
    const jobs: DownloadJob[] = [];
    for (const row of data) {
      const mapped = mapDownloadJobRow(row);
      if (mapped._tag === "Err") return mapped;
      jobs.push(mapped.value);
    }
    return ok(jobs);
  } catch (caught: unknown) {
    return err(fromUnknown(caught, "DATABASE_ERROR", "fetchDownloadJobs"));
  }
}

export async function fetchDownloadJobsByCountry(countryCode: string): Promise<Result<DownloadJob[], AppError>> {
  try {
    const { data, error } = await supabase
      .from("download_jobs")
      .select("*")
      .eq("country_code", countryCode)
      .order("created_at", { ascending: false });
    if (error) return err(ioError("DATABASE_ERROR", error.message, { table: "download_jobs", countryCode }, "fetchDownloadJobsByCountry"));
    if (!data) return ok([]);
    const jobs: DownloadJob[] = [];
    for (const row of data) {
      const mapped = mapDownloadJobRow(row);
      if (mapped._tag === "Err") return mapped;
      jobs.push(mapped.value);
    }
    return ok(jobs);
  } catch (caught: unknown) {
    return err(fromUnknown(caught, "DATABASE_ERROR", "fetchDownloadJobsByCountry"));
  }
}
