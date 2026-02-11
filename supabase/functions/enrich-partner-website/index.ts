import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { partnerId } = await req.json();
    if (!partnerId) {
      return new Response(JSON.stringify({ error: "partnerId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!FIRECRAWL_API_KEY) {
      return new Response(JSON.stringify({ error: "Firecrawl not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get partner
    const { data: partner, error: partnerError } = await supabase
      .from("partners")
      .select("id, company_name, website, country_name, city")
      .eq("id", partnerId)
      .single();

    if (partnerError || !partner) {
      return new Response(JSON.stringify({ error: "Partner not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!partner.website) {
      return new Response(JSON.stringify({ error: "Partner has no website" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Format URL
    let url = partner.website.trim();
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = `https://${url}`;
    }

    console.log(`Scraping website for ${partner.company_name}: ${url}`);

    // Scrape with Firecrawl
    const scrapeResponse = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["markdown"],
        onlyMainContent: true,
        waitFor: 3000,
      }),
    });

    const scrapeData = await scrapeResponse.json();
    const markdown = scrapeData?.data?.markdown || scrapeData?.markdown || "";

    if (!markdown || markdown.length < 50) {
      // Save empty enrichment to mark as attempted
      await supabase
        .from("partners")
        .update({
          enrichment_data: { error: "Could not extract content from website", attempted_url: url },
          enriched_at: new Date().toISOString(),
        })
        .eq("id", partnerId);

      return new Response(
        JSON.stringify({ success: true, enrichment: null, message: "No content extracted" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Extracted ${markdown.length} chars, analyzing with AI...`);

    // Analyze with Gemini via Lovable AI
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `Sei un analista di logistica e spedizioni. Analizza il contenuto del sito web di un'azienda di spedizioni/logistica e estrai informazioni strutturate. Rispondi SOLO con JSON valido, senza markdown.`,
          },
          {
            role: "user",
            content: `Azienda: ${partner.company_name} (${partner.city}, ${partner.country_name})
Website: ${url}

Contenuto del sito:
${markdown.substring(0, 8000)}

Estrai queste informazioni (metti null se non trovate):
{
  "revenue_estimate": "string o null - fatturato annuo se menzionato",
  "employee_count": "number o null - numero dipendenti",
  "founding_year": "number o null - anno di fondazione",
  "has_own_fleet": "boolean - se hanno mezzi di proprietà",
  "fleet_details": "string o null - dettagli flotta (numero mezzi, tipi)",
  "has_warehouses": "boolean - se hanno magazzini propri",
  "warehouse_sqm": "number o null - superficie magazzini in mq",
  "warehouse_details": "string o null - dettagli magazzini",
  "additional_services": ["array di string - servizi/specializzazioni non standard"],
  "key_markets": ["array di string - mercati/rotte principali"],
  "summary_it": "string - riassunto breve in italiano dell'azienda (max 2 frasi)"
}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_company_data",
              description: "Extract structured company data from website content",
              parameters: {
                type: "object",
                properties: {
                  revenue_estimate: { type: ["string", "null"] },
                  employee_count: { type: ["number", "null"] },
                  founding_year: { type: ["number", "null"] },
                  has_own_fleet: { type: "boolean" },
                  fleet_details: { type: ["string", "null"] },
                  has_warehouses: { type: "boolean" },
                  warehouse_sqm: { type: ["number", "null"] },
                  warehouse_details: { type: ["string", "null"] },
                  additional_services: { type: "array", items: { type: "string" } },
                  key_markets: { type: "array", items: { type: "string" } },
                  summary_it: { type: "string" },
                },
                required: [
                  "revenue_estimate", "employee_count", "founding_year",
                  "has_own_fleet", "fleet_details", "has_warehouses",
                  "warehouse_sqm", "warehouse_details", "additional_services",
                  "key_markets", "summary_it",
                ],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_company_data" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      const detail = aiResponse.status === 402 ? "Crediti AI esauriti. Riprova più tardi." : `AI analysis failed (${aiResponse.status})`;
      return new Response(JSON.stringify({ error: detail }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    let enrichment: any = null;

    // Extract from tool call
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        enrichment = JSON.parse(toolCall.function.arguments);
      } catch {
        console.error("Failed to parse tool call arguments");
      }
    }

    // Fallback: try parsing content directly
    if (!enrichment) {
      const content = aiData.choices?.[0]?.message?.content || "";
      try {
        enrichment = JSON.parse(content.replace(/```json\n?|\n?```/g, "").trim());
      } catch {
        console.error("Failed to parse AI response");
      }
    }

    if (!enrichment) {
      return new Response(JSON.stringify({ error: "Failed to extract data" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    enrichment.source_url = url;

    // Save to DB
    const { error: updateError } = await supabase
      .from("partners")
      .update({
        enrichment_data: enrichment,
        enriched_at: new Date().toISOString(),
      })
      .eq("id", partnerId);

    if (updateError) {
      console.error("DB update error:", updateError);
      return new Response(JSON.stringify({ error: "Failed to save enrichment" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Enrichment saved for ${partner.company_name}`);

    return new Response(
      JSON.stringify({ success: true, enrichment }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
