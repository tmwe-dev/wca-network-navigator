import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { PLATFORM_TOOLS, executePlatformTool } from "../_shared/platformTools.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Sei il cervello operativo dell'estensione browser del sistema WCA Network Navigator.

HAI ACCESSO COMPLETO ALLA PIATTAFORMA
Puoi cercare partner, contatti, prospect, inbox, holding pattern, creare attività, reminder, generare outreach, gestire memoria, e qualsiasi altra operazione disponibile nel sistema.

Quando l'utente ti chiede qualcosa:
1. Usa i tool disponibili per interrogare il database e operare sul sistema
2. Rispondi in modo conciso e operativo in italiano
3. Puoi creare attività, inviare email, cercare informazioni, gestire partner — tutto ciò che serve

REGOLE:
- Rispondi SEMPRE in italiano
- Sii conciso ma completo
- Se non puoi fare qualcosa, spiegalo chiaramente
- Usa i tool per dare risposte basate su dati reali, non inventare`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, systemPrompt, maxTokens } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Try to get userId from auth header for tool execution
    const authHeader = req.headers.get("Authorization") || "";
    let userId = "anonymous";
    if (authHeader.startsWith("Bearer ")) {
      try {
        const token = authHeader.replace("Bearer ", "");
        const authClient = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_ANON_KEY")!,
          { global: { headers: { Authorization: authHeader } } }
        );
        const { data: claimsData } = await authClient.auth.getClaims(token);
        if (claimsData?.claims?.sub) userId = claimsData.claims.sub as string;
      } catch { /* continue without auth */ }
    }

    const aiMessages = [];
    // Use custom system prompt if provided, otherwise use platform-aware default
    aiMessages.push({ role: "system", content: systemPrompt || SYSTEM_PROMPT });
    if (Array.isArray(messages)) {
      aiMessages.push(...messages);
    }

    // Only use tools if user is authenticated
    const useTools = userId !== "anonymous";

    let response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: aiMessages,
        max_tokens: maxTokens || 1024,
        ...(useTools ? { tools: PLATFORM_TOOLS } : {}),
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Riprova tra poco." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Crediti AI esauriti." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI gateway error:", status, errText);
      return new Response(JSON.stringify({ error: `AI error: ${status}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let data = await response.json();
    let assistantMessage = data.choices?.[0]?.message;
    let totalUsage = { prompt_tokens: data.usage?.prompt_tokens || 0, completion_tokens: data.usage?.completion_tokens || 0 };

    // Tool calling loop (only if authenticated)
    let iterations = 0;
    while (useTools && assistantMessage?.tool_calls?.length && iterations < 5) {
      iterations++;
      const toolResults = [];
      for (const tc of assistantMessage.tool_calls) {
        console.log(`[extension-brain] Tool: ${tc.function.name}`, tc.function.arguments);
        const args = JSON.parse(tc.function.arguments || "{}");
        const toolResult = await executePlatformTool(tc.function.name, args, userId, authHeader);
        console.log(`[extension-brain] Result ${tc.function.name}:`, JSON.stringify(toolResult).substring(0, 500));
        toolResults.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(toolResult) });
      }

      aiMessages.push(assistantMessage);
      aiMessages.push(...toolResults);

      response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "google/gemini-3-flash-preview", messages: aiMessages, max_tokens: maxTokens || 1024, tools: PLATFORM_TOOLS }),
      });

      if (!response.ok) {
        console.error("AI error on tool response:", response.status, await response.text());
        break;
      }

      data = await response.json();
      assistantMessage = data.choices?.[0]?.message;
      if (data.usage) {
        totalUsage.prompt_tokens += data.usage.prompt_tokens || 0;
        totalUsage.completion_tokens += data.usage.completion_tokens || 0;
      }
    }

    const content = assistantMessage?.content || "";

    return new Response(JSON.stringify({
      content,
      usage: {
        input_tokens: totalUsage.prompt_tokens,
        output_tokens: totalUsage.completion_tokens,
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extension-brain error:", e);
    return new Response(JSON.stringify({ error: e.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
