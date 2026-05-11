import { invokeEdge } from "@/lib/api/invokeEdge";
import type { BulkEntry } from "../types";
import { assertCalledFromRunner } from "./_internal";

export interface VerifyContactItem { readonly contactId: string; }
export interface DedupItem { readonly importLogId: string; }

export const verifyWaEntry: BulkEntry<VerifyContactItem, { ok: boolean }> = {
  scope: "verify.wa",
  itemId: (i) => i.contactId,
  continueOnError: true,
  handler: async (item) => {
    assertCalledFromRunner("verify.wa");
    await invokeEdge("verify-whatsapp-number", { body: { contact_id: item.contactId }, context: "bulkOps.verifyWa" });
    return { ok: true };
  },
};

export const verifyLiEntry: BulkEntry<VerifyContactItem, { ok: boolean }> = {
  scope: "verify.li",
  itemId: (i) => i.contactId,
  continueOnError: true,
  handler: async (item) => {
    assertCalledFromRunner("verify.li");
    await invokeEdge("verify-linkedin-profile", { body: { contact_id: item.contactId }, context: "bulkOps.verifyLi" });
    return { ok: true };
  },
};

export const verifyEmailEntry: BulkEntry<VerifyContactItem, { ok: boolean }> = {
  scope: "verify.email",
  itemId: (i) => i.contactId,
  continueOnError: true,
  handler: async (item) => {
    assertCalledFromRunner("verify.email");
    await invokeEdge("verify-email-address", { body: { contact_id: item.contactId }, context: "bulkOps.verifyEmail" });
    return { ok: true };
  },
};

export const verifyDedupEntry: BulkEntry<DedupItem, { ok: boolean }> = {
  scope: "verify.dedup",
  itemId: (i) => i.importLogId,
  continueOnError: true,
  handler: async (item) => {
    assertCalledFromRunner("verify.dedup");
    await invokeEdge("find-import-duplicates", { body: { import_log_id: item.importLogId }, context: "bulkOps.verifyDedup" });
    return { ok: true };
  },
};