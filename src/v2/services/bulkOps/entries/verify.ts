import type { BulkEntry } from "../types";
import { assertCalledFromRunner } from "./_internal";

/**
 * NOTE (2026-07-17 audit): le edge function `verify-*` e `find-import-duplicates`
 * non sono mai state deployate. Per evitare 404 in produzione le entry qui sotto
 * diventano no-op strutturati (skipped:true). Quando l'edge sarà pronta, ripristinare
 * l'invokeEdge originale mantenendo la stessa firma dell'item.
 */

export interface VerifyContactItem { readonly contactId: string; }
export interface DedupItem { readonly importLogId: string; }

export const verifyWaEntry: BulkEntry<VerifyContactItem, { ok: boolean; skipped: true; reason: string }> = {
  scope: "verify.wa",
  itemId: (i) => i.contactId,
  continueOnError: true,
  handler: async (_item) => {
    assertCalledFromRunner("verify.wa");
    return { ok: true, skipped: true, reason: "verify-whatsapp-number edge not deployed" };
  },
};

export const verifyLiEntry: BulkEntry<VerifyContactItem, { ok: boolean; skipped: true; reason: string }> = {
  scope: "verify.li",
  itemId: (i) => i.contactId,
  continueOnError: true,
  handler: async (_item) => {
    assertCalledFromRunner("verify.li");
    return { ok: true, skipped: true, reason: "verify-linkedin-profile edge not deployed" };
  },
};

export const verifyEmailEntry: BulkEntry<VerifyContactItem, { ok: boolean; skipped: true; reason: string }> = {
  scope: "verify.email",
  itemId: (i) => i.contactId,
  continueOnError: true,
  handler: async (_item) => {
    assertCalledFromRunner("verify.email");
    return { ok: true, skipped: true, reason: "verify-email-address edge not deployed" };
  },
};

export const verifyDedupEntry: BulkEntry<DedupItem, { ok: boolean; skipped: true; reason: string }> = {
  scope: "verify.dedup",
  itemId: (i) => i.importLogId,
  continueOnError: true,
  handler: async (_item) => {
    assertCalledFromRunner("verify.dedup");
    return { ok: true, skipped: true, reason: "find-import-duplicates edge not deployed" };
  },
};