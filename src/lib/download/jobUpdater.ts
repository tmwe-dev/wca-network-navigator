import { updateDownloadJob as dalUpdateJob } from "@/data/downloadJobs";

/**
 * Centralized helper for updating download job progress in the database.
 * Eliminates 12+ duplicated update calls across the processor.
 */
export async function updateJobProgress(
  jobId: string,
  updates: {
    currentIndex?: number;
    processedIds?: number[];
    lastWcaId?: number;
    lastCompany?: string;
    contactResult?: string;
    contactsFound?: number;
    contactsMissing?: number;
    failedIds?: number[];
    status?: string;
    errorMessage?: string | null;
  },
) {
  const payload: Record<string, any> = {};

  if (updates.currentIndex !== undefined) payload.current_index = updates.currentIndex;
  if (updates.processedIds) payload.processed_ids = updates.processedIds as Record<string, unknown>;
  if (updates.lastWcaId !== undefined) payload.last_processed_wca_id = updates.lastWcaId;
  if (updates.lastCompany) payload.last_processed_company = updates.lastCompany;
  if (updates.contactResult) payload.last_contact_result = updates.contactResult;
  if (updates.contactsFound !== undefined) payload.contacts_found_count = updates.contactsFound;
  if (updates.contactsMissing !== undefined) payload.contacts_missing_count = updates.contactsMissing;
  if (updates.failedIds) payload.failed_ids = updates.failedIds as Record<string, unknown>;
  if (updates.status) payload.status = updates.status;
  if (updates.errorMessage !== undefined) payload.error_message = updates.errorMessage;

  if (Object.keys(payload).length > 0) {
    await dalUpdateJob(jobId, payload);
  }
}
