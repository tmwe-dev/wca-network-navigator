import type { Tool } from "./types";
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
import { aiQueryTool } from "./aiQueryTool";
import { scrapeCompanyWebsiteTool } from "./scrapeCompanyWebsite";
import { scrapeLinkedInProfileTool } from "./scrapeLinkedInProfile";
import { scrapePartnerTool } from "./scrapePartner";
import { scrapeProspectTool } from "./scrapeProspect";
import { enrichPartnerFromWebTool } from "./enrichPartnerFromWeb";
import { enrichPartnerFromWebsiteTool } from "./enrichPartnerFromWebsite";
import { enrichProspectFromWebsiteTool } from "./enrichProspectFromWebsite";
import { browserAutoCompleteTool } from "./browserAutoComplete";
import { browserFillFormTool } from "./browserFillForm";
import { browserNavigateAndExtractTool } from "./browserNavigateAndExtract";
import { sendWhatsappTool } from "./sendWhatsapp";
import { sendLinkedinTool } from "./sendLinkedin";
import { launchMissionTool } from "./launchMission";
import { dailyBriefingTool } from "./dailyBriefing";
import { parseBusinessCardTool } from "./parseBusinessCard";
import { kbIngestDocumentTool } from "./kbIngestDocument";
import { sendEmailDirectTool } from "./sendEmailDirect";
import { deepSearchPartnerTool } from "./deepSearchPartner";
import { deduplicatePartnersTool } from "./deduplicatePartners";
import { recalculatePartnerQualityTool } from "./recalculatePartnerQuality";
import { applyEmailRulesTool } from "./applyEmailRules";
import { suggestEmailGroupsTool } from "./suggestEmailGroups";
import { syncBusinessCardsTool } from "./syncBusinessCards";
import { countryKbGeneratorTool } from "./countryKbGenerator";
import { optimusAnalyzeTool } from "./optimusAnalyze";
import { exportAuditCsvTool } from "./exportAuditCsv";
import { healthCheckTool } from "./healthCheck";
import { pendingActionExecutorTool } from "./pendingActionExecutor";
import { scrapeWebsiteTool } from "./scrapeWebsite";
import { wcaCountryCountsTool } from "./wcaCountryCounts";
import { linkedinProfileApiTool } from "./linkedinProfileApi";
import { analyzeEmailEditTool } from "./analyzeEmailEdit";
import { analyzeImportStructureTool } from "./analyzeImportStructure";
import { manageEmailFoldersTool } from "./manageEmailFolders";
import { harmonizeProposalChatTool } from "./harmonizeProposalChat";
import { replayDomainEventsTool } from "./replayDomainEvents";
import { scheduleActivityTool } from "./scheduleActivity";
import { decideToolFromPrompt } from "@/v2/io/edge/aiAssistant";

const TOOLS: readonly Tool[] = [
  // Composers / special
  composeEmailTool,
  // Reads
  dashboardSnapshotTool,
  outreachQueueStatusTool,
  dailyBriefingTool,
  followupBatchTool,
  agentReportTool,
  campaignStatusTool,
  searchKbTool,
  deepSearchContactTool,
  deepSearchPartnerTool,
  analyzePartnerTool,
  optimusAnalyzeTool,
  suggestEmailGroupsTool,
  exportAuditCsvTool,
  healthCheckTool,
  wcaCountryCountsTool,
  linkedinProfileApiTool,
  scrapeWebsiteTool,
  analyzeEmailEditTool,
  analyzeImportStructureTool,
  // Writes (approval required)
  createContactTool,
  updateContactTool,
  createPartnerTool,
  updatePartnerStatusTool,
  createCampaignTool,
  enqueueOutreachTool,
  sendWhatsappTool,
  sendLinkedinTool,
  sendEmailDirectTool,
  launchMissionTool,
  pendingActionExecutorTool,
  parseBusinessCardTool,
  kbIngestDocumentTool,
  syncBusinessCardsTool,
  countryKbGeneratorTool,
  applyEmailRulesTool,
  manageEmailFoldersTool,
  harmonizeProposalChatTool,
  replayDomainEventsTool,
  createAgentTool,
  scheduleActivityTool,
  createKbEntryTool,
  calculateLeadScoresTool,
  deduplicateContactsTool,
  deduplicatePartnersTool,
  recalculatePartnerQualityTool,
  // Scraping & enrichment (write — require approval)
  scrapePartnerTool,
  scrapeProspectTool,
  scrapeCompanyWebsiteTool,
  scrapeLinkedInProfileTool,
  enrichPartnerFromWebTool,
  enrichPartnerFromWebsiteTool,
  enrichProspectFromWebsiteTool,
  // Browser automation (write — require approval)
  browserAutoCompleteTool,
  browserFillFormTool,
  browserNavigateAndExtractTool,
  // GENERIC AI READ — must be LAST (catch-all for any "mostra/quanti/cerca …" query).
  // Specific tools above win because their match() is more selective.
  aiQueryTool,
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

/**
 * Lightweight metadata for tools, used by planner to determine approval requirements.
 * Marks write/mutation tools as requiring approval before execution.
 */
const WRITE_TOOL_IDS = new Set<string>([
  "create-contact",
  "update-contact",
  "create-partner",
  "update-partner-status",
  "create-campaign",
  "enqueue-outreach",
  "create-agent",
  "create-kb-entry",
  "calculate-lead-scores",
  "deduplicate-contacts",
  "compose-email",
  "send-whatsapp",
  "send-linkedin",
  "launch-mission",
  "parse-business-card",
  "kb-ingest-document",
  "send-email-direct",
  "deduplicate-partners",
  "recalculate-partner-quality",
  "apply-email-rules",
  "sync-business-cards",
  "country-kb-generator",
  "pending-action-executor",
  "manage-email-folders",
  "harmonize-proposal-chat",
  "replay-domain-events",
  "schedule-activity",
  "scrape-partner-website",
  "scrape-prospect-website",
  "scrape-company-website",
  "scrape-linkedin-profile",
  "enrich-partner-from-web",
  "enrich-partner-from-website",
  "enrich-prospect-from-website",
  "browser-auto-complete",
  "browser-fill-form",
  "browser-navigate-extract",
]);

export interface ToolMetadata {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly requiresApproval: boolean;
}

export const TOOL_METADATA: readonly ToolMetadata[] = TOOLS.map((t) => ({
  id: t.id,
  label: t.label,
  description: t.description,
  requiresApproval: WRITE_TOOL_IDS.has(t.id),
}));
