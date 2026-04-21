/**
 * contextAssembler.ts — Loads all contextual data from DB for generate-outreach.
 * Returns pre-built text blocks ready for the promptBuilder.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import type { Quality } from "../_shared/kbSlice.ts";
import type { Channel } from "./promptBuilder.ts";

type SupabaseClient = ReturnType<typeof createClient>;

// ── KB fetcher ──

export async function fetchKbEntriesForOutreach(
  supabase: SupabaseClient, quality: Quality, channel: Channel, userId: string,
): Promise<{ text: string; sections: string[] }> {
  const limit = quality === "fast" ? 6 : quality === "standard" ? 15 : 35;
  const categories = ["regole_sistema", "filosofia"];
  if (channel === "email") categories.push("struttura_email", "hook", "cold_outreach");
  if (channel === "linkedin") categories.push("cold_outreach", "tono");
  if (channel === "whatsapp") categories.push("tono", "frasi_modello");
  if (quality !== "fast") categories.push("negoziazione", "chris_voss", "dati_partner");
  if (quality === "premium") categories.push("arsenale", "persuasione", "obiezioni", "chiusura", "followup", "errori");

  const { data: entries } = await supabase
    .from("kb_entries").select("title, content, category, chapter, tags")
    .eq("user_id", userId).eq("is_active", true).in("category", categories)
    .order("priority", { ascending: false }).order("sort_order").limit(limit);

  if (!entries?.length) return { text: "", sections: [] };
  const sections = [...new Set(entries.map((e: { category: string }) => e.category))];
  const text = entries.map((e: { title: string; content: string; chapter: string }) => `### ${e.title} [${e.chapter}]\n${e.content}`).join("\n\n---\n\n");
  return { text, sections };
}

// ── Conversation Intelligence ──

export async function loadConversationContextOutreach(
  supabase: SupabaseClient, userId: string, emailAddress: string | null,
): Promise<string> {
  if (!emailAddress) return "";

  const [ctxRes, rulesRes, classRes] = await Promise.all([
    supabase.from("contact_conversation_context").select("conversation_summary, last_exchanges, response_rate, avg_response_time_hours, dominant_sentiment")
      .eq("user_id", userId).eq("email_address", emailAddress).maybeSingle(),
    supabase.from("email_address_rules").select("tone_override, topics_to_emphasize, topics_to_avoid, email_prompts(instructions)")
      .eq("user_id", userId).eq("email_address", emailAddress).maybeSingle(),
    supabase.from("email_classifications")
      .select("category, confidence, ai_summary, sentiment")
      .eq("user_id", userId).eq("email_address", emailAddress)
      .order("classified_at", { ascending: false }).limit(3),
  ]);

  const parts: string[] = [];
  const ctx = ctxRes.data;
  const rules = rulesRes.data;
  const classes = classRes.data ?? [];

  if (ctx) {
    if (ctx.conversation_summary) parts.push(`CONVERSATION HISTORY: ${ctx.conversation_summary}`);
    const exchanges = Array.isArray(ctx.last_exchanges) ? (ctx.last_exchanges as Array<Record<string, unknown>>).slice(-5) : [];
    if (exchanges.length) {
      parts.push(`Last exchanges:\n${exchanges.map((ex: Record<string, unknown>) => `  ${ex.date || "?"} - ${ex.subject || "N/A"} - ${ex.sentiment || "neutral"}`).join("\n")}`);
    }
    parts.push(`RESPONSE PATTERN: Rate ${Math.round(ctx.response_rate ?? 0)}%, avg ${ctx.avg_response_time_hours != null ? `${Math.round(ctx.avg_response_time_hours)}h` : "N/A"}, sentiment: ${ctx.dominant_sentiment || "neutral"}`);
  }

  if (rules) {
    const rp: string[] = [];
    if (rules.tone_override) rp.push(`Tone=${rules.tone_override}`);
    if (rules.topics_to_emphasize?.length) rp.push(`Emphasize=${rules.topics_to_emphasize.join(", ")}`);
    if (rules.topics_to_avoid?.length) rp.push(`Avoid=${rules.topics_to_avoid.join(", ")}`);
    if (rp.length) parts.push(`SENDER RULES: ${rp.join(", ")}`);
    if ((rules as Record<string, unknown>)?.email_prompts && ((rules as Record<string, unknown>).email_prompts as Record<string, unknown>)?.instructions) parts.push(`SENDER PROMPT: ${((rules as Record<string, unknown>).email_prompts as Record<string, unknown>).instructions}`);
  }

  if (classes.length) {
    parts.push(`RECENT CLASSIFICATIONS:\n${classes.map((c: Record<string, unknown>) => `  ${c.category} (${Math.round((c.confidence ?? 0) * 100)}%) - ${c.ai_summary || ""}`).join("\n")}`);
  }

  return parts.length ? `\nCONVERSATION INTELLIGENCE:\n${parts.join("\n")}\n` : "";
}

// ── Intelligence assembly ──

export interface RecipientIntelligence {
  sources_checked: string[];
  data_found: Record<string, boolean>;
  enrichment_snippet: string;
  warning: string | null;
}

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
  // ── Fix 3.1: real relationship stage (single source of truth) ──
  relationshipStage: "cold" | "warm" | "active" | "stale" | "ghosted";
  relationshipMetrics: {
    response_rate: number;
    unanswered_count: number;
    days_since_last_contact: number;
    commercial_state: "new" | "holding" | "engaged";
    total_interactions: number;
  };
  // ── Fix 3.2: active playbook injection ──
  playbookBlock: string;
  playbookActive: boolean;
  // ── Fix 3.3: honest channel declaration ──
  channelDeclaration: string;
}

/**
 * Fix 3.2 — Loader del playbook commerciale attivo per un partner.
 * Path: partner_workflow_state(active) → commercial_workflows.code → commercial_playbooks(workflow_code, is_active=true).
 */
export async function loadActivePlaybook(
  supabase: SupabaseClient,
  userId: string,
  partnerId: string | null,
): Promise<{ block: string; active: boolean }> {
  if (!partnerId) return { block: "", active: false };

  const { data: state } = await supabase
    .from("partner_workflow_state")
    .select("workflow_id, status, current_step")
    .eq("user_id", userId)
    .eq("partner_id", partnerId)
    .eq("status", "active")
    .maybeSingle();

  if (!state?.workflow_id) return { block: "", active: false };

  const { data: workflow } = await supabase
    .from("commercial_workflows")
    .select("code, name")
    .eq("id", state.workflow_id)
    .maybeSingle();

  if (!workflow?.code) return { block: "", active: false };

  const { data: playbooks } = await supabase
    .from("commercial_playbooks")
    .select("name, description, prompt_template, suggested_actions, kb_tags, code")
    .eq("workflow_code", workflow.code)
    .eq("is_active", true)
    .order("priority", { ascending: false })
    .limit(1);

  const playbook = playbooks?.[0];
  if (!playbook) return { block: "", active: false };

  const lines: string[] = [
    `# PLAYBOOK ATTIVO — ${playbook.name} (workflow: ${workflow.code}, step: ${state.current_step ?? 0})`,
  ];
  if (playbook.description) lines.push(`Obiettivo: ${playbook.description}`);
  if (playbook.prompt_template) lines.push(`\nIstruzioni operative:\n${playbook.prompt_template}`);
  if (playbook.suggested_actions) {
    const actions = typeof playbook.suggested_actions === "string"
      ? playbook.suggested_actions
      : JSON.stringify(playbook.suggested_actions);
    lines.push(`\nAzioni suggerite: ${actions}`);
  }
  lines.push(`\nQuesto playbook GUIDA tono, contenuto e CTA. Rispetta le istruzioni prima di applicare la KB generica.`);

  return { block: lines.join("\n") + "\n", active: true };
}

/**
 * Fix 3.3 — Dichiarazione onesta del canale: l'AI deve sapere se ha contesto storico completo o limitato.
 */
export function buildChannelDeclaration(channel: Channel): string {
  switch (channel) {
    case "email":
      return `CANALE: EMAIL — canale primario, contesto storico completo (interazioni, classificazioni, risposte).`;
    case "whatsapp":
      return `CANALE: WHATSAPP — contesto storico LIMITATO (no thread completo). Tono breve, diretto, conversazionale. Max 2-4 righe.`;
    case "linkedin":
      return `CANALE: LINKEDIN — contesto storico LIMITATO. Tono professionale, conciso. Max 4-6 righe.`;
    case "sms":
      return `CANALE: SMS — un solo messaggio breve (max 160 caratteri). Solo per follow-up urgenti.`;
    default:
      return `CANALE: ${(channel as string).toUpperCase()} — adatta tono e lunghezza.`;
  }
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
        if (ed.deep_search_summary) parts.push(`Deep Search: ${String(ed.deep_search_summary).slice(0, 400)}`);
      }
      if (parts.length) contextParts.push(`[PARTNER DB]\n${parts.join("\n")}`);
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
  let interactionHistoryCount = 0;
  let relationshipBlock = "";
  let interlocutorBlock = "";
  let branchBlock = "";
  let historyText = "";
  // Fix 3.1: expose real relationship metrics (single source of truth)
  let relationshipStage: "cold" | "warm" | "active" | "stale" | "ghosted" = "cold";
  let relationshipMetrics = {
    response_rate: 0,
    unanswered_count: 0,
    days_since_last_contact: 0,
    commercial_state: "new" as "new" | "holding" | "engaged",
    total_interactions: 0,
  };

  const { checkSameLocationContacts, getSameCompanyBranches, analyzeRelationshipHistory, buildInterlocutorTypeBlock, buildBranchCoordinationBlock, buildRelationshipAnalysisBlock } = await import("../_shared/sameLocationGuard.ts");

  if (partnerId) {
    const guardResult = await checkSameLocationContacts(supabase, partnerId, params.contact_email || null, userId);
    if (!guardResult.allowed) {
      throw Object.assign(new Error(guardResult.reason), { code: "duplicate_branch", recentContact: guardResult.recentContact });
    }
    const { metrics, historyText: ht } = await analyzeRelationshipHistory(supabase, partnerId, userId);
    historyText = ht;
    interactionHistoryCount = metrics.total_interactions;
    relationshipBlock = buildRelationshipAnalysisBlock(metrics);
    // Fix 3.1: capture real metrics for downstream decision
    relationshipStage = metrics.relationship_stage;
    relationshipMetrics = {
      response_rate: metrics.response_rate ?? 0,
      unanswered_count: metrics.unanswered_count ?? 0,
      days_since_last_contact: metrics.days_since_last_contact ?? 0,
      commercial_state: metrics.commercial_state,
      total_interactions: metrics.total_interactions ?? 0,
    };
    if (historyText) { intelligence.data_found.interactions = true; contextParts.push(`[STORIA INTERAZIONI]\n${historyText}`); }
    else { intelligence.data_found.interactions = false; }
    const branches = await getSameCompanyBranches(supabase, partnerId);
    branchBlock = buildBranchCoordinationBlock(branches, "");
  } else { intelligence.data_found.interactions = false; }

  const sourceType = partnerId ? "partner" : "contact";
  interlocutorBlock = buildInterlocutorTypeBlock(sourceType);

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

  // Website/LinkedIn cache
  let websiteSource: "cached" | "not_available" = "not_available";
  if (partnerId && quality !== "fast") {
    // LOVABLE-72: lettura unificata (Base + Deep Local + Legacy + Sherlock)
    const { readUnifiedEnrichment, formatEnrichmentForPrompt } = await import("../_shared/enrichmentAdapter.ts");
    const unified = await readUnifiedEnrichment(partnerId, supabase);
    if (unified.has_any) {
      const block = formatEnrichmentForPrompt(unified);
      if (block) {
        contextParts.push(`[ENRICHMENT UNIFICATO]\n${block}`);
        websiteSource = "cached";
        if (unified.legacy.linkedin_summary || unified.base.linkedin_url) {
          linkedinSource = "cached";
          intelligence.data_found.linkedin = true;
        }
        if (unified.base.website_excerpt || unified.legacy.website_summary) {
          intelligence.data_found.website = true;
        }
      }
    }
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
  if (!kbResult.text && settings.ai_sales_knowledge_base) {
    console.warn("[generate-outreach] kb_entries vuoto, fallback monolitico DEPRECATO — migrare a kb_entries");
  }

  // ── Conversation Intelligence ──
  const conversationIntelligenceContext = await loadConversationContextOutreach(
    supabase, userId, params.contact_email || null,
  );

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

  return {
    intelligence, interlocutorBlock, relationshipBlock, branchBlock, metInPersonContext,
    historyText, interactionHistoryCount, conversationIntelligenceContext,
    salesKBSlice: kbResult.text, salesKBSections: kbResult.sections,
    settings, partnerId, websiteSource, linkedinSource,
    commercialState, touchCount, daysSinceLastContact, warmthScore,
    relationshipStage, relationshipMetrics,
    playbookBlock: playbook.block, playbookActive: playbook.active,
    channelDeclaration,
  };
}
