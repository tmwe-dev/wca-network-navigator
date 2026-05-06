/**
 * finder-api-chat — Conversational AI for the Finder API page.
 *
 * Read-only conversational agent that translates natural-language queries into
 * TMWE/Findair proxy calls (whitelist of 6 ops) and returns a result + spoken
 * commentary. When ambiguous or failing, it suggests a KB card to be saved in
 * `finder_api_kb`. Approved KB entries are injected as context on the next turn.
 *
 * Auth: requires a valid Supabase JWT (preview-session or app session).
 */
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

interface ChatMsg {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
}

const TMWE_OPS = [
  { op: "profile.me", desc: "Profilo utente TMWE corrente." },
  { op: "tracking.byAwb", desc: "Tracking di una spedizione per AWB. Params: { awb: string }" },
  { op: "shipment.list", desc: "Elenco spedizioni dell'utente. Params filtro opzionali." },
  { op: "shipment.unified", desc: "Dettaglio unificato di una spedizione. Params libero (vedi TMWE)." },
  { op: "rubrica.search", desc: "Cerca contatti/aziende nella rubrica TMWE. Params: { q: string }" },
  { op: "system.health", desc: "Stato del sistema TMWE." },
] as const;

const SYSTEM_PROMPT = `Sei "Finder API", un agente conversazionale-tecnico dedicato all'API TMWE/Findair.

Identità: parli come un collega tecnico che ragiona ad alta voce, è breve, mostra cosa sta facendo.
Obiettivo: tradurre richieste in linguaggio naturale in chiamate alle 6 operazioni TMWE consentite, mostrare il risultato grezzo nel canvas e commentare in modo umano.

Operazioni disponibili (uniche consentite):
${TMWE_OPS.map((o) => `- ${o.op}: ${o.desc}`).join("\n")}

Metodo:
1. Capisci l'intento. Se serve solo una chiamata, scegli l'op giusta e i parametri.
2. Se la richiesta è ambigua o fuori scope, NON inventare: chiedi chiarimento o proponi una KB card.
3. Quando un risultato torna vuoto o errore, proponi sempre una KB card per arricchire la knowledge base ("propose_kb_entry").
4. Niente azioni di scrittura: sei read-only.

Output: usa SEMPRE tool calling. Non scrivere mai JSON nel content.
Tool disponibili:
- call_tmwe(op, params) — chiama un endpoint TMWE.
- propose_kb_entry(title, body, trigger_query, trigger_op?, trigger_error?, tags?) — suggerisci articolo KB.
- final_answer(text, spoken_summary?) — chiudi il turno con risposta umana.

Guardrail: se l'utente chiede qualcosa che non rientra nelle 6 op, spiega cosa puoi fare e proponi una KB card.`;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "call_tmwe",
      description: "Invoca un'operazione TMWE/Findair via proxy whitelistato.",
      parameters: {
        type: "object",
        properties: {
          op: { type: "string", enum: TMWE_OPS.map((o) => o.op) },
          params: { type: "object", description: "Parametri specifici dell'operazione." },
        },
        required: ["op"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_kb_entry",
      description: "Suggerisci un articolo KB per migliorare le risposte future.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          body: { type: "string" },
          trigger_query: { type: "string" },
          trigger_op: { type: "string" },
          trigger_error: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
        },
        required: ["title", "body", "trigger_query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "final_answer",
      description: "Chiudi il turno con un messaggio conversazionale per l'utente.",
      parameters: {
        type: "object",
        properties: {
          text: { type: "string", description: "Messaggio testuale, in italiano, max 4 righe." },
          spoken_summary: { type: "string", description: "Versione vocale brevissima (max 1 frase)." },
        },
        required: ["text"],
        additionalProperties: false,
      },
    },
  },
];

async function callTmweProxy(authHeader: string, op: string, params: Record<string, unknown>) {
  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/tmwe-proxy`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
      apikey: Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    },
    body: JSON.stringify({ op, params }),
  });
  const text = await res.text();
  let data: unknown = null;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  return { ok: res.ok, status: res.status, data };
}

async function loadApprovedKb(supabase: ReturnType<typeof createClient>): Promise<string> {
  const { data, error } = await supabase
    .from("finder_api_kb")
    .select("title, body, tags")
    .eq("status", "approved")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error || !data || data.length === 0) return "";
  const lines = data.map((k) => `• ${k.title}: ${k.body}`).join("\n");
  return `\n\n=== Knowledge Base approvata (Finder API) ===\n${lines}\n=== fine KB ===`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages = [] } = (await req.json()) as { messages: ChatMsg[] };

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const kbContext = await loadApprovedKb(supabase);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemMsg = { role: "system", content: SYSTEM_PROMPT + kbContext };
    const convo: Array<Record<string, unknown>> = [systemMsg, ...messages];

    // Tool-loop, max 5 round-trip
    let toolResults: Array<{ op: string; ok: boolean; data: unknown }> = [];
    let kbProposal: Record<string, unknown> | null = null;
    let finalText = "";
    let spoken = "";

    for (let i = 0; i < 5; i++) {
      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-pro",
          messages: convo,
          tools: TOOLS,
          tool_choice: "auto",
        }),
      });

      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit AI (riprova tra poco)." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiRes.status === 402) {
        return new Response(JSON.stringify({ error: "Crediti AI esauriti." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!aiRes.ok) {
        const errTxt = await aiRes.text();
        return new Response(JSON.stringify({ error: "AI gateway error", detail: errTxt }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const aiJson = await aiRes.json();
      const choice = aiJson.choices?.[0]?.message;
      if (!choice) break;

      const toolCalls = choice.tool_calls ?? [];
      if (toolCalls.length === 0) {
        finalText = choice.content ?? "";
        break;
      }

      // Push assistant turn with tool_calls
      convo.push(choice);

      for (const tc of toolCalls) {
        const fn = tc.function?.name;
        let args: Record<string, unknown> = {};
        try { args = JSON.parse(tc.function?.arguments ?? "{}"); } catch { /* ignore */ }

        if (fn === "call_tmwe") {
          const op = String(args.op ?? "");
          const params = (args.params as Record<string, unknown>) ?? {};
          const allowed = TMWE_OPS.some((o) => o.op === op);
          let result: { ok: boolean; status: number; data: unknown };
          if (!allowed) {
            result = { ok: false, status: 400, data: { error: `Op non consentita: ${op}` } };
          } else {
            result = await callTmweProxy(authHeader, op, params);
          }
          toolResults.push({ op, ok: result.ok, data: result.data });
          convo.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify(result).slice(0, 8000),
          });
        } else if (fn === "propose_kb_entry") {
          kbProposal = args;
          convo.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify({ ok: true, draft: args }),
          });
        } else if (fn === "final_answer") {
          finalText = String(args.text ?? "");
          spoken = String(args.spoken_summary ?? "");
          // synthesize a tool reply so the loop can terminate cleanly
          convo.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify({ ok: true }),
          });
        } else {
          convo.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify({ ok: false, error: `Tool sconosciuto: ${fn}` }),
          });
        }
      }

      if (finalText) break;
    }

    if (!finalText) finalText = "Pronto.";

    return new Response(
      JSON.stringify({
        text: finalText,
        spoken_summary: spoken || finalText.slice(0, 140),
        tool_results: toolResults,
        kb_proposal: kbProposal,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});