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

const SYSTEM_PROMPT = `Sei l'assistente AI dedicato al modulo Import della piattaforma CRM per spedizionieri internazionali. Il tuo compito è aiutare l'utente a comprendere lo stato delle importazioni, analizzare problemi, e OPERARE DIRETTAMENTE sul sistema per conto dell'utente.

CHI SEI
Sei un operatore esperto che può sia informare che agire. Quando l'utente chiede di fare qualcosa, NON limitarti a suggerire — ESEGUILO usando i tuoi tool. Sei autorizzato a trasferire contatti, creare attività, correggere errori, e gestire le importazioni.

HAI ACCESSO COMPLETO ALLA PIATTAFORMA
Oltre ai tool specifici per le importazioni, hai accesso a TUTTI i tool della piattaforma: puoi cercare partner WCA per il matching, creare attività e outreach, gestire memoria, consultare inbox, holding pattern, e molto altro.

DATI CHE GESTISCI
La tabella "import_logs" contiene lo storico di ogni importazione: file_name, total_rows, imported_rows, error_rows, status (pending/processing/completed/failed), normalization_method (ai/standard), created_at, completed_at.
La tabella "imported_contacts" contiene i contatti nello staging di ogni import.
La tabella "import_errors" contiene gli errori di importazione.
La tabella "partners" è la destinazione finale.

COSA PUOI FARE
1. CONSULTARE: Interroga import_logs, imported_contacts, import_errors
2. TRASFERIRE: Trasferisci contatti dalla staging a partners
3. CREARE ATTIVITÀ: Crea attività email o chiamata
4. ANALIZZARE ERRORI: Consulta gli errori e spiega cosa è andato storto
5. ELIMINARE: Elimina import log e tutti i dati associati
6. SELEZIONARE: Seleziona/deseleziona contatti in batch
7. STATISTICHE: Conta, raggruppa, analizza
8. CERCARE PARTNER WCA: Per matching e arricchimento
9. GENERARE OUTREACH: Crea email e messaggi per i contatti importati
10. GESTIRE MEMORIA: Salva note e informazioni persistenti

REGOLE
- Rispondi sempre in italiano
- Quando esegui un'azione, conferma cosa hai fatto con numeri precisi
- Se un'operazione potrebbe essere distruttiva, chiedi conferma PRIMA
- Usa markdown per formattare: tabelle per liste, grassetto per numeri importanti`;

// ── Import-specific tools ──
const importTools = [
  { type: "function", function: { name: "list_imports", description: "Lista gli import recenti con statistiche.", parameters: { type: "object", properties: { limit: { type: "number" }, status: { type: "string", enum: ["pending", "processing", "completed", "failed"] } }, additionalProperties: false } } },
  { type: "function", function: { name: "get_import_detail", description: "Dettaglio completo di un import specifico.", parameters: { type: "object", properties: { import_log_id: { type: "string" } }, required: ["import_log_id"], additionalProperties: false } } },
  { type: "function", function: { name: "search_imported_contacts", description: "Cerca tra i contatti importati nello staging.", parameters: { type: "object", properties: { import_log_id: { type: "string" }, is_transferred: { type: "boolean" }, has_email: { type: "boolean" }, has_phone: { type: "boolean" }, company_name: { type: "string" }, country: { type: "string" }, limit: { type: "number" }, count_only: { type: "boolean" } }, additionalProperties: false } } },
  { type: "function", function: { name: "list_import_errors", description: "Lista gli errori di un import specifico.", parameters: { type: "object", properties: { import_log_id: { type: "string" }, status: { type: "string", enum: ["pending", "corrected", "dismissed"] }, limit: { type: "number" } }, required: ["import_log_id"], additionalProperties: false } } },
  { type: "function", function: { name: "transfer_contacts", description: "Trasferisci contatti dallo staging alla tabella partners.", parameters: { type: "object", properties: { import_log_id: { type: "string" }, only_selected: { type: "boolean" }, filter_country: { type: "string" }, filter_has_email: { type: "boolean" } }, required: ["import_log_id"], additionalProperties: false } } },
  { type: "function", function: { name: "create_activities_from_import", description: "Crea attività per i contatti di un import.", parameters: { type: "object", properties: { import_log_id: { type: "string" }, activity_type: { type: "string", enum: ["send_email", "phone_call"] }, only_selected: { type: "boolean" }, filter_has_email: { type: "boolean" } }, required: ["import_log_id", "activity_type"], additionalProperties: false } } },
  { type: "function", function: { name: "select_contacts_import", description: "Seleziona o deseleziona contatti in batch per un import.", parameters: { type: "object", properties: { import_log_id: { type: "string" }, select: { type: "boolean" }, filter_has_email: { type: "boolean" }, filter_country: { type: "string" }, filter_company_name: { type: "string" } }, required: ["import_log_id", "select"], additionalProperties: false } } },
  { type: "function", function: { name: "delete_import", description: "Elimina un import log e TUTTI i dati associati. IRREVERSIBILE.", parameters: { type: "object", properties: { import_log_id: { type: "string" } }, required: ["import_log_id"], additionalProperties: false } } },
  { type: "function", function: { name: "get_import_stats", description: "Statistiche aggregate sugli import.", parameters: { type: "object", properties: { import_log_id: { type: "string" } }, additionalProperties: false } } },
];

// Merge all tools
const allTools = [...PLATFORM_TOOLS, ...importTools];

// ── Import-specific tool handlers ──

function resolveCountryCode(input: string): string {
  const map: Record<string, string> = {
    italia: "IT", italy: "IT", germany: "DE", germania: "DE", france: "FR", francia: "FR",
    spain: "ES", spagna: "ES", "united states": "US", usa: "US", "united kingdom": "GB", uk: "GB",
    china: "CN", cina: "CN", japan: "JP", giappone: "JP", brazil: "BR", brasile: "BR",
    india: "IN", australia: "AU", canada: "CA", mexico: "MX", messico: "MX",
  };
  const normalized = input.toLowerCase().trim();
  if (/^[A-Z]{2}$/i.test(normalized)) return normalized.toUpperCase();
  return map[normalized] || input.toUpperCase().slice(0, 2);
}

async function executeImportTool(name: string, args: any): Promise<unknown | null> {
  switch (name) {
    case "list_imports": {
      let query = supabase.from("import_logs").select("*").order("created_at", { ascending: false }).limit(args.limit || 10);
      if (args.status) query = query.eq("status", args.status);
      const { data, error } = await query;
      if (error) return { error: error.message };
      return { imports: data, total: data?.length || 0 };
    }
    case "get_import_detail": {
      const [logRes, contactsRes, errorsRes] = await Promise.all([
        supabase.from("import_logs").select("*").eq("id", args.import_log_id).single(),
        supabase.from("imported_contacts").select("id", { count: "exact" }).eq("import_log_id", args.import_log_id).limit(0),
        supabase.from("import_errors").select("id", { count: "exact" }).eq("import_log_id", args.import_log_id).limit(0),
      ]);
      if (logRes.error) return { error: logRes.error.message };
      const [transferredRes, selectedRes, withEmailRes, withPhoneRes] = await Promise.all([
        supabase.from("imported_contacts").select("id", { count: "exact" }).eq("import_log_id", args.import_log_id).eq("is_transferred", true).limit(0),
        supabase.from("imported_contacts").select("id", { count: "exact" }).eq("import_log_id", args.import_log_id).eq("is_selected", true).limit(0),
        supabase.from("imported_contacts").select("id", { count: "exact" }).eq("import_log_id", args.import_log_id).not("email", "is", null).limit(0),
        supabase.from("imported_contacts").select("id", { count: "exact" }).eq("import_log_id", args.import_log_id).not("phone", "is", null).limit(0),
      ]);
      return { log: logRes.data, contacts_total: contactsRes.count || 0, contacts_transferred: transferredRes.count || 0, contacts_selected: selectedRes.count || 0, contacts_with_email: withEmailRes.count || 0, contacts_with_phone: withPhoneRes.count || 0, errors_total: errorsRes.count || 0 };
    }
    case "search_imported_contacts": {
      let query = supabase.from("imported_contacts").select("id, company_name, name, email, phone, mobile, country, city, is_selected, is_transferred, company_alias, contact_alias", args.count_only ? { count: "exact" } : undefined);
      if (args.import_log_id) query = query.eq("import_log_id", args.import_log_id);
      if (args.is_transferred !== undefined) query = query.eq("is_transferred", args.is_transferred);
      if (args.has_email === true) query = query.not("email", "is", null);
      if (args.has_email === false) query = query.is("email", null);
      if (args.has_phone === true) query = query.or("phone.not.is.null,mobile.not.is.null");
      if (args.company_name) query = query.ilike("company_name", `%${escapeLike(args.company_name)}%`);
      if (args.country) query = query.ilike("country", `%${escapeLike(args.country)}%`);
      if (args.count_only) {
        query = query.limit(0);
        const { count, error } = await query;
        return error ? { error: error.message } : { count };
      }
      const { data, error } = await query.order("row_number").limit(args.limit || 20);
      return error ? { error: error.message } : { contacts: data, total: data?.length || 0 };
    }
    case "list_import_errors": {
      let query = supabase.from("import_errors").select("*").eq("import_log_id", args.import_log_id).order("row_number").limit(args.limit || 20);
      if (args.status) query = query.eq("status", args.status);
      const { data, error } = await query;
      return error ? { error: error.message } : { errors: data, total: data?.length || 0 };
    }
    case "transfer_contacts": {
      let query = supabase.from("imported_contacts").select("*").eq("import_log_id", args.import_log_id).eq("is_transferred", false);
      if (args.only_selected) query = query.eq("is_selected", true);
      if (args.filter_country) query = query.ilike("country", `%${escapeLike(args.filter_country)}%`);
      if (args.filter_has_email) query = query.not("email", "is", null);
      const { data: contacts, error } = await query;
      if (error) return { error: error.message };
      if (!contacts || contacts.length === 0) return { transferred: 0, message: "Nessun contatto da trasferire." };
      let successCount = 0;
      for (const c of contacts) {
        const countryCode = resolveCountryCode(c.country || "");
        const { data: partner, error: pError } = await supabase.from("partners").insert({ company_name: c.company_name || "Unknown", country_code: countryCode || "XX", country_name: c.country || "Unknown", city: c.city || "Unknown", address: c.address, phone: c.phone, mobile: c.mobile, email: c.email, company_alias: c.company_alias, is_active: true }).select().single();
        if (pError) continue;
        if (c.name) await supabase.from("partner_contacts").insert({ partner_id: partner.id, name: c.name, email: c.email, direct_phone: c.phone, mobile: c.mobile, contact_alias: c.contact_alias, is_primary: true });
        await supabase.from("imported_contacts").update({ is_transferred: true }).eq("id", c.id);
        successCount++;
      }
      return { transferred: successCount, total_candidates: contacts.length, message: `${successCount} contatti trasferiti con successo.` };
    }
    case "create_activities_from_import": {
      let query = supabase.from("imported_contacts").select("*").eq("import_log_id", args.import_log_id).eq("is_transferred", false);
      if (args.only_selected) query = query.eq("is_selected", true);
      if (args.filter_has_email) query = query.not("email", "is", null);
      const { data: contacts, error } = await query;
      if (error) return { error: error.message };
      if (!contacts || contacts.length === 0) return { created: 0, message: "Nessun contatto disponibile." };
      const batchId = `import_ai_${Date.now()}`;
      let count = 0;
      for (const c of contacts) {
        const countryCode = resolveCountryCode(c.country || "");
        const { data: partner, error: pError } = await supabase.from("partners").insert({ company_name: c.company_name || "Unknown", country_code: countryCode || "XX", country_name: c.country || "Unknown", city: c.city || "Unknown", phone: c.phone, email: c.email, company_alias: c.company_alias, is_active: true }).select().single();
        if (pError) continue;
        let contactId: string | null = null;
        if (c.name) { const { data: contact } = await supabase.from("partner_contacts").insert({ partner_id: partner.id, name: c.name, email: c.email, direct_phone: c.phone, mobile: c.mobile, contact_alias: c.contact_alias, is_primary: true }).select().single(); contactId = contact?.id || null; }
        await supabase.from("activities").insert({ partner_id: partner.id, source_type: "partner", source_id: partner.id, activity_type: args.activity_type, title: `${args.activity_type === "send_email" ? "Email" : "Chiamata"} - ${c.company_name}`, status: "pending", priority: "medium", selected_contact_id: contactId, campaign_batch_id: batchId });
        await supabase.from("imported_contacts").update({ is_transferred: true }).eq("id", c.id);
        count++;
      }
      return { created: count, batch_id: batchId, activity_type: args.activity_type, message: `${count} attività create.` };
    }
    case "select_contacts_import": {
      let query = supabase.from("imported_contacts").select("id").eq("import_log_id", args.import_log_id).eq("is_transferred", false);
      if (args.filter_has_email) query = query.not("email", "is", null);
      if (args.filter_country) query = query.ilike("country", `%${escapeLike(args.filter_country)}%`);
      if (args.filter_company_name) query = query.ilike("company_name", `%${escapeLike(args.filter_company_name)}%`);
      const { data, error } = await query;
      if (error) return { error: error.message };
      if (!data || data.length === 0) return { updated: 0, message: "Nessun contatto trovato." };
      const ids = data.map((d: any) => d.id);
      for (let i = 0; i < ids.length; i += 100) {
        const batch = ids.slice(i, i + 100);
        await supabase.from("imported_contacts").update({ is_selected: args.select }).in("id", batch);
      }
      return { updated: ids.length, selected: args.select, message: `${ids.length} contatti ${args.select ? "selezionati" : "deselezionati"}.` };
    }
    case "delete_import": {
      await supabase.from("import_errors").delete().eq("import_log_id", args.import_log_id);
      await supabase.from("imported_contacts").delete().eq("import_log_id", args.import_log_id);
      const { error } = await supabase.from("import_logs").delete().eq("id", args.import_log_id);
      return error ? { error: error.message } : { deleted: true, message: "Import eliminato." };
    }
    case "get_import_stats": {
      if (args.import_log_id) {
        const { data, error } = await supabase.from("imported_contacts").select("country, email, phone, is_transferred, is_selected").eq("import_log_id", args.import_log_id);
        if (error) return { error: error.message };
        const stats: any = { total: data?.length || 0, transferred: 0, selected: 0, with_email: 0, with_phone: 0, by_country: {} };
        for (const c of (data || []) as any[]) {
          if (c.is_transferred) stats.transferred++;
          if (c.is_selected) stats.selected++;
          if (c.email) stats.with_email++;
          if (c.phone) stats.with_phone++;
          const country = c.country || "Sconosciuto";
          stats.by_country[country] = (stats.by_country[country] || 0) + 1;
        }
        return stats;
      }
      const [logsRes, contactsRes, errorsRes, transferredRes] = await Promise.all([
        supabase.from("import_logs").select("id", { count: "exact" }).limit(0),
        supabase.from("imported_contacts").select("id", { count: "exact" }).limit(0),
        supabase.from("import_errors").select("id", { count: "exact" }).limit(0),
        supabase.from("imported_contacts").select("id", { count: "exact" }).eq("is_transferred", true).limit(0),
      ]);
      return { total_imports: logsRes.count || 0, total_contacts_staging: contactsRes.count || 0, total_transferred: transferredRes.count || 0, total_errors: errorsRes.count || 0 };
    }
    default:
      return null; // Not an import tool
  }
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

    const { messages, context } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    let systemPrompt = SYSTEM_PROMPT;
    if (context?.activeLogId) {
      systemPrompt += `\n\nCONTESTO: L'utente sta guardando l'import con ID "${context.activeLogId}" (file: ${context.activeFileName || "sconosciuto"}).`;
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

    // Tool calling loop
    let iterations = 0;
    while (assistantMessage?.tool_calls?.length && iterations < 6) {
      iterations++;
      const toolResults = [];
      for (const tc of assistantMessage.tool_calls) {
        console.log(`[import-assistant] Tool: ${tc.function.name}`, tc.function.arguments);
        const args = JSON.parse(tc.function.arguments || "{}");
        // Try import-specific tool first, then platform tool
        let toolResult = await executeImportTool(tc.function.name, args);
        if (toolResult === null) {
          toolResult = await executePlatformTool(tc.function.name, args, userId, authHeader);
        }
        console.log(`[import-assistant] Result ${tc.function.name}:`, JSON.stringify(toolResult).substring(0, 500));
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
    }

    const finalContent = assistantMessage?.content || "Nessuna risposta";
    const dataModified = iterations > 0;

    // Consume credits
    if (result.usage) {
      const inputTokens = result.usage.prompt_tokens || 0;
      const outputTokens = result.usage.completion_tokens || 0;
      const totalCredits = Math.max(1, Math.ceil((inputTokens + outputTokens * 3) / 1000));
      await supabase.rpc("deduct_credits", { p_user_id: userId, p_amount: totalCredits, p_operation: "ai_call", p_description: `Import Assistant: ${inputTokens} in + ${outputTokens} out tokens (${totalCredits} crediti)` });
    }

    return new Response(JSON.stringify({ content: finalContent, data_modified: dataModified }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("import-assistant error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Errore sconosciuto" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
