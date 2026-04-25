import "../_shared/llmFetchInterceptor.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";


serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;

  const origin = req.headers.get("origin");
  const dynCors = getCorsHeaders(origin);

  try {
    const { name, text, type } = await req.json();
    if (!name && !text) {
      return new Response(JSON.stringify({ category: "altro" }), {
        headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ category: "altro" }), {
        headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }

    const categories = type === "proposal"
      ? ["proposta_servizi", "partnership", "altro"]
      : ["primo_contatto", "follow_up", "richiesta", "partnership", "altro"];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
            content: `Sei un classificatore. Dato un elemento con nome e descrizione, rispondi SOLO con una delle seguenti categorie: ${categories.join(", ")}. Nient'altro.`,
          },
          {
            role: "user",
            content: `Nome: ${name}\nDescrizione: ${text}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "classify",
              description: "Classifica l'elemento nella categoria corretta",
              parameters: {
                type: "object",
                properties: {
                  category: { type: "string", enum: categories },
                },
                required: ["category"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "classify" } },
      }),
    });

    if (!response.ok) {
      console.error("AI gateway error:", response.status);
      return new Response(JSON.stringify({ category: "altro" }), {
        headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    let category = "altro";
    if (toolCall?.function?.arguments) {
      try {
        const args = JSON.parse(toolCall.function.arguments);
        if (categories.includes(args.category)) category = args.category;
      } catch { /* fallback */ }
    }

    return new Response(JSON.stringify({ category }), {
      headers: { ...dynCors, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("categorize error:", e);
    return new Response(JSON.stringify({ category: "altro" }), {
      headers: { ...dynCors, "Content-Type": "application/json" },
    });
  }
});
