// Barrel exports for src/data/ DAL modules
// Grouped by domain for readability

// ── Partners & Contacts ──
export * from "./partners";
export { updateLeadStatus as updateContactLeadStatus } from "./contacts";
export * from "./contacts";
export * from "./contactInteractions";
export * from "./partnerRelations";
export * from "./businessCards";
export * from "./blacklist";
export * from "./profiles";
export * from "./prospects";

// ── Communication ──
export * from "./channelMessages";
export * from "./emailCampaigns";
export { countEmailDrafts as countEmailDraftsOnly } from "./emailDrafts";
export * from "./emailDrafts";
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
