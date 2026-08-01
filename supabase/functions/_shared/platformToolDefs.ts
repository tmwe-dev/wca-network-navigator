/**
 * platformToolDefs.ts — Central barrel export for all platform tools.
 *
 * Maintains backward compatibility by re-exporting all tool definitions
 * from category-specific modules.
 */

import { PARTNERS_TOOLS } from "./platformToolDefs/partnersTools.ts";
import { CRM_TOOLS } from "./platformToolDefs/crmTools.ts";
import { ACTIVITIES_TOOLS } from "./platformToolDefs/activitiesTools.ts";
import { MEMORY_TOOLS } from "./platformToolDefs/memoryTools.ts";
import { OUTREACH_TOOLS } from "./platformToolDefs/outreachTools.ts";
import { CONVERSATION_TOOLS } from "./platformToolDefs/conversationTools.ts";
import { SEARCH_TOOLS } from "./platformToolDefs/searchTools.ts";
import { BUSINESS_CARD_TOOLS } from "./platformToolDefs/businessCardTools.ts";
import { SYSTEM_TOOLS } from "./platformToolDefs/systemTools.ts";
import { CONTACT_MANAGEMENT_TOOLS } from "./platformToolDefs/contactManagementTools.ts";
import { UI_TOOLS } from "./platformToolDefs/uiTools.ts";
import { AGENT_TOOLS } from "./platformToolDefs/agentTools.ts";
import { WORK_PLAN_TOOLS } from "./platformToolDefs/workPlanTools.ts";
import { ALIAS_TOOLS } from "./platformToolDefs/aliasTools.ts";
import { DELETE_TOOLS } from "./platformToolDefs/deleteTools.ts";

/**
 * PLATFORM_TOOLS — Combined array of all tool definitions.
 * Aggregates tools from all category modules for backward compatibility.
 */
export const PLATFORM_TOOLS = [
  ...PARTNERS_TOOLS,
  ...CRM_TOOLS,
  ...ACTIVITIES_TOOLS,
  ...MEMORY_TOOLS,
  ...OUTREACH_TOOLS,
  ...CONVERSATION_TOOLS,
  ...SEARCH_TOOLS,
  ...BUSINESS_CARD_TOOLS,
  ...SYSTEM_TOOLS,
  ...CONTACT_MANAGEMENT_TOOLS,
  ...UI_TOOLS,
  ...AGENT_TOOLS,
  ...WORK_PLAN_TOOLS,
  ...ALIAS_TOOLS,
  ...DELETE_TOOLS,
];

// Re-export individual tool categories for direct imports
export {
  PARTNERS_TOOLS,
  CRM_TOOLS,
  ACTIVITIES_TOOLS,
  MEMORY_TOOLS,
  OUTREACH_TOOLS,
  CONVERSATION_TOOLS,
  SEARCH_TOOLS,
  BUSINESS_CARD_TOOLS,
  SYSTEM_TOOLS,
  CONTACT_MANAGEMENT_TOOLS,
  UI_TOOLS,
  AGENT_TOOLS,
  WORK_PLAN_TOOLS,
  ALIAS_TOOLS,
  DELETE_TOOLS,
};
