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
