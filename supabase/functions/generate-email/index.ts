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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { activity_id, goal, base_proposal, language, document_ids, reference_urls, quality: rawQuality } = await req.json();
    if (!activity_id) throw new Error("activity_id is required");

    const quality: Quality = (["fast", "standard", "premium"].includes(rawQuality) ? rawQuality : "standard") as Quality;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch activity with partner + selected contact
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

    const partner = activity.partners;
    const contact = activity.selected_contact;

    // --- VALIDATION: check contact has email ---
    const contactEmail = contact?.email || partner.email || null;
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
    const [networksRes, servicesRes, settingsRes, socialRes] = await Promise.all([
      supabase.from("partner_networks").select("network_name").eq("partner_id", partner.id),
      quality !== "fast"
        ? supabase.from("partner_services").select("service_category").eq("partner_id", partner.id)
        : Promise.resolve({ data: [] }),
      supabase.from("app_settings").select("key, value").like("key", "ai_%"),
      quality === "premium"
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
    let linksContext = "";
    if (quality === "premium" && reference_urls && reference_urls.length > 0) {
      const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
      if (FIRECRAWL_API_KEY) {
        const urlsToScrape = reference_urls.slice(0, 3);
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

    // --- USE ALIASES as primary names ---
    const recipientName = contact
      ? (contact.contact_alias || contact.name)
      : (partner.company_alias || partner.company_name);
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
- Nome da usare nel saluto: ${recipientName} (IMPORTANTE: usa SOLO questo nome, mai il nome completo con cognome)
- Ruolo: ${contact.title || "N/A"}
- Email: ${contact.email || contactEmail}
${quality !== "fast" ? `- Telefono: ${contact.direct_phone || contact.mobile || "N/A"}` : ""}
` : `Nessun contatto specifico selezionato — indirizzare all'azienda usando il nome "${recipientCompany}".`;

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

    const effectiveLanguage = language || settings.ai_language || "inglese";

    const systemPrompt = `Sei un esperto copywriter di email B2B nel settore della logistica e del freight forwarding internazionale. Scrivi email professionali, personalizzate e convincenti.

REGOLE CRITICHE:
1. Scrivi in ${effectiveLanguage === "entrambe" ? "inglese (adatta al paese del destinatario)" : effectiveLanguage}
2. L'email deve essere specifica per il destinatario — usa i dati del profilo per personalizzare
3. Mantieni il tono indicato dal profilo del mittente
4. NON INCLUDERE una firma — la firma viene aggiunta automaticamente dal sistema
5. Non inventare informazioni — usa solo i dati forniti
6. L'email deve essere pronta per l'invio, non un template generico
7. Usa i network condivisi come punto di connessione se esistono
8. Rispondi SOLO con il testo dell'email (no markdown, no commenti esterni)
9. Includi un oggetto email nella prima riga nel formato "Subject: ..."
10. Dopo l'oggetto, vai a capo due volte e scrivi il corpo dell'email
11. Se sono forniti documenti di riferimento o informazioni da link, usali per arricchire il contenuto
12. Se sono disponibili profili LinkedIn, puoi menzionare la connessione professionale
13. IMPORTANTE: Usa SEMPRE l'alias/nome breve del destinatario nel saluto (es. "Dear Marco" non "Dear Marco Rossi"). Mai usare nome e cognome completi.
14. IMPORTANTE: Usa SEMPRE l'alias/nome breve del mittente, mai il nome completo con cognome.
15. Il corpo dell'email deve terminare con un saluto di chiusura (es. "Best regards," o "Cordiali saluti,") seguito dal nome del mittente. NON aggiungere dettagli come ruolo, azienda, telefono, email — quelli sono nella firma automatica.`;

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

    let subject = "";
    let body = content;
    const subjectMatch = content.match(/^Subject:\s*(.+)/i);
    if (subjectMatch) {
      subject = subjectMatch[1].trim();
      body = content.substring(subjectMatch[0].length).trim();
    }

    // Append signature block to body
    if (signatureBlock.trim()) {
      body = body + "\n\n" + signatureBlock;
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
