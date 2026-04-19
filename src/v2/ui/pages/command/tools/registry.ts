import type { Tool } from "./types";
import { scrapePartnerTool } from "./scrapePartner";
import { browserNavigateAndExtractTool } from "./browserNavigateAndExtract";
import { browserFillFormTool } from "./browserFillForm";
import { browserAutoCompleteTool } from "./browserAutoComplete";
import { followupBatchTool } from "./followupBatch";
import { agentReportTool } from "./agentReport";
import { campaignStatusTool } from "./campaignStatus";
import { composeEmailTool } from "./composeEmail";
import { searchKbTool } from "./searchKb";
import { dashboardSnapshotTool } from "./dashboardSnapshot";
import { outreachQueueStatusTool } from "./outreachQueueStatus";
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
import { scrapeLinkedInProfileTool } from "./scrapeLinkedInProfile";
import { scrapeCompanyWebsiteTool } from "./scrapeCompanyWebsite";
import { enrichPartnerFromWebTool } from "./enrichPartnerFromWeb";
import { enrichPartnerFromWebsiteTool } from "./enrichPartnerFromWebsite";
import { enrichProspectFromWebsiteTool } from "./enrichProspectFromWebsite";
import { scrapeProspectTool } from "./scrapeProspect";
import { aiQueryTool } from "./aiQueryTool";

const TOOLS: readonly Tool[] = [
  // Composers / special
  composeEmailTool,
  // AI-native query (sostituisce partnerSearch, contactSearch, prospectSearch,
  // deepSearchPartner, scanWcaDirectory). L'AI conosce lo schema e genera la query.
  aiQueryTool,
  // Reads d'azione/contesto specifico
  dashboardSnapshotTool,
  outreachQueueStatusTool,
  followupBatchTool,
  agentReportTool,
  campaignStatusTool,
  searchKbTool,
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
  // Scraper tools (approval required)
  scrapeLinkedInProfileTool,
  scrapeCompanyWebsiteTool,
  enrichPartnerFromWebTool,
  enrichPartnerFromWebsiteTool,
  enrichProspectFromWebsiteTool,
  scrapePartnerTool,
  scrapeProspectTool,
  // Browser-action tools (approval required)
  browserNavigateAndExtractTool,
  browserFillFormTool,
  browserAutoCompleteTool,
];

/* ─── Tool metadata for plan-execution ─── */

const WRITE_TOOL_IDS = new Set([
  "create-contact", "update-contact", "create-partner", "update-partner-status",
  "create-campaign", "enqueue-outreach", "create-agent", "create-kb-entry",
]);

const ACTION_TOOL_IDS = new Set([
  "calculate-lead-scores", "deduplicate-contacts",
  "scrape-linkedin-profile", "scrape-company-website", "enrich-partner-from-web",
  "enrich-partner-from-website", "enrich-prospect-from-website",
  "browser-navigate-extract", "browser-fill-form", "browser-auto-complete",
  "scrape-partner-website", "scrape-prospect-website",
]);

export const TOOL_METADATA = TOOLS.map((t) => ({
  id: t.id,
  label: t.label,
  description: t.description,
  requiresApproval: WRITE_TOOL_IDS.has(t.id) || ACTION_TOOL_IDS.has(t.id),
}));

/**
 * Fast-path keyword match (no network). Returns tool if regex matches.
 * NB: aiQueryTool ha match generico → resta come ultimo fallback prima dell'AI.
 */
function resolveToolFast(prompt: string): Tool | null {
  // Cerca prima tool d'azione (specifici), poi aiQueryTool (generico)
  const specific = TOOLS.filter((t) => t.id !== "ai-query").find((t) => t.match(prompt));
  if (specific) return specific;
  if (aiQueryTool.match(prompt)) return aiQueryTool;
  return null;
}

/**
 * Resolves the best tool for a prompt.
 * 1. Fast keyword match first (free, instant)
 * 2. Falls back to AI decision via ai-assistant edge function
 * 3. Ultimate fallback: aiQueryTool (l'AI proverà a generare una query)
 */
export async function resolveTool(prompt: string): Promise<Tool | null> {
  const fast = resolveToolFast(prompt);
  if (fast) return fast;

  try {
    const decision = await decideToolFromPrompt(
      prompt,
      TOOLS.map((t) => ({ id: t.id, label: t.label, description: t.description })),
    );

    if (decision._tag === "Err" || decision.value.toolId === "none") {
      return aiQueryTool; // fallback: l'AI Query Planner tenterà comunque
    }

    return TOOLS.find((t) => t.id === decision.value.toolId) ?? aiQueryTool;
  } catch {
    return aiQueryTool;
  }
}

export { TOOLS };
