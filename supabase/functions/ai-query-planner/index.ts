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
import { aiChat, AiGatewayError } from "../_shared/aiGateway.ts";
import { requireInternalOrUser } from "../_shared/internalAuth.ts";
import { edgeErrorWithStatus } from "../_shared/handleEdgeError.ts";



/**
 * Lista tabelle business consultabili dall'AI. Unica fonte di verità: questa
 * costante. Per aggiungerne una nuova: aggiungi qui + verifica che esista nel DB.
 * Lo schema (colonne, enum) viene caricato live tramite RPC.
 */
const ALLOWED_TABLES = [
  "partners",
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

/** Hint di scopo per ciascuna tabella — una riga, non binari. L'AI sceglie. */
const TABLE_PURPOSE: Record<string, string> = {
  partners: "Partner della rete WCA (logistica/spedizionieri internazionali, ~25k record).",
  imported_contacts: "Contatti CRM importati (clienti, lead, prospect).",
  outreach_queue: "Coda messaggi outbound (email/whatsapp/linkedin).",
  activities: "Attività CRM (chiamate, follow-up, meeting, reminder).",
  channel_messages: "Messaggi sincronizzati inbound+outbound multicanale.",
  agents: "Agenti AI configurati nel sistema.",
  agent_tasks: "Task assegnati agli agenti AI.",
  kb_entries: "Knowledge Base interna (doctrine, manuali).",
  business_cards: "Biglietti da visita digitalizzati via OCR.",
  download_jobs: "Job di sincronizzazione massiva da fonti esterne.",
  campaign_jobs: "Job di campagne outbound assegnati a operatori.",
};

function buildSystemPrompt(liveSchema: string): string {
  const tableList = ALLOWED_TABLES.map((t) => `  • ${t} — ${TABLE_PURPOSE[t] ?? ""}`).join("\n");

  return `Sei un Query Planner per un CRM logistico. Ricevi una richiesta in linguaggio naturale e produci un piano di query SELECT in JSON.

TABELLE CONSULTABILI:
${tableList}

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
- Se interpreti termini (es. "attive" → quali enum?), guarda i valori reali della colonna nello schema sopra e scegli quelli che semanticamente corrispondono.
- Se la richiesta non è una query (è un'azione, una domanda generica, una richiesta di scrittura), rispondi: {"plans":[{"table":"INVALID","filters":[],"limit":1,"title":"Non è una query","rationale":"<motivo>"}]}.
- CONVERSAZIONE: hai la cronologia COMPLETA dei turni precedenti (messaggi user/assistant). Usala come fonte primaria per capire il contesto. Se il prompt è ellittico ("e a Milano?", "e in USA?", "solo gli attivi", "Spagna"), DEDUCI dall'ultima query dell'utente la tabella e i filtri, e sostituisci solo ciò che cambia (di norma il paese/città). Esempio: turno 1 "quanti partner?" → turno 2 "e in Italia?" significa "quanti partner in Italia" → table=partners, filtro country_code=IT.
- SMALLTALK / CONVERSAZIONE LIBERA: se il prompt è un saluto, un ringraziamento, una chiacchiera o una domanda conversazionale che NON richiede dati dal DB, rispondi: {"plans":[{"table":"SMALLTALK","filters":[],"limit":1,"title":"Conversazione","rationale":"<la tua risposta conversazionale in italiano, calorosa e breve>"}]}. Il campo "rationale" verrà letto all'utente: scrivilo come risposta diretta, non come spiegazione.
- Per ricerche testuali (nomi azienda, persona, città) usa ilike. Per nomi paese usa il codice ISO-2 se la colonna si chiama country_code, altrimenti il nome libero.
- PROFILI WCA (testo libero): la colonna \`partners.profile_description\` contiene la descrizione completa del profilo WCA (servizi offerti, rotte, corridoi, paesi serviti, specializzazioni, certificazioni). Se la richiesta riguarda COSA FA o CON CHI/DOVE LAVORA un partner ("chi lavora con Gibuti", "chi fa pharma", "chi copre la rotta Cina-Italia", "verifica nei profili"), NON filtrare su country_code: usa \`{"column":"profile_description","op":"ilike","value":"<termine>"}\` e includi \`profile_description\` tra le columns.
  Se il termine è un paese, usa il NOME del paese in inglese (es. "Djibouti", "Ivory Coast") perché i profili sono in inglese; se utile, produci un secondo piano con la variante italiana o con country_code.
  \`country_code\` indica solo DOVE HA SEDE il partner, non i paesi con cui lavora.
- DOMANDE DI CAPACITÀ ("puoi leggere i profili?", "sai analizzare il db?"): rispondi con SMALLTALK spiegando brevemente cosa puoi cercare, NON con INVALID.
- Per "ultimi N" usa sort desc + limit N. Per "quanti/totale" usa columns:["id"] + limit:1 (il count viene dal DB).
- Zero risultati è un risultato valido, NON un errore.`;
}

function plannerFallbackResponse(
  corsHeaders: Record<string, string>,
  rationale: string,
  kind = "ai_unavailable",
): Response {
  return new Response(
    JSON.stringify({
      plans: [
        {
          table: "INVALID",
          filters: [],
          limit: 1,
          title: "AI Query non disponibile",
          rationale,
        },
      ],
      fallback: true,
      kind,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

function openAiLimitMessage(error: AiGatewayError): string {
  const detail = (error.detail ?? "").toLowerCase();
  if (detail.includes("insufficient_quota")) {
    return "OpenAI ha rifiutato la richiesta per credito/quota non disponibile. Non è un errore dei dati: aggiorna credito o chiave OpenAI e riprova.";
  }
  if (detail.includes("tokens per min") || detail.includes("tpm") || detail.includes("rate_limit_exceeded")) {
    return "OpenAI ha rifiutato la richiesta per limite temporaneo di token al minuto. Ho evitato retry aggiuntivi per non peggiorare il blocco: attendi qualche secondo e riprova.";
  }
  return "OpenAI ha rifiutato la richiesta per limite temporaneo (429). Non è un errore della ricerca o del database: attendi qualche secondo e riprova.";
}

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") {
    // Auth condiviso: JWT utente oppure chiamata interna server-to-server.
    const auth = await requireInternalOrUser(req, null, corsHeaders);
    if (auth.kind === "error") return auth.response;
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const prompt = typeof body?.prompt === "string" ? body.prompt : "";
    const history = Array.isArray(body?.history) ? body.history : [];
    const contextHint = typeof body?.contextHint === "string" ? body.contextHint : "";

    if (!prompt) {
      return edgeErrorWithStatus("VALIDATION_ERROR", "prompt richiesto", 400, { ...corsHeaders, "Content-Type": "application/json" });
    }

    // Carica schema reale dal DB (cache 5min)
    const { rendered: liveSchema } = await loadLiveSchema(ALLOWED_TABLES);
    const baseSystem = buildSystemPrompt(liveSchema);
    const systemWithContext = baseSystem + (contextHint ? `\n\nCONTESTO TURNO PRECEDENTE:\n${contextHint}` : "");

    const messages = [
      { role: "system", content: systemWithContext },
      ...history.slice(-6).map((m: { role: string; content: string }) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.content,
      })),
      { role: "user", content: prompt },
    ];

    let content = "";
    try {
      const r = await aiChat({
        models: ["google/gemini-2.5-flash"],
        messages: messages as { role: "system" | "user" | "assistant"; content: string }[],
        context: "ai-query-planner",
        functionName: "ai-query-planner",
        // Scope DEVE combaciare con la riga in ai_routing_config (provider openai,
        // model gpt-4o). Un nome diverso bypassa il routing e ricade su un
        // provider di fallback potenzialmente sotto rate-limit.
        scope: "ai_query_planner",
        temperature: 0.1,
        max_tokens: 900,
        maxRetries: 0,
      });
      content = r.content ?? "";
    } catch (e) {
      if (e instanceof AiGatewayError) {
        const userMsg =
          e.kind === "credits_exhausted"
            ? "Crediti AI esauriti."
            : e.kind === "rate_limited"
              ? openAiLimitMessage(e)
              : e.kind === "unauthorized"
                ? "Chiave AI non valida o scaduta."
                : `Errore AI: ${e.kind}`;
        return plannerFallbackResponse(corsHeaders, userMsg, e.kind);
      }
      throw e;
    }

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
    const isListIntent =
      /\b(elenco|elenc|lista|liste|mostra|mostrami|dammi|vedi|visualizza|fammi vedere|fai vedere)\b/i.test(prompt);
    const isCountIntent = !isListIntent && /\b(quanti|quante|totale|numero di|conteggio|count)\b/i.test(prompt);
    const isRealTable = (t: unknown) => typeof t === "string" && t !== "INVALID" && t !== "SMALLTALK";
    for (const plan of plans) {
      if (isCountIntent && isRealTable(plan.table)) {
        plan.columns = ["id"];
        delete plan.sort;
        plan.limit = 1;
      } else if (isListIntent && isRealTable(plan.table)) {
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
    return plannerFallbackResponse(
      corsHeaders,
      e instanceof Error ? e.message : "Planner temporaneamente non disponibile.",
      "planner_failed",
    );
  }
});
