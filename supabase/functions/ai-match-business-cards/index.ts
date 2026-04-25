import "../_shared/llmFetchInterceptor.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";


serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;

  const origin = req.headers.get("origin");
  const dynCors = getCorsHeaders(origin);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing auth");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) throw new Error("Non autenticato");

    const { batch_offset = 0, batch_size = 20 } = await req.json();

    // Fetch unmatched business cards
    const { data: unmatchedCards, error: bcErr } = await supabase
      .from("business_cards")
      .select("id, company_name, contact_name, email, phone, mobile, location, event_name")
      .eq("user_id", user.id)
      .eq("match_status", "unmatched")
      .order("created_at", { ascending: false })
      .range(batch_offset, batch_offset + batch_size - 1);

    if (bcErr) throw bcErr;
    if (!unmatchedCards || unmatchedCards.length === 0) {
      return new Response(JSON.stringify({ matches: [], total_unmatched: 0 }), {
        headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }

    // Get total count
    const { count: totalUnmatched } = await supabase
      .from("business_cards")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("match_status", "unmatched");

    // Get a broad set of partner candidates - fetch partners whose names might overlap
    // We'll get all partners and let AI do the matching
    const companyNames = unmatchedCards.map(c => c.company_name).filter(Boolean);
    
    // Build search terms from first words of company names
    const searchTerms = [...new Set(companyNames.flatMap(name => {
      const words = name!.split(/\s+/).filter(w => w.length > 2);
      return words.slice(0, 2);
    }))].slice(0, 30);

    let partners: Array<Record<string, unknown>> = [];
    if (searchTerms.length > 0) {
      // Search in batches to get relevant partners
      const orFilter = searchTerms.map(t => `company_name.ilike.%${t}%`).join(",");
      const { data: partnerData } = await supabase
        .from("partners")
        .select("id, company_name, company_alias, country_code, country_name, city, wca_id")
        .or(orFilter)
        .limit(200);
      partners = partnerData || [];
    }

    if (partners.length === 0) {
      // No potential matches found
      return new Response(JSON.stringify({ 
        matches: unmatchedCards.map(c => ({ card_id: c.id, company_name: c.company_name, candidates: [] })),
        total_unmatched: totalUnmatched || 0,
      }), {
        headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }

    // Call AI to match
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const prompt = `You are an expert at matching business card company names to a partner database.

Given these BUSINESS CARDS (unmatched):
${JSON.stringify(unmatchedCards.map(c => ({ id: c.id, company: c.company_name, contact: c.contact_name, email: c.email, location: c.location })), null, 2)}

And these PARTNERS in the database:
${JSON.stringify(partners.map(p => ({ id: p.id, company: p.company_name, alias: p.company_alias, country: p.country_name, city: p.city })), null, 2)}

For each business card, find the most likely matching partner(s). Consider:
- Abbreviations (e.g., "Int'l" = "International")
- Translations between languages
- Common variations (Ltd, LLC, GmbH, S.r.l., etc.)
- Partial name matches with high semantic similarity

Return ONLY a JSON array. Each element:
{
  "card_id": "uuid of business card",
  "candidates": [
    { "partner_id": "uuid", "confidence": 85, "reason": "brief explanation" }
  ]
}

confidence: 0-100. Only include candidates with confidence >= 50. Max 3 candidates per card. If no match, return empty candidates array.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: prompt }],
        tools: [{
          type: "function",
          function: {
            name: "return_matches",
            description: "Return the matching results",
            parameters: {
              type: "object",
              properties: {
                results: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      card_id: { type: "string" },
                      candidates: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            partner_id: { type: "string" },
                            confidence: { type: "number" },
                            reason: { type: "string" },
                          },
                          required: ["partner_id", "confidence", "reason"],
                        },
                      },
                    },
                    required: ["card_id", "candidates"],
                  },
                },
              },
              required: ["results"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "return_matches" } },
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit raggiunto, riprova tra poco." }), {
          status: 429, headers: { ...dynCors, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Crediti AI esauriti." }), {
          status: 402, headers: { ...dynCors, "Content-Type": "application/json" },
        });
      }
      const t = await aiResponse.text();
      console.error("AI error:", aiResponse.status, t);
      throw new Error("AI gateway error");
    }

    const aiData = await aiResponse.json();
    let results: Array<Record<string, unknown>> = [];
    
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      results = parsed.results || [];
    }

    // Enrich results with card and partner display data
    const cardMap = new Map(unmatchedCards.map(c => [c.id, c]));
    const partnerMap = new Map(partners.map(p => [p.id, p]));

    const enrichedMatches = results.map((r: Record<string, unknown>) => {
      const card = cardMap.get(r.card_id);
      return {
        card_id: r.card_id,
        card_company: card?.company_name || "?",
        card_contact: card?.contact_name || "",
        card_email: card?.email || "",
        card_phone: card?.phone || card?.mobile || "",
        card_location: card?.location || "",
        candidates: (r.candidates || []).map((c: Record<string, unknown>) => {
          const partner = partnerMap.get(c.partner_id);
          return {
            partner_id: c.partner_id,
            confidence: c.confidence,
            reason: c.reason,
            partner_company: partner?.company_name || "?",
            partner_alias: partner?.company_alias || "",
            partner_country: partner?.country_name || "",
            partner_country_code: partner?.country_code || "",
            partner_city: partner?.city || "",
          };
        }).sort((a: Record<string, unknown>, b: Record<string, unknown>) => b.confidence - a.confidence),
      };
    }).filter((r: Record<string, unknown>) => r.candidates.length > 0)
      .sort((a: Record<string, unknown>, b: Record<string, unknown>) => (b.candidates[0]?.confidence || 0) - (a.candidates[0]?.confidence || 0));

    return new Response(JSON.stringify({ 
      matches: enrichedMatches,
      total_unmatched: totalUnmatched || 0,
      processed: unmatchedCards.length,
    }), {
      headers: { ...dynCors, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("ai-match error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...dynCors, "Content-Type": "application/json" },
    });
  }
});
