/**
 * DownloadJob Mapper — DB row → Domain entity
 */
import { type Result, ok, err } from "../domain/result";
import { ioError, type AppError } from "../domain/errors";
import { DownloadJobRowSchema } from "../../io/supabase/schemas/download-job-schema";
import { type DownloadJob, downloadJobId, userId } from "../domain/entities";

export function mapDownloadJobRow(row: unknown): Result<DownloadJob, AppError> {
  const parsed = DownloadJobRowSchema.safeParse(row);
  if (!parsed.success) {
    return err(ioError("SCHEMA_MISMATCH", `DownloadJob row validation failed: ${parsed.error.message}`, {
      issues: parsed.error.issues,
    }, "download-job-mapper"));
  }
  const r = parsed.data;
  return ok({
    id: downloadJobId(r.id),
    countryCode: r.country_code,
    countryName: r.country_name,
    networkName: r.network_name,
    jobType: r.job_type,
    status: r.status,
    totalCount: r.total_count,
    currentIndex: r.current_index,
    contactsFoundCount: r.contacts_found_count,
    contactsMissingCount: r.contacts_missing_count,
    delaySeconds: r.delay_seconds,
    errorMessage: r.error_message,
    userId: r.user_id ? userId(r.user_id) : null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    completedAt: r.completed_at,
  });
}
