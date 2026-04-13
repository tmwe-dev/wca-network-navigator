import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimiter.ts";

serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;

  const origin = req.headers.get("origin");
  const dynCors = getCorsHeaders(origin);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "AUTH_REQUIRED" }), { status: 401, headers: { ...dynCors, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from token
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "INVALID_TOKEN" }), { status: 401, headers: { ...dynCors, "Content-Type": "application/json" } });
    }
    const user = { id: claimsData.claims.sub as string };

    // Rate limiting
    const rl = checkRateLimit(`suggest-groups:${user.id}`, { maxTokens: 5, refillRate: 0.08 });
    if (!rl.allowed) return rateLimitResponse(rl, dynCors);

    const body = await req.json();
    const minEmailCount = body.min_email_count ?? 3;
    const batchSize = body.batch_size ?? 20;

    // 1. Load groups
    const { data: groups } = await supabase
      .from("email_sender_groups")
      .select("id, nome_gruppo, descrizione")
      .eq("user_id", user.id);

    if (!groups || groups.length === 0) {
      return new Response(JSON.stringify({ error: "No groups configured" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 2. Load uncategorized addresses with enough emails
    const { data: addresses } = await supabase
      .from("email_address_rules")
      .select("id, email_address, display_name, email_count")
      .eq("user_id", user.id)
      .is("group_id", null)
      .gte("email_count", minEmailCount)
      .order("email_count", { ascending: false })
      .limit(batchSize);

    if (!addresses || addresses.length === 0) {
      return new Response(JSON.stringify({ processed: 0, suggestions: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 3. For each address, get last 5 subjects
    const addressData: Array<{ email: string; display_name: string | null; email_count: number; subjects: string[]; ruleId: string }> = [];

    for (const addr of addresses) {
      const { data: msgs } = await supabase
        .from("channel_messages")
        .select("subject")
        .eq("from_address", addr.email_address)
        .eq("direction", "inbound")
        .order("created_at", { ascending: false })
        .limit(5);

      addressData.push({
        email: addr.email_address,
        display_name: addr.display_name,
        email_count: addr.email_count ?? 0,
        subjects: (msgs || []).map((m: any) => m.subject || "").filter(Boolean),
        ruleId: addr.id,
      });
    }

    // 4. Call AI
    const groupsList = groups.map((g: any) => `- ${g.nome_gruppo}: ${g.descrizione || "nessuna descrizione"}`).join("\n");
    const addressList = addressData.map((a) =>
      `Email: ${a.email}, Nome: ${a.display_name || "N/A"}, Volume: ${a.email_count}, Ultimi oggetti: ${a.subjects.slice(0, 5).join(" | ") || "N/A"}`
    ).join("\n");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Sei un assistente di classificazione email per un'azienda di freight forwarding / logistica internazionale.`
          },
          {
            role: "user",
            content: `Gruppi disponibili:\n${groupsList}\n\nPer ogni address email qui sotto, suggerisci il gruppo più appropriato.\n\nREGOLE:\n- Usa SOLO gruppi esistenti dalla lista sopra, non inventarne di nuovi\n- Se non sei sicuro (confidence < 0.4), suggerisci "uncategorized"\n- Basa la decisione su: dominio email, contenuto subject, pattern del sender\n- Rispondi SOLO con un JSON array valido, niente altro testo\n\nFormato risposta: [{"email":"...","suggested_group":"nome_gruppo","confidence":0.0-1.0,"reasoning":"breve spiegazione"}]\n\nAddress da classificare:\n${addressList}`
          }
        ],
        tools: [{
          type: "function",
          function: {
            name: "classify_email_addresses",
            description: "Classify email addresses into groups",
            parameters: {
              type: "object",
              properties: {
                classifications: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      email: { type: "string" },
                      suggested_group: { type: "string" },
                      confidence: { type: "number" },
                      reasoning: { type: "string" }
                    },
                    required: ["email", "suggested_group", "confidence", "reasoning"],
                    additionalProperties: false
                  }
                }
              },
              required: ["classifications"],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "classify_email_addresses" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      return new Response(JSON.stringify({ error: "AI gateway error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiData = await aiResponse.json();
    let classifications: Array<{ email: string; suggested_group: string; confidence: number; reasoning: string }> = [];

    try {
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        const parsed = JSON.parse(toolCall.function.arguments);
        classifications = parsed.classifications || [];
      }
    } catch (e) {
      console.error("Parse error:", e);
      return new Response(JSON.stringify({ error: "Failed to parse AI response" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 5. Save suggestions
    let processed = 0;
    for (const cls of classifications) {
      if (cls.suggested_group === "uncategorized" || cls.confidence < 0.3) continue;
      const addrData = addressData.find((a) => a.email.toLowerCase() === cls.email.toLowerCase());
      if (!addrData) continue;

      await supabase
        .from("email_address_rules")
        .update({
          ai_suggested_group: cls.suggested_group,
          ai_suggestion_confidence: cls.confidence,
        })
        .eq("id", addrData.ruleId);

      processed++;
    }

    return new Response(
      JSON.stringify({ processed, suggestions: classifications }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("suggest-email-groups error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
