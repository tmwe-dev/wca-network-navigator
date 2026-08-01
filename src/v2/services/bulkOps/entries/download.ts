/**
 * Entry: download.partner
 */
import { invokeEdge } from "@/lib/api/invokeEdge";
import type { BulkEntry } from "../types";
import { assertCalledFromRunner } from "./_internal";

export interface DownloadItem {
  readonly downloadJobId: string;
}

export const downloadEntry: BulkEntry<DownloadItem, { ok: boolean }> = {
  scope: "download.partner",
  itemId: (i) => i.downloadJobId,
  continueOnError: true,
  handler: async (item) => {
    assertCalledFromRunner("download.partner");
    await invokeEdge("process-download-job", {
      body: { job_id: item.downloadJobId },
      context: "bulkOps.download",
    });
    return { ok: true };
  },
};