/**
 * Contacts Data Access Layer
 * Backward-compatible re-export from organized modules
 */
export {
  type LeadStatus,
  type ImportedContactRow,
  type ImportedContactInsert,
  type ContactFilters,
  type ContactInteraction,
  type ContactPaginatedSort,
  type ContactPaginatedFilters,
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
  type ImportDuplicateMatch,
  updateContactEnrichment,
  findContactByEmail,
  bulkUpdateContactsOrigin,
  listDistinctContactOrigins,
  bulkUpdateContactsByOrigins,
  findContactsPaginated,
  findHoldingPatternContacts,
  getHoldingPatternStats,
  getContactFilterOptions,
  fetchGroupContactIds,
  findContactsByGroup,
  findContactInteractions,
  createContactInteraction,
  findBusinessCardForContact,
  contactKeys,
  invalidateContactCache,
  findContactsForSegments,
  type SegmentContactRow,
  findConversationContextsForUser,
  type ConversationContextRow,
  findContactsForPipeline,
  type PipelineContactRow,
  findContactsForDuplicateScan,
  type DedupContactRow,
  findContactsForExport,
  type ExportContactRow,
} from "./contacts/index";

export interface RecipientSearchRow {
  id: string;
  name: string | null;
  company_name: string | null;
  email: string | null;
}

/** Ricerca contatti importati per il RecipientPicker del composer email V2. */
export async function searchImportedContactsForRecipientPicker(search: string): Promise<RecipientSearchRow[]> {
  const { data } = await supabase
    .from("imported_contacts")
    .select("id, name, company_name, email")
    .not("email", "is", null)
    .or(`name.ilike.%${search}%,email.ilike.%${search}%,company_name.ilike.%${search}%`)
    .limit(10);
  return data ?? [];
}
