/**
 * platformToolHandlers.ts - Main orchestrator for tool execution
 * Routes tool calls to appropriate handler modules
 */

import { handleSearchPartners, handleGetPartnerDetail, handleGetCountryOverview } from "./partnersSearchHandler.ts";
import { handleUpdatePartner, handleAddPartnerNote, handleBulkUpdatePartners } from "./partnersUpdateHandler.ts";
import { handleSearchContacts, handleGetContactDetail, handleUpdateLeadStatus } from "./contactsHandler.ts";
import { handleSearchProspects } from "./prospectsHandler.ts";
import { handleListActivities, handleCreateActivity, handleUpdateActivity } from "./activitiesHandler.ts";
import { handleListReminders, handleCreateReminder } from "./remindersHandler.ts";
import { handleSaveMemory, handleSearchMemory } from "./memoryHandler.ts";
import { handleGenerateOutreach, handleSendEmail, handleScheduleEmail, handleQueueOutreach } from "./outreachHandler.ts";
import { handleGetInbox, handleGetEmailThread } from "./conversationsInboxHandler.ts";
import { handleGetConversationHistory } from "./conversationsHistoryHandler.ts";
import { handleGetHoldingPattern } from "./holdingPatternHandler.ts";
import { handleGetDirectoryStatus, handleDeepSearchPartner, handleDeepSearchContact } from "./searchHandler.ts";
import { handleSearchBusinessCards } from "./businessCardsHandler.ts";
import { handleGetGlobalSummary, handleCheckBlacklist, handleGetOperationsDashboard } from "./systemHandler.ts";
import { handleManagePartnerContact } from "./contactManagementHandler.ts";
import { handleExecuteUIAction, handleCreateAgentTask, handleListAgentTasks, handleGetTeamStatus } from "./agentHandler.ts";
import { handleCreateWorkPlan, handleListWorkPlans } from "./workPlansHandler.ts";
import { handleGenerateAliases } from "./aliasesHandler.ts";
import { handleDeleteRecords } from "./deleteHandler.ts";

export async function executePlatformTool(
  name: string,
  args: Record<string, unknown>,
  userId: string,
  authHeader: string
): Promise<unknown> {
  switch (name) {
    // ── Partners ──
    case "search_partners":
      return handleSearchPartners(args);
    case "get_partner_detail":
      return handleGetPartnerDetail(args);
    case "get_country_overview":
      return handleGetCountryOverview(args);
    case "update_partner":
      return handleUpdatePartner(args);
    case "add_partner_note":
      return handleAddPartnerNote(args);
    case "bulk_update_partners":
      return handleBulkUpdatePartners(args);

    // ── Contacts ──
    case "search_contacts":
      return handleSearchContacts(args);
    case "get_contact_detail":
      return handleGetContactDetail(args);
    case "update_lead_status":
      return handleUpdateLeadStatus(args);

    // ── Prospects ──
    case "search_prospects":
      return handleSearchProspects(args);

    // ── Activities ──
    case "list_activities":
      return handleListActivities(args);
    case "create_activity":
      return handleCreateActivity(args, userId);
    case "update_activity":
      return handleUpdateActivity(args);

    // ── Reminders ──
    case "list_reminders":
      return handleListReminders(args);
    case "create_reminder":
      return handleCreateReminder(args, userId);

    // ── Memory ──
    case "save_memory":
      return handleSaveMemory(args, userId);
    case "search_memory":
      return handleSearchMemory(args, userId);

    // ── Outreach & Email ──
    case "generate_outreach":
      return handleGenerateOutreach(args, authHeader);
    case "send_email":
      return handleSendEmail(args, authHeader);
    case "schedule_email":
      return handleScheduleEmail(args, userId);
    case "queue_outreach":
      return handleQueueOutreach(args, userId);

    // ── Inbox & Conversations ──
    case "get_inbox":
      return handleGetInbox(args, userId);
    case "get_conversation_history":
      return handleGetConversationHistory(args, userId);
    case "get_email_thread":
      return handleGetEmailThread(args, userId);
    case "get_holding_pattern":
      return handleGetHoldingPattern(args);

    // ── Directory & Deep Search ──
    case "get_directory_status":
      return handleGetDirectoryStatus(args);
    case "deep_search_partner":
      return handleDeepSearchPartner(args, authHeader);
    case "deep_search_contact":
      return handleDeepSearchContact(args, authHeader);

    // ── Business Cards ──
    case "search_business_cards":
      return handleSearchBusinessCards(args);

    // ── System ──
    case "get_global_summary":
      return handleGetGlobalSummary();
    case "check_blacklist":
      return handleCheckBlacklist(args);
    case "get_operations_dashboard":
      return handleGetOperationsDashboard(userId);

    // ── Contact Management ──
    case "manage_partner_contact":
      return handleManagePartnerContact(args);

    // ── UI Actions ──
    case "execute_ui_action":
      return handleExecuteUIAction(args);

    // ── Agent Management ──
    case "create_agent_task":
      return handleCreateAgentTask(args, userId);
    case "list_agent_tasks":
      return handleListAgentTasks(args, userId);
    case "get_team_status":
      return handleGetTeamStatus(userId);

    // ── Work Plans ──
    case "create_work_plan":
      return handleCreateWorkPlan(args, userId);
    case "list_work_plans":
      return handleListWorkPlans(args, userId);

    // ── Aliases ──
    case "generate_aliases":
      return handleGenerateAliases(args, authHeader);

    // ── Delete ──
    case "delete_records":
      return handleDeleteRecords(args, userId);

    default:
      return { error: `Tool sconosciuto: ${name}` };
  }
}
