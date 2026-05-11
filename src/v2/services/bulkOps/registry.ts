/**
 * Registry SSOT scope → entry handler.
 *
 * Ogni blocco bulk ha UN solo handler raggiungibile dalla UI.
 * Aggiungere uno scope NUOVO senza registrarlo qui = errore a runtime.
 */
import type { BulkEntry, BulkScope } from "./types";
import { enrichBaseEntry } from "./entries/enrichBase";
import { deepSearchEntry } from "./entries/deepSearch";
import { downloadEntry } from "./entries/download";
import { inboundEnrichEntry } from "./entries/inboundEnrich";
import { verifyWaEntry, verifyLiEntry, verifyEmailEntry, verifyDedupEntry } from "./entries/verify";
import {
  updateOriginEntry, updateLeadStatusEntry, updateEmailRulesEntry,
  updateBackfillEntry, updateAnalyzeAiEntry, updateDispatchEntry,
} from "./entries/update";

const REGISTRY: Record<BulkScope, BulkEntry> = {
  "enrich.base": enrichBaseEntry as BulkEntry,
  "deepsearch.sherlock": deepSearchEntry as BulkEntry,
  "download.partner": downloadEntry as BulkEntry,
  "enrich.inbound": inboundEnrichEntry as BulkEntry,
  "verify.wa": verifyWaEntry as BulkEntry,
  "verify.li": verifyLiEntry as BulkEntry,
  "verify.email": verifyEmailEntry as BulkEntry,
  "verify.dedup": verifyDedupEntry as BulkEntry,
  "update.origin": updateOriginEntry as BulkEntry,
  "update.leadStatus": updateLeadStatusEntry as BulkEntry,
  "update.emailRules": updateEmailRulesEntry as BulkEntry,
  "update.backfill": updateBackfillEntry as BulkEntry,
  "update.analyzeAi": updateAnalyzeAiEntry as BulkEntry,
  "update.dispatch": updateDispatchEntry as BulkEntry,
};

export function getEntry(scope: BulkScope): BulkEntry {
  const entry = REGISTRY[scope];
  if (!entry) {
    throw new Error(`[bulkOps] Scope sconosciuto: "${scope}". Registralo in registry.ts.`);
  }
  return entry;
}

export function listScopes(): readonly BulkScope[] {
  return Object.keys(REGISTRY) as BulkScope[];
}