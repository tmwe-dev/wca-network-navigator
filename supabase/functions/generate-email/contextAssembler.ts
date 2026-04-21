/**
 * contextAssembler.ts — Loads all contextual data from DB for generate-email.
 * Returns pre-built text blocks ready for the promptBuilder.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { aiChat } from "../_shared/aiGateway.ts";
import type { Quality } from "../_shared/kbSlice.ts";
import type { PartnerData, ContactData, NetworkRow, ServiceRow, SocialLinkRow } from "./promptBuilder.ts";
import { readUnifiedEnrichment, formatEnrichmentForPrompt } from "../_shared/enrichmentAdapter.ts";

type SupabaseClient = ReturnType<typeof createClient>;

interface KbEntry { title: string; content: string; category: string; chapter: string; tags: string[]; }
interface StyleMemoryRow { content: string; confidence: number; access_count: number; }
interface DocRow { file_name: string; extracted_text: string | null; }
interface BusinessCardRow { contact_name: string | null; event_name: string | null; met_at: string | null; location: string | null; }

// ── KB fetcher ──

/**
 * Always-on KB categories. Loaded from `system_doctrine` table when available
 * (rows with category in this prefix list), with safe fallback to the codebase
 * defaults if the table is empty / unreachable.
 *
 * Fix 5 (Gap E): rimuove l'hardcoding diretto delle 6 categorie always-on.
 */
const FALLBACK_ALWAYS_ON_CATEGORIES = [
  "regole_sistema",
  "filosofia",
  "struttura_email",
  "hook",
  "cold_outreach",
  "dati_partner",
] as const;

async function loadAlwaysOnCategories(supabase: SupabaseClient): Promise<string[]> {
  try {
    const { data } = await supabase
      .from("system_doctrine")
      .select("category")
      .eq("is_active", true)
      .eq("always_on", true)
      .limit(50);
    const cats = (data ?? [])
      .map((r: { category: string | null }) => r.category)
      .filter((c): c is string => !!c);
    if (cats.length) return [...new Set(cats)];
  } catch {
    // Table may not exist or be readable — fall back silently
  }
  return [...FALLBACK_ALWAYS_ON_CATEGORIES];
}

export async function fetchKbEntriesStrategic(
  supabase: SupabaseClient, quality: Quality, userId: string,
  context: { emailCategory?: string; hasInteractionHistory?: boolean; isFollowUp?: boolean; kb_categories?: string[] },
): Promise<{ text: string; sections_used: string[] }> {
  const limit = quality === "fast" ? 8 : quality === "standard" ? 18 : 40;
  const alwaysOn = await loadAlwaysOnCategories(supabase);
  const categories: string[] = [...alwaysOn];
  if (context.kb_categories?.length) categories.push(...context.kb_categories);
  if (context.isFollowUp) categories.push("followup", "chris_voss", "obiezioni");
  if (quality !== "fast") categories.push("negoziazione", "tono", "frasi_modello");
  if (quality === "premium") categories.push("arsenale", "persuasione", "chiusura", "errori");

  const { data: entries } = await supabase
    .from("kb_entries").select("title, content, category, chapter, tags")
    .eq("user_id", userId).eq("is_active", true)
    .in("category", [...new Set(categories)])
    .order("priority", { ascending: false }).order("sort_order").limit(limit);

  if (!entries || entries.length === 0) return { text: "", sections_used: [] };
  const sectionsUsed = [...new Set((entries as KbEntry[]).map((e) => e.category))];
  const text = (entries as KbEntry[]).map((e) => `### ${e.title} [${e.chapter}]\n${e.content}`).join("\n\n---\n\n");
  return { text, sections_used: sectionsUsed };
}

// ── Alias generator ──

export async function generateAliasesInline(
  companyName: string, contactName: string | null, contactTitle: string | null,
): Promise<{ company_alias: string; contact_alias: string }> {
  const prompt = `Genera alias per:
- Azienda: "${companyName}" → rimuovi suffissi legali (SRL, LLC, Ltd, GmbH, etc.) e città dal nome
- Contatto: "${contactName || ""}" (ruolo: ${contactTitle || "N/A"}) → usa SOLO il cognome, rimuovi titoli (Mr., Mrs., Dr., etc.). Se sembra un ruolo e non un nome di persona, restituisci ""

Rispondi SOLO con JSON: {"company_alias":"...","contact_alias":"..."}`;
  try {
    const result = await aiChat({
      models: ["google/gemini-2.5-flash-lite"],
      messages: [{ role: "user", content: prompt }],
      temperature: 0, max_tokens: 100, timeoutMs: 8000, context: "generate-email:alias",
    });
    const text = result.content || "";
    const jsonMatch = text.match(/\{[^}]+\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch (e) { console.error("Inline alias generation failed:", e); }
  return { company_alias: "", contact_alias: "" };
}

// ── Partner/contact loading from activity ──

export interface LoadedEntity {
  partner: PartnerData | null;
  contact: ContactData | null;
  contactEmail: string | null;
  sourceType: string;
  activityPartnerId?: string | null;
}

export async function loadEntityFromActivity(
  supabase: SupabaseClient, activityId: string,
): Promise<LoadedEntity> {
  const { data: actData, error: actErr } = await supabase
    .from("activities")
    .select(`*, partners(id, company_name, company_alias, country_code, country_name, city, email, phone, website, profile_description, rating, raw_profile_markdown), selected_contact:partner_contacts!activities_selected_contact_id_fkey(id, name, email, direct_phone, mobile, title, contact_alias)`)
    .eq("id", activityId).single();

  if (actErr || !actData) throw new Error("Activity not found");
  const activity = actData as Record<string, unknown>;
  let partner: PartnerData | null = activity.partners;
  let contact: ContactData | null = activity.selected_contact;
  let contactEmail: string | null = null;
  const sourceType = activity.source_type || "partner";

  if (sourceType === "contact" && activity.source_id) {
    const { data: ic } = await supabase
      .from("imported_contacts")
      .select("id, company_name, company_alias, name, contact_alias, email, phone, mobile, country, city, position, origin, note")
      .eq("id", activity.source_id).single();
    if (ic) {
      partner = {
        id: ic.id, company_name: ic.company_name || "Azienda sconosciuta", company_alias: ic.company_alias,
        country_code: ic.country || "??", country_name: ic.country || "Sconosciuto", city: ic.city || "",
        email: ic.email, phone: ic.phone, website: null, profile_description: ic.note, rating: null, raw_profile_markdown: null,
      };
      contact = { id: ic.id, name: ic.name || ic.company_name || "", email: ic.email, direct_phone: ic.phone, mobile: ic.mobile, title: ic.position, contact_alias: ic.contact_alias };
      contactEmail = ic.email;
    }
  }

  if (sourceType === "prospect" && activity.source_id) {
    const { data: prospect } = await supabase
      .from("prospects")
      .select("id, company_name, city, province, region, email, phone, website, codice_ateco, descrizione_ateco, fatturato, dipendenti")
      .eq("id", activity.source_id).single();
    if (prospect) {
      partner = {
        id: prospect.id, company_name: prospect.company_name, company_alias: null,
        country_code: "IT", country_name: "Italia",
        city: [prospect.city, prospect.province].filter(Boolean).join(", "),
        email: prospect.email, phone: prospect.phone, website: prospect.website,
        profile_description: [prospect.descrizione_ateco, prospect.fatturato ? `Fatturato: €${(prospect.fatturato / 1_000_000).toFixed(1)}M` : null, prospect.dipendenti ? `Dipendenti: ${prospect.dipendenti}` : null].filter(Boolean).join(" · "),
        rating: null, raw_profile_markdown: null,
      };
      contact = null; contactEmail = prospect.email;
      const { data: pContacts } = await supabase.from("prospect_contacts").select("name, email, phone, role").eq("prospect_id", prospect.id).limit(1);
      if (pContacts?.[0]) {
        const pc = pContacts[0];
        contact = { id: prospect.id, name: pc.name, email: pc.email, direct_phone: pc.phone, mobile: null, title: pc.role, contact_alias: null };
        contactEmail = pc.email || prospect.email;
      }
    }
  }

  if (sourceType === "partner" || !contactEmail) {
    contactEmail = contact?.email || partner?.email || null;
  }

  return { partner, contact, contactEmail, sourceType, activityPartnerId: activity.partner_id };
}

export async function loadStandalonePartner(
  supabase: SupabaseClient, partnerId: string, recipientName?: string,
): Promise<LoadedEntity> {
  const { data: realPartner } = await supabase
    .from("partners")
    .select("id, company_name, company_alias, country_code, country_name, city, email, phone, website, profile_description, rating, raw_profile_markdown, enrichment_data, office_type, lead_status")
    .eq("id", partnerId).single();

  if (!realPartner) {
    return { partner: null, contact: null, contactEmail: null, sourceType: "standalone" };
  }

  const partner = realPartner as PartnerData;
  let contact: ContactData | null = null;
  let contactEmail = partner.email;

  const { data: contacts } = await supabase
    .from("partner_contacts").select("id, name, email, direct_phone, mobile, title, contact_alias")
    .eq("partner_id", partnerId).limit(5);

  if (contacts?.length) {
    const matched = recipientName
      ? contacts.find((c: Record<string, unknown>) => c.name?.toLowerCase().includes(recipientName.toLowerCase()) || c.contact_alias?.toLowerCase().includes(recipientName.toLowerCase())) || contacts[0]
      : contacts[0];
    contact = matched as ContactData;
    contactEmail = contact.email || partner.email;
  }

  return { partner, contact, contactEmail, sourceType: "partner" };
}

// ── Conversation Intelligence loader ──

interface ConversationIntelligence {
  convCtx: Record<string, unknown> | null;
  rules: Record<string, unknown> | null;
  classifications: Array<Record<string, unknown>>;
}

export async function loadConversationContext(
  supabase: SupabaseClient, userId: string, emailAddress: string | null, partnerId: string | null,
): Promise<ConversationIntelligence> {
  if (!emailAddress) return { convCtx: null, rules: null, classifications: [] };

  const [ctxRes, rulesRes, classRes] = await Promise.all([
    supabase.from("contact_conversation_context").select("*")
      .eq("user_id", userId).eq("email_address", emailAddress).maybeSingle(),
    supabase.from("email_address_rules").select("*, email_prompts(*)")
      .eq("user_id", userId).eq("email_address", emailAddress).maybeSingle(),
    supabase.from("email_classifications")
      .select("category, confidence, ai_summary, sentiment, action_suggested, classified_at")
      .eq("user_id", userId).eq("email_address", emailAddress)
      .order("classified_at", { ascending: false }).limit(3),
  ]);

  return {
    convCtx: ctxRes.data ?? null,
    rules: rulesRes.data ?? null,
    classifications: classRes.data ?? [],
  };
}

export function buildConversationBlock(intel: ConversationIntelligence): string {
  const parts: string[] = [];
  const { convCtx, rules, classifications } = intel;

  if (convCtx) {
    const exchanges = Array.isArray(convCtx.last_exchanges) ? convCtx.last_exchanges as Array<Record<string, unknown>> : [];
    if (convCtx.conversation_summary) {
      parts.push(`CONVERSATION HISTORY: ${convCtx.conversation_summary}`);
    }
    if (exchanges.length) {
      const last5 = exchanges.slice(-5).map((ex: Record<string, unknown>) =>
        `  ${ex.date || "?"} - ${ex.subject || "N/A"} - sentiment: ${ex.sentiment || "neutral"} - ${ex.summary || ""}`
      );
      parts.push(`Last ${last5.length} exchanges:\n${last5.join("\n")}`);
    }
    parts.push(`RESPONSE PATTERN: Response rate ${Math.round(convCtx.response_rate ?? 0)}%, avg response time ${convCtx.avg_response_time_hours != null ? `${Math.round(convCtx.avg_response_time_hours)}h` : "N/A"}, dominant sentiment: ${convCtx.dominant_sentiment || "neutral"}`);
  }

  if (rules) {
    const ruleParts: string[] = [];
    if (rules.tone_override) ruleParts.push(`Tone=${rules.tone_override}`);
    if (rules.topics_to_emphasize?.length) ruleParts.push(`Emphasize=${rules.topics_to_emphasize.join(", ")}`);
    if (rules.topics_to_avoid?.length) ruleParts.push(`Avoid=${rules.topics_to_avoid.join(", ")}`);
    if (ruleParts.length) parts.push(`SENDER RULES: ${ruleParts.join(", ")}`);
    if (rules.email_prompts?.instructions) {
      parts.push(`SENDER PROMPT: ${rules.email_prompts.instructions}`);
    }
  }

  if (classifications.length) {
    const classLines = classifications.map((c: Record<string, unknown>) =>
      `  ${c.category} (${Math.round((c.confidence ?? 0) * 100)}%) - ${c.ai_summary || "no summary"}`
    );
    parts.push(`RECENT CLASSIFICATIONS:\n${classLines.join("\n")}`);
  }

  if (!parts.length) return "";
  return `\nCONVERSATION INTELLIGENCE:\n${parts.join("\n")}\n`;
}

// ── Context blocks assembly ──

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
  // ── Deep Search status (per _context_summary) ──
  deepSearchStatus?: "fresh" | "cached" | "stale" | "missing" | "skipped" | "failed";
  deepSearchAgeDays?: number | null;
}

/**
 * Fix 3.2 — Loader del playbook commerciale attivo (parallelo a generate-outreach).
 */
async function loadActivePlaybook(
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
  lines.push(`\nQuesto playbook GUIDA tono, contenuto e CTA. Rispetta le istruzioni prima della KB generica.`);

  return { block: lines.join("\n") + "\n", active: true };
}

export async function assembleContextBlocks(
  supabase: SupabaseClient, userId: string, partner: PartnerData, contact: ContactData | null,
  contactEmail: string | null, sourceType: string, quality: Quality, standalone: boolean,
  opts: { oracle_type?: string; use_kb?: boolean; document_ids?: string[]; partner_id?: string; activityPartnerId?: string | null; deep_search?: boolean; authHeader?: string; email_type_kb_categories?: string[] | null },
): Promise<ContextBlocks> {
  const isPartnerSource = (sourceType === "partner" && partner.id) && (!standalone || opts.partner_id);

  // ── Auto-generate aliases if missing ──
  const needsCompanyAlias = !standalone && !partner.company_alias;
  const needsContactAlias = contact && !contact.contact_alias;
  if (needsCompanyAlias || needsContactAlias) {
    const generated = await generateAliasesInline(partner.company_name, contact?.name || null, contact?.title || null);
    if (generated.company_alias && needsCompanyAlias) {
      partner.company_alias = generated.company_alias;
      if (sourceType === "partner") await supabase.from("partners").update({ company_alias: generated.company_alias }).eq("id", partner.id!);
      else if (sourceType === "contact") await supabase.from("imported_contacts").update({ company_alias: generated.company_alias }).eq("id", partner.id!);
    }
    if (generated.contact_alias && needsContactAlias && contact) {
      contact.contact_alias = generated.contact_alias;
      if (sourceType === "partner") await supabase.from("partner_contacts").update({ contact_alias: generated.contact_alias }).eq("id", contact.id);
      else if (sourceType === "contact") await supabase.from("imported_contacts").update({ contact_alias: generated.contact_alias }).eq("id", contact.id);
    }
  }

  // ── Parallel data loading ──
  const [networksRes, servicesRes, settingsRes, socialRes] = await Promise.all([
    isPartnerSource ? supabase.from("partner_networks").select("network_name").eq("partner_id", partner.id!) : Promise.resolve({ data: [] }),
    isPartnerSource && quality !== "fast" ? supabase.from("partner_services").select("service_category").eq("partner_id", partner.id!) : Promise.resolve({ data: [] }),
    supabase.from("app_settings").select("key, value").eq("user_id", userId).like("key", "ai_%"),
    isPartnerSource && quality === "premium" ? supabase.from("partner_social_links").select("platform, url, contact_id").eq("partner_id", partner.id!) : Promise.resolve({ data: [] }),
  ]);

  const networks = (networksRes.data || []) as NetworkRow[];
  const services = (servicesRes.data || []) as ServiceRow[];
  const socialLinks = (socialRes.data || []) as SocialLinkRow[];
  const settings: Record<string, string> = {};
  ((settingsRes.data || []) as { key: string; value: string | null }[]).forEach((r) => { settings[r.key] = r.value || ""; });

  // ── Style Preferences from AI Memory ──
  let stylePreferencesContext = "";
  const { data: styleMemories } = await supabase
    .from("ai_memory").select("content, confidence, access_count")
    .eq("user_id", userId).contains("tags", ["style_preference"])
    .gte("confidence", 30).order("access_count", { ascending: false }).limit(5);
  if (styleMemories?.length) {
    stylePreferencesContext = `\nPREFERENZE DI STILE APPRESE (dall'editing dell'utente):\n${(styleMemories as StyleMemoryRow[]).map((m) => `- ${m.content}`).join("\n")}\nAPPLICA queste preferenze nella generazione.\n`;
  }

  // ── Edit Patterns ──
  let editPatternsContext = "";
  {
    // Fix 3 (Gap C): inferenza category sicura — qui non abbiamo ancora touchCount, usiamo solo oracle_type esplicito
    const emailCategory = opts.oracle_type || null;
    const countryFilter = partner.country_code || null;
    let epQuery = supabase.from("ai_edit_patterns")
      .select("email_type, country_code, hook_original, hook_final, cta_original, cta_final, tone_delta, formality_shift, length_delta_percent")
      .eq("user_id", userId).in("significance", ["medium", "high"]).order("created_at", { ascending: false }).limit(10);
    if (countryFilter) epQuery = epQuery.eq("country_code", countryFilter);
    if (emailCategory) epQuery = epQuery.eq("email_type", emailCategory);
    let { data: editPatterns } = await epQuery;
    if (!editPatterns?.length && (countryFilter || emailCategory)) {
      const { data: fallback } = await supabase.from("ai_edit_patterns")
        .select("email_type, country_code, hook_original, hook_final, cta_original, cta_final, tone_delta, formality_shift, length_delta_percent")
        .eq("user_id", userId).in("significance", ["medium", "high"]).order("created_at", { ascending: false }).limit(10);
      editPatterns = fallback;
    }
    if (editPatterns?.length) {
      const lines = editPatterns.map((ep: Record<string, unknown>) =>
        `- ${ep.email_type || "generico"} verso ${ep.country_code || "??"}: Hook cambiato da '${(ep.hook_original || "").slice(0, 60)}' a '${(ep.hook_final || "").slice(0, 60)}', CTA da '${(ep.cta_original || "").slice(0, 60)}' a '${(ep.cta_final || "").slice(0, 60)}', tono: ${ep.tone_delta || "invariato"}, formalità: ${ep.formality_shift || "invariata"}, lunghezza: ${ep.length_delta_percent || 0}%`
      );
      editPatternsContext = `\nPATTERN DI EDITING DELL'UTENTE (modifiche precedenti alle email generate):\n${lines.join("\n")}\nADATTA lo stile in base a questi pattern.\n`;
    }
  }

  // ── Response Patterns ──
  let responseInsightsContext = "";
  {
    let rpQuery = supabase.from("response_patterns")
      .select("country_code, channel, email_type, total_sent, total_responses, response_rate, avg_response_time_hours, pattern_confidence")
      .eq("user_id", userId).gte("pattern_confidence", 0.5).gte("total_sent", 3)
      .order("pattern_confidence", { ascending: false }).limit(5);
    if (partner.country_code) rpQuery = rpQuery.eq("country_code", partner.country_code);
    const { data: responsePatterns } = await rpQuery;
    if (responsePatterns?.length) {
      const lines = responsePatterns.map((rp: Record<string, unknown>) =>
        `- ${rp.country_code || "Global"} ${rp.channel} ${rp.email_type || "generico"}: ${rp.total_responses}/${rp.total_sent} risposte (${Math.round(Number(rp.response_rate))}%), tempo medio: ${rp.avg_response_time_hours != null ? `${rp.avg_response_time_hours}h` : "N/A"}`
      );
      responseInsightsContext = `\nINSIGHT DALLE RISPOSTE RICEVUTE (dati reali):\n${lines.join("\n")}\n`;
    }
  }

  // ── Commercial Intelligence (Same-Location Guard, Relationship, Branches) ──
  const { checkSameLocationContacts, getSameCompanyBranches, analyzeRelationshipHistory, buildInterlocutorTypeBlock, buildBranchCoordinationBlock, buildRelationshipAnalysisBlock } = await import("../_shared/sameLocationGuard.ts");

  const effectivePartnerId = isPartnerSource ? (opts.activityPartnerId || partner.id) : partner.id;

  // Same-Location Guard
  if (!standalone && effectivePartnerId) {
    const guardResult = await checkSameLocationContacts(supabase, effectivePartnerId, contactEmail, userId);
    if (!guardResult.allowed) {
      throw Object.assign(new Error(guardResult.reason), { code: "duplicate_branch", recentContact: guardResult.recentContact, partnerName: partner.company_name });
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

    // Extract commercial state from metrics + partner.lead_status
    const m = metrics as Record<string, unknown>;
    commercialState = (m.commercial_state as string | undefined) ?? (partner.lead_status as string | undefined);
    touchCount = typeof m.total_interactions === "number" ? m.total_interactions : (typeof m.touch_count === "number" ? m.touch_count : undefined);
    daysSinceLastContact = typeof m.days_since_last_contact === "number" ? m.days_since_last_contact : undefined;
    warmthScore = typeof m.warmth_score === "number" ? m.warmth_score : undefined;
    lastChannel = m.last_channel as string | undefined;
    lastOutcome = m.last_outcome as string | undefined;
  }
  const interlocutorBlock = buildInterlocutorTypeBlock(sourceType);

  // ── Met in Person ──
  let metInPersonContext = "";
  if (effectivePartnerId) {
    const { data: bcaRows } = await supabase.from("business_cards")
      .select("contact_name, event_name, met_at, location").eq("matched_partner_id", effectivePartnerId).limit(3);
    if (bcaRows?.length) {
      const encounters = (bcaRows as BusinessCardRow[]).map((bc) => {
        const parts: string[] = [];
        if (bc.event_name) parts.push(`Evento: ${bc.event_name}`);
        if (bc.contact_name) parts.push(`Contatto: ${bc.contact_name}`);
        if (bc.met_at) parts.push(`Data: ${bc.met_at}`);
        if (bc.location) parts.push(`Luogo: ${bc.location}`);
        return parts.join(", ");
      }).join("\n");
      metInPersonContext = `\nINCONTRO DI PERSONA:\nIncontri registrati con questa azienda:\n${encounters}\n`;
    }
  }

  // ── Cached Enrichment Data + optional live Deep Search ──
  let cachedEnrichmentContext = "";
  let deepSearchStatus: "fresh" | "cached" | "stale" | "missing" | "skipped" | "failed" = "missing";
  let deepSearchAgeDays: number | null = null;
  if (effectivePartnerId) {
    // LOVABLE-72: usa adapter unificato (Base + Deep Local + Legacy + Sherlock)
    const unified = await readUnifiedEnrichment(effectivePartnerId, supabase);
    deepSearchAgeDays = unified.freshness.deep_age_days ?? unified.freshness.base_age_days;
    if (unified.has_any) {
      deepSearchStatus = (deepSearchAgeDays != null && deepSearchAgeDays > 30) ? "stale" : "cached";
      const block = formatEnrichmentForPrompt(unified);
      if (block) cachedEnrichmentContext = `\n${block}\n`;
    } else {
      deepSearchStatus = "missing";
    }
    if (opts.deep_search !== true && deepSearchStatus === "cached") {
      deepSearchStatus = "skipped";
    }
  }

  // ── Documents ──
  let documentsContext = "";
  if (quality !== "fast" && opts.document_ids?.length) {
    const { data: docs } = await supabase.from("workspace_documents").select("file_name, extracted_text").in("id", opts.document_ids);
    if (docs?.length) {
      const docTexts = (docs as DocRow[]).filter((d) => d.extracted_text).map((d) => `--- ${d.file_name} ---\n${d.extracted_text!.substring(0, 3000)}`).join("\n\n");
      if (docTexts) documentsContext = `\nDOCUMENTI DI RIFERIMENTO:\n${docTexts}\n`;
    }
  }

  // ── Conversation Intelligence ──
  const convIntel = await loadConversationContext(supabase, userId, contactEmail, effectivePartnerId ?? null);
  const conversationIntelligenceContext = buildConversationBlock(convIntel);

  // ── Sales KB ──
  // Fix 3 (Gap C): nessun fallback hardcoded — se oracle_type manca, deriva da touchCount/commercialState
  const tcForCategory = touchCount ?? 0;
  const inferredCategory = tcForCategory === 0 ? "primo_contatto" : "follow_up";
  const emailCategory = opts.oracle_type || inferredCategory;
  const isFollowUp = emailCategory === "follow_up" || historyContext.includes("[") || tcForCategory > 0;
  const kbResult = await fetchKbEntriesStrategic(supabase, quality, userId, {
    emailCategory,
    hasInteractionHistory: !!historyContext,
    isFollowUp,
    // Fix 1 (Gap A): propagate KB categories defined by the selected EmailType
    kb_categories: opts.email_type_kb_categories ?? undefined,
  });
  if (!kbResult.text && settings.ai_sales_knowledge_base) {
    console.warn("[generate-email] kb_entries vuoto, fallback monolitico DEPRECATO — migrare a kb_entries");
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
    historyContext, relationshipBlock, branchBlock, interlocutorBlock,
    metInPersonContext, cachedEnrichmentContext, documentsContext,
    stylePreferencesContext, editPatternsContext, responseInsightsContext,
    conversationIntelligenceContext,
    salesKBSlice: kbResult.text, salesKBSections: kbResult.sections_used,
    signatureBlock, networks, services, socialLinks, settings,
    commercialState, touchCount, daysSinceLastContact, warmthScore, lastChannel, lastOutcome,
    playbookBlock: playbook.block, playbookActive: playbook.active,
    deepSearchStatus, deepSearchAgeDays,
  };
}
