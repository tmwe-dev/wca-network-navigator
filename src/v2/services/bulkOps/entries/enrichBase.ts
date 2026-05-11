/**
 * Entry: enrich.base
 * Delega all'edge function `enrich-partner-website` (1 partner per item).
 */
import { invokeEdge } from "@/lib/api/invokeEdge";
import type { BulkEntry } from "../types";
import { assertCalledFromRunner } from "./_internal";

export interface EnrichBaseItem {
  readonly partnerId: string;
}

export const enrichBaseEntry: BulkEntry<EnrichBaseItem, { ok: boolean }> = {
  scope: "enrich.base",
  itemId: (i) => i.partnerId,
  continueOnError: true,
  handler: async (item) => {
    assertCalledFromRunner("enrich.base");
    await invokeEdge("enrich-partner-website", {
      body: { partner_id: item.partnerId },
      context: "bulkOps.enrichBase",
    });
    return { ok: true };
  },
};