import type { Tool } from "./types";
import { partnerSearchTool } from "./partnerSearch";
import { followupBatchTool } from "./followupBatch";
import { agentReportTool } from "./agentReport";
import { campaignStatusTool } from "./campaignStatus";
import { composeEmailTool } from "./composeEmail";
import { searchKbTool } from "./searchKb";
import { contactSearchTool } from "./contactSearch";
import { prospectSearchTool } from "./prospectSearch";
import { dashboardSnapshotTool } from "./dashboardSnapshot";
import { outreachQueueStatusTool } from "./outreachQueueStatus";
import { deepSearchPartnerTool } from "./deepSearchPartner";
import { deepSearchContactTool } from "./deepSearchContact";
import { createContactTool } from "./createContact";
import { updateContactTool } from "./updateContact";
import { createPartnerTool } from "./createPartner";
import { updatePartnerStatusTool } from "./updatePartnerStatus";
import { createCampaignTool } from "./createCampaign";
import { enqueueOutreachTool } from "./enqueueOutreach";
import { createAgentTool } from "./createAgent";
import { createKbEntryTool } from "./createKbEntry";
import { analyzePartnerTool } from "./analyzePartner";
import { calculateLeadScoresTool } from "./calculateLeadScores";
import { deduplicateContactsTool } from "./deduplicateContacts";
import { decideToolFromPrompt } from "@/v2/io/edge/aiAssistant";

const TOOLS: readonly Tool[] = [
  // Composers / special
  composeEmailTool,
  // Reads
  contactSearchTool,
  partnerSearchTool,
  prospectSearchTool,
  dashboardSnapshotTool,
  outreachQueueStatusTool,
  followupBatchTool,
  agentReportTool,
  campaignStatusTool,
  searchKbTool,
  deepSearchPartnerTool,
  deepSearchContactTool,
  analyzePartnerTool,
  // Writes (approval required)
  createContactTool,
  updateContactTool,
  createPartnerTool,
  updatePartnerStatusTool,
  createCampaignTool,
  enqueueOutreachTool,
  createAgentTool,
  createKbEntryTool,
  calculateLeadScoresTool,
  deduplicateContactsTool,
];

/**
 * Fast-path keyword match (no network). Returns tool if regex matches.
 */
function resolveToolFast(prompt: string): Tool | null {
  return TOOLS.find((t) => t.match(prompt)) ?? null;
}

/**
 * Resolves the best tool for a prompt.
 * 1. Fast keyword match first (free, instant)
 * 2. Falls back to AI decision via ai-assistant edge function
 */
export async function resolveTool(
  prompt: string,
  history: { role: string; content: string }[] = [],
): Promise<Tool | null> {
  // Fast-path: keyword match
  const fast = resolveToolFast(prompt);
  if (fast) return fast;

  // AI fallback
  try {
    const decision = await decideToolFromPrompt(
      prompt,
      TOOLS.map((t) => ({ id: t.id, label: t.label, description: t.description })),
      history,
    );

    if (decision._tag === "Err" || decision.value.toolId === "none") {
      return null;
    }

    return TOOLS.find((t) => t.id === decision.value.toolId) ?? null;
  } catch {
    // If AI call fails, return null gracefully
    return null;
  }
}

export { TOOLS };
