/**
 * IO Mutations: Download Jobs — Result-based
 */
import { supabase } from "@/integrations/supabase/client";
import { type Result, ok, err } from "../../../core/domain/result";
import { ioError, fromUnknown, type AppError } from "../../../core/domain/errors";
import type { Database } from "@/integrations/supabase/types";

type DownloadJobUpdate = Database["public"]["Tables"]["download_jobs"]["Update"];

export async function updateDownloadJobStatus(
  jobId: string,
  updates: DownloadJobUpdate,
): Promise<Result<void, AppError>> {
  try {
    const { error } = await supabase
      .from("download_jobs")
      .update(updates)
      .eq("id", jobId);
    if (error) return err(ioError("DATABASE_ERROR", error.message, { table: "download_jobs", jobId }, "updateDownloadJobStatus"));
    return ok(undefined);
  } catch (caught: unknown) {
    return err(fromUnknown(caught, "DATABASE_ERROR", "updateDownloadJobStatus"));
  }
}
