import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { escapeLike } from "../_shared/sqlEscape.ts";
import { PLATFORM_TOOLS, executePlatformTool } from "../_shared/platformTools.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const SYSTEM_PROMPT = `Sei l'assistente AI della maschera Contatti. Operi sulla tabella imported_contacts che contiene contatti importati da varie fonti (WCA, fiere, LinkedIn, ecc).

IL TUO RUOLO
Aiuti l'utente a filtrare, ordinare, selezionare e operare sui contatti in modo rapido tramite linguaggio naturale. Rispondi SEMPRE in italiano, breve e operativo.

HAI ACCESSO COMPLETO ALLA PIATTAFORMA
Puoi cercare partner WCA, prospect, inbox email, business cards, creare attività, reminder, generare outreach, gestire memoria persistente, e molto altro. Usa tutti i tool disponibili per dare risposte complete.

COME FUNZIONI
Quando l'utente chiede un'azione, usi i tool a disposizione per interrogare il database e poi restituisci un COMANDO STRUTTURATO che il frontend applicherà. Il comando va SEMPRE appeso alla fine della tua risposta con il delimitatore ---COMMAND---.

STRUTTURA DEI COMANDI
Ogni comando è un JSON con un "type" e parametri specifici:

1. apply_filters — Imposta filtri sulla lista
   { "type": "apply_filters", "filters": { "country": "...", "origin": "...", "leadStatus": "...", "holdingPattern": "out"|"in"|"all", "search": "...", "dateFrom": "...", "dateTo": "...", "importLogId": "..." }, "groupBy": "country"|"origin"|"status"|"date" }

2. set_sort — Cambia ordinamento
   { "type": "set_sort", "sort": "company"|"name"|"city"|"date" }

3. select_contacts — Seleziona contatti per criterio
   { "type": "select_contacts", "contact_ids": ["id1", "id2", ...] }

4. update_status — Aggiorna lead status dei contatti selezionati
   { "type": "update_status", "contact_ids": ["id1", ...], "status": "new"|"contacted"|"in_progress"|"negotiation"|"converted"|"lost" }

5. export_csv — Esporta contatti in un file CSV scaricabile
   { "type": "export_csv", "contact_ids": ["id1", "id2", ...] }

6. send_to_workspace — Invia contatti al Workspace per generare email personalizzate
   { "type": "send_to_workspace", "contact_ids": ["id1", "id2", ...] }

7. multi — Esegui più comandi in sequenza
   { "type": "multi", "commands": [ ... ] }

REGOLE
- Prima di applicare filtri, usa i tool per verificare quanti risultati ci saranno.
- Per selezionare contatti, usa i tool per ottenere gli ID e poi restituisci select_contacts.
- Per update_status, CHIEDI SEMPRE conferma prima di procedere mostrando quanti contatti saranno aggiornati.
- Sii sintetico nelle risposte. Una o due frasi di conferma + il comando.
- Se l'utente chiede qualcosa che non puoi fare con i tool, dillo chiaramente.
- Puoi anche usare tool della piattaforma (partner, attività, outreach, inbox) se la richiesta lo richiede.

CAMPI DELLA TABELLA imported_contacts:
id, company_name, name, email, phone, mobile, country, city, address, zip_code, origin, lead_status, interaction_count, last_interaction_at, deep_search_at, company_alias, contact_alias, position, note, created_at, import_log_id, is_selected, is_transferred, external_id, raw_data, converted_at`;

// ── Module-specific tools (contacts-specific search with more filters) ──
const contactSpecificTools = [
  {
    type: "function",
    function: {
      name: "search_contacts_advanced",
      description: "Advanced search imported_contacts with full filters. Returns matching contacts (max 200). Use for contacts-specific queries.",
      parameters: {
        type: "object",
        properties: {
          company_name: { type: "string", description: "Company name (partial match)" },
          name: { type: "string", description: "Contact name (partial match)" },
          email: { type: "string", description: "Email (partial match)" },
          country: { type: "string", description: "Country name (exact)" },
          city: { type: "string", description: "City name (partial match)" },
          origin: { type: "string", description: "Origin/source (exact)" },
          lead_status: { type: "string", enum: ["new", "contacted", "in_progress", "negotiation", "converted", "lost"] },
          holding_pattern: { type: "string", enum: ["in", "out"], description: "'in' = interaction_count > 0, 'out' = interaction_count = 0" },
          has_email: { type: "boolean" },
          has_phone: { type: "boolean" },
          has_deep_search: { type: "boolean" },
          has_alias: { type: "boolean" },
          date_from: { type: "string", description: "ISO date" },
          date_to: { type: "string", description: "ISO date" },
          import_log_id: { type: "string" },
          limit: { type: "number", description: "Max results, default 50, max 200" },
          ids_only: { type: "boolean", description: "Return only IDs (for selection)" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "count_contacts_advanced",
      description: "Count contacts matching filters. Same filters as search_contacts_advanced but returns only count.",
      parameters: {
        type: "object",
        properties: {
          company_name: { type: "string" }, name: { type: "string" }, country: { type: "string" },
          city: { type: "string" }, origin: { type: "string" },
          lead_status: { type: "string", enum: ["new", "contacted", "in_progress", "negotiation", "converted", "lost"] },
          holding_pattern: { type: "string", enum: ["in", "out"] },
          has_email: { type: "boolean" }, has_phone: { type: "boolean" },
          has_deep_search: { type: "boolean" }, has_alias: { type: "boolean" },
          date_from: { type: "string" }, date_to: { type: "string" }, import_log_id: { type: "string" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_contact_stats",
      description: "Get aggregated statistics: counts by country, origin, status, email/phone coverage.",
      parameters: {
        type: "object",
        properties: {
          group_by: { type: "string", enum: ["country", "origin", "status"], description: "Grouping dimension" },
          limit: { type: "number", description: "Top N groups (default 20)" },
        },
        additionalProperties: false,
      },
    },
  },
];

// Merge all tools
const allTools = [...PLATFORM_TOOLS, ...contactSpecificTools];

// ── Module-specific tool execution ──

function buildContactQuery(args: Record<string, unknown>, selectCols: string, opts?: { count?: boolean }) {
  let q = opts?.count
    ? supabase.from("imported_contacts").select(selectCols, { count: "exact", head: true })
    : supabase.from("imported_contacts").select(selectCols);
  q = q.or("company_name.not.is.null,name.not.is.null,email.not.is.null");
  if (args.company_name) q = q.ilike("company_name", `%${escapeLike(args.company_name)}%`);
  if (args.name) q = q.ilike("name", `%${escapeLike(args.name)}%`);
  if (args.email) q = q.ilike("email", `%${escapeLike(args.email)}%`);
  if (args.country) q = q.eq("country", args.country);
  if (args.city) q = q.ilike("city", `%${escapeLike(args.city)}%`);
  if (args.origin) q = q.eq("origin", args.origin);
  if (args.lead_status) q = q.eq("lead_status", args.lead_status);
  if (args.holding_pattern === "out") q = q.eq("interaction_count", 0);
  if (args.holding_pattern === "in") q = q.gt("interaction_count", 0);
  if (args.has_email === true) q = q.not("email", "is", null);
  if (args.has_email === false) q = q.is("email", null);
  if (args.has_phone === true) q = q.or("phone.not.is.null,mobile.not.is.null");
  if (args.has_deep_search === true) q = q.not("deep_search_at", "is", null);
  if (args.has_deep_search === false) q = q.is("deep_search_at", null);
  if (args.has_alias === true) q = q.not("company_alias", "is", null);
  if (args.date_from) q = q.gte("created_at", args.date_from);
  if (args.date_to) q = q.lte("created_at", args.date_to);
  if (args.import_log_id) q = q.eq("import_log_id", args.import_log_id);
  return q;
}

async function executeLocalTool(name: string, args: Record<string, unknown>): Promise<unknown | null> {
  switch (name) {
    case "search_contacts_advanced": {
      const idsOnly = !!args.ids_only;
      const cols = idsOnly ? "id" : "id, company_name, name, email, phone, mobile, country, city, origin, lead_status, interaction_count, position, created_at";
      const limit = Math.min(Number(args.limit) || 50, 200);
      const q = buildContactQuery(args, cols).order("created_at", { ascending: false }).limit(limit);
      const { data, error } = await q;
      if (error) return { error: error.message };
      if (idsOnly) return { count: data?.length, ids: (data || []).map((r: any) => r.id) };
      return { count: data?.length, contacts: (data || []).map((c: any) => ({ id: c.id, company: c.company_name, name: c.name, email: c.email, phone: c.phone || c.mobile, country: c.country, city: c.city, origin: c.origin, status: c.lead_status, interactions: c.interaction_count, position: c.position })) };
    }
    case "count_contacts_advanced": {
      const q = buildContactQuery(args, "id", { count: true });
      const { count, error } = await q;
      if (error) return { error: error.message };
      return { count: count ?? 0 };
    }
    case "get_contact_stats": {
      const { data, error } = await supabase.rpc("get_contact_group_counts");
      if (error) return { error: error.message };
      const groupBy = String(args.group_by || "country");
      const limit = Number(args.limit) || 20;
      const filtered = (data || []).filter((r: any) => r.group_type === groupBy).slice(0, limit).map((r: any) => ({ group: r.group_label, count: r.contact_count, with_email: r.with_email, with_phone: r.with_phone, with_deep_search: r.with_deep_search, with_alias: r.with_alias }));
      return { group_by: groupBy, total_groups: filtered.length, groups: filtered };
    }
    default:
      return null; // Not a local tool
  }
}

// ── Credits ──

async function consumeCredits(userId: string, usage: { prompt_tokens: number; completion_tokens: number }) {
  const inputTokens = usage.prompt_tokens || 0;
  const outputTokens = usage.completion_tokens || 0;
  const totalCredits = Math.max(1, Math.ceil((inputTokens + outputTokens * 3) / 1000));
  await supabase.rpc("deduct_credits", {
    p_user_id: userId,
    p_amount: totalCredits,
    p_operation: "ai_call",
    p_description: `Contacts Assistant: ${inputTokens} in + ${outputTokens} out tokens (${totalCredits} crediti)`,
  });
}

// ── Main handler ──

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    // Check credits
    const { data: credits } = await supabase.from("user_credits").select("balance").eq("user_id", userId).single();
    if (credits && credits.balance <= 0) {
      return new Response(JSON.stringify({ error: "Crediti AI esauriti." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, context } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    let systemPrompt = SYSTEM_PROMPT;
    if (context) {
      systemPrompt += "\n\nCONTESTO CORRENTE:";
      if (context.filters) systemPrompt += `\nFiltri attivi: ${JSON.stringify(context.filters)}`;
      if (context.totalContacts !== undefined) systemPrompt += `\nContatti visibili: ${context.totalContacts}`;
      if (context.selectedCount !== undefined) systemPrompt += `\nContatti selezionati: ${context.selectedCount}`;
      if (context.groupBy) systemPrompt += `\nRaggruppamento: ${context.groupBy}`;
      if (context.sortKey) systemPrompt += `\nOrdinamento: ${context.sortKey}`;
    }

    const allMessages = [{ role: "system", content: systemPrompt }, ...messages];

    let response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-3-flash-preview", messages: allMessages, tools: allTools }),
    });

    if (!response.ok) {
      const status = response.status;
      const text = await response.text();
      console.error("AI gateway error:", status, text);
      const errorMsg = status === 429 ? "Troppe richieste, riprova tra poco." : status === 402 ? "Crediti AI esauriti." : "Errore AI gateway";
      return new Response(JSON.stringify({ error: errorMsg }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let result = await response.json();
    let assistantMessage = result.choices?.[0]?.message;
    let totalUsage = { prompt_tokens: 0, completion_tokens: 0 };
    if (result.usage) { totalUsage.prompt_tokens += result.usage.prompt_tokens || 0; totalUsage.completion_tokens += result.usage.completion_tokens || 0; }

    // Tool calling loop
    let iterations = 0;
    while (assistantMessage?.tool_calls?.length && iterations < 5) {
      iterations++;
      const toolResults = [];
      for (const tc of assistantMessage.tool_calls) {
        console.log(`[contacts-assistant] Tool: ${tc.function.name}`, tc.function.arguments);
        const args = JSON.parse(tc.function.arguments || "{}");
        // Try local tool first, then platform tool
        let toolResult = await executeLocalTool(tc.function.name, args);
        if (toolResult === null) {
          toolResult = await executePlatformTool(tc.function.name, args, userId, authHeader);
        }
        console.log(`[contacts-assistant] Result ${tc.function.name}:`, JSON.stringify(toolResult).substring(0, 500));
        toolResults.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(toolResult) });
      }

      allMessages.push(assistantMessage);
      allMessages.push(...toolResults);

      response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "google/gemini-3-flash-preview", messages: allMessages, tools: allTools }),
      });

      if (!response.ok) {
        console.error("AI error on tool response:", response.status, await response.text());
        return new Response(JSON.stringify({ error: "Errore durante l'elaborazione" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      result = await response.json();
      assistantMessage = result.choices?.[0]?.message;
      if (result.usage) { totalUsage.prompt_tokens += result.usage.prompt_tokens || 0; totalUsage.completion_tokens += result.usage.completion_tokens || 0; }
    }

    const finalContent = assistantMessage?.content || "Nessuna risposta";
    if (userId) await consumeCredits(userId, totalUsage);

    return new Response(JSON.stringify({ content: finalContent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("contacts-assistant error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Errore sconosciuto" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
