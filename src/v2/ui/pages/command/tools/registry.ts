import type { Tool } from "./types";
import { partnerSearchTool } from "./partnerSearch";
import { followupBatchTool } from "./followupBatch";

const TOOLS: readonly Tool[] = [followupBatchTool, partnerSearchTool];

export function resolveTool(prompt: string): Tool | null {
  return TOOLS.find((t) => t.match(prompt)) ?? null;
}
