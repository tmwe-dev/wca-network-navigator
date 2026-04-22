/**
 * contextAssembler.ts — Orchestrator for loading all contextual data from DB.
 *
 * Main entry point that imports and coordinates specialized loaders.
 * Maintains backward-compatible exports.
 *
 * Specialized modules:
 * - aliasPreparation: Auto-generate and persist missing aliases
 * - dataLoader: Load partner metadata (networks, services, settings, social links)
 * - styleContextAssembler: Load style preferences, edit patterns, response insights
 * - commercialIntelligenceAssembler: Load relationship metrics, branches, commercial state
 * - enrichmentContextAssembler: Load enrichment data and deep search scoring
 * - documentAndSignatureAssembler: Load reference documents and build signature blocks
 * - kbAndPlaybookAssembler: Load sales KB and active playbook
 * - kbAssembler: KB loading strategies
 * - aliasGenerator: LLM-based alias generation
 * - entityLoader: Partner and contact loading
 * - conversationIntel: Email rules and conversation context
 * - playbookLoader: Active workflow playbooks
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import type { Quality } from "../_shared/kbSlice.ts";
import type { PartnerData, ContactData, NetworkRow, ServiceRow, SocialLinkRow } from "./promptBuilder.ts";
import { generateAliasesInline } from "./aliasGenerator.ts";
import {
  loadEntityFromActivity,
  loadStandalonePartner,
  loadMetInPerson,
  type LoadedEntity,
} from "./entityLoader.ts";
import {
  loadConversationContext,
  buildConversationBlock,
  buildPriorityAddressPromptBlock,
  type ConversationIntelligence,
} from "./conversationIntel.ts";
import { ensureAliasesExist } from "./aliasPreparation.ts";
import { loadPartnerMetadata, type LoadedMetadata } from "./dataLoader.ts";
import { assembleStyleContext, type StyleContext } from "./styleContextAssembler.ts";
import { checkDuplicateContact, assembleCommercialIntelligence, type CommercialIntelligence } from "./commercialIntelligenceAssembler.ts";
import { assembleEnrichmentContext, type EnrichmentContext } from "./enrichmentContextAssembler.ts";
import { assembleDocumentsAndSignature, type DocumentsAndSignature } from "./documentAndSignatureAssembler.ts";
import { assembleKbAndPlaybook, type KbAndPlaybook } from "./kbAndPlaybookAssembler.ts";

type SupabaseClient = ReturnType<typeof createClient>;

// ── Context Blocks Type ──

export interface ContextBlocks {
  historyContext: string;
  relationshipBlock: string;
  branchBlock: string;
  interlocutorBlock: string;
  metInPersonContext: string;
  cachedEnrichmentContext: string;
  documentsContext: string;
  stylePreferencesContext: string;
  editPatternsContext: string;
  responseInsightsContext: string;
  conversationIntelligenceContext: string;
  salesKBSlice: string;
  salesKBSections: string[];
  signatureBlock: string;
  networks: NetworkRow[];
  services: ServiceRow[];
  socialLinks: SocialLinkRow[];
  settings: Record<string, string>;
  // ── Commercial state (Doctrine L0 / Holding Pattern awareness) ──
  commercialState?: string;
  touchCount?: number;
  daysSinceLastContact?: number;
  warmthScore?: number;
  lastChannel?: string;
  lastOutcome?: string;
  // ── Fix 3.2: active playbook (governs tone/content/CTA) ──
  playbookBlock?: string;
  playbookActive?: boolean;
  // ── Fix (email_address_rules propagation) ──
  addressCustomPrompt?: string;
  addressCategory?: string;
  // ── Deep Search status (per _context_summary) ──
  deepSearchStatus?: "fresh" | "cached" | "stale" | "missing" | "skipped" | "failed";
  deepSearchAgeDays?: number | null;
  // ── Oracle enrichment metadata ──
  enrichmentAgeDays?: number | null;
  sherlockLevel?: number;
  lastDeepSearchScore?: number;
}

// ── Backward-compatible exports ──

export { generateAliasesInline } from "./aliasGenerator.ts";
export {
  loadEntityFromActivity,
  loadStandalonePartner,
  type LoadedEntity,
} from "./entityLoader.ts";
export {
  loadConversationContext,
  buildConversationBlock,
  buildPriorityAddressPromptBlock,
  type ConversationIntelligence,
} from "./conversationIntel.ts";

export async function assembleContextBlocks(
  supabase: SupabaseClient,
  userId: string,
  partner: PartnerData,
  contact: ContactData | null,
  contactEmail: string | null,
  sourceType: string,
  quality: Quality,
  standalone: boolean,
  opts: {
    oracle_type?: string;
    use_kb?: boolean;
    document_ids?: string[];
    partner_id?: string;
    activityPartnerId?: string | null;
    deep_search?: boolean;
    authHeader?: string;
    email_type_kb_categories?: string[] | null;
  },
): Promise<ContextBlocks> {
  const isPartnerSource = sourceType === "partner" && partner.id && (!standalone || opts.partner_id);
  const effectivePartnerId = isPartnerSource ? opts.activityPartnerId || partner.id : partner.id;

  // ── Auto-generate aliases if missing ──
  await ensureAliasesExist(supabase, partner, contact, sourceType, standalone);

  // ── Load partner metadata (networks, services, settings, social links) ──
  const metadata = await loadPartnerMetadata(supabase, userId, partner, quality, isPartnerSource);
  const { networks, services, socialLinks, settings } = metadata;

  // ── Load style context (preferences, edit patterns, response insights) ──
  const styleContext = await assembleStyleContext(supabase, userId, partner, opts.oracle_type || null);

  // ── Check for duplicate contact at same location ──
  if (!standalone && effectivePartnerId) {
    try {
      await checkDuplicateContact(supabase, effectivePartnerId, contactEmail, userId);
    } catch (e) {
      const error = e as Error & { code?: string; recentContact?: unknown; partnerName?: string };
      if (error.code === "duplicate_branch") {
        error.message = `${error.message}`;
        throw error;
      }
      throw e;
    }
  }

  // ── Load commercial intelligence (relationship metrics, branches, commercial state) ──
  const commIntel = await assembleCommercialIntelligence(
    supabase,
    effectivePartnerId,
    partner,
    sourceType,
  );

  // ── Load met in person context ──
  const metInPersonContext = await loadMetInPerson(supabase, effectivePartnerId ?? null);

  // ── Load enrichment context (enrichment data, deep search scoring) ──
  const enrichmentCtx = await assembleEnrichmentContext(
    supabase,
    userId,
    effectivePartnerId,
    quality,
    !!commIntel.historyContext,
  );

  // ── Load documents and signature block ──
  const docAndSig = await assembleDocumentsAndSignature(
    supabase,
    quality,
    settings,
    opts.document_ids,
  );

  // ── Load conversation intelligence ──
  const convIntel = await loadConversationContext(
    supabase,
    userId,
    contactEmail,
    effectivePartnerId ?? null,
  );
  const conversationIntelligenceContext = buildConversationBlock(convIntel);

  // ── Extract custom_prompt and category from email_address_rules ──
  let addressCustomPrompt: string | undefined;
  let addressCategory: string | undefined;
  if (convIntel.rules) {
    const rules = convIntel.rules as Record<string, unknown>;
    if (rules.custom_prompt && typeof rules.custom_prompt === "string") {
      addressCustomPrompt = rules.custom_prompt;
    }
    if (rules.category && typeof rules.category === "string") {
      addressCategory = rules.category;
    }
  }

  // ── Load KB and playbook ──
  const kbAndPb = await assembleKbAndPlaybook(
    supabase,
    quality,
    userId,
    opts.oracle_type,
    !!commIntel.historyContext,
    commIntel.touchCount,
    effectivePartnerId,
    opts.email_type_kb_categories,
  );

  return {
    historyContext: commIntel.historyContext,
    relationshipBlock: commIntel.relationshipBlock,
    branchBlock: commIntel.branchBlock,
    interlocutorBlock: commIntel.interlocutorBlock,
    metInPersonContext,
    cachedEnrichmentContext: enrichmentCtx.cachedEnrichmentContext,
    documentsContext: docAndSig.documentsContext,
    stylePreferencesContext: styleContext.stylePreferencesContext,
    editPatternsContext: styleContext.editPatternsContext,
    responseInsightsContext: styleContext.responseInsightsContext,
    conversationIntelligenceContext,
    salesKBSlice: kbAndPb.salesKBSlice,
    salesKBSections: kbAndPb.salesKBSections,
    signatureBlock: docAndSig.signatureBlock,
    networks,
    services,
    socialLinks,
    settings,
    commercialState: commIntel.commercialState,
    touchCount: commIntel.touchCount,
    daysSinceLastContact: commIntel.daysSinceLastContact,
    warmthScore: commIntel.warmthScore,
    lastChannel: commIntel.lastChannel,
    lastOutcome: commIntel.lastOutcome,
    playbookBlock: kbAndPb.playbookBlock,
    playbookActive: kbAndPb.playbookActive,
    addressCustomPrompt,
    addressCategory,
    deepSearchStatus: enrichmentCtx.deepSearchStatus,
    deepSearchAgeDays: enrichmentCtx.deepSearchAgeDays,
    enrichmentAgeDays: enrichmentCtx.enrichmentAgeDays,
    sherlockLevel: enrichmentCtx.sherlockLevel,
    lastDeepSearchScore: enrichmentCtx.lastDeepSearchScore,
  };
}
