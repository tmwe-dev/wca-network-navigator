import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders, corsPreflight } from "../_shared/cors.ts";
import { aiChat, mapErrorToResponse } from "../_shared/aiGateway.ts";

type Channel = "email" | "linkedin" | "whatsapp" | "sms";
type Quality = "fast" | "standard" | "premium";

/** Contextual KB injection for outreach */
async function fetchKbEntriesForOutreach(supabase: any, quality: Quality, channel: Channel, userId: string): Promise<{ text: string; sections: string[] }> {
  const limit = quality === "fast" ? 6 : quality === "standard" ? 15 : 35;
  
  // Select categories based on channel — using ACTUAL DB categories
  const categories = ["regole_sistema", "filosofia"];
  if (channel === "email") categories.push("struttura_email", "hook", "cold_outreach");
  if (channel === "linkedin") categories.push("cold_outreach", "tono");
  if (channel === "whatsapp") categories.push("tono", "frasi_modello");
  if (quality !== "fast") categories.push("negoziazione", "chris_voss", "dati_partner");
  if (quality === "premium") categories.push("arsenale", "persuasione", "obiezioni", "chiusura", "followup", "errori");
  
  const { data: entries } = await supabase
    .from("kb_entries")
    .select("title, content, category, chapter, tags")
    .eq("user_id", userId)
    .eq("is_active", true)
    .in("category", categories)
    .order("priority", { ascending: false })
    .order("sort_order")
    .limit(limit);

  if (!entries || entries.length === 0) return { text: "", sections: [] };

  const sections = [...new Set(entries.map((e: any) => e.category))];
  const text = entries
    .map((e: any) => `### ${e.title} [${e.chapter}]\n${e.content}`)
    .join("\n\n---\n\n");

  return { text, sections };
}

import { getKBSlice, type Quality } from "../_shared/kbSlice.ts";

function getModel(quality: Quality): string {
  return quality === "fast"
    ? "google/gemini-2.5-flash-lite"
    : "google/gemini-3-flash-preview";
}

// ── Shared utilities (single source of truth) ──
import { getLanguageHint, isLikelyPersonName, cleanCompanyName } from "../_shared/textUtils.ts";

serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const {
      channel = "email",
      contact_name,
      contact_email,
      company_name,
      country_code = "",
      language,
      goal,
      base_proposal,
      quality: rawQuality,
      linkedin_profile,
    } = await req.json();

    const ch = (["email", "linkedin", "whatsapp", "sms"].includes(channel) ? channel : "email") as Channel;
    const quality: Quality = (["fast", "standard", "premium"].includes(rawQuality) ? rawQuality : "standard") as Quality;

    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // ─── Recipient Intelligence: query DB for real data ───
    const intelligence: {
      sources_checked: string[];
      data_found: Record<string, boolean>;
      enrichment_snippet: string;
      warning: string | null;
    } = {
      sources_checked: [],
      data_found: {},
      enrichment_snippet: "",
      warning: null,
    };
    const contextParts: string[] = [];

    // 1) Partners table
    intelligence.sources_checked.push("partners");
    let partnerId: string | null = null;
    if (company_name) {
      // Escape SQL LIKE wildcards (%, _) per evitare wildcard injection.
      const safeName = company_name.replace(/[\\%_]/g, (c: string) => `\\${c}`);
      const { data: partnerRows } = await supabase
        .from("partners")
        .select("id, company_name, company_alias, enrichment_data, profile_description, city, country_code, website, lead_status")
        .ilike("company_name", `%${safeName}%`)
        .limit(1);
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
          const ed = partner.enrichment_data as Record<string, any>;
          if (ed.trade_lanes) parts.push(`Trade Lanes: ${JSON.stringify(ed.trade_lanes).slice(0, 300)}`);
          if (ed.specializations) parts.push(`Specializzazioni: ${JSON.stringify(ed.specializations).slice(0, 200)}`);
          if (ed.deep_search_summary) parts.push(`Deep Search: ${String(ed.deep_search_summary).slice(0, 400)}`);
        }
        if (parts.length) contextParts.push(`[PARTNER DB]\n${parts.join("\n")}`);
      } else {
        intelligence.data_found.partner = false;
      }
    }

    // 2) Partner contacts
    intelligence.sources_checked.push("partner_contacts");
    if (partnerId) {
      const { data: contactRows } = await supabase
        .from("partner_contacts")
        .select("name, title, email, contact_alias")
        .eq("partner_id", partnerId)
        .limit(5);
      if (contactRows && contactRows.length > 0) {
        intelligence.data_found.contacts = true;
        const cList = contactRows.map((c: any) => `${c.name}${c.title ? ` (${c.title})` : ""}${c.email ? ` - ${c.email}` : ""}`).join("; ");
        contextParts.push(`[CONTATTI AZIENDA]\n${cList}`);
      } else {
        intelligence.data_found.contacts = false;
      }
    }

    // 3) Partner networks
    intelligence.sources_checked.push("partner_networks");
    if (partnerId) {
      const { data: netRows } = await supabase
        .from("partner_networks")
        .select("network_name")
        .eq("partner_id", partnerId)
        .limit(10);
      if (netRows && netRows.length > 0) {
        intelligence.data_found.networks = true;
        contextParts.push(`[NETWORK CONDIVISI]\n${netRows.map((n: any) => n.network_name).join(", ")}`);
      } else {
        intelligence.data_found.networks = false;
      }
    }

    // 4) Partner services
    intelligence.sources_checked.push("partner_services");
    if (partnerId) {
      const { data: svcRows } = await supabase
        .from("partner_services")
        .select("service_category")
        .eq("partner_id", partnerId)
        .limit(20);
      if (svcRows && svcRows.length > 0) {
        intelligence.data_found.services = true;
        contextParts.push(`[SERVIZI]\n${svcRows.map((s: any) => s.service_category).join(", ")}`);
      } else {
        intelligence.data_found.services = false;
      }
    }

    // 5) Imported contacts (CRM)
    intelligence.sources_checked.push("imported_contacts");
    if (contact_email || company_name) {
      const q = supabase.from("imported_contacts").select("name, company_name, note, enrichment_data, deep_search_at").limit(1);
      if (contact_email) q.ilike("email", contact_email);
      else if (company_name) q.ilike("company_name", `%${company_name}%`);
      const { data: icRows } = await q;
      const ic = icRows?.[0];
      if (ic) {
        intelligence.data_found.imported_contacts = true;
        const parts: string[] = [];
        if (ic.note) parts.push(`Note: ${String(ic.note).slice(0, 300)}`);
        if (ic.enrichment_data) {
          const ed = ic.enrichment_data as Record<string, any>;
          if (ed.summary) parts.push(`Enrichment: ${String(ed.summary).slice(0, 300)}`);
        }
        if (parts.length) contextParts.push(`[CRM CONTATTO]\n${parts.join("\n")}`);
      } else {
        intelligence.data_found.imported_contacts = false;
      }
    }

    // 6) Enhanced Interaction history + Relationship Analysis
    intelligence.sources_checked.push("interactions");
    let interactionHistoryCount = 0;
    let relationshipBlock = "";
    let interlocutorBlock = "";
    let branchBlock = "";
    let historyText = "";

    // Import commercial intelligence
    const { checkSameLocationContacts, getSameCompanyBranches, analyzeRelationshipHistory, buildInterlocutorTypeBlock, buildBranchCoordinationBlock, buildRelationshipAnalysisBlock } = await import("../_shared/sameLocationGuard.ts");

    if (partnerId) {
      // Same-Location Guard
      const guardResult = await checkSameLocationContacts(supabase, partnerId, contact_email, userId);
      if (!guardResult.allowed) {
        return new Response(
          JSON.stringify({
            error: "duplicate_branch",
            message: guardResult.reason,
            recent_contact: guardResult.recentContact,
          }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Semantic relationship analysis
      const { metrics, historyText: ht } = await analyzeRelationshipHistory(supabase, partnerId, userId);
      historyText = ht;
      interactionHistoryCount = metrics.total_interactions;
      relationshipBlock = buildRelationshipAnalysisBlock(metrics);
      
      if (historyText) {
        intelligence.data_found.interactions = true;
        contextParts.push(`[STORIA INTERAZIONI]\n${historyText}`);
      } else {
        intelligence.data_found.interactions = false;
      }

      // Branch coordination
      const branches = await getSameCompanyBranches(supabase, partnerId);
      branchBlock = buildBranchCoordinationBlock(branches, "");
    } else {
      intelligence.data_found.interactions = false;
    }

    // Interlocutor type differentiation
    const sourceType = partnerId ? "partner" : "contact";
    interlocutorBlock = buildInterlocutorTypeBlock(sourceType);

    // ─── "Met in Person" Context from Business Cards ───
    let metInPersonContext = "";
    if (partnerId) {
      const { data: bcaRows } = await supabase
        .from("business_cards")
        .select("contact_name, event_name, met_at, location")
        .eq("matched_partner_id", partnerId)
        .limit(3);
      if (bcaRows && bcaRows.length > 0) {
        const encounters = bcaRows.map((bc: any) => {
          const parts: string[] = [];
          if (bc.event_name) parts.push(`Evento: ${bc.event_name}`);
          if (bc.contact_name) parts.push(`Contatto: ${bc.contact_name}`);
          if (bc.met_at) parts.push(`Data: ${bc.met_at}`);
          if (bc.location) parts.push(`Luogo: ${bc.location}`);
          return parts.join(", ");
        }).join("\n");
        metInPersonContext = `\nINCONTRO DI PERSONA — IMPORTANTE:
Hai incontrato questa azienda di persona. Questo cambia il tono della comunicazione.
${encounters}
ISTRUZIONI: Usa un tono più caldo e familiare. Fai riferimento all'incontro di persona. NON trattare come un contatto freddo.\n`;
      }
    }

    // 7) Completed activities (email sent previously)
    intelligence.sources_checked.push("activities");
    const sourceIdForActivities = partnerId || null;
    if (sourceIdForActivities) {
      const { data: actRows } = await supabase
        .from("activities")
        .select("email_subject, sent_at, activity_type, status")
        .eq("source_id", sourceIdForActivities)
        .in("status", ["completed"])
        .order("created_at", { ascending: false })
        .limit(10);
      if (actRows && actRows.length > 0) {
        intelligence.data_found.activities = true;
        const acts = actRows.map((a: any) => `[${a.sent_at?.slice(0, 10) || "?"}] ${a.activity_type}: "${a.email_subject || "N/A"}"`).join("\n");
        contextParts.push(`[ATTIVITÀ PRECEDENTI]\nQueste comunicazioni sono GIÀ state inviate — NON ripetere lo stesso messaggio:\n${acts}`);
      } else {
        intelligence.data_found.activities = false;
      }
    }

    let linkedinSource: "cached" | "live_scraped" | "not_available" = "not_available";
    // 8b) Client-scraped LinkedIn profile (from extension)
    if (linkedin_profile && typeof linkedin_profile === "object") {
      const lp = linkedin_profile as Record<string, string>;
      const lpParts: string[] = [];
      if (lp.name) lpParts.push(`Nome: ${lp.name}`);
      if (lp.headline) lpParts.push(`Headline: ${lp.headline}`);
      if (lp.location) lpParts.push(`Località: ${lp.location}`);
      if (lp.about) lpParts.push(`About: ${String(lp.about).slice(0, 800)}`);
      if (lp.profileUrl) lpParts.push(`URL: ${lp.profileUrl}`);
      if (lpParts.length > 0) {
        contextParts.push(`[LINKEDIN PROFILO (scraping live dal browser)]\n${lpParts.join("\n")}`);
        intelligence.data_found.linkedin_live = true;
        intelligence.sources_checked.push("linkedin_live_scrape");
        linkedinSource = "live_scraped";
      }
    }

    let websiteSource: "cached" | "not_available" = "not_available";
    if (partnerId && quality !== "fast") {
      const { data: partnerFull } = await supabase
        .from("partners")
        .select("website, enrichment_data")
        .eq("id", partnerId)
        .single();
      
      if (partnerFull?.website) {
        const ed = (partnerFull.enrichment_data || {}) as Record<string, any>;
        if (ed.website_summary) {
          websiteSource = "cached";
          contextParts.push(`[SITO AZIENDALE (cached)]\n${String(ed.website_summary).slice(0, 600)}`);
          intelligence.data_found.website = true;
        }
      }
    }

    // 9) LinkedIn data from DB cache (no live scraping)
    if (partnerId && quality === "premium") {
      const { data: liLinks } = await supabase
        .from("partner_social_links")
        .select("url")
        .eq("partner_id", partnerId)
        .eq("platform", "linkedin")
        .limit(1);
      
      if (liLinks?.[0]?.url) {
        const { data: partnerEd } = await supabase
          .from("partners")
          .select("enrichment_data")
          .eq("id", partnerId)
          .single();
        const ed = (partnerEd?.enrichment_data || {}) as Record<string, any>;

        if (ed.linkedin_summary) {
          linkedinSource = "cached";
          contextParts.push(`[LINKEDIN (cached)]\n${String(ed.linkedin_summary).slice(0, 500)}`);
          intelligence.data_found.linkedin = true;
        }
      }
    }

    // Build enrichment snippet (max ~2000 chars)
    const rawSnippet = contextParts.join("\n\n");
    intelligence.enrichment_snippet = rawSnippet.slice(0, 2000);
    if (!rawSnippet) {
      intelligence.warning = "Nessun dato trovato nel DB. L'AI lavora solo con dati base.";
    }

    // ─── End Recipient Intelligence ───

    // Fetch AI settings (scoped to authenticated user)
    const { data: settingsRows } = await supabase
      .from("app_settings")
      .select("key, value")
      .eq("user_id", userId)
      .like("key", "ai_%");

    const settings: Record<string, string> = {};
    (settingsRows || []).forEach((r: any) => { settings[r.key] = r.value || ""; });

    // Resolve recipient name
    let recipientName = "";
    if (contact_name && isLikelyPersonName(contact_name)) {
      recipientName = contact_name;
    }

    const senderAlias = settings.ai_contact_alias || settings.ai_contact_name || "";
    const senderCompanyAlias = settings.ai_company_alias || settings.ai_company_name || "";

    // Sales KB — contextual injection from kb_entries
    const kbResult = await fetchKbEntriesForOutreach(supabase, quality, ch, userId);
    const fullSalesKB = settings.ai_sales_knowledge_base || "";
    const salesKBSlice = kbResult.text || getKBSlice(fullSalesKB, quality);

    // Language hint (AI can override based on context)
    const detected = getLanguageHint(country_code);
    const effectiveLanguage = language || detected.language;

    // Channel context — minimal, let AI decide style
    const channelContext = `Canale: ${ch.toUpperCase()}`;
    // Load commercial levers from settings (externalized)
    const commercialLevers = settings.ai_commercial_levers || "";

    const senderContext = `
MITTENTE (TU):
- Nome: ${senderAlias}
- Azienda: ${senderCompanyAlias}
- Ruolo: ${settings.ai_contact_role || "N/A"}
- Email: ${settings.ai_email_signature || "N/A"}
- Settore: ${settings.ai_sector || "freight_forwarding"}
- Network: ${settings.ai_networks || "N/A"}

KNOWLEDGE BASE AZIENDALE:
${settings.ai_knowledge_base || "Non configurata"}
${salesKBSlice ? `\n# ARSENAL STRATEGICO (${kbResult.sections.join(", ") || "legacy"}):\nApplica queste tecniche nel messaggio.\n\n${salesKBSlice}\n` : ""}
STILE:
- Tono: ${settings.ai_tone || "professionale"}
`;

    const cleanedCompany = cleanCompanyName(company_name || "");

    const recipientContext = `
DESTINATARIO:
- Azienda: ${cleanedCompany || company_name || "N/A"}
- Paese: ${country_code || "N/A"}
${recipientName ? `- Nome persona: ${recipientName}` : `- Nome persona: non disponibile`}
${contact_email ? `- Email: ${contact_email}` : ""}
`;

    // Recipient intelligence block for prompt
    const intelligenceBlock = intelligence.enrichment_snippet
      ? `\nINTELLIGENCE DESTINATARIO (dati verificati dal database — USA QUESTI, non inventare):
${intelligence.enrichment_snippet}
`
      : `\nATTENZIONE: Nessun dato arricchito disponibile per questo destinatario. Usa SOLO le informazioni base fornite. NON inventare dettagli, presentazioni, eventi o fatti specifici.
`;

    const systemPrompt = `Sei un esperto stratega di vendita B2B nel settore logistica e freight forwarding internazionale.
Hai accesso a una Knowledge Base di tecniche di vendita e negoziazione — usala autonomamente per scegliere strategia, tono e struttura.

${channelContext}

CONTESTO:
- Lingua suggerita: ${effectiveLanguage} (${country_code} → ${detected.languageLabel})
- ${ch === "email" ? "La firma viene aggiunta automaticamente dal sistema." : ""}

GUARDRAIL:
- Scrivi nella lingua del paese destinatario
- Zero allucinazioni: usa SOLO dati forniti, mai inventare fatti
- Usa alias/nome breve nel saluto, mai nome completo`;

    const userPrompt = `${senderContext}
${recipientContext}
${interlocutorBlock}
${relationshipBlock}
${branchBlock}
${metInPersonContext}
${intelligenceBlock}
GOAL: ${goal || "Proposta di collaborazione nel freight forwarding"}

PROPOSTA: ${base_proposal || "Collaborazione logistica internazionale"}
${commercialLevers ? `\nLEVE COMMERCIALI CONFIGURATE:\n${commercialLevers}\n` : ""}
Genera il messaggio completo per il canale ${ch.toUpperCase()}. Applica le tecniche dalla Knowledge Base.`;

    const model = getModel(quality);

    const result = await aiChat({
      models: [model, "openai/gpt-5-mini"],
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      timeoutMs: 40000,
      maxRetries: 1,
      context: `generate-outreach:${userId.substring(0, 8)}:${ch}/${quality}`,
    });
    const content = result.content || "";

    // Deduct credits
    {
      const inputTokens = result.usage.promptTokens;
      const outputTokens = result.usage.completionTokens;
      const totalCredits = Math.max(1, Math.ceil((inputTokens + outputTokens * 2) / 1000));
      await supabase.rpc("deduct_credits", {
        p_user_id: userId,
        p_amount: totalCredits,
        p_operation: "ai_call",
        p_description: `generate-outreach (${ch}/${quality}): ${inputTokens}in + ${outputTokens}out`,
      });
    }

    // Parse output
    let subject = "";
    let body = content;

    if (ch === "email") {
      const subjectMatch = content.match(/^Subject:\s*(.+)/i);
      if (subjectMatch) {
        subject = subjectMatch[1].trim();
        body = content.substring(subjectMatch[0].length).trim();
      }
      // Convert to HTML if needed
      if (!/<(p|br|div|ul|ol|h[1-6])\b/i.test(body)) {
        body = body.split(/\n\n+/).map((para: string) => `<p>${para.replace(/\n/g, "<br>")}</p>`).join("\n");
      }
      // Append signature
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
      if (signatureBlock.trim()) {
        body = body + `<br><br>${signatureBlock.replace(/\n/g, "<br>")}`;
      }
    }

    // Build debug/sources info
    const _debug = {
      model,
      quality,
      language_detected: detected.languageLabel,
      language_used: effectiveLanguage,
      country_code: country_code || "N/A",
      recipient_name_resolved: recipientName || "(generico)",
      sender_alias: senderAlias || "(non configurato)",
      sender_company: senderCompanyAlias || "(non configurato)",
      sender_role: settings.ai_contact_role || "(non configurato)",
      kb_loaded: !!settings.ai_knowledge_base,
      sales_kb_loaded: !!kbResult.text || !!fullSalesKB,
      sales_kb_sections: kbResult.sections.join(", ") || (quality === "premium" ? "tutte" : quality === "fast" ? "1,5" : "1-8"),
      goal_used: goal || "(default)",
      proposal_used: base_proposal || "(default)",
      tokens_input: result.usage.promptTokens,
      tokens_output: result.usage.completionTokens,
      credits_consumed: Math.max(1, Math.ceil((result.usage.promptTokens + result.usage.completionTokens * 2) / 1000)),
      model_used: result.modelUsed,
      ai_attempts: result.attempts,
      channel_instructions: ch.toUpperCase(),
      settings_keys_found: Object.keys(settings),
      recipient_intelligence: intelligence,
      interaction_history_count: interactionHistoryCount,
      website_source: websiteSource,
      linkedin_source: linkedinSource,
    };

    return new Response(
      JSON.stringify({
        channel: ch,
        subject,
        body,
        full_content: content,
        contact_name: recipientName || contact_name || null,
        contact_email: contact_email || null,
        company_name: company_name || null,
        language: effectiveLanguage,
        quality,
        model,
        _debug,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-outreach error:", e);
    return mapErrorToResponse(e, corsHeaders);
  }
});
