/**
 * platformToolHandlers.ts — Orchestrator for tool execution.
 *
 * Routes tool calls to specialized handler modules.
 * Maintains backward compatibility with executePlatformTool interface.
 */
import {
  executePartnerToolHandler,
  executeContactToolHandler,
  executeProspectToolHandler,
  executeActivityReminderToolHandler,
  executeMemoryToolHandler,
  executeOutreachToolHandler,
  executeInboxToolHandler,
  executeSearchToolHandler,
  executeSystemToolHandler,
  executeContactManagementToolHandler,
  executeAgentToolHandler,
} from "./platformToolHandlers/index.ts";

export async function executePlatformTool(
  name: string,
  args: Record<string, unknown>,
  userId: string,
  authHeader: string,
): Promise<unknown> {
  // ── Partners ──
  if (
    name === "search_partners" ||
    name === "get_partner_detail" ||
    name === "get_country_overview" ||
    name === "update_partner" ||
    name === "add_partner_note" ||
    name === "bulk_update_partners"
  ) {
    return executePartnerToolHandler(name, args, userId, authHeader);
  }

  // ── Contacts ──
  if (
    name === "search_contacts" ||
    name === "get_contact_detail" ||
    name === "update_lead_status"
  ) {
    return executeContactToolHandler(name, args, userId, authHeader);
  }

  // ── Prospects ──
  if (name === "search_prospects") {
    return executeProspectToolHandler(name, args, userId, authHeader);
  }

  // ── Activities & Reminders ──
  if (
    name === "list_activities" ||
    name === "create_activity" ||
    name === "update_activity" ||
    name === "list_reminders" ||
    name === "create_reminder"
  ) {
    return executeActivityReminderToolHandler(name, args, userId, authHeader);
  }

  // ── Memory ──
  if (name === "save_memory" || name === "search_memory") {
    return executeMemoryToolHandler(name, args, userId, authHeader);
  }

  // ── Outreach & Email ──
  if (
    name === "generate_outreach" ||
    name === "send_email" ||
    name === "schedule_email" ||
    name === "queue_outreach"
  ) {
    return executeOutreachToolHandler(name, args, userId, authHeader);
  }

  // ── Inbox & Conversations ──
  if (
    name === "get_inbox" ||
    name === "get_conversation_history" ||
    name === "get_email_thread" ||
    name === "get_holding_pattern"
  ) {
    return executeInboxToolHandler(name, args, userId, authHeader);
  }

  // ── Directory & Deep Search ──
  if (
    name === "get_directory_status" ||
    name === "deep_search_partner" ||
    name === "deep_search_contact"
  ) {
    return executeSearchToolHandler(name, args, userId, authHeader);
  }

  // ── Business Cards & System ──
  if (
    name === "search_business_cards" ||
    name === "get_global_summary" ||
    name === "check_blacklist" ||
    name === "get_operations_dashboard"
  ) {
    return executeSystemToolHandler(name, args, userId, authHeader);
  }

  // ── Contact Management ──
  if (name === "manage_partner_contact" || name === "execute_ui_action") {
    return executeContactManagementToolHandler(name, args, userId, authHeader);
  }

  // ── Agent Management, Work Plans, Aliases, Delete ──
  if (
    name === "create_agent_task" ||
    name === "list_agent_tasks" ||
    name === "get_team_status" ||
    name === "create_work_plan" ||
    name === "list_work_plans" ||
    name === "generate_aliases" ||
    name === "delete_records"
  ) {
    return executeAgentToolHandler(name, args, userId, authHeader);
  }

  return { error: `Tool sconosciuto: ${name}` };
}
