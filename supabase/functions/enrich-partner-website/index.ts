import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";

// LOVABLE-75 — LEGACY
// Questa funzione è mantenuta solo per useAcquisitionPipeline.
// Tutti gli altri chiamanti devono usare il Deep Search client-side (useDeepSearchLocal)
// o leggere i dati esistenti via readUnifiedEnrichment (vedi _shared/enrichmentAdapter.ts).
// Generate-email / improve-email / generate-outreach / Command tools NON devono più invocarla.

// ── Credit helpers ──
async function getUserId(req: Request, supabase: Record<string, unknown>): Promise<string | null> {
  const auth = req.headers.get("Authorization");
  if (!auth) return null;
  const token = auth.replace("Bearer ", "");
  const { data } = await supabase.auth.getUser(token);
  return data?.user?.id || null;
}

async function isByok(userId: string, supabase: Record<string, unknown>): Promise<boolean> {
  const { data } = await supabase
    .from("user_api_keys")
    .select("api_key")
    .eq("user_id", userId)
    .eq("provider", "google")
    .eq("is_active", true)
    .maybeSingle();
  return !!data?.api_key;
}

async function consumeCredits(userId: string, usage: { prompt_tokens: number; completion_tokens: number }, supabase: Record<string, unknown>) {
  const inputCost = Math.ceil(usage.prompt_tokens / 1000 * 1);
  const outputCost = Math.ceil(usage.completion_tokens / 1000 * 2);
  const total = inputCost + outputCost;
  if (total <= 0) return;

  const { data: credits } = await supabase.from("user_credits").select("balance, total_consumed").eq("user_id", userId).single();
  if (!credits) return;

  await supabase.from("user_credits").update({
    balance: Math.max(0, credits.balance - total),
    total_consumed: credits.total_consumed + total,
  }).eq("user_id", userId);

  await supabase.from("credit_transactions").insert({
    user_id: userId,
    amount: -total,
    operation: "ai_call",
    description: `enrich-partner-website: ${usage.prompt_tokens} in + ${usage.completion_tokens} out`,
  });
}

Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;

  const origin = req.headers.get("origin");
  const dynCors = getCorsHeaders(origin);

  try {
    const { partnerId, markdown: preScrapedMarkdown, sourceUrl: preScrapedUrl } = await req.json();
    if (!partnerId) {
      return new Response(JSON.stringify({ error: "partnerId is required" }), {
        status: 400,
        headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500, headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ── Check global pause ──
    const { data: pauseSetting } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "ai_automations_paused")
      .maybeSingle();

    if (pauseSetting?.value === "true") {
      return new Response(JSON.stringify({ error: "AI automations are paused" }), {
        status: 503, headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }

    // ── Auth & BYOK check ──
    const userId = await getUserId(req, supabase);
    const byok = userId ? await isByok(userId, supabase) : false;

    if (userId && !byok) {
      const { data: credits } = await supabase.from("user_credits").select("balance").eq("user_id", userId).single();
      if (!credits || credits.balance < 5) {
        return new Response(JSON.stringify({ error: "Crediti insufficienti. Acquista crediti extra o aggiungi le tue chiavi API." }), {
          status: 402, headers: { ...dynCors, "Content-Type": "application/json" },
        });
      }
    }

    // Get partner
    const { data: partner, error: partnerError } = await supabase
      .from("partners")
      .select("id, company_name, website, country_name, city")
      .eq("id", partnerId)
      .single();

    if (partnerError || !partner) {
      return new Response(JSON.stringify({ error: "Partner not found" }), {
        status: 404, headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }

    if (!partner.website) {
      return new Response(JSON.stringify({ error: "Partner has no website" }), {
        status: 400, headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }

    // Format URL
    let url = preScrapedUrl || partner.website.trim();
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = `https://${url}`;
    }


    // Use pre-scraped markdown if provided, otherwise fallback to server-side fetch
    let markdown = "";
    if (preScrapedMarkdown && preScrapedMarkdown.length > 50) {
      markdown = preScrapedMarkdown.substring(0, 15000);
    } else {
      // Fallback: direct fetch website content
      try {
        const fetchResp = await fetch(url, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; PartnerConnectBot/1.0)" },
          redirect: "follow",
        });
        if (fetchResp.ok) {
          const html = await fetchResp.text();
          markdown = html
            .replace(/<script[\s\S]*?<\/script>/gi, "")
            .replace(/<style[\s\S]*?<\/style>/gi, "")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .substring(0, 15000);
        }
      } catch (e) {
      }
    }

    if (!markdown || markdown.length < 50) {
      await supabase.from("partners").update({
        enrichment_data: { error: "Could not extract content from website", attempted_url: url },
        enriched_at: new Date().toISOString(),
      }).eq("id", partnerId);

      return new Response(
        JSON.stringify({ success: true, enrichment: null, message: "No content extracted" }),
        { headers: { ...dynCors, "Content-Type": "application/json" } }
      );
    }


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
  "key_markets": ["array di string - mercati/paesi principali serviti"],
  "key_routes": [{"from": "paese origine", "to": "paese destinazione"}],
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
                  key_routes: { type: "array", items: { type: "object", properties: { from: { type: "string" }, to: { type: "string" } }, required: ["from", "to"] } },
                  summary_it: { type: "string" },
                },
                required: [
                  "revenue_estimate", "employee_count", "founding_year",
                  "has_own_fleet", "fleet_details", "has_warehouses",
                  "warehouse_sqm", "warehouse_details", "additional_services",
                  "key_markets", "key_routes", "summary_it",
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
      const detail = aiResponse.status === 402 ? "Crediti AI esauriti. Riprova più tardi." : `AI analysis failed (${aiResponse.status})`;
      return new Response(JSON.stringify({ error: detail }), {
        status: 500, headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();

    // ── Consume credits ──
    if (userId && !byok && aiData.usage) {
      await consumeCredits(userId, {
        prompt_tokens: aiData.usage.prompt_tokens || 0,
        completion_tokens: aiData.usage.completion_tokens || 0,
      }, supabase);
    }

    let enrichment: Record<string, unknown> | null = null;

    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        enrichment = JSON.parse(toolCall.function.arguments);
      } catch {
      }
    }

    if (!enrichment) {
      const content = aiData.choices?.[0]?.message?.content || "";
      try {
        enrichment = JSON.parse(content.replace(/```json\n?|\n?```/g, "").trim());
      } catch {
      }
    }

    if (!enrichment) {
      return new Response(JSON.stringify({ error: "Failed to extract data" }), {
        status: 500, headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }

    enrichment.source_url = url;

    // Extract logo_url and website from enrichment for top-level columns
    const logoUrl = enrichment.logo_url && typeof enrichment.logo_url === "string" ? enrichment.logo_url : null;
    const websiteValue = enrichment.website && typeof enrichment.website === "string" ? enrichment.website : null;

    const { error: updateError } = await supabase.from("partners").update({
      enrichment_data: enrichment,
      enriched_at: new Date().toISOString(),
      ...(logoUrl && { logo_url: logoUrl }),
      ...(websiteValue && { website: websiteValue }),
    }).eq("id", partnerId);

    if (updateError) {
      return new Response(JSON.stringify({ error: "Failed to save enrichment" }), {
        status: 500, headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }


    // LOVABLE-93: Auto-calculate quality score after enrichment
    try {
      const { triggerQualityScoreRecalculation } = await import("../_shared/enrichmentAdapter.ts");
      await triggerQualityScoreRecalculation(supabase, partnerId);
    } catch (e) {
    }

    return new Response(
      JSON.stringify({ success: true, enrichment }),
      { headers: { ...dynCors, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...dynCors, "Content-Type": "application/json" } }
    );
  }
});
