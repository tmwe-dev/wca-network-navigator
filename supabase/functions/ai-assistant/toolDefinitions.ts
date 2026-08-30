/**
 * toolDefinitions.ts — Master index of AI tool definitions.
 * Imports from category-specific files and combines into single array.
 */

import { DATA_ACCESS_TOOLS } from "./toolDefs-dataAccess.ts";
import { WRITING_TOOLS } from "./toolDefs-writing.ts";
import { PLANNING_TOOLS } from "./toolDefs-planning.ts";
import { ENTERPRISE_TOOLS } from "./toolDefs-enterprise.ts";

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  ...DATA_ACCESS_TOOLS,
  ...WRITING_TOOLS,
  ...PLANNING_TOOLS,
  ...ENTERPRISE_TOOLS,
];

/**
 * Sottoinsieme SOLO-LETTURA usato dal canale VOCE (Aurora / Command vocale).
 * La voce deve poter cercare dati reali, ma non deve mai scrivere, inviare
 * o modificare nulla: le azioni restano sul canale testuale con approvazione.
 */
const VOICE_READONLY_TOOL_NAMES = new Set<string>([
  "find_anything",
  "inspect_field",
  "describe_tables",
  "search_partners",
  "get_partner_detail",
  "get_country_overview",
  "get_global_summary",
  "get_partners_without_contacts",
  "search_contacts",
  "get_contact_detail",
  "search_prospects",
  "search_business_cards",
  "list_activities",
  "list_reminders",
  "list_jobs",
  "check_job_status",
  "check_blacklist",
  "search_kb",
  "search_memory",
  "get_pending_actions",
  "get_email_classifications",
  "get_conversation_context",
  "get_procedure",
]);

export const VOICE_TOOL_DEFINITIONS: ToolDefinition[] = TOOL_DEFINITIONS.filter((t) =>
  VOICE_READONLY_TOOL_NAMES.has(t.function.name),
);
