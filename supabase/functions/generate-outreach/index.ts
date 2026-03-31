import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Channel = "email" | "linkedin" | "whatsapp" | "sms";
type Quality = "fast" | "standard" | "premium";

/** Extract sections from KB using <!-- SECTION:N --> markers */
function getKBSlice(fullKB: string, quality: Quality): string {
  if (!fullKB) return "";
  const sectionMap: Record<Quality, number[]> = {
    fast: [1, 5],
    standard: [1, 2, 3, 4, 5, 6, 7, 8],
    premium: [],
  };
  if (quality === "premium") return fullKB;
  const allowedSections = sectionMap[quality];
  const sectionRegex = /<!-- SECTION:(\d+) -->/g;
  const markers: { index: number; section: number }[] = [];
  let match;
  while ((match = sectionRegex.exec(fullKB)) !== null) {
    markers.push({ index: match.index, section: parseInt(match[1]) });
  }
  if (markers.length === 0) return fullKB;
  const parts: string[] = [];
  for (let i = 0; i < markers.length; i++) {
    if (allowedSections.includes(markers[i].section)) {
      const start = markers[i].index;
      const end = i + 1 < markers.length ? markers[i + 1].index : fullKB.length;
      parts.push(fullKB.substring(start, end).trim());
    }
  }
  return parts.join("\n\n---\n\n");
}

function getModel(quality: Quality): string {
  return quality === "fast"
    ? "google/gemini-2.5-flash-lite"
    : "google/gemini-3-flash-preview";
}

/** Detect language from country code */
function detectLanguage(countryCode: string): { language: string; languageLabel: string } {
  const cc = (countryCode || "").toUpperCase().trim();
  const map: Record<string, { language: string; languageLabel: string }> = {
    IT: { language: "italiano", languageLabel: "Italian" },
    ES: { language: "español", languageLabel: "Spanish" },
    AR: { language: "español", languageLabel: "Spanish" },
    MX: { language: "español", languageLabel: "Spanish" },
    CO: { language: "español", languageLabel: "Spanish" },
    FR: { language: "français", languageLabel: "French" },
    BE: { language: "français", languageLabel: "French" },
    DE: { language: "deutsch", languageLabel: "German" },
    AT: { language: "deutsch", languageLabel: "German" },
    CH: { language: "deutsch", languageLabel: "German" },
    PT: { language: "português", languageLabel: "Portuguese" },
    BR: { language: "português", languageLabel: "Portuguese" },
    NL: { language: "nederlands", languageLabel: "Dutch" },
    RU: { language: "русский", languageLabel: "Russian" },
    TR: { language: "türkçe", languageLabel: "Turkish" },
    PL: { language: "polski", languageLabel: "Polish" },
    RO: { language: "română", languageLabel: "Romanian" },
    GR: { language: "ελληνικά", languageLabel: "Greek" },
  };
  return map[cc] || { language: "english", languageLabel: "English" };
}

/** Check if a string looks like a person's name (vs a job title) */
function isLikelyPersonName(value: string): boolean {
  if (!value || value.trim().length < 2) return false;
  const lower = value.toLowerCase().trim();
  const roleKeywords = [
    "department", "pricing", "business development", "manager", "director",
    "office", "logistics", "operations", "commercial", "sales", "admin",
    "accounting", "hr", "finance", "marketing", "coordinator", "supervisor",
    "assistant", "secretary", "procurement", "purchasing", "supply chain",
    "warehouse", "import", "export", "freight", "shipping", "forwarding",
    "rappresentante", "responsabile", "direttore", "ufficio", "reparto",
    "amministrazione", "commerciale", "operativo", "logistica",
  ];
  if (roleKeywords.some((kw) => lower.includes(kw))) return false;
  if (/[&\/]/.test(value)) return false;
  return true;
}

/** Channel-specific instructions */
function getChannelInstructions(channel: Channel): string {
  switch (channel) {
    case "email":
      return `Genera un'email B2B professionale.
- Includi un oggetto nella prima riga: "Subject: ..."
- Dopo l'oggetto, corpo in HTML semplice (<p>, <br>, <strong>, <ul>/<li>)
- Tono formale ma umano, personalizzato sul destinatario
- Termina con saluto di chiusura e nome mittente`;

    case "linkedin":
      return `Genera un messaggio LinkedIn InMail/DM professionale.
- NON includere "Subject:" — LinkedIn non ha oggetto
- Massimo 300 parole — i messaggi LinkedIn devono essere concisi
- Tono semi-formale, diretto, personale — come un messaggio tra professionisti
- Fai riferimento al profilo/azienda del destinatario per personalizzare
- Testo puro, NO HTML
- Termina con nome mittente`;

    case "whatsapp":
      return `Genera un messaggio WhatsApp Business professionale.
- NON includere "Subject:" — WhatsApp non ha oggetto
- Massimo 150 parole — i messaggi WhatsApp devono essere brevi e diretti
- Tono informale ma rispettoso, conversazionale
- Usa emoji moderatamente (1-2 al massimo) per rendere il messaggio più umano
- Testo puro, NO HTML
- Vai subito al punto — no formalità eccessive`;

    case "sms":
      return `Genera un SMS professionale.
- NON includere "Subject:" — SMS non ha oggetto
- Massimo 160 caratteri — CRITICO: rispetta rigorosamente il limite SMS
- Tono ultra-conciso, diretto, essenziale
- Includi una call-to-action chiara
- Testo puro, NO HTML
- Nessun saluto formale — solo il contenuto essenziale e il nome`;
  }
}

/** Strip common legal suffixes from company names (fast, no AI needed) */
function cleanCompanyName(name: string): string {
  if (!name) return name;
  return name
    .replace(/\b(s\.?r\.?l\.?|s\.?p\.?a\.?|s\.?a\.?s\.?|s\.?n\.?c\.?|llc|ltd\.?|inc\.?|gmbh|d\.?o\.?o\.?|corp\.?|pty\.?|plc\.?|co\.?\s*ltd\.?|pvt\.?\s*ltd\.?|s\.?a\.?|ag|ab|as|aps|bv|nv|oy|kft|sro|spol|eirl|sarl|sas|eurl|sl|sa de cv)\b\.?/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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
    } = await req.json();

    const ch = (["email", "linkedin", "whatsapp", "sms"].includes(channel) ? channel : "email") as Channel;
    const quality: Quality = (["fast", "standard", "premium"].includes(rawQuality) ? rawQuality : "standard") as Quality;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

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
      const { data: partnerRows } = await supabase
        .from("partners")
        .select("id, company_name, company_alias, enrichment_data, profile_description, city, country_code, website, lead_status")
        .ilike("company_name", `%${company_name}%`)
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

    // Build enrichment snippet (max ~2000 chars)
    const rawSnippet = contextParts.join("\n\n");
    intelligence.enrichment_snippet = rawSnippet.slice(0, 2000);
    if (!rawSnippet) {
      intelligence.warning = "Nessun dato trovato nel DB. L'AI lavora solo con dati base.";
    }

    // ─── End Recipient Intelligence ───

    // Fetch AI settings
    const { data: settingsRows } = await supabase
      .from("app_settings")
      .select("key, value")
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

    // Sales KB
    const fullSalesKB = settings.ai_sales_knowledge_base || "";
    const salesKBSlice = getKBSlice(fullSalesKB, quality);

    // Language detection
    const detected = detectLanguage(country_code);
    const effectiveLanguage = language || detected.language;

    // Channel-specific instructions
    const channelInstructions = getChannelInstructions(ch);

    const senderContext = `
MITTENTE (TU):
- Nome: ${senderAlias}
- Azienda: ${senderCompanyAlias}
- Ruolo: ${settings.ai_contact_role || "N/A"}
- Email: ${settings.ai_email_signature || "N/A"}
- Settore: ${settings.ai_sector || "freight_forwarding"}
- Network: ${settings.ai_networks || "N/A"}

KNOWLEDGE BASE:
${settings.ai_knowledge_base || "Non configurata"}
${salesKBSlice ? `\nSALES TECHNIQUES:\n${salesKBSlice}\n` : ""}
STILE:
- Tono: ${settings.ai_tone || "professionale"}
`;

    const cleanedCompany = cleanCompanyName(company_name || "");

    const recipientContext = `
DESTINATARIO:
- Azienda: ${cleanedCompany || company_name || "N/A"}
- Paese: ${country_code || "N/A"}
${recipientName ? `- Nome: ${recipientName} (IMPORTANTE: usa SOLO il nome di battesimo nel saluto)` : `- ATTENZIONE: nessun nome persona disponibile. Usa saluto generico ("Gentile responsabile" o equivalente).`}
${contact_email ? `- Email: ${contact_email}` : ""}

REGOLA: ${recipientName ? `Rivolgiti a ${recipientName}, MAI all'azienda nel saluto.` : `Usa saluto generico. MAI usare nomi di azienda nel saluto.`}
`;

    // Recipient intelligence block for prompt
    const intelligenceBlock = intelligence.enrichment_snippet
      ? `\nINTELLIGENCE DESTINATARIO (dati verificati dal database — USA QUESTI, non inventare):
${intelligence.enrichment_snippet}
`
      : `\nATTENZIONE: Nessun dato arricchito disponibile per questo destinatario. Usa SOLO le informazioni base fornite. NON inventare dettagli, presentazioni, eventi o fatti specifici.
`;

    const systemPrompt = `Sei un esperto copywriter B2B nel settore logistica e freight forwarding internazionale.

CANALE: ${ch.toUpperCase()}
${channelInstructions}

REGOLE CRITICHE:
1. Scrivi INTERAMENTE in ${effectiveLanguage} (paese destinatario: ${country_code} → ${detected.languageLabel})
2. Personalizza il messaggio sul destinatario SOLO con dati dalla sezione INTELLIGENCE DESTINATARIO
3. ${ch === "email" ? "NON includere firma — viene aggiunta automaticamente" : "Includi il nome del mittente alla fine"}
4. CRITICO: Non inventare MAI informazioni, eventi, presentazioni o fatti non presenti nei dati forniti
5. Usa i network condivisi come punto di connessione se esistono nei dati
6. CRITICO: Se il nome del destinatario sembra un ruolo/titolo, usa "Gentile responsabile" o equivalente
7. Usa SEMPRE l'alias/nome breve, mai nome e cognome completi
8. Se non hai dati specifici sul destinatario, scrivi un messaggio generico ma professionale`;

    const userPrompt = `${senderContext}
${recipientContext}
${intelligenceBlock}
GOAL: ${goal || "Proposta di collaborazione nel freight forwarding"}

PROPOSTA: ${base_proposal || "Collaborazione logistica internazionale"}

Genera il messaggio completo per il canale ${ch.toUpperCase()}.`;

    const model = getModel(quality);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit, riprova tra poco." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI error:", status, text);
      throw new Error("AI gateway error");
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "";

    // Deduct credits
    if (result.usage) {
      const inputTokens = result.usage.prompt_tokens || 0;
      const outputTokens = result.usage.completion_tokens || 0;
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
      sales_kb_loaded: !!fullSalesKB,
      sales_kb_sections: quality === "premium" ? "tutte" : quality === "fast" ? "1,5" : "1-8",
      goal_used: goal || "(default)",
      proposal_used: base_proposal || "(default)",
      tokens_input: result.usage?.prompt_tokens || 0,
      tokens_output: result.usage?.completion_tokens || 0,
      credits_consumed: result.usage ? Math.max(1, Math.ceil(((result.usage.prompt_tokens || 0) + (result.usage.completion_tokens || 0) * 2) / 1000)) : 0,
      channel_instructions: ch.toUpperCase(),
      settings_keys_found: Object.keys(settings),
      recipient_intelligence: intelligence,
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
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
