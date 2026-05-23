import { invokeEdge } from "@/lib/api/invokeEdge";
import { invokeAi } from "@/lib/ai/invokeAi";
import type { BulkEntry } from "../types";
import { assertCalledFromRunner } from "./_internal";

type AnyAsync = (...a: unknown[]) => Promise<unknown>;

export interface UpdateOriginItem { readonly contactId: string; readonly origin: string; }
export const updateOriginEntry: BulkEntry<UpdateOriginItem, { ok: boolean }> = {
  scope: "update.origin",
  itemId: (i) => i.contactId,
  continueOnError: true,
  handler: async (item) => {
    assertCalledFromRunner("update.origin");
    const mod = (await import("@/data/contacts/queries")) as unknown as Record<string, AnyAsync>;
    if (!mod.bulkUpdateContactsOrigin) throw new Error("bulkUpdateContactsOrigin not exported by @/data/contacts/queries");
    await mod.bulkUpdateContactsOrigin([item.contactId], item.origin);
    return { ok: true };
  },
};

export interface UpdateLeadStatusItem { readonly contactId: string; readonly newStatus: string; readonly statusReason?: string; }
export const updateLeadStatusEntry: BulkEntry<UpdateLeadStatusItem, { ok: boolean }> = {
  scope: "update.leadStatus",
  itemId: (i) => i.contactId,
  continueOnError: true,
  handler: async (item) => {
    assertCalledFromRunner("update.leadStatus");
    const mod = (await import("@/data/contacts/queries")) as unknown as Record<string, AnyAsync>;
    if (!mod.updateLeadStatus) throw new Error("updateLeadStatus not exported by @/data/contacts/queries");
    await mod.updateLeadStatus([item.contactId], item.newStatus);
    return { ok: true };
  },
};

export interface UpdateEmailRulesItem { readonly emailAddress: string; readonly autoAction?: string; readonly blocked?: boolean; }
export const updateEmailRulesEntry: BulkEntry<UpdateEmailRulesItem, { ok: boolean }> = {
  scope: "update.emailRules",
  itemId: (i) => i.emailAddress,
  continueOnError: true,
  handler: async (item) => {
    assertCalledFromRunner("update.emailRules");
    const mod = (await import("@/data/emailAddressRules")) as unknown as Record<string, AnyAsync>;
    if (item.autoAction !== undefined && mod.bulkUpdateAutoAction) await mod.bulkUpdateAutoAction([item.emailAddress], item.autoAction);
    if (item.blocked !== undefined && mod.bulkSetBlocked) await mod.bulkSetBlocked([item.emailAddress], item.blocked);
    return { ok: true };
  },
};

export interface UpdateBackfillItem { readonly userId: string; readonly target: string; readonly scope: "address" | "group"; readonly dryRun?: boolean; }
export const updateBackfillEntry: BulkEntry<UpdateBackfillItem, { ok: boolean }> = {
  scope: "update.backfill",
  itemId: (i) => `${i.scope}:${i.target}`,
  continueOnError: true,
  handler: async (item) => {
    assertCalledFromRunner("update.backfill");
    const { backfillForAddress, backfillForGroup } = await import("@/data/emailRulesBackfill");
    if (item.scope === "address") await backfillForAddress(item.userId, item.target, item.dryRun ?? false);
    else await backfillForGroup(item.userId, item.target, item.dryRun ?? false);
    return { ok: true };
  },
};

export interface AnalyzeAiItem { readonly emailAddress: string; }
export const updateAnalyzeAiEntry: BulkEntry<AnalyzeAiItem, { ok: boolean }> = {
  scope: "update.analyzeAi",
  itemId: (i) => i.emailAddress,
  continueOnError: true,
  handler: async (item, ctx) => {
    assertCalledFromRunner("update.analyzeAi");
    await invokeAi("suggest-email-groups", {
      scope: "classify",
      body: { email_addresses: [item.emailAddress], user_id: ctx.userId },
      context: { source: "bulkOps.analyzeAi", mode: "bulk" },
    });
    return { ok: true };
  },
};

export interface DispatchItem { readonly contactId: string; readonly channel: "wa" | "li"; readonly messageId: string; }
export const updateDispatchEntry: BulkEntry<DispatchItem, { ok: boolean }> = {
  scope: "update.dispatch",
  itemId: (i) => `${i.channel}:${i.contactId}`,
  continueOnError: true,
  handler: async (item) => {
    assertCalledFromRunner("update.dispatch");
    await invokeEdge("extension-dispatch-enqueue", {
      body: { contact_id: item.contactId, channel: item.channel, message_id: item.messageId },
      context: "bulkOps.dispatch",
    });
    return { ok: true };
  },
};