import { supabase, type ExecuteContext } from "./shared.ts";

// ── Centralized imports from modular tool handlers ──
import {
  handleSendEmail,
  handleSendWhatsApp,
  handleSendLinkedIn,
  handleQueueOutreach,
  handleScheduleEmail,
  handleGenerateOutreach,
} from "./toolHandlers/emailTools.ts";

import {
  handleSearchPartners,
  handleGetPartnerDetail,
  handleSearchContacts,
  handleGetContactDetail,
  handleSearchProspects,
  handleSearchMemory,
  handleSearchBusinessCards,
  handleDeepSearchPartner,
  handleDeepSearchContact,
} from "./toolHandlers/searchTools.ts";

import {
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
} from "./toolHandlers/crmTools.ts";

import {
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
} from "./toolHandlers/analysisTools.ts";

import {
  handleCreateDownloadJob,
  handleDownloadSinglePartner,
  handleGetBlacklist,
  handleListReminders,
  handleGetPartnersWithoutContacts,
} from "./toolHandlers/dataTools.ts";

import {
  handleGetInbox,
  handleGetConversationHistory,
  handleGetHoldingPattern,
  handleUpdateMessageStatus,
  handleGetEmailThread,
} from "./toolHandlers/messagingTools.ts";

import {
  handleCreateAgentTask,
  handleListAgentTasks,
  handleGetTeamStatus,
  handleUpdateAgentPrompt,
  handleAddAgentKbEntry,
} from "./toolHandlers/agentTools.ts";

import {
  handleCreateWorkPlan,
  handleListWorkPlans,
  handleUpdateWorkPlan,
  handleCreateCampaign,
} from "./toolHandlers/workflowTools.ts";

import {
  handleManageWorkspacePreset,
  handleGetConversationContext,
  handleGetAddressRules,
  handleSaveMemory,
  handleDetectLanguage,
  handleGetPendingActions,
  handleApproveAiAction,
  handleRejectAiAction,
  handleExecuteUiAction,
} from "./toolHandlers/configTools.ts";

import {
  handleEnrichPartnerWebsite,
  handleGenerateAliases,
  handleScanDirectory,
  handleSuggestNextContacts,
} from "./toolHandlers/externalTools.ts";

// ═══ SHARED APPROVAL GUARD ═══
const SIDE_EFFECT_TOOLS = new Set<string>([
  "send_email",
  "send_whatsapp",
  "send_linkedin",
  "queue_channel_message",
  "update_partner",
  "create_task",
  "schedule_followup",
  "execute_decision",
]);

async function isApprovalRequired(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("user_id", userId)
    .eq("key", "agent_require_approval")
    .maybeSingle();
  return data?.value === "true" || (data?.value as unknown) === true;
}

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  userId: string,
  authHeader: string,
  context?: ExecuteContext
): Promise<unknown> {
  // ── Centralized approval gate for side-effect tools ──
  if (SIDE_EFFECT_TOOLS.has(name)) {
    const requiresApproval = await isApprovalRequired(userId);
    if (requiresApproval) {
      const partnerId = (args.partner_id ?? args.partnerId) as string | undefined;
      const recipient = (args.to_email ??
        args.to ??
        args.email ??
        args.recipient) as string | undefined;
      const { error: queueError } = await supabase
        .from("ai_pending_actions")
        .insert({
          user_id: userId,
          partner_id: partnerId ? String(partnerId) : null,
          email_address: recipient ? String(recipient) : null,
          action_type: name,
          action_payload: args,
          reasoning: `Agent tool "${name}" intercepted by approval guard (agent_require_approval=true).`,
          confidence: 0.9,
          source: "agent_autonomous",
          status: "pending",
        });

      if (queueError) {
        console.error(`[approval-guard] Failed to queue ${name}:`, queueError);
        return { error: `Impossibile accodare azione "${name}" per approvazione` };
      }

      return {
        success: true,
        queued: true,
        requires_approval: true,
        action_type: name,
        message: `Azione "${name}" accodata per approvazione umana. Non eseguita.`,
      };
    }
  }

  // ═══ ROUTER ═══
  // Dispatches to modular handlers by tool category

  // ── EMAIL TOOLS ──
  switch (name) {
    case "send_email":
      return handleSendEmail(supabase, args, userId, authHeader, context);
    case "send_whatsapp":
      return handleSendWhatsApp(supabase, args, userId, context);
    case "send_linkedin_message":
    case "send_linkedin":
      return handleSendLinkedIn(supabase, args, userId, context);
    case "generate_outreach":
      return handleGenerateOutreach(authHeader, args);
    case "queue_outreach":
      return handleQueueOutreach(supabase, args, userId);
    case "schedule_email":
      return handleScheduleEmail(supabase, args, userId);

    // ── SEARCH TOOLS ──
    case "search_partners":
      return handleSearchPartners(supabase, args);
    case "get_partner_detail":
      return handleGetPartnerDetail(supabase, args);
    case "search_contacts":
      return handleSearchContacts(supabase, args);
    case "get_contact_detail":
      return handleGetContactDetail(supabase, args);
    case "search_prospects":
      return handleSearchProspects(supabase, args);
    case "search_memory":
      return handleSearchMemory(supabase, userId, args);
    case "search_business_cards":
      return handleSearchBusinessCards(supabase, args);
    case "deep_search_partner":
      return handleDeepSearchPartner(supabase, userId, args, authHeader);
    case "deep_search_contact":
      return handleDeepSearchContact(supabase, args);

    // ── CRM TOOLS ──
    case "update_partner":
      return handleUpdatePartner(supabase, args);
    case "add_partner_note":
      return handleAddPartnerNote(supabase, args);
    case "create_reminder":
      return handleCreateReminder(supabase, userId, args);
    case "create_activity":
      return handleCreateActivity(supabase, userId, args);
    case "update_activity":
      return handleUpdateActivity(supabase, args);
    case "list_activities":
      return handleListActivities(supabase, args);
    case "manage_partner_contact":
      return handleManagePartnerContact(supabase, args);
    case "update_reminder":
      return handleUpdateReminder(supabase, args);
    case "update_lead_status":
      return handleUpdateLeadStatus(supabase, args);
    case "bulk_update_partners":
      return handleBulkUpdatePartners(supabase, args);
    case "delete_records":
      return handleDeleteRecords(supabase, userId, args);
    case "get_email_classifications":
      return handleGetEmailClassifications(supabase, userId, args);
    case "assign_contacts_to_agent":
      return handleAssignContactsToAgent(supabase, userId, args);

    // ── ANALYSIS TOOLS ──
    case "get_country_overview":
      return handleGetCountryOverview(supabase, args);
    case "get_directory_status":
      return handleGetDirectoryStatus(supabase, args);
    case "get_global_summary":
      return handleGetGlobalSummary(supabase);
    case "list_jobs":
      return handleListJobs(supabase, args);
    case "check_job_status":
      return handleCheckJobStatus(supabase, args);
    case "get_operations_dashboard":
      return handleGetOperationsDashboard(supabase, userId);
    case "get_system_analytics":
      return handleGetSystemAnalytics(supabase, userId);
    case "analyze_incoming_email":
      return handleAnalyzeIncomingEmail(supabase, userId, args, context);
    case "evaluate_partner":
      return handleEvaluatePartner(supabase, userId, args);
    case "execute_decision":
      return handleExecuteDecision(supabase, userId, args);
    case "undo_ai_action":
      return handleUndoAiAction(supabase, userId, args);
    case "get_approval_dashboard":
      return handleGetApprovalDashboard(supabase, userId);

    // ── DATA TOOLS ──
    case "create_download_job":
      return handleCreateDownloadJob(supabase, args);
    case "download_single_partner":
      return handleDownloadSinglePartner(supabase, args);
    case "get_blacklist":
      return handleGetBlacklist(supabase, userId, args);
    case "list_reminders":
      return handleListReminders(supabase, userId, args);
    case "get_partners_without_contacts":
      return handleGetPartnersWithoutContacts(supabase, args);
    case "get_inbox":
      return handleGetInbox(supabase, userId, args);
    case "get_conversation_history":
      return handleGetConversationHistory(supabase, userId, args);
    case "get_holding_pattern":
      return handleGetHoldingPattern(supabase, userId, args);
    case "update_message_status":
      return handleUpdateMessageStatus(supabase, userId, args);
    case "get_email_thread":
      return handleGetEmailThread(supabase, userId, args);

    // ── AGENT TOOLS ──
    case "create_agent_task":
      return handleCreateAgentTask(supabase, userId, args);
    case "list_agent_tasks":
      return handleListAgentTasks(supabase, userId, args);
    case "get_team_status":
      return handleGetTeamStatus(supabase, userId);
    case "update_agent_prompt":
      return handleUpdateAgentPrompt(supabase, userId, args);
    case "add_agent_kb_entry":
      return handleAddAgentKbEntry(supabase, userId, args);

    // ── WORKFLOW TOOLS ──
    case "create_work_plan":
      return handleCreateWorkPlan(supabase, userId, args);
    case "list_work_plans":
      return handleListWorkPlans(supabase, userId, args);
    case "update_work_plan":
      return handleUpdateWorkPlan(supabase, userId, args);
    case "create_campaign":
      return handleCreateCampaign(supabase, userId, args);

    // ── CONFIG TOOLS ──
    case "manage_workspace_preset":
      return handleManageWorkspacePreset(supabase, userId, args);
    case "get_conversation_context":
      return handleGetConversationContext(supabase, userId, args);
    case "get_address_rules":
      return handleGetAddressRules(supabase, userId, args);
    case "save_memory":
      return handleSaveMemory(supabase, userId, args);
    case "detect_language":
      return handleDetectLanguage(args);
    case "get_pending_actions":
      return handleGetPendingActions(supabase, userId, args);
    case "approve_ai_action":
      return handleApproveAiAction(supabase, userId, args);
    case "reject_ai_action":
      return handleRejectAiAction(supabase, userId, args);
    case "execute_ui_action":
      return handleExecuteUiAction(args);

    // ── EXTERNAL TOOLS ──
    case "enrich_partner_website":
      return handleEnrichPartnerWebsite(args, authHeader);
    case "generate_aliases":
      return handleGenerateAliases(args, authHeader);
    case "scan_directory":
      return handleScanDirectory();
    case "suggest_next_contacts":
      return handleSuggestNextContacts(args);

    default:
      return { error: `Tool sconosciuto: ${name}` };
  }
}
