import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { aiChat, mapErrorToResponse } from "../_shared/aiGateway.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimiter.ts";
import type { Quality } from "../_shared/kbSlice.ts";

// ── Type definitions for DB entities ──
interface PartnerData {
  id: string | null;
  company_name: string;
  company_alias: string | null;
  country_code: string;
  country_name: string;
  city: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  profile_description: string | null;
  rating: number | null;
  raw_profile_markdown: string | null;
  enrichment_data?: Record<string, unknown>;
  office_type?: string;
  lead_status?: string;
}

interface ContactData {
  id: string;
  name: string;
  email: string | null;
  direct_phone: string | null;
  mobile: string | null;
  title: string | null;
  contact_alias: string | null;
}

interface ActivityData {
  id: string;
  partner_id: string | null;
  source_type: string;
  source_id: string;
  partners: PartnerData | null;
  selected_contact: ContactData | null;
}

interface KbEntry {
  title: string;
  content: string;
  category: string;
  chapter: string;
  tags: string[];
}

interface SettingRow {
  key: string;
  value: string | null;
}

interface NetworkRow {
  network_name: string;
}

interface ServiceRow {
  service_category: string;
}

interface SocialLinkRow {
  platform: string;
  url: string;
  contact_id: string | null;
}

interface BusinessCardRow {
  contact_name: string | null;
  event_name: string | null;
  met_at: string | null;
  location: string | null;
}

interface StyleMemoryRow {
  content: string;
  confidence: number;
  access_count: number;
}

interface DocRow {
  file_name: string;
  extracted_text: string | null;
}

type SupabaseClient = ReturnType<typeof createClient>;

/**
 * STRATEGIC ADVISOR — Intelligent KB Selection
 */
async function fetchKbEntriesStrategic(
  supabase: SupabaseClient,
  quality: Quality,
  userId: string,
  context: {
    emailCategory?: string;
    hasInteractionHistory?: boolean;
    isFollowUp?: boolean;
    kb_categories?: string[];
  }
): Promise<{ text: string; sections_used: string[] }> {
  const limit = quality === "fast" ? 8 : quality === "standard" ? 18 : 40;

  const categories: string[] = ["regole_sistema", "filosofia"];

  if (context.kb_categories?.length) {
    categories.push(...context.kb_categories);
  }

  categories.push("struttura_email", "hook", "cold_outreach", "dati_partner");
  if (context.isFollowUp) categories.push("followup", "chris_voss", "obiezioni");
  if (quality !== "fast") categories.push("negoziazione", "tono", "frasi_modello");
  if (quality === "premium") {
    categories.push("arsenale", "persuasione", "chiusura", "errori");
  }

  const uniqueCategories = [...new Set(categories)];

  const { data: entries } = await supabase
    .from("kb_entries")
    .select("title, content, category, chapter, tags")
    .eq("user_id", userId)
    .eq("is_active", true)
    .in("category", uniqueCategories)
    .order("priority", { ascending: false })
    .order("sort_order")
    .limit(limit);

  if (!entries || entries.length === 0) return { text: "", sections_used: [] };

  const sectionsUsed = [...new Set((entries as KbEntry[]).map((e) => e.category))];

  const text = (entries as KbEntry[])
    .map((e) => `### ${e.title} [${e.chapter}]\n${e.content}`)
    .join("\n\n---\n\n");

  return { text, sections_used: sectionsUsed };
}

/** Build the Strategic Advisor — context-driven, not prescriptive */
function buildStrategicAdvisor(context: {
  emailCategory?: string;
  hasHistory?: boolean;
  followUpCount?: number;
  hasEnrichmentData?: boolean;
}): string {
  return `
# STRATEGIC ADVISOR — Contesto per Decisione Autonoma

Hai accesso a una Knowledge Base di tecniche di vendita, negoziazione e comunicazione B2B.
Seleziona autonomamente le tecniche più appropriate in base al contesto sottostante.

## Contesto:
- Tipo email: ${context.emailCategory || "generico"}
- Storia interazioni disponibile: ${context.hasHistory ? "SÌ" : "NO"}
- Tentativo follow-up: ${context.followUpCount ? `#${context.followUpCount}` : "N/A"}
- Dati enrichment disponibili: ${context.hasEnrichmentData ? "SÌ" : "NO"}

## Guardrail:
- Se c'è storia interazioni → non ripetere approcci già usati
- Se dati enrichment scarsi → resta generico ma vero
- Ogni comunicazione deve portare VALORE NUOVO
`;
}

// ── Shared utilities (single source of truth) ──
import { getLanguageHint, isLikelyPersonName } from "../_shared/textUtils.ts";

/** Validate URL: only allow http/https, block private IPs */
function isValidPublicUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    const host = parsed.hostname;
    if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|0\.|169\.254\.|localhost|::1|fc|fd)/i.test(host)) return false;
    return true;
  } catch {
    return false;
  }
}

/** Generate aliases inline via AI if missing — lightweight single-item call */
async function generateAliasesInline(
  companyName: string,
  contactName: string | null,
  contactTitle: string | null,
): Promise<{ company_alias: string; contact_alias: string }> {
  const prompt = `Genera alias per:
- Azienda: "${companyName}" → rimuovi suffissi legali (SRL, LLC, Ltd, GmbH, etc.) e città dal nome
- Contatto: "${contactName || ""}" (ruolo: ${contactTitle || "N/A"}) → usa SOLO il cognome, rimuovi titoli (Mr., Mrs., Dr., etc.). Se sembra un ruolo e non un nome di persona, restituisci ""

Rispondi SOLO con JSON: {"company_alias":"...","contact_alias":"..."}`;

  try {
    const result = await aiChat({
      models: ["google/gemini-2.5-flash-lite"],
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
      max_tokens: 100,
      timeoutMs: 8000,
      context: "generate-email:alias",
    });
    const text = result.content || "";
    const jsonMatch = text.match(/\{[^}]+\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error("Inline alias generation failed:", e);
  }
  return { company_alias: "", contact_alias: "" };
}

serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;

  const origin = req.headers.get("origin");
  const dynCors = getCorsHeaders(origin);

  try {
    // ── Auth check (REQUIRED) ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const { activity_id, goal, base_proposal, language, document_ids, reference_urls, quality: rawQuality, oracle_type, oracle_tone, use_kb, deep_search, standalone, partner_id, recipient_count, recipient_countries, recipient_name, recipient_company } = await req.json();

    const quality: Quality = (["fast", "standard", "premium"].includes(rawQuality) ? rawQuality : "standard") as Quality;

    // Use service role for data queries (user is already authenticated above)
    const supabase = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let partner: PartnerData | null = null;
    let contact: ContactData | null = null;
    let contactEmail: string | null = null;
    let sourceType = "partner";
    let activity: ActivityData | null = null;

    if (standalone && partner_id) {
      // ── STANDALONE + PARTNER_ID MODE: load real partner data from DB ──
      console.log(`Standalone mode with real partner_id: ${partner_id}`);
      const { data: realPartner } = await supabase
        .from("partners")
        .select("id, company_name, company_alias, country_code, country_name, city, email, phone, website, profile_description, rating, raw_profile_markdown, enrichment_data, office_type, lead_status")
        .eq("id", partner_id)
        .single();

      if (realPartner) {
        partner = realPartner as PartnerData;
        sourceType = "partner";

        // Load contacts for this partner
        const { data: contacts } = await supabase
          .from("partner_contacts")
          .select("id, name, email, direct_phone, mobile, title, contact_alias")
          .eq("partner_id", partner_id)
          .limit(5);

        if (contacts?.length) {
          const matchedContact = recipient_name
            ? contacts.find((c: ContactData) =>
                c.name?.toLowerCase().includes(recipient_name.toLowerCase()) ||
                c.contact_alias?.toLowerCase().includes(recipient_name.toLowerCase())
              ) || contacts[0]
            : contacts[0];
          contact = matchedContact as ContactData;
          contactEmail = contact.email || partner.email;
        } else {
          contactEmail = partner.email;
        }
      } else {
        // Fallback to synthetic partner if not found
        partner = {
          id: partner_id,
          company_name: recipient_company || "Destinatario",
          company_alias: recipient_company || null,
          country_code: "IT",
          country_name: recipient_countries || "",
          city: "",
          email: null, phone: null, website: null,
          profile_description: null, rating: null, raw_profile_markdown: null,
        };
        sourceType = "standalone";
      }
    } else if (standalone) {
      // ── STANDALONE MODE (no partner_id): generic/synthetic partner ──
      const firstCountry = (recipient_countries || "").split(/[,;\s]+/).find((s: string) => s.trim().length === 2) || "IT";
      partner = {
        id: null,
        company_name: recipient_company || "Destinatario generico",
        company_alias: recipient_company || null,
        country_code: firstCountry.toUpperCase().trim(),
        country_name: recipient_countries || "Vari",
        city: "",
        email: null,
        phone: null,
        website: null,
        profile_description: null,
        rating: null,
        raw_profile_markdown: null,
      };
      if (recipient_name) {
        contact = {
          id: "",
          name: recipient_name,
          contact_alias: recipient_name,
          title: null, email: null, direct_phone: null, mobile: null,
        };
      } else {
        contact = null;
      }
      contactEmail = "destinatario@email.com";
      sourceType = "standalone";
    } else {
      // ── ACTIVITY MODE: original logic ──
      if (!activity_id) throw new Error("activity_id is required");

    // Fetch activity
    const { data: actData, error: actErr } = await supabase
      .from("activities")
      .select(`
        *,
        partners(
          id, company_name, company_alias, country_code, country_name, city,
          email, phone, website, profile_description, rating,
          raw_profile_markdown
        ),
        selected_contact:partner_contacts!activities_selected_contact_id_fkey(
          id, name, email, direct_phone, mobile, title, contact_alias
        )
      `)
      .eq("id", activity_id)
      .single();

    if (actErr || !actData) throw new Error("Activity not found");
    activity = actData as unknown as ActivityData;

    sourceType = activity.source_type || "partner";
    partner = activity.partners;
    contact = activity.selected_contact;

    // For contact-source activities, fetch from imported_contacts
    if (sourceType === "contact" && activity.source_id) {
      const { data: importedContact } = await supabase
        .from("imported_contacts")
        .select("id, company_name, company_alias, name, contact_alias, email, phone, mobile, country, city, position, origin, note")
        .eq("id", activity.source_id)
        .single();
      if (importedContact) {
        partner = {
          id: importedContact.id,
          company_name: importedContact.company_name || "Azienda sconosciuta",
          company_alias: importedContact.company_alias,
          country_code: importedContact.country || "??",
          country_name: importedContact.country || "Sconosciuto",
          city: importedContact.city || "",
          email: importedContact.email,
          phone: importedContact.phone,
          website: null,
          profile_description: importedContact.note,
          rating: null,
          raw_profile_markdown: null,
        };
        contact = {
          id: importedContact.id,
          name: importedContact.name || importedContact.company_name || "",
          email: importedContact.email,
          direct_phone: importedContact.phone,
          mobile: importedContact.mobile,
          title: importedContact.position,
          contact_alias: importedContact.contact_alias,
        };
        contactEmail = importedContact.email;
      }
    }

    // For prospect-source activities, fetch from prospects
    if (sourceType === "prospect" && activity.source_id) {
      const { data: prospect } = await supabase
        .from("prospects")
        .select("id, company_name, city, province, region, email, phone, website, codice_ateco, descrizione_ateco, fatturato, dipendenti")
        .eq("id", activity.source_id)
        .single();
      if (prospect) {
        partner = {
          id: prospect.id,
          company_name: prospect.company_name,
          company_alias: null,
          country_code: "IT",
          country_name: "Italia",
          city: [prospect.city, prospect.province].filter(Boolean).join(", "),
          email: prospect.email,
          phone: prospect.phone,
          website: prospect.website,
          profile_description: [
            prospect.descrizione_ateco,
            prospect.fatturato ? `Fatturato: €${(prospect.fatturato / 1_000_000).toFixed(1)}M` : null,
            prospect.dipendenti ? `Dipendenti: ${prospect.dipendenti}` : null,
          ].filter(Boolean).join(" · "),
          rating: null,
          raw_profile_markdown: null,
        };
        contact = null;
        contactEmail = prospect.email;

        // Try to find prospect contacts
        const { data: pContacts } = await supabase
          .from("prospect_contacts")
          .select("name, email, phone, role")
          .eq("prospect_id", prospect.id)
          .limit(1);
        if (pContacts?.[0]) {
          const pc = pContacts[0];
          contact = {
            id: prospect.id,
            name: pc.name,
            email: pc.email,
            direct_phone: pc.phone,
            mobile: null,
            title: pc.role,
            contact_alias: null,
          };
          contactEmail = pc.email || prospect.email;
        }
      }
    }

    // For partner source (default), keep existing logic
    if (sourceType === "partner" || !contactEmail) {
      contactEmail = contact?.email || partner?.email || null;
    }

    if (!partner) throw new Error("Source entity not found");
    } // end non-standalone

    // --- VALIDATION: partner source MUST have a selected contact ---
    if (!standalone && sourceType === "partner" && !contact) {
      return new Response(
        JSON.stringify({
          error: "no_contact",
          message: "Nessun contatto selezionato. Seleziona un contatto prima di generare l'email.",
          partner_name: partner!.company_name,
        }),
        { status: 422, headers: { ...dynCors, "Content-Type": "application/json" } }
      );
    }

    // --- VALIDATION: check contact has email ---
    if (!standalone && !contactEmail) {
      return new Response(
        JSON.stringify({
          error: "no_email",
          message: "Nessun indirizzo email disponibile per questo contatto/partner",
          partner_name: partner!.company_name,
          contact_name: contact?.name || null,
        }),
        { status: 422, headers: { ...dynCors, "Content-Type": "application/json" } }
      );
    }

    // ── AUTO-GENERATE ALIASES IF MISSING ──
    const needsCompanyAlias = !standalone && !partner!.company_alias;
    const needsContactAlias = contact && !contact.contact_alias;

    if (needsCompanyAlias || needsContactAlias) {
      console.log(`Auto-generating aliases for ${partner!.company_name} (company: ${needsCompanyAlias}, contact: ${needsContactAlias})`);
      const generated = await generateAliasesInline(
        partner!.company_name,
        contact?.name || null,
        contact?.title || null,
      );

      if (generated.company_alias && needsCompanyAlias) {
        partner!.company_alias = generated.company_alias;
        if (sourceType === "partner") {
          await supabase.from("partners").update({ company_alias: generated.company_alias }).eq("id", partner!.id!);
        } else if (sourceType === "contact") {
          await supabase.from("imported_contacts").update({ company_alias: generated.company_alias }).eq("id", partner!.id!);
        }
      }
      if (generated.contact_alias && needsContactAlias && contact) {
        contact.contact_alias = generated.contact_alias;
        if (sourceType === "partner") {
          await supabase.from("partner_contacts").update({ contact_alias: generated.contact_alias }).eq("id", contact.id);
        } else if (sourceType === "contact") {
          await supabase.from("imported_contacts").update({ contact_alias: generated.contact_alias }).eq("id", contact.id);
        }
      }
      console.log(`Aliases generated — company: "${generated.company_alias}", contact: "${generated.contact_alias}"`);
    }

    // Fetch partner networks, services, social links, settings in parallel
    const isPartnerSource = (sourceType === "partner" && partner?.id) && (!standalone || partner_id);
    const [networksRes, servicesRes, settingsRes, socialRes] = await Promise.all([
      isPartnerSource
        ? supabase.from("partner_networks").select("network_name").eq("partner_id", partner!.id!)
        : Promise.resolve({ data: [] as NetworkRow[] }),
      isPartnerSource && quality !== "fast"
        ? supabase.from("partner_services").select("service_category").eq("partner_id", partner!.id!)
        : Promise.resolve({ data: [] as ServiceRow[] }),
      supabase.from("app_settings").select("key, value").eq("user_id", userId).like("key", "ai_%"),
      isPartnerSource && quality === "premium"
        ? supabase.from("partner_social_links").select("platform, url, contact_id").eq("partner_id", partner!.id!)
        : Promise.resolve({ data: [] as SocialLinkRow[] }),
    ]);

    const networks = (networksRes.data || []) as NetworkRow[];
    const services = (servicesRes.data || []) as ServiceRow[];
    const socialLinks = (socialRes.data || []) as SocialLinkRow[];

    const settings: Record<string, string> = {};
    ((settingsRes.data || []) as SettingRow[]).forEach((r) => { settings[r.key] = r.value || ""; });

    // ─── Style Preferences from AI Memory (learned from user edits) ───
    let stylePreferencesContext = "";
    const { data: styleMemories } = await supabase
      .from("ai_memory")
      .select("content, confidence, access_count")
      .eq("user_id", userId)
      .contains("tags", ["style_preference"])
      .gte("confidence", 30)
      .order("access_count", { ascending: false })
      .limit(5);
    if (styleMemories && styleMemories.length > 0) {
      stylePreferencesContext = `\nPREFERENZE DI STILE APPRESE (dall'editing dell'utente):\n${(styleMemories as StyleMemoryRow[]).map((m) => `- ${m.content}`).join("\n")}\nAPPLICA queste preferenze nella generazione.\n`;
    }

    // ─── Edit Patterns from user corrections (ai_edit_patterns) ───
    let editPatternsContext = "";
    {
      const countryFilter = partner?.country_code || null;
      const typeFilter = emailCategory || null;

      // Try specific filters first
      let epQuery = supabase
        .from("ai_edit_patterns")
        .select("email_type, country_code, hook_original, hook_final, cta_original, cta_final, tone_delta, formality_shift, length_delta_percent")
        .eq("user_id", userId)
        .in("significance", ["medium", "high"])
        .order("created_at", { ascending: false })
        .limit(10);
      if (countryFilter) epQuery = epQuery.eq("country_code", countryFilter);
      if (typeFilter) epQuery = epQuery.eq("email_type", typeFilter);

      let { data: editPatterns } = await epQuery;

      // Fallback: broader query without country/type filters
      if ((!editPatterns || editPatterns.length === 0) && (countryFilter || typeFilter)) {
        const { data: fallback } = await supabase
          .from("ai_edit_patterns")
          .select("email_type, country_code, hook_original, hook_final, cta_original, cta_final, tone_delta, formality_shift, length_delta_percent")
          .eq("user_id", userId)
          .in("significance", ["medium", "high"])
          .order("created_at", { ascending: false })
          .limit(10);
        editPatterns = fallback;
      }

      if (editPatterns && editPatterns.length > 0) {
        const lines = editPatterns.map((ep) =>
          `- ${ep.email_type || "generico"} verso ${ep.country_code || "??"}: Hook cambiato da '${(ep.hook_original || "").slice(0, 60)}' a '${(ep.hook_final || "").slice(0, 60)}', CTA da '${(ep.cta_original || "").slice(0, 60)}' a '${(ep.cta_final || "").slice(0, 60)}', tono: ${ep.tone_delta || "invariato"}, formalità: ${ep.formality_shift || "invariata"}, lunghezza: ${ep.length_delta_percent || 0}%`
        );
        editPatternsContext = `\nPATTERN DI EDITING DELL'UTENTE (modifiche precedenti alle email generate):\n${lines.join("\n")}\nADATTA lo stile in base a questi pattern.\n`;
      }
    }

    // ─── Response Patterns (real data from response_patterns table) ───
    let responseInsightsContext = "";
    {
      let rpQuery = supabase
        .from("response_patterns")
        .select("country_code, channel, email_type, total_sent, total_responses, response_rate, avg_response_time_hours, pattern_confidence")
        .eq("user_id", userId)
        .gte("pattern_confidence", 0.5)
        .gte("total_sent", 3)
        .order("pattern_confidence", { ascending: false })
        .limit(5);
      if (partner?.country_code) rpQuery = rpQuery.eq("country_code", partner.country_code);

      const { data: responsePatterns } = await rpQuery;

      if (responsePatterns && responsePatterns.length > 0) {
        const lines = responsePatterns.map((rp) =>
          `- ${rp.country_code || "Global"} ${rp.channel} ${rp.email_type || "generico"}: ${rp.total_responses}/${rp.total_sent} risposte (${Math.round(Number(rp.response_rate))}%), tempo medio risposta: ${rp.avg_response_time_hours != null ? `${rp.avg_response_time_hours}h` : "N/A"}, confidence: ${rp.pattern_confidence}`
        );
        responseInsightsContext = `\nINSIGHT DALLE RISPOSTE RICEVUTE (dati reali):\n${lines.join("\n")}\n`;
      }
    }

    // ─── Import commercial intelligence modules ───
    const { checkSameLocationContacts, getSameCompanyBranches, analyzeRelationshipHistory, buildInterlocutorTypeBlock, buildBranchCoordinationBlock, buildRelationshipAnalysisBlock } = await import("../_shared/sameLocationGuard.ts");

    // ─── Same-Location Guard: prevent duplicate comms to same branch ───
    const effectivePartnerId = isPartnerSource ? (activity?.partner_id || partner?.id) : partner?.id;

    if (!standalone && effectivePartnerId) {
      const guardResult = await checkSameLocationContacts(
        supabase, effectivePartnerId, contactEmail, userId
      );
      if (!guardResult.allowed) {
        return new Response(
          JSON.stringify({
            error: "duplicate_branch",
            message: guardResult.reason,
            recent_contact: guardResult.recentContact,
          }),
          { status: 422, headers: { ...dynCors, "Content-Type": "application/json" } }
        );
      }
    }

    // ─── Enhanced Relationship History (semantic analysis) ───
    let historyContext = "";
    let relationshipBlock = "";
    let branchBlock = "";
    let interlocutorBlock = "";

    if (effectivePartnerId) {
      const { metrics, historyText } = await analyzeRelationshipHistory(supabase, effectivePartnerId, userId);
      if (historyText) historyContext = `\n${historyText}\n`;
      relationshipBlock = buildRelationshipAnalysisBlock(metrics);

      // Branch coordination
      const branches = await getSameCompanyBranches(supabase, effectivePartnerId);
      branchBlock = buildBranchCoordinationBlock(branches, partner?.city);
    }

    // ─── Interlocutor Type (Partner vs End Client) ───
    interlocutorBlock = buildInterlocutorTypeBlock(sourceType);

    // ─── "Met in Person" Context from Business Cards ───
    let metInPersonContext = "";
    if (effectivePartnerId) {
      const { data: bcaRows } = await supabase
        .from("business_cards")
        .select("contact_name, event_name, met_at, location")
        .eq("matched_partner_id", effectivePartnerId)
        .limit(3);
      if (bcaRows && bcaRows.length > 0) {
        const encounters = (bcaRows as BusinessCardRow[]).map((bc) => {
          const parts: string[] = [];
          if (bc.event_name) parts.push(`Evento: ${bc.event_name}`);
          if (bc.contact_name) parts.push(`Contatto: ${bc.contact_name}`);
          if (bc.met_at) parts.push(`Data: ${bc.met_at}`);
          if (bc.location) parts.push(`Luogo: ${bc.location}`);
          return parts.join(", ");
        }).join("\n");
        metInPersonContext = `\nINCONTRO DI PERSONA:
Incontri registrati con questa azienda:
${encounters}
`;
      }
    }

    // ─── Cached Enrichment Data (website/LinkedIn summaries from DB) ───
    let cachedEnrichmentContext = "";
    if (effectivePartnerId) {
      const { data: partnerEd } = await supabase
        .from("partners")
        .select("enrichment_data")
        .eq("id", effectivePartnerId)
        .single();
      if (partnerEd?.enrichment_data) {
        const ed = partnerEd.enrichment_data as Record<string, unknown>;
        if (ed.website_summary) {
          cachedEnrichmentContext += `\nINFORMAZIONI DAL SITO AZIENDALE:\n${String(ed.website_summary).slice(0, 600)}\n`;
        }
        if (ed.linkedin_summary) {
          cachedEnrichmentContext += `\nPROFILO LINKEDIN:\n${String(ed.linkedin_summary).slice(0, 500)}\n`;
        }
        if (ed.deep_search_summary) {
          cachedEnrichmentContext += `\nDEEP SEARCH:\n${String(ed.deep_search_summary).slice(0, 400)}\n`;
        }
      }
    }

    // Fetch workspace documents text — skip for "fast"
    let documentsContext = "";
    if (quality !== "fast" && document_ids && document_ids.length > 0) {
      const { data: docs } = await supabase
        .from("workspace_documents")
        .select("file_name, extracted_text")
        .in("id", document_ids);
      if (docs && docs.length > 0) {
        const docTexts = (docs as DocRow[])
          .filter((d) => d.extracted_text)
          .map((d) => `--- ${d.file_name} ---\n${d.extracted_text!.substring(0, 3000)}`)
          .join("\n\n");
        if (docTexts) {
          documentsContext = `\nDOCUMENTI DI RIFERIMENTO:\n${docTexts}\n`;
        }
      }
    }

    // Reference URLs — use cached data only (no live scraping)
    let linksContext = "";
    // Firecrawl removed — reference URLs are no longer scraped live

    // LinkedIn context — only for premium
    let linkedinContext = "";
    if (quality === "premium") {
      const companyLinkedIn = socialLinks.find((l) => l.platform === "linkedin" && !l.contact_id);
      const contactLinkedIn = contact
        ? socialLinks.find((l) => l.platform === "linkedin" && l.contact_id === contact!.id)
        : null;
      if (companyLinkedIn || contactLinkedIn) {
        linkedinContext = "\nLINKEDIN:\n";
        if (companyLinkedIn) linkedinContext += `- Azienda: ${companyLinkedIn.url}\n`;
        if (contactLinkedIn) linkedinContext += `- Contatto: ${contactLinkedIn.url}\n`;
      }
    }

    // --- USE ALIASES as primary names, but validate they're actual person names ---
    let recipientName: string;
    if (contact) {
      const alias = contact.contact_alias;
      const name = contact.name;
      if (alias && isLikelyPersonName(alias)) {
        recipientName = alias;
      } else if (name && isLikelyPersonName(name)) {
        recipientName = name;
      } else {
        recipientName = "";
      }
    } else {
      recipientName = "";
    }
    const recipientCompany = partner!.company_alias || partner!.company_name;
    const senderAlias = settings.ai_contact_alias || settings.ai_contact_name || "";
    const senderCompanyAlias = settings.ai_company_alias || settings.ai_company_name || "";

    // Build context with quality-aware truncation
    const trunc = getProfileTruncation(quality);

    const partnerContext = `
AZIENDA DESTINATARIA:
- Nome: ${recipientCompany}${partner!.company_name !== recipientCompany ? ` (ragione sociale: ${partner!.company_name})` : ""}
- Città: ${partner!.city}, ${partner!.country_name} (${partner!.country_code})
${quality !== "fast" ? `- Sito web: ${partner!.website || "N/A"}` : ""}
- Email: ${contactEmail}
${quality !== "fast" ? `- Rating: ${partner!.rating ? `${partner!.rating}/5` : "N/A"}` : ""}
- Network: ${networks.map((n) => n.network_name).join(", ") || "N/A"}
${quality !== "fast" ? `- Servizi: ${services.map((s) => s.service_category.replace(/_/g, " ")).join(", ") || "N/A"}` : ""}
${trunc.description > 0 && partner!.profile_description ? `- Descrizione: ${partner!.profile_description.substring(0, trunc.description)}` : ""}
${trunc.rawProfile > 0 && partner!.raw_profile_markdown ? `\nPROFILO COMPLETO (estratto):\n${partner!.raw_profile_markdown.substring(0, trunc.rawProfile)}` : ""}
${linkedinContext}`;

    const contactContext = contact ? `
CONTATTO DESTINATARIO:
${recipientName ? `- Nome persona: ${recipientName}` : `- Nome persona: non disponibile`}
- Ruolo: ${contact.title || "N/A"}
- Email: ${contact.email || contactEmail}
${quality !== "fast" ? `- Telefono: ${contact.direct_phone || contact.mobile || "N/A"}` : ""}
` : `NOTA: Nessun contatto selezionato.`;

    // --- SIGNATURE BLOCK ---
    let signatureBlock = settings.ai_email_signature_block || "";
    if (!signatureBlock.trim()) {
      const sigParts: string[] = [];
      if (senderAlias) sigParts.push(senderAlias);
      if (settings.ai_contact_role) sigParts.push(settings.ai_contact_role);
      if (senderCompanyAlias) sigParts.push(senderCompanyAlias);
      if (settings.ai_phone_signature) sigParts.push(`Tel: ${settings.ai_phone_signature}`);
      if (settings.ai_email_signature) sigParts.push(`Email: ${settings.ai_email_signature}`);
      if (sigParts.length > 0) {
        signatureBlock = sigParts.join("\n");
      }
    }

    // Sales KB — Strategic contextual injection
    const emailCategory = oracle_type || "primo_contatto";
    const prevActCount = historyContext ? (historyContext.match(/\[/g) || []).length : 0;
    const kbResult = await fetchKbEntriesStrategic(supabase, quality, userId, {
      emailCategory,
      hasInteractionHistory: !!historyContext,
      isFollowUp: emailCategory === "follow_up" || prevActCount > 0,
      kb_categories: undefined,
    });
    const fullSalesKB = settings.ai_sales_knowledge_base || "";
    const salesKBSlice = kbResult.text || "";
    if (!kbResult.text && fullSalesKB) {
      console.warn("[generate-email] kb_entries vuoto, fallback monolitico DEPRECATO — migrare a kb_entries");
    }

    // Build Strategic Advisor instructions
    const strategicAdvisor = buildStrategicAdvisor({
      emailCategory,
      hasHistory: !!historyContext,
      followUpCount: prevActCount,
      hasEnrichmentData: !!cachedEnrichmentContext,
    });

    const senderContext = `
MITTENTE (TU):
- Nome da usare: ${senderAlias}
- Azienda: ${senderCompanyAlias}
- Ruolo: ${settings.ai_contact_role || "N/A"}
- Email: ${settings.ai_email_signature || "N/A"}
${quality !== "fast" ? `- Telefono: ${settings.ai_phone_signature || "N/A"}` : ""}
- Settore: ${settings.ai_sector || "freight_forwarding"}
- Network: ${settings.ai_networks || "N/A"}

KNOWLEDGE BASE AZIENDALE:
${use_kb !== false ? (settings.ai_knowledge_base || "Non configurata") : "(Knowledge Base disattivata dall'utente)"}
${use_kb !== false && salesKBSlice ? `\n# ARSENAL STRATEGICO (${kbResult.sections_used.join(", ") || "legacy"}):\nLeggi ATTENTAMENTE queste tecniche e APPLICALE nel messaggio.\n\n${salesKBSlice}\n` : ""}
STILE DI COMUNICAZIONE:
- Tono: ${oracle_tone || settings.ai_tone || "professionale"}
- Lingua: ${settings.ai_language || "italiano"}
${settings.ai_style_instructions ? `- Istruzioni: ${settings.ai_style_instructions}` : ""}
${settings.ai_sector_notes ? `- Note settoriali: ${settings.ai_sector_notes}` : ""}
`;

    // Language hint (AI can override based on context)
    const detected = getLanguageHint(partner!.country_code);
    const effectiveLanguage = language || detected.language;

    const systemPrompt = `Sei un esperto stratega di vendita B2B nel settore della logistica e del freight forwarding internazionale.
Hai accesso a una Knowledge Base di tecniche — seleziona autonomamente quelle più adatte al contesto.

${strategicAdvisor}

## Formato output:
- Prima riga: "Subject: ..." (testo puro)
- Corpo in HTML semplice (<p>, <br>, <strong>, <ul>/<li>)
- La firma viene aggiunta automaticamente — non includerla.

## Guardrail:
- Lingua: ${effectiveLanguage} (${partner!.country_code} → ${detected.languageLabel})
- Usa alias/nome breve nel saluto, mai nome completo
- Zero allucinazioni: usa SOLO dati forniti`;

    const userPrompt = `${senderContext}

${partnerContext}

${contactContext}
${interlocutorBlock}
${relationshipBlock}
${historyContext}
${branchBlock}
${metInPersonContext}
${cachedEnrichmentContext}
${documentsContext}
${linksContext}
${stylePreferencesContext}
${editPatternsContext}
${responseInsightsContext}
GOAL DELLA COMUNICAZIONE:
${goal || "Presentazione aziendale e proposta di collaborazione"}

PROPOSTA DI BASE:
${base_proposal || "Proposta generica di collaborazione nel settore freight forwarding"}

Genera l'email completa con oggetto e corpo. Applica le tecniche dalla Knowledge Base.`;

    const model = getModel(quality);

    // AI generation via centralized gateway
    const result = await aiChat({
      models: [model, "google/gemini-2.5-flash", "openai/gpt-5-mini"],
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      timeoutMs: 45000,
      maxRetries: 1,
      context: "generate-email:" + userId.substring(0, 8),
    });
    const content = result.content || "";

    // Consume credits atomically
    if (result.usage) {
      const inputTokens = result.usage.promptTokens;
      const outputTokens = result.usage.completionTokens;
      const totalCredits = Math.max(1, Math.ceil((inputTokens + outputTokens * 2) / 1000));
      await supabase.rpc("deduct_credits", {
        p_user_id: userId,
        p_amount: totalCredits,
        p_operation: "ai_call",
        p_description: `generate-email (${quality}): ${inputTokens} in + ${outputTokens} out`,
      });
    }

    let subject = "";
    let body = content;
    const subjectMatch = content.match(/^Subject:\s*(.+)/i);
    if (subjectMatch) {
      subject = subjectMatch[1].trim();
      body = content.substring(subjectMatch[0].length).trim();
    }

    // Post-processing: convert plain text newlines to HTML if AI didn't use HTML tags
    if (!/<(p|br|div|ul|ol|h[1-6])\b/i.test(body)) {
      body = body
        .split(/\n\n+/)
        .map((para) => `<p>${para.replace(/\n/g, "<br>")}</p>`)
        .join("\n");
    }

    // Clean up excessive whitespace/formatting from AI output
    body = body
      .replace(/<p>\s*(<br\s*\/?>|\s|&nbsp;)*\s*<\/p>/gi, "")
      .replace(/(<br\s*\/?\s*>[\s\n]*){3,}/gi, "<br><br>")
      .replace(/<p>\s*(<br\s*\/?\s*>)+/gi, "<p>")
      .replace(/(<br\s*\/?\s*>)+\s*<\/p>/gi, "</p>")
      .replace(/>\s{2,}</g, "> <")
      .trim();

    // Append signature block to body (as HTML)
    if (signatureBlock.trim()) {
      const sigHtml = signatureBlock.replace(/\n/g, "<br>");
      body = body + `<br><br>${sigHtml}`;
    }

    return new Response(
      JSON.stringify({
        subject,
        body,
        full_content: content,
        partner_name: partner!.company_name,
        contact_name: contact?.contact_alias || contact?.name || null,
        contact_email: contactEmail,
        has_contact: !!contact,
        used_partner_email: !contact?.email && !!partner!.email,
        quality,
        model,
      }),
      { headers: { ...dynCors, "Content-Type": "application/json" } }
    );
  } catch (e: unknown) {
    console.error("generate-email error:", e);
    return mapErrorToResponse(e, getCorsHeaders(req.headers.get("origin")));
  }
});
