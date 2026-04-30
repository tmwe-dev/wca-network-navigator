import "../_shared/llmFetchInterceptor.ts";
/**
 * ai-query-planner — Genera un QueryPlan strutturato da un prompt utente.
 *
 * Input:  { prompt: string, history?: {role,content}[] }
 * Output: { table, columns?, filters[], sort?, limit, title?, rationale? }
 *
 * L'AI riceve lo SCHEMA REALE letto live dal DB (RPC `ai_introspect_schema`,
 * cache 5 min) e una whitelist di tabelle. Nessun esempio rigido, nessuna
 * regola hardcoded. L'AI decide tabella, filtri, valori enum.
 *
 * Guardrail (in codice, non nel prompt):
 *   - Solo tabelle whitelisted (ALLOWED_TABLES)
 *   - Solo SELECT; nessuna mutazione
 *   - Validazione colonne/enum delegata al safe executor client-side
 */
import { getCorsHeaders } from "../_shared/cors.ts";
import { loadLiveSchema } from "../_shared/liveSchemaLoader.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

/**
 * Whitelist tecnica di sicurezza: tabelle business che l'AI può consultare.
 * Non è una "guida" per l'AI — è un guardrail. La SEMANTICA (cosa contiene
 * ogni tabella, dove vivono indirizzi/contatti, ecc.) sta nella KB entry
 * con tag `data_schema`, iniettata nel prompt.
 */
const ALLOWED_TABLES = [
  "partners",
  "partner_networks",
  "network_configs",
  "partner_services",
  "partner_contacts",
  "prospects",
  "prospect_contacts",
  "imported_contacts",
  "outreach_queue",
  "activities",
  "channel_messages",
  "agents",
  "agent_tasks",
  "kb_entries",
  "business_cards",
  "download_jobs",
  "campaign_jobs",
] as const;

/** Cache 5 min per l'indice semantico KB (evita query ripetute). */
let _kbIndexCache: { content: string; ts: number } | null = null;
const KB_CACHE_TTL_MS = 5 * 60 * 1000;

async function loadDataSchemaIndex(): Promise<string> {
  const now = Date.now();
  if (_kbIndexCache && now - _kbIndexCache.ts < KB_CACHE_TTL_MS) {
    return _kbIndexCache.content;
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return "";
  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data } = await sb
      .from("kb_entries")
      .select("content")
      .contains("tags", ["data_schema"])
      .limit(1)
      .maybeSingle();
    const content = (data as { content?: string } | null)?.content ?? "";
    _kbIndexCache = { content, ts: now };
    return content;
  } catch {
    return "";
  }
}

function buildSystemPrompt(liveSchema: string, kbIndex: string): string {
  const tableList = ALLOWED_TABLES.map((t) => `  • ${t}`).join("\n");

  return `Sei un Query Planner per un CRM logistico. Ricevi una richiesta in linguaggio naturale e produci un piano di query SELECT in JSON.

CONTESTO OPERATIVO:
Il CRM gestisce partner logistici WCA e relative appartenenze a network/gruppi operativi. Quando l'utente parla di gruppi come "Time Critical", "Pharma", "Projects", "Relocations", "Dangerous Goods" o simili, cerca prioritariamente nella tabella delle appartenenze network, non nella Knowledge Base.

TABELLE CONSULTABILI (whitelist di sicurezza — usa SOLO queste):
${tableList}

INDICE SEMANTICO (cosa contiene ogni tabella, dove vivono indirizzi/contatti/biglietti):
${kbIndex || "(indice non disponibile — usa nome tabella + schema reale per inferire)"}

SCHEMA REALE (live dal DB — fidati di questo, NON di nomi che ricordi):
${liveSchema || "(schema non disponibile, usa solo i nomi tabella sopra)"}

FORMATO OUTPUT (JSON puro, niente markdown):
{
  "plans": [
    {
      "table": "<nome_tabella>",
      "columns": ["col1","col2"],                         // opzionale
      "filters": [{"column":"<nome>","op":"<op>","value":<v>}],
      "sort": {"column":"<nome>","ascending":false},      // opzionale
      "limit": 50,
      "title": "<titolo breve>",
      "rationale": "<1 frase: perché questa tabella, perché questi filtri>"
    }
  ]
}

MULTI-ENTITÀ:
- Se la richiesta menziona più entità DISTINTE che vivono in tabelle diverse
  (es. "quanti partner E contatti", "address e biglietti", "attività e outreach"),
  produci UN piano per OGNI entità (max 4 piani, in ordine in cui compaiono).
- Se la richiesta è su una sola entità, produci 1 solo piano nell'array.
- NON duplicare piani sulla stessa tabella con filtri identici.

OPERATORI AMMESSI: eq, neq, gt, gte, lt, lte, ilike, in, is.
- "ilike" wrappa automaticamente con % ed è accent-insensitive.
- "in" richiede un array di valori.
- "is" con value=null per IS NULL.

VINCOLI HARD:
- Solo SELECT. Mai INSERT/UPDATE/DELETE.
- Solo tabelle dell'elenco sopra.
- Per colonne enum, usa SOLO i valori elencati nello schema (sotto la colonna in [pipe|separated]).
- limit max 200, default 50.

LIBERTÀ:
- Decidi tu la tabella più probabile. Se la richiesta è ambigua spiega in "rationale".
- Per network/gruppi WCA usa \`partner_networks.network_name\` come fonte primaria. Se serve contare partner in un gruppo, pianifica su \`partner_networks\` filtrando \`network_name\`.
- Se interpreti termini (es. "attive" → quali enum?), guarda i valori reali della colonna nello schema sopra e scegli quelli che semanticamente corrispondono.
- Se la richiesta non è una query (è un'azione, una domanda generica, una richiesta di scrittura), rispondi: {"plans":[{"table":"INVALID","filters":[],"limit":1,"title":"Non è una query","rationale":"<motivo>"}]}.
- Se ricevi CONTESTO TURNO PRECEDENTE (vedi sotto) e il prompt è ellittico ("e a Milano?", "solo gli attivi"), eredita tabella e filtri compatibili, sovrascrivi solo ciò che cambia.
- Per ricerche testuali (nomi azienda, persona, città) usa ilike. Per nomi paese usa il codice ISO-2 se la colonna si chiama country_code, altrimenti il nome libero.
- Per "ultimi N" usa sort desc + limit N. Per "quanti/totale" usa columns:["id"] + limit:1 (il count viene dal DB).
- Zero risultati è un risultato valido, NON un errore.`;
}

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY non configurata" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json().catch(() => ({}));
    const prompt = typeof body?.prompt === "string" ? body.prompt : "";
    const history = Array.isArray(body?.history) ? body.history : [];
    const contextHint = typeof body?.contextHint === "string" ? body.contextHint : "";

    if (!prompt) {
      return new Response(JSON.stringify({ error: "prompt richiesto" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Carica schema reale dal DB (cache 5min)
    const [{ rendered: liveSchema }, kbIndex] = await Promise.all([
      loadLiveSchema(ALLOWED_TABLES),
      loadDataSchemaIndex(),
    ]);
    const baseSystem = buildSystemPrompt(liveSchema, kbIndex);
    const systemWithContext = baseSystem + (contextHint ? `\n\nCONTESTO TURNO PRECEDENTE:\n${contextHint}` : "");

    const messages = [
      { role: "system", content: systemWithContext },
      ...history.slice(-6).map((m: { role: string; content: string }) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.content,
      })),
      { role: "user", content: prompt },
    ];

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        response_format: { type: "json_object" },
      }),
    });

    if (!aiResp.ok) {
      const txt = await aiResp.text();
      return new Response(
        JSON.stringify({ error: `AI gateway error: ${aiResp.status}`, detail: txt.slice(0, 500) }),
        { status: aiResp.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const aiJson = await aiResp.json();
    const content: string = aiJson?.choices?.[0]?.message?.content ?? "";

    let parsed: Record<string, unknown> | null;
    try {
      parsed = JSON.parse(content);
    } catch {
      const m = content.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : null;
    }

    if (!parsed || typeof parsed !== "object") {
      return new Response(
        JSON.stringify({ error: "Planner non ha prodotto JSON valido", raw: content.slice(0, 500) }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Normalizza in array di piani. Accetta sia il nuovo formato {plans:[...]}
    // sia il vecchio formato singolo (retro-compat verso modelli che ignorano
    // la nuova istruzione).
    let plans: Record<string, unknown>[];
    if (Array.isArray((parsed as { plans?: unknown }).plans)) {
      plans = ((parsed as { plans: unknown[] }).plans as Record<string, unknown>[]).slice(0, 4);
    } else if (typeof (parsed as { table?: unknown }).table === "string") {
      plans = [parsed];
    } else {
      return new Response(
        JSON.stringify({ error: "Planner output senza 'plans' né 'table'", raw: content.slice(0, 500) }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Bonus optimization: COUNT vs LIST detection from user prompt ──
    // LIST intent wins over COUNT when both could match ("dammi l'elenco di
    // quanti partner..." → user wants the list, not just a number).
    const isListIntent = /\b(elenco|elenc|lista|liste|mostra|mostrami|dammi|vedi|visualizza|fammi vedere|fai vedere)\b/i.test(prompt);
    const isCountIntent = !isListIntent && /\b(quanti|quante|totale|numero di|conteggio|count)\b/i.test(prompt);
    for (const plan of plans) {
      if (isCountIntent && plan.table && plan.table !== "INVALID") {
        plan.columns = ["id"];
        delete plan.sort;
        plan.limit = 1;
      } else if (isListIntent && plan.table && plan.table !== "INVALID") {
        if (Array.isArray(plan.columns) && plan.columns.length === 1 && plan.columns[0] === "id") {
          delete plan.columns;
        }
        if (typeof plan.limit !== "number" || plan.limit < 20) {
          plan.limit = 200;
        }
      }
    }

    return new Response(JSON.stringify({ plans }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
