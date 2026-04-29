// Re-export all tool handlers for centralized access

export {
  handleSendEmail,
  handleSendWhatsApp,
  handleSendLinkedIn,
  handleQueueOutreach,
  handleScheduleEmail,
  handleGenerateOutreach,
} from "./emailTools.ts";

export {
  handleSearchPartners,
  handleGetPartnerDetail,
  handleSearchContacts,
  handleGetContactDetail,
  handleSearchProspects,
  handleSearchMemory,
  handleSearchBusinessCards,
  handleDeepSearchPartner,
  handleDeepSearchContact,
} from "./searchTools.ts";

export {
  handleUpdatePartner,
  handleAddPartnerNote,
  handleCreateReminder,
  handleCreateActivity,
  handleUpdateActivity,
  handleListActivities,
  handleManagePartnerContact,
  handleUpdateReminder,
  handleUpdateLeadStatus,
  handleBulkUpdatePartners,
  handleDeleteRecords,
  handleGetEmailClassifications,
  handleAssignContactsToAgent,
} from "./crmTools.ts";

export {
  handleGetCountryOverview,
  handleGetDirectoryStatus,
  handleGetGlobalSummary,
  handleListJobs,
  handleCheckJobStatus,
  handleGetOperationsDashboard,
  handleGetSystemAnalytics,
  handleAnalyzeIncomingEmail,
  handleEvaluatePartner,
  handleExecuteDecision,
  handleUndoAiAction,
  handleGetApprovalDashboard,
} from "./analysisTools.ts";

export {
  handleGetBlacklist,
  handleListReminders,
  handleGetPartnersWithoutContacts,
} from "./dataTools.ts";

export {
  handleGetInbox,
  handleGetConversationHistory,
  handleGetHoldingPattern,
  handleUpdateMessageStatus,
  handleGetEmailThread,
} from "./messagingTools.ts";

export {
  handleCreateAgentTask,
  handleListAgentTasks,
  handleGetTeamStatus,
  handleUpdateAgentPrompt,
  handleAddAgentKbEntry,
} from "./agentTools.ts";

export {
  handleCreateWorkPlan,
  handleListWorkPlans,
  handleUpdateWorkPlan,
  handleCreateCampaign,
} from "./workflowTools.ts";

export {
  handleManageWorkspacePreset,
  handleGetConversationContext,
  handleGetAddressRules,
  handleSaveMemory,
  handleDetectLanguage,
  handleGetPendingActions,
  handleApproveAiAction,
  handleRejectAiAction,
  handleExecuteUiAction,
} from "./configTools.ts";

export {
  handleEnrichPartnerWebsite,
  handleGenerateAliases,
  handleSuggestNextContacts,
} from "./externalTools.ts";
