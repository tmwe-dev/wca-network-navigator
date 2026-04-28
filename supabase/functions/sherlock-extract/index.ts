import "../_shared/llmFetchInterceptor.ts";
/**
 * sherlock-extract — Edge function che usa Lovable AI (gemini-3-flash-preview)
 * per estrarre findings strutturati da un markdown già scrapato.
 *
 * Input:  { markdown, extract_prompt, target_fields[], prior_findings, label }
 * Output: { findings: {...}, confidence: 0-1, suggested_next_url?: string, reasoning?: string }
 *
 * Implementa tool calling: schema dinamico generato da target_fields.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

interface ReqBody {
  markdown: string;
  extract_prompt: string;
  target_fields?: string[];
  prior_findings?: Record<string, unknown>;
  label?: string;
}

const SYSTEM_PROMPT = `Sei "Sherlock", un investigatore commerciale digitale.
Estrai SOLO informazioni FATTUALI presenti nel testo fornito.
Mai inventare. Se un campo non è presente, lascialo null.
Quando trovi un'informazione, includi una breve spiegazione di dove l'hai trovata.
Pensa come un detective: ogni dettaglio piccolo conta.
Se nel testo trovi un URL particolarmente promettente per la prossima ricerca
(es. profilo LinkedIn di un decision maker, pagina contatti dettagliata),
suggeriscilo in suggested_next_url.`;

function buildSchema(targetFields: string[]) {
  // Schema generico: ogni target_field diventa una stringa opzionale + array fonti.
  const properties: Record<string, unknown> = {
    summary: { type: "string", description: "Sintesi 1-2 righe di ciò che è stato trovato in questa pagina" },
    confidence: {
      type: "number",
      description: "0-1: quanto sei sicuro complessivamente di ciò che hai estratto",
    },
    suggested_next_url: {
      type: ["string", "null"],
      description: "URL trovato nel testo che vale la pena scrapare come prossimo step (es. LinkedIn CEO). null se nessuno.",
    },
    fields: {
      type: "object",
      description: "Mappa target_field → valore estratto (string o null se non trovato)",
      properties: Object.fromEntries(
        targetFields.map((f) => [f, { type: ["string", "null"] }]),
      ),
      additionalProperties: true,
    },
    other_findings: {
      type: "array",
      description: "Findings rilevanti non previsti dai target_fields",
      items: {
        type: "object",
        properties: {
          key: { type: "string" },
          value: { type: "string" },
        },
        required: ["key", "value"],
      },
    },
  };

  return {
    type: "object",
    properties,
    required: ["summary", "confidence", "fields"],
    additionalProperties: false,
  };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as ReqBody;
    if (!body.markdown || !body.extract_prompt) {
      return new Response(
        JSON.stringify({ error: "markdown e extract_prompt sono obbligatori" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY mancante" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const targetFields = body.target_fields ?? [];
    const schema = buildSchema(targetFields);

    // Tronca markdown a 30k char per evitare context overflow
    const md = body.markdown.length > 30_000 ? body.markdown.slice(0, 30_000) + "\n…[truncated]" : body.markdown;

    const userParts = [
      `**Pagina**: ${body.label ?? "(senza etichetta)"}`,
      `**Target fields**: ${targetFields.join(", ") || "(nessuno specifico)"}`,
      `**Findings precedenti**:\n\`\`\`json\n${JSON.stringify(body.prior_findings ?? {}, null, 2)}\n\`\`\``,
      `**Istruzione**:\n${body.extract_prompt}`,
      `**Contenuto pagina**:\n---\n${md}\n---`,
    ].join("\n\n");

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userParts },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "report_findings",
              description: "Riporta i findings strutturati estratti dalla pagina",
              parameters: schema,
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "report_findings" } },
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("AI gateway error", aiRes.status, errText);
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit AI. Riprova fra poco." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiRes.status === 402) {
        return new Response(
          JSON.stringify({ error: "Crediti AI esauriti. Aggiungi fondi al workspace Lovable." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ error: "Errore AI gateway", detail: errText }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiRes.json();
    const toolCall = aiJson?.choices?.[0]?.message?.tool_calls?.[0];
    const argsStr = toolCall?.function?.arguments;
    if (!argsStr) {
      console.error("No tool call in AI response", JSON.stringify(aiJson).slice(0, 500));
      return new Response(
        JSON.stringify({ error: "AI non ha restituito findings strutturati", raw: aiJson }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(argsStr);
    } catch (e) {
      return new Response(
        JSON.stringify({ error: "Parse JSON tool call fallito", detail: String(e) }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("sherlock-extract error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Errore sconosciuto" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
