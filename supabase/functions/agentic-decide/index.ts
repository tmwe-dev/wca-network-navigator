import "../_shared/llmFetchInterceptor.ts";
/**
 * agentic-decide — l'AI legge il contesto attuale dell'indagine e decide:
 *   - quali URL visitare nei prossimi step (max 3 alla volta)
 *   - se fermarsi perché ha già trovato abbastanza
 *
 * Input:
 *   {
 *     company_name: string,
 *     city?: string,
 *     country?: string,
 *     website?: string,
 *     budget_remaining: number,        // step rimanenti
 *     visited_urls: string[],          // già visitati (anche falliti)
 *     candidate_links: string[],       // link candidati (estratti dall'home)
 *     google_results: { url: string; title: string; snippet?: string }[], // risultati Google
 *     findings_so_far: Record<string, unknown>,
 *     target_fields: string[],         // cosa cerchiamo (CEO, contacts, services, ...)
 *     last_page_summary?: string       // sintesi dell'ultima pagina visitata (se c'è)
 *   }
 *
 * Output:
 *   {
 *     stop: boolean,
 *     reason: string,
 *     next_actions: { url: string; label: string; why: string }[]  // 0..3 azioni
 *   }
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ReqBody {
  company_name: string;
  city?: string;
  country?: string;
  website?: string;
  budget_remaining: number;
  visited_urls: string[];
  candidate_links: string[];
  google_results?: { url: string; title?: string; snippet?: string }[];
  findings_so_far: Record<string, unknown>;
  target_fields: string[];
  last_page_summary?: string;
}

const SYSTEM_PROMPT = `Sei "Sherlock", un investigatore commerciale autonomo.
Il tuo OBIETTIVO è raccogliere informazioni utili per scrivere una mail commerciale personalizzata
(servizi offerti, dimensione azienda, decision maker, reputazione, particolarità del business).

REGOLE:
1) Massima parsimonia: se hai già findings sufficienti, fermati (stop=true).
2) Scegli URL CONCRETI da quelli forniti — niente invenzioni.
3) Preferisci pagine sostanziose (about, team, leadership, services, fleet, news)
   ed evita aggregatori (Google, Yellow Pages, Yelp) e link interni inutili
   (cookie policy, privacy, login, sitemap).
4) MAI riproporre URL già in visited_urls.
5) Massimo 3 azioni per ciclo. Se il budget rimanente è ≤ 2, scegli al massimo 1 azione.
6) Se l'ultima pagina è stata "page not found" o vuota, prova un link alternativo.
7) Se mancano fondamentali (CEO/owner, contatti, servizi) e il budget lo permette,
   suggerisci un Google search mirato (es. "site:linkedin.com/in COMPANY CEO").`;

const SCHEMA = {
  type: "object",
  properties: {
    stop: { type: "boolean", description: "true se vuoi terminare l'indagine" },
    reason: { type: "string", description: "Motivo breve (max 1 riga) della scelta" },
    next_actions: {
      type: "array",
      maxItems: 3,
      items: {
        type: "object",
        properties: {
          url: { type: "string", description: "URL completo da visitare (http/https)" },
          label: { type: "string", description: "Etichetta breve per la timeline (es. 'Sito — Leadership')" },
          why: { type: "string", description: "Perché questo URL — max 1 riga" },
        },
        required: ["url", "label", "why"],
      },
    },
  },
  required: ["stop", "reason", "next_actions"],
  additionalProperties: false,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json()) as ReqBody;
    if (!body.company_name) {
      return new Response(JSON.stringify({ error: "company_name obbligatorio" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY mancante" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Riduci candidati a max 80 link e 20 google results per non saturare il context
    const candidates = (body.candidate_links ?? []).slice(0, 80);
    const gResults = (body.google_results ?? []).slice(0, 20);
    const visited = (body.visited_urls ?? []).slice(-30);

    const userParts = [
      `**Azienda**: ${body.company_name}${body.city ? ` (${body.city}${body.country ? `, ${body.country}` : ""})` : ""}`,
      body.website ? `**Sito**: ${body.website}` : null,
      `**Budget rimanente**: ${body.budget_remaining} step`,
      `**Target fields**: ${body.target_fields.join(", ") || "(generico)"}`,
      `**URL già visitati** (${visited.length}):\n${visited.map((u) => `- ${u}`).join("\n") || "(nessuno)"}`,
      candidates.length
        ? `**Link candidati dal sito** (${candidates.length}):\n${candidates.map((u) => `- ${u}`).join("\n")}`
        : null,
      gResults.length
        ? `**Risultati Google rilevanti**:\n${gResults
            .map((r) => `- ${r.url}${r.title ? ` — ${r.title}` : ""}${r.snippet ? `\n  ${r.snippet.slice(0, 200)}` : ""}`)
            .join("\n")}`
        : null,
      body.last_page_summary
        ? `**Sintesi ultima pagina**:\n${body.last_page_summary}`
        : null,
      `**Findings raccolti finora**:\n\`\`\`json\n${JSON.stringify(body.findings_so_far ?? {}, null, 2).slice(0, 2000)}\n\`\`\``,
      `\nDecidi le prossime azioni (o stop). Sii chirurgico.`,
    ]
      .filter(Boolean)
      .join("\n\n");

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
              name: "decide_next",
              description: "Decide le prossime URL da visitare, o stop=true",
              parameters: SCHEMA,
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "decide_next" } },
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
      return new Response(JSON.stringify({ error: "AI gateway error", detail: errText }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiRes.json();
    const argsStr = aiJson?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!argsStr) {
      console.error("No tool call", JSON.stringify(aiJson).slice(0, 500));
      return new Response(JSON.stringify({ stop: true, reason: "AI non ha risposto", next_actions: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const parsed = JSON.parse(argsStr);
    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("agentic-decide error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Errore" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
