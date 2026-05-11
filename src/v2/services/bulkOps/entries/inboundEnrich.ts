/**
 * Entry: enrich.inbound
 */
import { invokeEdge } from "@/lib/api/invokeEdge";
import type { BulkEntry } from "../types";
import { assertCalledFromRunner } from "./_internal";

export interface InboundEnrichItem {
  readonly emailAddress: string;
}

export const inboundEnrichEntry: BulkEntry<InboundEnrichItem, { ok: boolean }> = {
  scope: "enrich.inbound",
  itemId: (i) => i.emailAddress,
  continueOnError: true,
  handler: async (item) => {
    assertCalledFromRunner("enrich.inbound");
    await invokeEdge("process-inbound-enrichment", {
      body: { email_address: item.emailAddress },
      context: "bulkOps.inboundEnrich",
    });
    return { ok: true };
  },
};