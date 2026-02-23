import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { activity_id, goal, base_proposal, language } = await req.json();
    if (!activity_id) throw new Error("activity_id is required");

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

    // Fetch partner networks
    const { data: networks } = await supabase
      .from("partner_networks")
      .select("network_name")
      .eq("partner_id", partner.id);

    // Fetch partner services
    const { data: services } = await supabase
      .from("partner_services")
      .select("service_category")
      .eq("partner_id", partner.id);

    // Fetch AI profile settings
    const { data: settingsRows } = await supabase
      .from("app_settings")
      .select("key, value")
      .like("key", "ai_%");

    const settings: Record<string, string> = {};
    (settingsRows || []).forEach((r: any) => { settings[r.key] = r.value || ""; });

    // Build context
    const partnerContext = `
AZIENDA DESTINATARIA:
- Nome: ${partner.company_name}${partner.company_alias ? ` (alias: ${partner.company_alias})` : ""}
- Città: ${partner.city}, ${partner.country_name} (${partner.country_code})
- Sito web: ${partner.website || "N/A"}
- Email generale: ${partner.email || "N/A"}
- Rating: ${partner.rating ? `${partner.rating}/5` : "N/A"}
- Network: ${(networks || []).map((n: any) => n.network_name).join(", ") || "N/A"}
- Servizi: ${(services || []).map((s: any) => s.service_category.replace(/_/g, " ")).join(", ") || "N/A"}
${partner.profile_description ? `- Descrizione: ${partner.profile_description.substring(0, 800)}` : ""}
${partner.raw_profile_markdown ? `\nPROFILO COMPLETO (estratto):\n${partner.raw_profile_markdown.substring(0, 1500)}` : ""}
`;

    const contactContext = contact ? `
CONTATTO DESTINATARIO:
- Nome: ${contact.name}${contact.contact_alias ? ` (alias: ${contact.contact_alias})` : ""}
- Ruolo: ${contact.title || "N/A"}
- Email: ${contact.email || "N/A"}
- Telefono: ${contact.direct_phone || contact.mobile || "N/A"}
` : "Nessun contatto specifico selezionato — indirizzare all'azienda genericamente.";

    const senderContext = `
MITTENTE (TU):
- Azienda: ${settings.ai_company_name || "N/A"}${settings.ai_company_alias ? ` (${settings.ai_company_alias})` : ""}
- Referente: ${settings.ai_contact_name || "N/A"}${settings.ai_contact_alias ? ` (${settings.ai_contact_alias})` : ""}
- Ruolo: ${settings.ai_contact_role || "N/A"}
- Email: ${settings.ai_email_signature || "N/A"}
- Telefono: ${settings.ai_phone_signature || "N/A"}
- Settore: ${settings.ai_sector || "freight_forwarding"}
- Network: ${settings.ai_networks || "N/A"}

KNOWLEDGE BASE:
${settings.ai_knowledge_base || "Non configurata"}

STILE DI COMUNICAZIONE:
- Tono: ${settings.ai_tone || "professionale"}
- Lingua: ${settings.ai_language || "italiano"}
${settings.ai_style_instructions ? `- Istruzioni: ${settings.ai_style_instructions}` : ""}
${settings.ai_sector_notes ? `- Note settoriali: ${settings.ai_sector_notes}` : ""}
`;

    const effectiveLanguage = language || settings.ai_language || "inglese";

    const systemPrompt = `Sei un esperto copywriter di email B2B nel settore della logistica e del freight forwarding internazionale. Scrivi email professionali, personalizzate e convincenti.

REGOLE:
1. Scrivi in ${effectiveLanguage === "entrambe" ? "inglese (adatta al paese del destinatario)" : effectiveLanguage}
2. L'email deve essere specifica per il destinatario — usa i dati del profilo per personalizzare
3. Mantieni il tono indicato dal profilo del mittente
4. Includi una firma professionale con i dati del mittente
5. Non inventare informazioni — usa solo i dati forniti
6. L'email deve essere pronta per l'invio, non un template generico
7. Usa i network condivisi come punto di connessione se esistono
8. Rispondi SOLO con il testo dell'email (no markdown, no commenti esterni)
9. Includi un oggetto email nella prima riga nel formato "Subject: ..."
10. Dopo l'oggetto, vai a capo due volte e scrivi il corpo dell'email`;

    const userPrompt = `${senderContext}

${partnerContext}

${contactContext}

GOAL DELLA COMUNICAZIONE:
${goal || "Presentazione aziendale e proposta di collaborazione"}

PROPOSTA DI BASE:
${base_proposal || "Proposta generica di collaborazione nel settore freight forwarding"}

Genera l'email completa con oggetto e corpo.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
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

    // Parse subject and body
    let subject = "";
    let body = content;
    const subjectMatch = content.match(/^Subject:\s*(.+)/i);
    if (subjectMatch) {
      subject = subjectMatch[1].trim();
      body = content.substring(subjectMatch[0].length).trim();
    }

    return new Response(
      JSON.stringify({
        subject,
        body,
        full_content: content,
        partner_name: partner.company_name,
        contact_name: contact?.name || null,
        contact_email: contact?.email || partner.email || null,
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
