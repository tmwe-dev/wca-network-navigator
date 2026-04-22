/**
 * contextAssembler.ts — Orchestrator for outreach context assembly.
 * Loads all contextual data from DB and returns pre-built text blocks.
 * Delegates specialized logic to focused modules.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import type { Quality } from "../_shared/kbSlice.ts";
import type { Channel } from "./promptBuilder.ts";
import { fetchKbEntriesForOutreach } from "./kbFetcher.ts";
import { loadConversationContextOutreach } from "./conversationContext.ts";
import { buildChannelDeclaration } from "./channelDeclaration.ts";
import { loadActivePlaybook } from "./playbookLoader.ts";
import { assemblePartnerEnrichmentContext, getEnrichmentMetadata, type RecipientIntelligence } from "./enrichmentAssembler.ts";
import { analyzePartnerRelationship } from "./relationshipAnalyzer.ts";

type SupabaseClient = ReturnType<typeof createClient>;

export type { RecipientIntelligence };

export interface OutreachContextBlocks {
  intelligence: RecipientIntelligence;
  interlocutorBlock: string;
  relationshipBlock: string;
  branchBlock: string;
  metInPersonContext: string;
  historyText: string;
  interactionHistoryCount: number;
  conversationIntelligenceContext: string;
  salesKBSlice: string;
  salesKBSections: string[];
  settings: Record<string, string>;
  partnerId: string | null;
  websiteSource: "cached" | "not_available";
  linkedinSource: "cached" | "live_scraped" | "not_available";
  relationshipStage: "cold" | "warm" | "active" | "stale" | "ghosted";
  relationshipMetrics: {
    response_rate: number;
    unanswered_count: number;
    days_since_last_contact: number;
    commercial_state: "new" | "holding" | "engaged";
    total_interactions: number;
  };
  playbookBlock: string;
  playbookActive: boolean;
  channelDeclaration: string;
  addressCustomPrompt?: string;
  addressCategory?: string;
  enrichmentAgeDays?: number | null;
  sherlockLevel?: number;
  lastDeepSearchScore?: number;
}

export async function assembleOutreachContext(
  supabase: SupabaseClient, userId: string, channel: Channel, quality: Quality,
  params: {
    company_name?: string; contact_name?: string; contact_email?: string;
    country_code?: string; linkedin_profile?: Record<string, string>;
    email_type_id?: string;
  },
): Promise<OutreachContextBlocks> {
  const intelligence: RecipientIntelligence = {
    sources_checked: [], data_found: {}, enrichment_snippet: "", warning: null,
  };
  const contextParts: string[] = [];

  // 1) Partners table
  intelligence.sources_checked.push("partners");
  let partnerId: string | null = null;
  if (params.company_name) {
    const safeName = params.company_name.replace(/[\\%_]/g, (c: string) => `\\${c}`);
    const { data: partnerRows } = await supabase
      .from("partners").select("id, company_name, company_alias, enrichment_data, profile_description, city, country_code, website, lead_status")
      .ilike("company_name", `%${safeName}%`).limit(1);
    const partner = partnerRows?.[0];
    if (partner) {
      intelligence.data_found.partner = true;
      partnerId = partner.id;
      const parts: string[] = [];
      if (partner.profile_description) parts.push(`Profilo: ${partner.profile_description.slice(0, 500)}`);
      if (partner.city) parts.push(`Sede: ${partner.city}, ${partner.country_code}`);
      if (partner.website) parts.push(`Website: ${partner.website}`);
      if (partner.lead_status) parts.push(`Status CRM: ${partner.lead_status}`);
      if (partner.enrichment_data) {
        const ed = partner.enrichment_data as Record<string, unknown>;
        if (ed.trade_lanes) parts.push(`Trade Lanes: ${JSON.stringify(ed.trade_lanes).slice(0, 300)}`);
        if (ed.specializations) parts.push(`Specializzazioni: ${JSON.stringify(ed.specializations).slice(0, 200)}`);
      }
      if (parts.length) contextParts.push(`[PARTNER DB]\n${parts.join("\n")}`);

      // LOVABLE-77B: unified enrichment (Base + Deep Local + Sherlock + Legacy)
      try {
        const { websiteSource, linkedinSource } = await assemblePartnerEnrichmentContext(
          supabase, partner.id, quality, contextParts, intelligence
        );
      } catch (e) {
        console.warn("[assembleOutreachContext] enrichment assembly failed:", e instanceof Error ? e.message : e);
      }
    } else {
      intelligence.data_found.partner = false;
    }
  }

  // 2-4) Partner contacts, networks, services
  if (partnerId) {
    const [contactsRes, netsRes, svcsRes] = await Promise.all([
      supabase.from("partner_contacts").select("name, title, email, contact_alias").eq("partner_id", partnerId).limit(5),
      supabase.from("partner_networks").select("network_name").eq("partner_id", partnerId).limit(10),
      supabase.from("partner_services").select("service_category").eq("partner_id", partnerId).limit(20),
    ]);
    intelligence.sources_checked.push("partner_contacts", "partner_networks", "partner_services");

    if (contactsRes.data?.length) {
      intelligence.data_found.contacts = true;
      contextParts.push(`[CONTATTI AZIENDA]\n${contactsRes.data.map((c: Record<string, unknown>) => `${c.name}${c.title ? ` (${c.title})` : ""}${c.email ? ` - ${c.email}` : ""}`).join("; ")}`);
    } else { intelligence.data_found.contacts = false; }

    if (netsRes.data?.length) {
      intelligence.data_found.networks = true;
      contextParts.push(`[NETWORK CONDIVISI]\n${netsRes.data.map((n: Record<string, unknown>) => n.network_name).join(", ")}`);
    } else { intelligence.data_found.networks = false; }

    if (svcsRes.data?.length) {
      intelligence.data_found.services = true;
      contextParts.push(`[SERVIZI]\n${svcsRes.data.map((s: Record<string, unknown>) => s.service_category).join(", ")}`);
    } else { intelligence.data_found.services = false; }
  }

  // 5) Imported contacts
  intelligence.sources_checked.push("imported_contacts");
  if (params.contact_email || params.company_name) {
    const q = supabase.from("imported_contacts").select("name, company_name, note, enrichment_data, deep_search_at").limit(1);
    if (params.contact_email) q.ilike("email", params.contact_email);
    else if (params.company_name) q.ilike("company_name", `%${params.company_name}%`);
    const { data: icRows } = await q;
    const ic = icRows?.[0];
    if (ic) {
      intelligence.data_found.imported_contacts = true;
      const parts: string[] = [];
      if (ic.note) parts.push(`Note: ${String(ic.note).slice(0, 300)}`);
      if (ic.enrichment_data) { const ed = ic.enrichment_data as Record<string, unknown>; if (ed.summary) parts.push(`Enrichment: ${String(ed.summary).slice(0, 300)}`); }
      if (parts.length) contextParts.push(`[CRM CONTATTO]\n${parts.join("\n")}`);
    } else { intelligence.data_found.imported_contacts = false; }
  }

  // 6) Interaction history + Relationship
  intelligence.sources_checked.push("interactions");
  const relationshipAnalysis = await analyzePartnerRelationship(supabase, partnerId, userId);

  // 7) Met in Person
  let metInPersonContext = "";
  if (partnerId) {
    const { data: bcaRows } = await supabase.from("business_cards")
      .select("contact_name, event_name, met_at, location").eq("matched_partner_id", partnerId).limit(3);
    if (bcaRows?.length) {
      const encounters = bcaRows.map((bc: Record<string, unknown>) => {
        const parts: string[] = [];
        if (bc.event_name) parts.push(`Evento: ${bc.event_name}`);
        if (bc.contact_name) parts.push(`Contatto: ${bc.contact_name}`);
        if (bc.met_at) parts.push(`Data: ${bc.met_at}`);
        if (bc.location) parts.push(`Luogo: ${bc.location}`);
        return parts.join(", ");
      }).join("\n");
      metInPersonContext = `\nINCONTRO DI PERSONA — IMPORTANTE:\nHai incontrato questa azienda di persona. Questo cambia il tono della comunicazione.\n${encounters}\nISTRUZIONI: Usa un tono più caldo e familiare. Fai riferimento all'incontro di persona. NON trattare come un contatto freddo.\n`;
    }
  }

  // 8) Activities
  intelligence.sources_checked.push("activities");
  if (partnerId) {
    const { data: actRows } = await supabase.from("activities")
      .select("email_subject, sent_at, activity_type, status")
      .eq("source_id", partnerId).in("status", ["completed"])
      .order("created_at", { ascending: false }).limit(10);
    if (actRows?.length) {
      intelligence.data_found.activities = true;
      const acts = actRows.map((a: Record<string, unknown>) => `[${a.sent_at?.slice(0, 10) || "?"}] ${a.activity_type}: "${a.email_subject || "N/A"}"`).join("\n");
      contextParts.push(`[ATTIVITÀ PRECEDENTI]\nQueste comunicazioni sono GIÀ state inviate — NON ripetere lo stesso messaggio:\n${acts}`);
    } else { intelligence.data_found.activities = false; }
  }

  // 8b) LinkedIn profile from client
  let linkedinSource: "cached" | "live_scraped" | "not_available" = "not_available";
  if (params.linkedin_profile && typeof params.linkedin_profile === "object") {
    const lp = params.linkedin_profile;
    const lpParts: string[] = [];
    if (lp.name) lpParts.push(`Nome: ${lp.name}`);
    if (lp.headline) lpParts.push(`Headline: ${lp.headline}`);
    if (lp.location) lpParts.push(`Località: ${lp.location}`);
    if (lp.about) lpParts.push(`About: ${String(lp.about).slice(0, 800)}`);
    if (lp.profileUrl) lpParts.push(`URL: ${lp.profileUrl}`);
    if (lpParts.length) {
      contextParts.push(`[LINKEDIN PROFILO (scraping live dal browser)]\n${lpParts.join("\n")}`);
      intelligence.data_found.linkedin_live = true;
      intelligence.sources_checked.push("linkedin_live_scrape");
      linkedinSource = "live_scraped";
    }
  }

  // Website/LinkedIn cache (reassess after live scrape)
  let websiteSource: "cached" | "not_available" = "not_available";
  if (partnerId && linkedinSource !== "live_scraped") {
    const enrichment = await assemblePartnerEnrichmentContext(supabase, partnerId, quality, contextParts, intelligence);
    websiteSource = enrichment.websiteSource;
    linkedinSource = enrichment.linkedinSource;
  }

  // Build enrichment snippet
  const rawSnippet = contextParts.join("\n\n");
  intelligence.enrichment_snippet = rawSnippet.slice(0, 2000);
  if (!rawSnippet) intelligence.warning = "Nessun dato trovato nel DB. L'AI lavora solo con dati base.";

  // Settings
  const { data: settingsRows } = await supabase.from("app_settings").select("key, value").eq("user_id", userId).like("key", "ai_%");
  const settings: Record<string, string> = {};
  (settingsRows || []).forEach((r: { key: string; value: string | null }) => { settings[r.key] = r.value || ""; });

  // Sales KB
  const kbResult = await fetchKbEntriesForOutreach(supabase, quality, channel, userId);

  // ── Conversation Intelligence ──
  const convResult = await loadConversationContextOutreach(supabase, userId, params.contact_email || null);

  // Commercial state for prompt context
  let commercialState = "new";
  let touchCount = 0;
  let daysSinceLastContact = 0;
  let lastOutcome: string | null = null;
  if (partnerId) {
    const { data: pState } = await supabase
      .from("partners")
      .select("lead_status, interaction_count, last_interaction_at")
      .eq("id", partnerId)
      .maybeSingle();
    if (pState) {
      commercialState = pState.lead_status || "new";
      touchCount = pState.interaction_count || 0;
      daysSinceLastContact = pState.last_interaction_at
        ? Math.floor((Date.now() - new Date(pState.last_interaction_at).getTime()) / 86400000)
        : 0;
    }
  }

  const warmthScore = Math.min(100,
    (touchCount || 0) * 15 +
    (daysSinceLastContact != null && daysSinceLastContact < 14 ? 20 : 0) +
    (lastOutcome === "positive" ? 15 : 0)
  );

  // Fix 3.2: Active playbook
  const playbook = await loadActivePlaybook(supabase, userId, partnerId);

  // Fix 3.3: Honest channel declaration
  const channelDeclaration = buildChannelDeclaration(channel);

  // ── Oracle enrichment metadata ──
  const enrichMetadata = await getEnrichmentMetadata(supabase, partnerId, quality);

  return {
    intelligence,
    interlocutorBlock: relationshipAnalysis.interlocutorBlock,
    relationshipBlock: relationshipAnalysis.relationshipBlock,
    branchBlock: relationshipAnalysis.branchBlock,
    metInPersonContext,
    historyText: relationshipAnalysis.historyText,
    interactionHistoryCount: relationshipAnalysis.interactionHistoryCount,
    conversationIntelligenceContext: convResult.text,
    salesKBSlice: kbResult.text,
    salesKBSections: kbResult.sections,
    settings,
    partnerId,
    websiteSource,
    linkedinSource,
    relationshipStage: relationshipAnalysis.relationshipStage,
    relationshipMetrics: relationshipAnalysis.relationshipMetrics,
    playbookBlock: playbook.block,
    playbookActive: playbook.active,
    channelDeclaration,
    addressCustomPrompt: convResult.customPrompt,
    addressCategory: convResult.category,
    enrichmentAgeDays: enrichMetadata.enrichmentAgeDays,
    sherlockLevel: enrichMetadata.sherlockLevel,
    lastDeepSearchScore: enrichMetadata.lastDeepSearchScore,
  };
}
