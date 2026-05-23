/**
 * Entry: deepsearch.sherlock
 * Delega a Sherlock (3 livelli). Single source of truth Deep Search.
 */
import { invokeAi } from "@/lib/ai/invokeAi";
import type { BulkEntry } from "../types";
import { assertCalledFromRunner } from "./_internal";

export type SherlockLevel = "scout" | "detective" | "sherlock";

export interface DeepSearchItem {
  readonly entityType: "partner" | "contact";
  readonly entityId: string;
  readonly level: SherlockLevel;
}

export const deepSearchEntry: BulkEntry<DeepSearchItem, { ok: boolean }> = {
  scope: "deepsearch.sherlock",
  itemId: (i) => `${i.entityType}:${i.entityId}`,
  continueOnError: true,
  handler: async (item) => {
    assertCalledFromRunner("deepsearch.sherlock");
    await invokeAi("sherlock-extract", {
      scope: "sherlock",
      body: { entity_type: item.entityType, entity_id: item.entityId, level: item.level },
      context: { source: "bulkOps.deepSearch", mode: "bulk" },
    });
    return { ok: true };
  },
};