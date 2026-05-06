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
import { getCorsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

interface ChatMsg {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
}

const FALLBACK_OPS = [
  { op: "profile.me", desc: "Profilo utente TMWE corrente." },
  { op: "tracking.byAwb", desc: "Tracking spedizione per AWB. Params: { awb: string }" },
  { op: "shipment.list", desc: "Elenco spedizioni dell'utente." },
  { op: "shipment.unified", desc: "Dettaglio unificato spedizione." },
  { op: "rubrica.search", desc: "Cerca contatti rubrica. Params: { q: string }" },
  { op: "system.health", desc: "Stato sistema TMWE." },
];

const BASE_PROMPT = `Sei "Finder API", agente conversazionale-tecnico per l'API TMWE/Findair.

## Identità
Collega tecnico interno, breve, decisionale. Non ti scusi e non chiedi all'utente cose che il sistema può scoprire da solo.

## Cosa puoi fare (capabilities)
Hai accesso a 245+ op TMWE attive (read, write, admin GET/POST/PUT/PATCH). Coprono:
- **Profilo & sistema**: profile.me, system.health, rubrica.search
- **Spedizioni**: shipment.list, shipment.unified, shipment.get_express, shipment.get_cargo, shipment.crm, shipment_management.ext_my_shipments, shipment_ops.api_shipment_export
- **Tracking** (PIÙ DI UNO — se uno fallisce PROVA GLI ALTRI):
  • tracking.byAwb (POST, alias shipment_tracking)
  • tracking.ext_tracking (GET)
  • tracking.shipment_tracking (GET)
  • tracking.ext_tracking_list (GET, batch)
  • courier.tracking_aggregator (POST, multi-corriere)
- **Etichette**: shipment.print_label, labels.get_label_courier_shipment, labels.shipment_label_generator
- **Pricing & quote**: rating_booking.api_rate_shipment, courier.api_pricing_services, shipment.add_express_quote_request
- **Cargo**: cargo.api_cargo_shipments, cargo.api_cargo_shipment_create
- **Rubrica & CRM**: rubrica.*, shipment.crm
- **Fatturazione, dogana, documenti, bulk import** ecc.

Hai inoltre il MANIFEST della SCHEMA MAP (op → n.campi → ruoli) iniettato sotto. Per il dettaglio campo-per-campo usa il tool 'schema_lookup(op)'.

## Strategia operativa
1. **Non chiedere all'utente cose che puoi scoprire**. Se l'utente dà solo un AWB/numero spedizione, NON chiedere "che corriere?": prova prima 'courier.tracking_aggregator' o 'tracking.byAwb' che già ricavano il corriere dal numero. Solo se TUTTI i tentativi falliscono chiedi info aggiuntive.
2. **Fallback chain per il tracking**: se 'tracking.byAwb' restituisce 400/vuoto, è perché vuole l'ID interno della spedizione, NON l'AWB pubblico. Procedura corretta:
   a) chiama 'shipment.list' (o 'shipment_management.ext_my_shipments') filtrando per quel numero (params tipici: { awb }, { tracking_code }, { search }, { code }, { rif_cliente });
   b) dalla risposta estrai 'id' (role=id_interno) della spedizione;
   c) chiama 'tracking.byAwb' con { shipment_id: <id>, id: <id> } (prova entrambe le chiavi);
   d) in parallelo/dopo, prova 'tracking.ext_tracking' (GET, query { awb } o { tracking_code }) e 'courier.tracking_aggregator' (POST { awb }) per arricchire eventi/corriere;
   e) solo se TUTTE queste vie tornano vuote dichiari "nessuna spedizione tua con AWB X". Mai arrenderti al primo 400/404.
3. **Workflow standard**: se non sai i campi → schema_lookup(op) → call_tmwe(op, params) → leggi schema_hint nella risposta → final_answer formattato.
4. **Multi-call**: puoi (e spesso devi) fare più call_tmwe in sequenza nello stesso turno. Esempio canonico AWB: shipment.list({awb}) → estrai id → tracking.byAwb({shipment_id:id}) → eventi. NON chiedere mai il corriere all'utente se hai un AWB.
5. **Read first**: privilegia GET/POST read. Per write/admin (create/update) chiedi conferma all'utente prima.
6. **DELETE disabilitate** lato sicurezza — se servono dillo all'utente di abilitarle dal toggle UI.
7. **Output**: rispondi via 'final_answer'. Quando esponi dati estrai con la mappa i campi role ∈ {id_interno, tracking_code, data, stato, servizio, note, contatto, cliente}. Usa elenchi puntati o tabelle markdown brevi.
8. **propose_kb_entry** SOLO se la mappa è insufficiente o l'API risponde in modo inatteso e ricorrente.

## Lingua
Italiano. Tono diretto, niente "se vuoi posso…": fai la cosa giusta e mostrala.`;

function buildTools(allowedOps: string[]) {
  return [
  {
    type: "function",
    function: {
      name: "call_tmwe",
      description: "Invoca un'operazione TMWE/Findair via proxy. L'op DEVE essere tra quelle elencate nel system prompt.",
      parameters: {
        type: "object",
        properties: {
          op: { type: "string", enum: allowedOps },
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
      name: "schema_lookup",
      description: "Restituisce i campi mappati (field, role, description, example) per una specifica op TMWE. Usalo PRIMA di call_tmwe per sapere quali parametri/risposte aspettarti.",
      parameters: {
        type: "object",
        properties: {
          op: { type: "string", description: "Nome dell'op TMWE (es. 'shipment.list')." },
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
          text: { type: "string", description: "Messaggio testuale, in italiano. Quando esponi una spedizione includi i campi chiave (LDV, OTP, data, stato, servizio, note)." },
          spoken_summary: { type: "string", description: "Versione vocale brevissima (max 1 frase)." },
        },
        required: ["text"],
        additionalProperties: false,
      },
    },
  },
  ];
}

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

async function loadEnabledOps(supabase: ReturnType<typeof createClient>): Promise<Array<{ op: string; desc: string; risk: string; method: string }>> {
  const { data, error } = await supabase
    .from("tmwe_api_catalog")
    .select("op, description, risk_level, method, api_group")
    .eq("enabled", true)
    .order("api_group", { ascending: true })
    .order("op", { ascending: true })
    .limit(500);
  if (error || !data || data.length === 0) {
    return FALLBACK_OPS.map((o) => ({ op: o.op, desc: o.desc, risk: "read", method: "GET" }));
  }
  return (data as Array<{ op: string; description: string | null; risk_level: string; method: string }>).map((r) => ({
    op: r.op,
    desc: r.description ?? "",
    risk: r.risk_level,
    method: r.method,
  }));
}

type SchemaRow = { op: string; field: string; role: string; description: string | null; example: string | null };

async function loadSchemaMapFull(supabase: ReturnType<typeof createClient>): Promise<Map<string, SchemaRow[]>> {
  const { data, error } = await supabase
    .from("finder_api_schema_map")
    .select("op, field, role, description, example")
    .order("op", { ascending: true });
  const map = new Map<string, SchemaRow[]>();
  if (error || !data) return map;
  for (const r of data as SchemaRow[]) {
    const arr = map.get(r.op) ?? [];
    arr.push(r);
    map.set(r.op, arr);
  }
  return map;
}

function buildSchemaManifest(map: Map<string, SchemaRow[]>): string {
  if (map.size === 0) return "";
  const lines: string[] = [];
  for (const [op, fields] of map) {
    const roleCounts: Record<string, number> = {};
    for (const f of fields) roleCounts[f.role] = (roleCounts[f.role] ?? 0) + 1;
    const roles = Object.entries(roleCounts).map(([r, n]) => `${r}×${n}`).join(", ");
    lines.push(`- ${op}: ${fields.length} campi [${roles}]`);
  }
  return `\n\n=== SCHEMA MAP TMWE — Manifest (${map.size} op, ${[...map.values()].reduce((s, a) => s + a.length, 0)} campi) ===\n` +
    `Per i campi dettagliati di un'op usa il tool 'schema_lookup(op)'.\n` +
    lines.join("\n") +
    `\n=== fine manifest ===`;
}

function lookupSchema(map: Map<string, SchemaRow[]>, op: string): { op: string; fields: SchemaRow[] } | { op: string; error: string } {
  const fields = map.get(op);
  if (!fields || fields.length === 0) return { op, error: `Nessun campo mappato per '${op}'. Chiama l'op e usa 'discover' dalla UI per popolarla.` };
  return { op, fields };
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));
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

    const [kbContext, schemaMap, enabledOps] = await Promise.all([
      loadApprovedKb(supabase),
      loadSchemaMapFull(supabase),
      loadEnabledOps(supabase),
    ]);
    const schemaContext = buildSchemaManifest(schemaMap);

    // Costruisci elenco operazioni per il system prompt (max 120 per non saturare i token)
    const opsForPrompt = enabledOps.slice(0, 120);
    const opsList = opsForPrompt
      .map((o) => `- ${o.op} [${o.method} · ${o.risk}]${o.desc ? `: ${o.desc.slice(0, 120)}` : ""}`)
      .join("\n");
    const opsBlock = `\n\nOperazioni TMWE disponibili (solo queste sono chiamabili):\n${opsList}\n${enabledOps.length > opsForPrompt.length ? `(+ altre ${enabledOps.length - opsForPrompt.length} disponibili: filtra per gruppo se serve)` : ""}`;
    const allowedOpNames = enabledOps.map((o) => o.op);
    const TOOLS = buildTools(allowedOpNames);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemMsg = { role: "system", content: BASE_PROMPT + opsBlock + schemaContext + kbContext };
    const convo: Array<Record<string, unknown>> = [systemMsg, ...messages];

    // Tool-loop, max 5 round-trip
    let toolResults: Array<{ op: string; ok: boolean; data: unknown }> = [];
    let kbProposal: Record<string, unknown> | null = null;
    let finalText = "";
    let spoken = "";

    for (let i = 0; i < 8; i++) {
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
          const allowed = allowedOpNames.includes(op);
          let result: { ok: boolean; status: number; data: unknown };
          if (!allowed) {
            result = { ok: false, status: 400, data: { error: `Op non consentita: ${op}` } };
          } else {
            result = await callTmweProxy(authHeader, op, params);
          }
          toolResults.push({ op, ok: result.ok, data: result.data });
          // Post-call hint: se la mappa contiene quest'op, allega i campi come riferimento.
          const mapped = schemaMap.get(op);
          const hint = mapped && mapped.length > 0
            ? { schema_hint: mapped.map((f) => ({ field: f.field, role: f.role, description: f.description })) }
            : {};
          convo.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify({ ...result, ...hint }).slice(0, 8000),
          });
        } else if (fn === "schema_lookup") {
          const op = String(args.op ?? "");
          const res = lookupSchema(schemaMap, op);
          convo.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify(res),
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