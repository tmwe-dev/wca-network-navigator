// Barrel exports for src/data/ DAL modules
// Grouped by domain for readability

// ── Partners & Contacts ──
// partners exports updateLeadStatus (for partners); contacts also exports updateLeadStatus (for contacts)
// We keep the partners version as the default and alias the contacts version
export * from "./partners";
export {
  contactKeys,
  findContacts,
  findHoldingPatternContacts,
  getHoldingPatternStats,
  getContactFilterOptions,
  findContactInteractions,
  updateLeadStatus as updateContactLeadStatus,
  createContactInteraction,
  deleteContacts,
  updateContact,
  getContactById,
  getContactsByIds,
  insertContacts,
  toggleContactSelection,
  markContactTransferred,
  findContactByEmail,
  updateContactEnrichment,
  updateContactStatus,
  fetchGroupContactIds,
  invalidateContactCache,
} from "./contacts";
export type { LeadStatus, ContactFilters, ContactInteraction } from "./contacts";
export * from "./contactInteractions";
export * from "./partnerRelations";
export * from "./businessCards";
export * from "./blacklist";
export * from "./profiles";
export * from "./prospects";

// ── Communication ──
export * from "./channelMessages";
// emailCampaigns exports countEmailDrafts; emailDrafts also exports countEmailDrafts
// We keep the emailCampaigns version as default and alias the emailDrafts version
export * from "./emailCampaigns";
export {
  countEmailDrafts as countEmailDraftsStandalone,
  insertEmailDraft,
  insertEmailDraftReturning,
} from "./emailDrafts";
export * from "./emailPrompts";
export * from "./emailTemplates";
export * from "./interactions";

// ── AI & Memory ──
export * from "./aiConversations";
export * from "./aiEditPatterns";
export * from "./aiMemory";
export * from "./aiLabTestRuns";
export * from "./kbEntries";
export * from "./kbSeedData";
export * from "./salesKnowledgeBase";
export * from "./workPlans";
export * from "./operativePrompts";

// ── Agents ──
export * from "./agents";
export * from "./agentAvatars";
export * from "./agentPrompts";
export * from "./agentTasks";
export * from "./agentTemplates";

// ── Outreach & Campaigns ──
export * from "./outreachMissions";
export * from "./outreachQueue";
export * from "./campaignJobs";
export * from "./cockpitQueue";

// ── Operations ──
export * from "./activities";
export * from "./downloadJobs";
export * from "./importLogs";
export * from "./directoryCache";
export * from "./operationsProcedures";
export * from "./clientAssignments";

// ── External Integrations ──
export * from "./linkedinFlow";
export * from "./wcaCountries";
export * from "./wcaFilters";

// ── Settings & Config ──
export * from "./appSettings";
export * from "./credits";
export * from "./telemetry";
export * from "./defaultContentPresets";
export * from "./defaultEmailTypes";

// ── Reference Data ──
export * from "./atecoCategories";
export * from "./atecoRanking";
export * from "./italianProvinces";
export * from "./workspaceDocs";
export * from "./rpc";
