import type { Tool } from "./types";
import { partnerSearchTool } from "./partnerSearch";
import { followupBatchTool } from "./followupBatch";
import { agentReportTool } from "./agentReport";
import { campaignStatusTool } from "./campaignStatus";

const TOOLS: readonly Tool[] = [campaignStatusTool, agentReportTool, followupBatchTool, partnerSearchTool];

export function resolveTool(prompt: string): Tool | null {
  return TOOLS.find((t) => t.match(prompt)) ?? null;
}
