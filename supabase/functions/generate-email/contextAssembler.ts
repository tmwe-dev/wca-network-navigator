/**
 * contextAssembler.ts — Orchestrator for loading all contextual data from DB.
 *
 * Main entry point that imports and coordinates specialized loaders.
 * Maintains backward-compatible exports.
 *
 * Specialized modules:
 * - kbAssembler: KB loading strategies
 * - aliasGenerator: LLM-based alias generation
 * - entityLoader: Partner and contact loading
 * - conversationIntel: Email rules and conversation context
 * - playbookLoader: Active workflow playbooks
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import type { Quality } from "../_shared/kbSlice.ts";
import type { PartnerData, ContactData, NetworkRow, ServiceRow, SocialLinkRow } from "./promptBuilder.ts";
import { fetchKbEntriesStrategic } from "./kbAssembler.ts";
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
import { loadActivePlaybook } from "./playbookLoader.ts";
import { readUnifiedEnrichment, formatEnrichmentForPrompt } from "../_shared/enrichmentAdapter.ts";
import {
  calculateDeepSearchScore,
  formatScoreForPrompt,
  type DeepSearchScoreResult,
} from "../_shared/deepSearchScore.ts";

type SupabaseClient = ReturnType<typeof createClient>;

interface StyleMemoryRow {
  content: string;
  confidence: number;
  access_count: number;
}
interface DocRow {
  file_name: string;
  extracted_text: string | null;
}

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

export { fetchKbEntriesStrategic } from "./kbAssembler.ts";
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
export { loadActivePlaybook } from "./playbookLoader.ts";

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

  // ── Auto-generate aliases if missing ──
  const needsCompanyAlias = !standalone && !partner.company_alias;
  const needsContactAlias = contact && !contact.contact_alias;
  if (needsCompanyAlias || needsContactAlias) {
    const generated = await generateAliasesInline(
      partner.company_name,
      contact?.name || null,
      contact?.title || null,
    );
    if (generated.company_alias && needsCompanyAlias) {
      partner.company_alias = generated.company_alias;
      if (sourceType === "partner")
        await supabase.from("partners").update({ company_alias: generated.company_alias }).eq("id", partner.id!);
      else if (sourceType === "contact")
        await supabase
          .from("imported_contacts")
          .update({ company_alias: generated.company_alias })
          .eq("id", partner.id!);
    }
    if (generated.contact_alias && needsContactAlias && contact) {
      contact.contact_alias = generated.contact_alias;
      if (sourceType === "partner")
        await supabase
          .from("partner_contacts")
          .update({ contact_alias: generated.contact_alias })
          .eq("id", contact.id);
      else if (sourceType === "contact")
        await supabase
          .from("imported_contacts")
          .update({ contact_alias: generated.contact_alias })
          .eq("id", contact.id);
    }
  }

  // ── Parallel data loading ──
  const [networksRes, servicesRes, settingsRes, socialRes] = await Promise.all([
    isPartnerSource
      ? supabase.from("partner_networks").select("network_name").eq("partner_id", partner.id!)
      : Promise.resolve({ data: [] }),
    isPartnerSource && quality !== "fast"
      ? supabase.from("partner_services").select("service_category").eq("partner_id", partner.id!)
      : Promise.resolve({ data: [] }),
    supabase
      .from("app_settings")
      .select("key, value")
      .eq("user_id", userId)
      .like("key", "ai_%"),
    isPartnerSource && quality === "premium"
      ? supabase
          .from("partner_social_links")
          .select("platform, url, contact_id")
          .eq("partner_id", partner.id!)
      : Promise.resolve({ data: [] }),
  ]);

  const networks = (networksRes.data || []) as NetworkRow[];
  const services = (servicesRes.data || []) as ServiceRow[];
  const socialLinks = (socialRes.data || []) as SocialLinkRow[];
  const settings: Record<string, string> = {};
  ((settingsRes.data || []) as { key: string; value: string | null }[]).forEach((r) => {
    settings[r.key] = r.value || "";
  });

  // ── Style Preferences from AI Memory ──
  let stylePreferencesContext = "";
  const { data: styleMemories } = await supabase
    .from("ai_memory")
    .select("content, confidence, access_count")
    .eq("user_id", userId)
    .contains("tags", ["style_preference"])
    .gte("confidence", 30)
    .order("access_count", { ascending: false })
    .limit(5);
  if (styleMemories?.length) {
    stylePreferencesContext = `\nPREFERENZE DI STILE APPRESE (dall'editing dell'utente):\n${(styleMemories as StyleMemoryRow[])
      .map((m) => `- ${m.content}`)
      .join("\n")}\nAPPLICA queste preferenze nella generazione.\n`;
  }

  // ── Edit Patterns ──
  let editPatternsContext = "";
  {
    const emailCategory = opts.oracle_type || null;
    const countryFilter = partner.country_code || null;
    let epQuery = supabase
      .from("ai_edit_patterns")
      .select(
        "email_type, country_code, hook_original, hook_final, cta_original, cta_final, tone_delta, formality_shift, length_delta_percent",
      )
      .eq("user_id", userId)
      .in("significance", ["medium", "high"])
      .order("created_at", { ascending: false })
      .limit(10);
    if (countryFilter) epQuery = epQuery.eq("country_code", countryFilter);
    if (emailCategory) epQuery = epQuery.eq("email_type", emailCategory);
    let { data: editPatterns } = await epQuery;
    if (!editPatterns?.length && (countryFilter || emailCategory)) {
      const { data: fallback } = await supabase
        .from("ai_edit_patterns")
        .select(
          "email_type, country_code, hook_original, hook_final, cta_original, cta_final, tone_delta, formality_shift, length_delta_percent",
        )
        .eq("user_id", userId)
        .in("significance", ["medium", "high"])
        .order("created_at", { ascending: false })
        .limit(10);
      editPatterns = fallback;
    }
    if (editPatterns?.length) {
      const lines = editPatterns.map(
        (ep: Record<string, unknown>) =>
          `- ${ep.email_type || "generico"} verso ${ep.country_code || "??"}: Hook cambiato da '${((ep.hook_original || "") as string).slice(0, 60)}' a '${((ep.hook_final || "") as string).slice(0, 60)}', CTA da '${((ep.cta_original || "") as string).slice(0, 60)}' a '${((ep.cta_final || "") as string).slice(0, 60)}', tono: ${ep.tone_delta || "invariato"}, formalità: ${ep.formality_shift || "invariata"}, lunghezza: ${ep.length_delta_percent || 0}%`,
      );
      editPatternsContext = `\nPATTERN DI EDITING DELL'UTENTE (modifiche precedenti alle email generate):\n${lines.join(
        "\n",
      )}\nADATTA lo stile in base a questi pattern.\n`;
    }
  }

  // ── Response Patterns ──
  let responseInsightsContext = "";
  {
    let rpQuery = supabase
      .from("response_patterns")
      .select(
        "country_code, channel, email_type, total_sent, total_responses, response_rate, avg_response_time_hours, pattern_confidence",
      )
      .eq("user_id", userId)
      .gte("pattern_confidence", 0.5)
      .gte("total_sent", 3)
      .order("pattern_confidence", { ascending: false })
      .limit(5);
    if (partner.country_code) rpQuery = rpQuery.eq("country_code", partner.country_code);
    const { data: responsePatterns } = await rpQuery;
    if (responsePatterns?.length) {
      const lines = responsePatterns.map(
        (rp: Record<string, unknown>) =>
          `- ${rp.country_code || "Global"} ${rp.channel} ${rp.email_type || "generico"}: ${rp.total_responses}/${rp.total_sent} risposte (${Math.round(Number(rp.response_rate))}%), tempo medio: ${rp.avg_response_time_hours != null ? `${rp.avg_response_time_hours}h` : "N/A"}`,
      );
      responseInsightsContext = `\nINSIGHT DALLE RISPOSTE RICEVUTE (dati reali):\n${lines.join("\n")}\n`;
    }
  }

  // ── Commercial Intelligence (Same-Location Guard, Relationship, Branches) ──
  const {
    checkSameLocationContacts,
    getSameCompanyBranches,
    analyzeRelationshipHistory,
    buildInterlocutorTypeBlock,
    buildBranchCoordinationBlock,
    buildRelationshipAnalysisBlock,
  } = await import("../_shared/sameLocationGuard.ts");

  const effectivePartnerId = isPartnerSource ? opts.activityPartnerId || partner.id : partner.id;

  // Same-Location Guard
  if (!standalone && effectivePartnerId) {
    const guardResult = await checkSameLocationContacts(supabase, effectivePartnerId, contactEmail, userId);
    if (!guardResult.allowed) {
      throw Object.assign(new Error(guardResult.reason), {
        code: "duplicate_branch",
        recentContact: guardResult.recentContact,
        partnerName: partner.company_name,
      });
    }
  }

  let historyContext = "";
  let relationshipBlock = "";
  let branchBlock = "";
  let commercialState: string | undefined;
  let touchCount: number | undefined;
  let daysSinceLastContact: number | undefined;
  let warmthScore: number | undefined;
  let lastChannel: string | undefined;
  let lastOutcome: string | undefined;
  if (effectivePartnerId) {
    const { metrics, historyText } = await analyzeRelationshipHistory(supabase, effectivePartnerId, userId);
    if (historyText) historyContext = `\n${historyText}\n`;
    relationshipBlock = buildRelationshipAnalysisBlock(metrics);
    const branches = await getSameCompanyBranches(supabase, effectivePartnerId);
    branchBlock = buildBranchCoordinationBlock(branches, partner.city);

    const m = metrics as Record<string, unknown>;
    commercialState = (m.commercial_state as string | undefined) ?? (partner.lead_status as string | undefined);
    touchCount =
      typeof m.total_interactions === "number"
        ? m.total_interactions
        : typeof m.touch_count === "number"
          ? m.touch_count
          : undefined;
    daysSinceLastContact =
      typeof m.days_since_last_contact === "number" ? m.days_since_last_contact : undefined;
    warmthScore = typeof m.warmth_score === "number" ? m.warmth_score : undefined;
    lastChannel = m.last_channel as string | undefined;
    lastOutcome = m.last_outcome as string | undefined;
  }
  const interlocutorBlock = buildInterlocutorTypeBlock(sourceType);

  // ── Met in Person ──
  const metInPersonContext = await loadMetInPerson(supabase, effectivePartnerId ?? null);

  // ── Cached Enrichment Data + optional live Deep Search ──
  let cachedEnrichmentContext = "";
  let deepSearchStatus: "fresh" | "cached" | "stale" | "missing" | "skipped" | "failed" = "missing";
  let deepSearchAgeDays: number | null = null;
  let dsScore: DeepSearchScoreResult | null = null;
  if (effectivePartnerId) {
    const unified = await readUnifiedEnrichment(effectivePartnerId, supabase);
    deepSearchAgeDays = unified.freshness.deep_age_days ?? unified.freshness.base_age_days;
    if (unified.has_any) {
      deepSearchStatus = deepSearchAgeDays != null && deepSearchAgeDays > 30 ? "stale" : "cached";
      const block = formatEnrichmentForPrompt(unified, quality);
      if (block) cachedEnrichmentContext = `\n${block}\n`;

      if (deepSearchAgeDays !== null && deepSearchAgeDays > 30) {
        cachedEnrichmentContext += `\nATTENZIONE: dati arricchimento obsoleti (${deepSearchAgeDays} giorni). Usare con cautela — considera di aggiornare con Deep Search.\n`;
      }
    } else {
      deepSearchStatus = "missing";
    }
    if (opts.deep_search !== true && deepSearchStatus === "cached") {
      deepSearchStatus = "skipped";
    }

    // LOVABLE-88: calcola Deep Search Score e aggiungilo al contesto
    const interactionCountResult = await supabase
      .from("interactions")
      .select("id", { count: "exact", head: true })
      .eq("partner_id", effectivePartnerId);
    const kbCountResult = await supabase
      .from("kb_entries")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .contains("tags", [`partner_${effectivePartnerId}`]);
    dsScore = calculateDeepSearchScore({
      enrichment: unified,
      interactionCount: interactionCountResult.count ?? 0,
      kbEntryCount: kbCountResult.count ?? 0,
      hasActiveConversation: !!historyContext,
    });
    const dsScoreBlock = formatScoreForPrompt(dsScore);
    if (dsScoreBlock) {
      cachedEnrichmentContext += `\n${dsScoreBlock}\n`;
    }
    if (dsScore.auto_enrich_suggested) {
      console.warn(
        `[generate-email] Deep Search Score ${dsScore.score}/100 per partner ${effectivePartnerId} — arricchimento consigliato`,
      );
    }

    // LOVABLE-93: Inject Partner Quality Score per calibrare il tono dell'outreach
    try {
      const { loadAndCalculateQuality, formatQualityForPrompt } = await import(
        "../_shared/partnerQualityScore.ts"
      );
      const qualityScore = await loadAndCalculateQuality(supabase, effectivePartnerId);
      const qualityBlock = formatQualityForPrompt(qualityScore);
      if (qualityBlock) {
        cachedEnrichmentContext += `\n${qualityBlock}\n`;
      }
    } catch (e) {
      console.warn(
        "[generate-email] Partner Quality Score calculation failed:",
        e instanceof Error ? e.message : String(e),
      );
    }
  }

  // ── Documents ──
  let documentsContext = "";
  if (quality !== "fast" && opts.document_ids?.length) {
    const { data: docs } = await supabase
      .from("workspace_documents")
      .select("file_name, extracted_text")
      .in("id", opts.document_ids);
    if (docs?.length) {
      const docTexts = (docs as DocRow[])
        .filter((d) => d.extracted_text)
        .map((d) => `--- ${d.file_name} ---\n${d.extracted_text!.substring(0, 3000)}`)
        .join("\n\n");
      if (docTexts) documentsContext = `\nDOCUMENTI DI RIFERIMENTO:\n${docTexts}\n`;
    }
  }

  // ── Conversation Intelligence ──
  const convIntel = await loadConversationContext(supabase, userId, contactEmail, effectivePartnerId ?? null);
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

  // ── Sales KB ──
  const tcForCategory = touchCount ?? 0;
  const inferredCategory = tcForCategory === 0 ? "primo_contatto" : "follow_up";
  const emailCategory = opts.oracle_type || inferredCategory;
  const isFollowUp = emailCategory === "follow_up" || historyContext.includes("[") || tcForCategory > 0;
  const kbResult = await fetchKbEntriesStrategic(supabase, quality, userId, {
    emailCategory,
    hasInteractionHistory: !!historyContext,
    isFollowUp,
    kb_categories: opts.email_type_kb_categories ?? undefined,
  });
  if (!kbResult.text && settings.ai_sales_knowledge_base) {
    console.warn(
      "[generate-email] kb_entries vuoto, fallback monolitico DEPRECATO — migrare a kb_entries",
    );
  }

  // ── Signature Block ──
  const senderAlias = settings.ai_contact_alias || settings.ai_contact_name || "";
  const senderCompanyAlias = settings.ai_company_alias || settings.ai_company_name || "";
  let signatureBlock = settings.ai_email_signature_block || "";
  if (!signatureBlock.trim()) {
    const sigParts: string[] = [];
    if (senderAlias) sigParts.push(senderAlias);
    if (settings.ai_contact_role) sigParts.push(settings.ai_contact_role);
    if (senderCompanyAlias) sigParts.push(senderCompanyAlias);
    if (settings.ai_phone_signature) sigParts.push(`Tel: ${settings.ai_phone_signature}`);
    if (settings.ai_email_signature) sigParts.push(`Email: ${settings.ai_email_signature}`);
    if (sigParts.length > 0) signatureBlock = sigParts.join("\n");
  }

  // Fix 3.2: Active playbook
  const playbook = await loadActivePlaybook(supabase, userId, effectivePartnerId ?? null);

  return {
    historyContext,
    relationshipBlock,
    branchBlock,
    interlocutorBlock,
    metInPersonContext,
    cachedEnrichmentContext,
    documentsContext,
    stylePreferencesContext,
    editPatternsContext,
    responseInsightsContext,
    conversationIntelligenceContext,
    salesKBSlice: kbResult.text,
    salesKBSections: kbResult.sections_used,
    signatureBlock,
    networks,
    services,
    socialLinks,
    settings,
    commercialState,
    touchCount,
    daysSinceLastContact,
    warmthScore,
    lastChannel,
    lastOutcome,
    playbookBlock: playbook.block,
    playbookActive: playbook.active,
    addressCustomPrompt,
    addressCategory,
    deepSearchStatus,
    deepSearchAgeDays,
    enrichmentAgeDays: deepSearchAgeDays,
    sherlockLevel: (unified?.sherlock?.level as number | undefined) ?? 0,
    lastDeepSearchScore: dsScore?.score,
  };
}
