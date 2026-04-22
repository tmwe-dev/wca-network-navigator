// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TOOL DEFINITIONS (main export aggregator)
// Re-exports all category-based tools for backward compatibility
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { PARTNER_TOOLS } from "./toolDefs-partner.ts";
import { ENRICHMENT_TOOLS } from "./toolDefs-enrichment.ts";
import { MEMORY_TOOLS } from "./toolDefs-memory.ts";
import { CONTACT_TOOLS } from "./toolDefs-contact.ts";
import { ACTIVITY_TOOLS } from "./toolDefs-activity.ts";
import { COMMUNICATION_TOOLS } from "./toolDefs-communication.ts";
import { AGENT_TOOLS } from "./toolDefs-agent.ts";
import { OPERATIONS_TOOLS } from "./toolDefs-operations.ts";
import { PLANNING_TOOLS } from "./toolDefs-planning.ts";
import { APPROVAL_TOOLS } from "./toolDefs-approval.ts";

// Main aggregated export for backward compatibility
export const ALL_TOOLS: Record<string, unknown> = {
  ...PARTNER_TOOLS,
  ...ENRICHMENT_TOOLS,
  ...MEMORY_TOOLS,
  ...CONTACT_TOOLS,
  ...ACTIVITY_TOOLS,
  ...COMMUNICATION_TOOLS,
  ...AGENT_TOOLS,
  ...OPERATIONS_TOOLS,
  ...PLANNING_TOOLS,
  ...APPROVAL_TOOLS,
};

// Category exports for selective imports
export {
  PARTNER_TOOLS,
  ENRICHMENT_TOOLS,
  MEMORY_TOOLS,
  CONTACT_TOOLS,
  ACTIVITY_TOOLS,
  COMMUNICATION_TOOLS,
  AGENT_TOOLS,
  OPERATIONS_TOOLS,
  PLANNING_TOOLS,
  APPROVAL_TOOLS,
};
