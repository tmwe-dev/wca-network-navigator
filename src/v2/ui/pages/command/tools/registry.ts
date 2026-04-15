import type { Tool } from "./types";
import { partnerSearchTool } from "./partnerSearch";

const TOOLS: readonly Tool[] = [partnerSearchTool];

export function resolveTool(prompt: string): Tool | null {
  return TOOLS.find((t) => t.match(prompt)) ?? null;
}
