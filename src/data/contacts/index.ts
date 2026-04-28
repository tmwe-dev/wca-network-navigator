/**
 * Contacts Data Access Layer
 * Re-exports all contact-related functions organized by module
 */

export type {
  LeadStatus,
  ImportedContactRow,
  ImportedContactInsert,
  ContactFilters,
  ContactInteraction,
  ContactPaginatedSort,
  ContactPaginatedFilters,
} from "./types";

export {
  findContacts,
  getContactById,
  getContactsByIds,
  updateContact,
  deleteContacts,
  insertContacts,
  updateContactStatus,
  updateLeadStatus,
  toggleContactSelection,
  markContactTransferred,
  linkContactToPartner,
  findImportDuplicates,
  updateContactEnrichment,
  findContactByEmail,
} from "./queries";

export type { ImportDuplicateMatch } from "./queries";

export { findContactsPaginated } from "./pagination";

export {
  findHoldingPatternContacts,
  getHoldingPatternStats,
  getContactFilterOptions,
  fetchGroupContactIds,
  findContactsByGroup,
} from "./filters";

export {
  findContactInteractions,
  createContactInteraction,
  findBusinessCardForContact,
} from "./interactions";

export { contactKeys } from "./queryKeys";

// For cache invalidation
import type { QueryClient } from "@tanstack/react-query";
import { contactKeys } from "./queryKeys";

export function invalidateContactCache(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: contactKeys.all });
  qc.invalidateQueries({ queryKey: contactKeys.holdingPattern });
}
