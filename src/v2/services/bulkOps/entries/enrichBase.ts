/**
 * Entry: enrich.base
 * Delega all'edge function `enrich-partner-website` (1 partner per item).
 */
import { invokeEdge } from "@/lib/api/invokeEdge";
import type { BulkEntry } from "../types";
import { assertCalledFromRunner } from "./_internal";

export interface EnrichBaseItem {
  readonly partnerId: string;
  readonly markdown?: string;
  readonly sourceUrl?: string;
}

export const enrichBaseEntry: BulkEntry<EnrichBaseItem, Record<string, unknown>> = {
  scope: "enrich.base",
  itemId: (i) => i.partnerId,
  continueOnError: true,
  handler: async (item) => {
    assertCalledFromRunner("enrich.base");
    return await invokeEdge<Record<string, unknown>>("enrich-partner-website", {
      body: {
        partnerId: item.partnerId,
        markdown: item.markdown,
        sourceUrl: item.sourceUrl,
      },
      context: "bulkOps.enrichBase",
    });
  },
};
