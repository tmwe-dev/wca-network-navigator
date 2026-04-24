/**
 * toolExecutors.ts — Tool execution handlers + dispatcher (refactored barrel).
 * Re-exports main executor function for backward compatibility.
 * Extracted from ai-assistant/index.ts (lines 1383-2696).
 *
 * Refactored into modular components under toolExecutors/:
 * - procedures.ts — Procedure knowledge base (47 lines)
 * - wcaIdResolver.ts — WCA ID resolution for batch jobs (123 lines)
 * - downloadJobs.ts — Download job creation executor (118 lines)
 * - partnerLookup.ts — Partner/company name lookup helpers (124 lines)
 * - partnerDownload.ts — Single partner download executor (138 lines)
 * - email.ts — Email classification & context (65 lines)
 * - aiActions.ts — AI pending actions (129 lines)
 * - crm.ts — Contact & campaign management (123 lines)
 * - agents.ts — Agent management (118 lines)
 * - system.ts — System-level tools (42 lines)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

import { executeGetProcedure } from "./toolExecutors/procedures.ts";
import { executeCreateDownloadJob } from "./toolExecutors/downloadJobs.ts";
import { executeDownloadSinglePartner } from "./toolExecutors/partnerDownload.ts";
import {
  executeGetEmailClassifications,
  executeGetConversationContext,
  executeGetAddressRules,
} from "./toolExecutors/email.ts";
import {
  executeGetPendingActions,
  executeApproveAiAction,
  executeRejectAiAction,
  executeSuggestNextContacts,
  executeDetectLanguage,
} from "./toolExecutors/aiActions.ts";
import {
  executeCreateContact,
  executeCreateCampaign,
  executeScheduleEmail,
} from "./toolExecutors/crm.ts";
import {
  executeUpdateAgentPrompt,
  executeAddAgentKbEntry,
} from "./toolExecutors/agents.ts";
import { executeRunKbAudit } from "./toolExecutors/system.ts";

type SupabaseClient = ReturnType<typeof createClient>;

interface ReadHandlers {
  executeSearchPartners: Function;
  executeCountryOverview: Function;
  executeDirectoryStatus: Function;
  executeListJobs: Function;
  executePartnerDetail: Function;
  executeGlobalSummary: Function;
  executeCheckBlacklist: Function;
  executeListReminders: Function;
  executePartnersWithoutContacts: Function;
  executeSearchContacts: Function;
  executeGetContactDetail: Function;
  executeSearchProspects: Function;
  executeListActivities: Function;
  executeSearchBusinessCards: Function;
  executeCheckJobStatus: Function;
}

interface WriteHandlers {
  executeUpdatePartner: Function;
  executeAddPartnerNote: Function;
  executeCreateReminder: Function;
  executeUpdateLeadStatus: Function;
  executeBulkUpdatePartners: Function;
  executeLinkBusinessCard: Function;
  executeCreateActivity: Function;
  executeUpdateActivity: Function;
  executeManagePartnerContact: Function;
  executeUpdateReminder: Function;
  executeDeleteRecords: Function;
  executeGenerateOutreach: Function;
  executeSendEmail: Function;
  executeDeepSearchPartner: Function;
  executeDeepSearchContact: Function;
  executeEnrichPartnerWebsite: Function;
  executeScanDirectory: Function;
  executeGenerateAliases: Function;
}

interface EnterpriseHandlers {
  executeSaveMemory: Function;
  executeSearchMemory: Function;
  executeCreateWorkPlan: Function;
  executeExecutePlanStep: Function;
  executeGetActivePlans: Function;
  executeSaveAsTemplate: Function;
  executeSearchTemplates: Function;
  executeSaveKbRule: Function;
  executeSaveOperativePrompt: Function;
  executeListWorkflows: Function;
  executeStartWorkflow: Function;
  executeAdvanceWorkflowGate: Function;
  executeListPlaybooks: Function;
  executeApplyPlaybook: Function;
  executeUiAction: Function;
  executeSearchKb: Function;
}

export interface ToolExecutorDeps {
  // deno-lint-ignore no-explicit-any
  supabase: any;
  readH: ReadHandlers;
  writeH: WriteHandlers;
  entH: EnterpriseHandlers;
}

/**
 * Main tool dispatcher — routes tool calls to appropriate handlers.
 * Integrates all modular tool executors from toolExecutors/ directory.
 */
export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  deps: ToolExecutorDeps,
  userId?: string,
  authHeader?: string,
): Promise<unknown> {
  const { supabase, readH, writeH, entH } = deps;

  // ── Read handlers (shared module) ──
  const readMap: Record<string, () => Promise<unknown>> = {
    search_partners: () => readH.executeSearchPartners(args, userId),
    get_country_overview: () => readH.executeCountryOverview(args),
    get_directory_status: () => readH.executeDirectoryStatus(args),
    list_jobs: () => readH.executeListJobs(args, userId),
    get_partner_detail: () => readH.executePartnerDetail(args, userId),
    get_global_summary: () => readH.executeGlobalSummary(),
    check_blacklist: () => readH.executeCheckBlacklist(args),
    list_reminders: () => readH.executeListReminders(args, userId),
    get_partners_without_contacts: () =>
      readH.executePartnersWithoutContacts(args),
    search_contacts: () => readH.executeSearchContacts(args, userId),
    get_contact_detail: () => readH.executeGetContactDetail(args, userId),
    search_prospects: () => readH.executeSearchProspects(args, userId),
    list_activities: () => readH.executeListActivities(args, userId),
    search_business_cards: () => readH.executeSearchBusinessCards(args, userId),
    check_job_status: () => readH.executeCheckJobStatus(args, userId),
  };
  if (readMap[name]) return readMap[name]();

  // ── Write handlers (shared module) ──
  const writeMap: Record<string, () => Promise<unknown>> = {
    add_partner_note: () => writeH.executeAddPartnerNote(args),
    update_lead_status: () => writeH.executeUpdateLeadStatus(args),
    link_business_card: () => writeH.executeLinkBusinessCard(args),
    update_activity: () => writeH.executeUpdateActivity(args),
    manage_partner_contact: () => writeH.executeManagePartnerContact(args),
    update_reminder: () => writeH.executeUpdateReminder(args),
  };
  if (writeMap[name]) return writeMap[name]();

  // Write handlers needing authHeader / userId
  const writeAuthMap: Record<string, () => Promise<unknown>> = {
    update_partner: () => writeH.executeUpdatePartner(args, userId!),
    bulk_update_partners: () =>
      writeH.executeBulkUpdatePartners(args, userId!),
    create_reminder: () => writeH.executeCreateReminder(args, userId!),
    create_activity: () => writeH.executeCreateActivity(args, userId!),
    delete_records: () => writeH.executeDeleteRecords(args, userId!),
    generate_outreach: () => writeH.executeGenerateOutreach(args, authHeader!),
    send_email: () => writeH.executeSendEmail(args, authHeader!, userId!),
    deep_search_partner: () =>
      writeH.executeDeepSearchPartner(args, authHeader!),
    deep_search_contact: () =>
      writeH.executeDeepSearchContact(args, authHeader!),
    enrich_partner_website: () =>
      writeH.executeEnrichPartnerWebsite(args, authHeader!),
    scan_directory: () => writeH.executeScanDirectory(args, authHeader!),
    generate_aliases: () => writeH.executeGenerateAliases(args, authHeader!),
  };
  if (writeAuthMap[name]) return userId ? writeAuthMap[name]() : { error: "Auth required" };

  // ── Enterprise handlers (shared module) ──
  const entAuthMap: Record<string, () => Promise<unknown>> = {
    save_memory: () => entH.executeSaveMemory(args, userId!),
    search_memory: () => entH.executeSearchMemory(args, userId!),
    create_work_plan: () => entH.executeCreateWorkPlan(args, userId!),
    execute_plan_step: () =>
      entH.executeExecutePlanStep(args, userId!, authHeader),
    get_active_plans: () => entH.executeGetActivePlans(userId!),
    save_as_template: () => entH.executeSaveAsTemplate(args, userId!),
    search_templates: () => entH.executeSearchTemplates(args, userId!),
    save_kb_rule: () => entH.executeSaveKbRule(args, userId!),
    save_operative_prompt: () =>
      entH.executeSaveOperativePrompt(args, userId!),
    list_workflows: () => entH.executeListWorkflows(args, userId!),
    start_workflow: () => entH.executeStartWorkflow(args, userId!),
    advance_workflow_gate: () =>
      entH.executeAdvanceWorkflowGate(args, userId!),
    list_playbooks: () => entH.executeListPlaybooks(args, userId!),
    apply_playbook: () => entH.executeApplyPlaybook(args, userId!),
  };
  if (entAuthMap[name]) {
    return userId ? entAuthMap[name]() : { error: "Auth required" };
  }

  // Enterprise handlers without user requirement
  const entMap: Record<string, () => Promise<unknown>> = {
    execute_ui_action: () => entH.executeUiAction(args),
    search_kb: () => entH.executeSearchKb(args, userId || ""),
  };
  if (entMap[name]) return entMap[name]();

  // ── Modular inline handlers ──

  // Procedures (procedures.ts)
  if (name === "get_procedure") return executeGetProcedure(args);

  // Download jobs (downloadJobs.ts)
  if (name === "create_download_job") {
    return executeCreateDownloadJob(supabase, args);
  }
  if (name === "download_single_partner") {
    return executeDownloadSinglePartner(supabase, args);
  }

  // Email tools (email.ts)
  if (name === "get_email_classifications") {
    return executeGetEmailClassifications(supabase, args, userId);
  }
  if (name === "get_conversation_context") {
    return executeGetConversationContext(supabase, args, userId);
  }
  if (name === "get_address_rules") {
    return executeGetAddressRules(supabase, args, userId);
  }

  // AI actions (aiActions.ts)
  if (name === "get_pending_actions") {
    return userId
      ? executeGetPendingActions(supabase, args, userId)
      : { error: "Auth required" };
  }
  if (name === "approve_ai_action") {
    return userId
      ? executeApproveAiAction(supabase, args, userId)
      : { error: "Auth required" };
  }
  if (name === "reject_ai_action") {
    return userId
      ? executeRejectAiAction(supabase, args, userId)
      : { error: "Auth required" };
  }
  if (name === "suggest_next_contacts") {
    return executeSuggestNextContacts(authHeader, args);
  }
  if (name === "detect_language") {
    return executeDetectLanguage(args);
  }

  // CRM tools (crm.ts)
  if (name === "create_contact") {
    return userId
      ? executeCreateContact(supabase, args, userId)
      : { error: "Auth required" };
  }
  if (name === "create_campaign") {
    return userId
      ? executeCreateCampaign(supabase, args, userId)
      : { error: "Auth required" };
  }
  if (name === "schedule_email") {
    return userId
      ? executeScheduleEmail(supabase, args, userId)
      : { error: "Auth required" };
  }

  // Agent tools (agents.ts)
  if (name === "update_agent_prompt") {
    return userId
      ? executeUpdateAgentPrompt(supabase, args, userId)
      : { error: "Auth required" };
  }
  if (name === "add_agent_kb_entry") {
    return userId
      ? executeAddAgentKbEntry(supabase, args, userId)
      : { error: "Auth required" };
  }

  // System tools (system.ts)
  if (name === "run_kb_audit") {
    return userId
      ? executeRunKbAudit(args, userId)
      : { error: "Auth required" };
  }

  return { error: `Tool sconosciuto: ${name}` };
}
