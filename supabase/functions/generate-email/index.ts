import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Quality = "fast" | "standard" | "premium";

/** Extract sections from KB using <!-- SECTION:N --> markers */
function getKBSlice(fullKB: string, quality: Quality): string {
  if (!fullKB) return "";
  
  const sectionMap: Record<Quality, number[]> = {
    fast: [1, 5],
    standard: [1, 2, 3, 4, 5, 6, 7, 8],
    premium: [], // all sections
  };

  if (quality === "premium") return fullKB;

  const allowedSections = sectionMap[quality];
  const sectionRegex = /<!-- SECTION:(\d+) -->/g;
  const markers: { index: number; section: number }[] = [];
  let match;
  while ((match = sectionRegex.exec(fullKB)) !== null) {
    markers.push({ index: match.index, section: parseInt(match[1]) });
  }
  if (markers.length === 0) return fullKB; // no markers, return all

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

function getProfileTruncation(quality: Quality): { description: number; rawProfile: number } {
  switch (quality) {
    case "fast": return { description: 0, rawProfile: 0 };
    case "standard": return { description: 800, rawProfile: 0 };
    case "premium": return { description: 800, rawProfile: 1500 };
  }
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
    CL: { language: "español", languageLabel: "Spanish" },
    PE: { language: "español", languageLabel: "Spanish" },
    VE: { language: "español", languageLabel: "Spanish" },
    EC: { language: "español", languageLabel: "Spanish" },
    UY: { language: "español", languageLabel: "Spanish" },
    PY: { language: "español", languageLabel: "Spanish" },
    BO: { language: "español", languageLabel: "Spanish" },
    CR: { language: "español", languageLabel: "Spanish" },
    PA: { language: "español", languageLabel: "Spanish" },
    GT: { language: "español", languageLabel: "Spanish" },
    CU: { language: "español", languageLabel: "Spanish" },
    DO: { language: "español", languageLabel: "Spanish" },
    HN: { language: "español", languageLabel: "Spanish" },
    SV: { language: "español", languageLabel: "Spanish" },
    NI: { language: "español", languageLabel: "Spanish" },
    FR: { language: "français", languageLabel: "French" },
    BE: { language: "français", languageLabel: "French" },
    CI: { language: "français", languageLabel: "French" },
    SN: { language: "français", languageLabel: "French" },
    CM: { language: "français", languageLabel: "French" },
    MA: { language: "français", languageLabel: "French" },
    TN: { language: "français", languageLabel: "French" },
    DZ: { language: "français", languageLabel: "French" },
    DE: { language: "deutsch", languageLabel: "German" },
    AT: { language: "deutsch", languageLabel: "German" },
    CH: { language: "deutsch", languageLabel: "German" },
    PT: { language: "português", languageLabel: "Portuguese" },
    BR: { language: "português", languageLabel: "Portuguese" },
    AO: { language: "português", languageLabel: "Portuguese" },
    MZ: { language: "português", languageLabel: "Portuguese" },
    NL: { language: "nederlands", languageLabel: "Dutch" },
    RU: { language: "русский", languageLabel: "Russian" },
    JP: { language: "english", languageLabel: "English" },
    CN: { language: "english", languageLabel: "English" },
    KR: { language: "english", languageLabel: "English" },
    TR: { language: "türkçe", languageLabel: "Turkish" },
    PL: { language: "polski", languageLabel: "Polish" },
    RO: { language: "română", languageLabel: "Romanian" },
    GR: { language: "ελληνικά", languageLabel: "Greek" },
  };
  return map[cc] || { language: "english", languageLabel: "English" };
}

/** Check if a string looks like a person's name (vs a job title/department) */
function isLikelyPersonName(value: string): boolean {
  if (!value || value.trim().length < 2) return false;
  const lower = value.toLowerCase().trim();
  const roleKeywords = [
    "department", "pricing", "business development", "manager", "director",
    "office", "logistics", "operations", "commercial", "sales", "admin",
    "accounting", "hr", "human resources", "finance", "marketing",
    "customer service", "general", "managing", "executive", "officer",
    "coordinator", "supervisor", "assistant", "secretary", "reception",
    "procurement", "purchasing", "supply chain", "warehouse", "import",
    "export", "freight", "shipping", "forwarding", "trade", "compliance",
    "legal", "it ", "information technology", "support", "helpdesk",
    "division", "unit", "team", "group", "section", "bureau", "desk",
    "rappresentante", "responsabile", "direttore", "ufficio", "reparto",
    "amministrazione", "commerciale", "operativo", "logistica",
    "contabilità", "segreteria", "acquisti", "vendite",
  ];
  // If it contains any role keyword, it's not a person name
  if (roleKeywords.some((kw) => lower.includes(kw))) return false;
  // If it contains "&" or "/" it's likely a department combo
  if (/[&\/]/.test(value)) return false;
  // If all words are capitalized short words (2-3 letters each), likely acronyms
  if (/^[A-Z]{2,4}(\s+[A-Z]{2,4})*$/.test(value.trim())) return false;
  return true;
}

/** Validate URL: only allow http/https, block private IPs */
function isValidPublicUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    const host = parsed.hostname;
    // Block private/internal IPs
    if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|0\.|169\.254\.|localhost|::1|fc|fd)/i.test(host)) return false;
    return true;
  } catch {
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // ── Auth check (REQUIRED) ──
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

    const { activity_id, goal, base_proposal, language, document_ids, reference_urls, quality: rawQuality } = await req.json();
    if (!activity_id) throw new Error("activity_id is required");

    const quality: Quality = (["fast", "standard", "premium"].includes(rawQuality) ? rawQuality : "standard") as Quality;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Use service role for data queries (user is already authenticated above)
    const supabase = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch activity
    const { data: activity, error: actErr } = await supabase
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

    if (actErr || !activity) throw new Error("Activity not found");

    const sourceType = activity.source_type || "partner";
    let partner = activity.partners;
    let contact = activity.selected_contact;
    let contactEmail: string | null = null;

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

    // --- VALIDATION: partner source MUST have a selected contact ---
    if (sourceType === "partner" && !contact) {
      return new Response(
        JSON.stringify({
          error: "no_contact",
          message: "Nessun contatto selezionato. Seleziona un contatto prima di generare l'email.",
          partner_name: partner.company_name,
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- VALIDATION: check contact has email ---
    if (!contactEmail) {
      return new Response(
        JSON.stringify({
          error: "no_email",
          message: "Nessun indirizzo email disponibile per questo contatto/partner",
          partner_name: partner.company_name,
          contact_name: contact?.name || null,
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch partner networks, services, social links, settings in parallel
    const isPartnerSource = sourceType === "partner" && activity.partner_id;
    const [networksRes, servicesRes, settingsRes, socialRes] = await Promise.all([
      isPartnerSource
        ? supabase.from("partner_networks").select("network_name").eq("partner_id", partner.id)
        : Promise.resolve({ data: [] }),
      isPartnerSource && quality !== "fast"
        ? supabase.from("partner_services").select("service_category").eq("partner_id", partner.id)
        : Promise.resolve({ data: [] }),
      supabase.from("app_settings").select("key, value").like("key", "ai_%"),
      isPartnerSource && quality === "premium"
        ? supabase.from("partner_social_links").select("platform, url, contact_id").eq("partner_id", partner.id)
        : Promise.resolve({ data: [] }),
    ]);

    const networks = networksRes.data || [];
    const services = servicesRes.data || [];
    const socialLinks = socialRes.data || [];

    const settings: Record<string, string> = {};
    (settingsRes.data || []).forEach((r: any) => { settings[r.key] = r.value || ""; });

    // Fetch workspace documents text — skip for "fast"
    let documentsContext = "";
    if (quality !== "fast" && document_ids && document_ids.length > 0) {
      const { data: docs } = await supabase
        .from("workspace_documents")
        .select("file_name, extracted_text")
        .in("id", document_ids);
      if (docs && docs.length > 0) {
        const docTexts = docs
          .filter((d: any) => d.extracted_text)
          .map((d: any) => `--- ${d.file_name} ---\n${d.extracted_text.substring(0, 3000)}`)
          .join("\n\n");
        if (docTexts) {
          documentsContext = `\nDOCUMENTI DI RIFERIMENTO:\n${docTexts}\n`;
        }
      }
    }

    // Scrape reference URLs via Firecrawl — only for "premium"
    // FIX #7: Validate URLs to prevent SSRF
    let linksContext = "";
    if (quality === "premium" && reference_urls && reference_urls.length > 0) {
      const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
      if (FIRECRAWL_API_KEY) {
        const validUrls = (reference_urls as string[]).filter(isValidPublicUrl);
        const urlsToScrape = validUrls.slice(0, 3);
        const scrapeResults = await Promise.allSettled(
          urlsToScrape.map(async (url: string) => {
            try {
              const resp = await fetch("https://api.firecrawl.dev/v1/scrape", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
              });
              if (!resp.ok) return null;
              const data = await resp.json();
              const md = data?.data?.markdown || data?.markdown || "";
              return md ? `--- ${url} ---\n${md.substring(0, 2000)}` : null;
            } catch {
              return null;
            }
          })
        );
        const scraped = scrapeResults
          .filter((r): r is PromiseFulfilledResult<string | null> => r.status === "fulfilled" && !!r.value)
          .map((r) => r.value)
          .join("\n\n");
        if (scraped) {
          linksContext = `\nINFORMAZIONI DA LINK DI RIFERIMENTO:\n${scraped}\n`;
        }
      }
    }

    // LinkedIn context — only for premium
    let linkedinContext = "";
    if (quality === "premium") {
      const companyLinkedIn = socialLinks.find((l: any) => l.platform === "linkedin" && !l.contact_id);
      const contactLinkedIn = contact
        ? socialLinks.find((l: any) => l.platform === "linkedin" && l.contact_id === contact.id)
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
        // Neither alias nor name is a person name — use generic greeting
        recipientName = "";
      }
    } else {
      recipientName = "";
    }
    const recipientCompany = partner.company_alias || partner.company_name;
    const senderAlias = settings.ai_contact_alias || settings.ai_contact_name || "";
    const senderCompanyAlias = settings.ai_company_alias || settings.ai_company_name || "";

    // Build context with quality-aware truncation
    const trunc = getProfileTruncation(quality);

    const partnerContext = `
AZIENDA DESTINATARIA:
- Nome: ${recipientCompany}${partner.company_name !== recipientCompany ? ` (ragione sociale: ${partner.company_name})` : ""}
- Città: ${partner.city}, ${partner.country_name} (${partner.country_code})
${quality !== "fast" ? `- Sito web: ${partner.website || "N/A"}` : ""}
- Email: ${contactEmail}
${quality !== "fast" ? `- Rating: ${partner.rating ? `${partner.rating}/5` : "N/A"}` : ""}
- Network: ${networks.map((n: any) => n.network_name).join(", ") || "N/A"}
${quality !== "fast" ? `- Servizi: ${services.map((s: any) => s.service_category.replace(/_/g, " ")).join(", ") || "N/A"}` : ""}
${trunc.description > 0 && partner.profile_description ? `- Descrizione: ${partner.profile_description.substring(0, trunc.description)}` : ""}
${trunc.rawProfile > 0 && partner.raw_profile_markdown ? `\nPROFILO COMPLETO (estratto):\n${partner.raw_profile_markdown.substring(0, trunc.rawProfile)}` : ""}
${linkedinContext}`;

    const contactContext = contact ? `
CONTATTO DESTINATARIO:
${recipientName ? `- Nome da usare nel saluto: ${recipientName} (IMPORTANTE: usa SOLO questo nome, mai il nome completo con cognome)` : `- ATTENZIONE: il nome del contatto non è disponibile o è un titolo/ruolo aziendale. Usa "Gentile responsabile" o equivalente nella lingua dell'email.`}
- Ruolo: ${contact.title || "N/A"}
- Email: ${contact.email || contactEmail}
${quality !== "fast" ? `- Telefono: ${contact.direct_phone || contact.mobile || "N/A"}` : ""}

REGOLA ASSOLUTA: ${recipientName ? `Rivolgiti SEMPRE alla persona (${recipientName}), MAI all'azienda nel saluto.` : `Non hai un nome di persona valido. Usa un saluto generico come "Gentile responsabile" o equivalente. MAI usare nomi di ruoli/dipartimenti come se fossero persone.`} L'email è personale, diretta al contatto. Non scrivere mai "Cara azienda", "Gentile società", "Dear Company" o simili.
` : `ATTENZIONE: Nessun contatto selezionato. Rivolgiti comunque in modo generico ma MAI usando "Cara/Dear" + nome azienda. Usa "Gentile responsabile" o equivalente nella lingua richiesta.`;

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

    // Sales KB — slice based on quality
    const fullSalesKB = settings.ai_sales_knowledge_base || "";
    const salesKBSlice = getKBSlice(fullSalesKB, quality);

    const senderContext = `
MITTENTE (TU):
- Nome da usare: ${senderAlias}
- Azienda: ${senderCompanyAlias}
- Ruolo: ${settings.ai_contact_role || "N/A"}
- Email: ${settings.ai_email_signature || "N/A"}
${quality !== "fast" ? `- Telefono: ${settings.ai_phone_signature || "N/A"}` : ""}
- Settore: ${settings.ai_sector || "freight_forwarding"}
- Network: ${settings.ai_networks || "N/A"}

KNOWLEDGE BASE:
${settings.ai_knowledge_base || "Non configurata"}
${salesKBSlice ? `\nSALES TECHNIQUES GUIDE:\n${salesKBSlice}\n` : ""}
STILE DI COMUNICAZIONE:
- Tono: ${settings.ai_tone || "professionale"}
- Lingua: ${settings.ai_language || "italiano"}
${settings.ai_style_instructions ? `- Istruzioni: ${settings.ai_style_instructions}` : ""}
${settings.ai_sector_notes ? `- Note settoriali: ${settings.ai_sector_notes}` : ""}
`;

    // Auto-detect language from recipient's country code
    const detected = detectLanguage(partner.country_code);
    const effectiveLanguage = language || detected.language;

    const systemPrompt = `Sei un esperto copywriter di email B2B nel settore della logistica e del freight forwarding internazionale. Scrivi email professionali, personalizzate e convincenti.

REGOLE CRITICHE:
1. Scrivi INTERAMENTE in ${effectiveLanguage} — oggetto (Subject:), saluto, corpo e chiusura devono essere TUTTI in ${effectiveLanguage}. Lingua scelta dal paese del destinatario (${partner.country_code} → ${detected.languageLabel}).
2. L'email deve essere specifica per il destinatario — usa i dati del profilo per personalizzare
3. Mantieni il tono indicato dal profilo del mittente
4. NON INCLUDERE una firma — la firma viene aggiunta automaticamente dal sistema
5. Non inventare informazioni — usa solo i dati forniti
6. L'email deve essere pronta per l'invio, non un template generico
7. Usa i network condivisi come punto di connessione se esistono
8. Genera il corpo dell'email in HTML semplice: usa <p> per i paragrafi, <br> per gli a capo interni, <strong> per enfasi, <ul>/<li> per elenchi puntati. NON usare markdown. NON usare \n per gli a capo, usa i tag HTML.
9. Includi un oggetto email nella prima riga nel formato "Subject: ..." (l'oggetto è testo puro, non HTML)
10. Dopo l'oggetto, vai a capo due volte e scrivi il corpo dell'email in HTML
11. Se sono forniti documenti di riferimento o informazioni da link, usali per arricchire il contenuto
12. Se sono disponibili profili LinkedIn, puoi menzionare la connessione professionale
13. IMPORTANTE: Usa SEMPRE l'alias/nome breve del destinatario nel saluto (es. "Dear Marco" non "Dear Marco Rossi"). Mai usare nome e cognome completi.
14. IMPORTANTE: Usa SEMPRE l'alias/nome breve del mittente, mai il nome completo con cognome.
15. Il corpo dell'email deve terminare con un saluto di chiusura (es. "Best regards," o "Cordiali saluti,") seguito dal nome del mittente. NON aggiungere dettagli come ruolo, azienda, telefono, email — quelli sono nella firma automatica.
16. CRITICO: Se il nome del destinatario sembra un ruolo/titolo aziendale (es. "Pricing & Business Development", "Operations Manager", "Import Department"), NON usarlo MAI come nome di persona nel saluto. In quel caso usa "Gentile responsabile" o equivalente.`;

    const userPrompt = `${senderContext}

${partnerContext}

${contactContext}
${documentsContext}
${linksContext}
GOAL DELLA COMUNICAZIONE:
${goal || "Presentazione aziendale e proposta di collaborazione"}

PROPOSTA DI BASE:
${base_proposal || "Proposta generica di collaborazione nel settore freight forwarding"}

Genera l'email completa con oggetto e corpo.`;

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
        return new Response(JSON.stringify({ error: "Rate limit raggiunto, riprova tra poco." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Crediti AI esauriti." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI error:", status, text);
      throw new Error("AI gateway error");
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "";

    // Consume credits atomically
    if (result.usage) {
      const inputTokens = result.usage.prompt_tokens || 0;
      const outputTokens = result.usage.completion_tokens || 0;
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
        partner_name: partner.company_name,
        contact_name: contact?.contact_alias || contact?.name || null,
        contact_email: contactEmail,
        has_contact: !!contact,
        used_partner_email: !contact?.email && !!partner.email,
        quality,
        model,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-email error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
