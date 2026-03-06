import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

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

DATI CHE GESTISCI

La tabella "import_logs" contiene lo storico di ogni importazione: file_name, total_rows, imported_rows, error_rows, status (pending/processing/completed/failed), normalization_method (ai/standard), created_at, completed_at.

La tabella "imported_contacts" contiene i contatti nello staging di ogni import. Ogni riga ha: company_name, name, email, phone, mobile, country, city, address, zip_code, note, origin, company_alias, contact_alias, is_selected (selezionato per azione), is_transferred (già trasferito a partners), raw_data (dati originali grezzi).

La tabella "import_errors" contiene gli errori di importazione: row_number, error_type (validation/parsing/duplicate), error_message, raw_data, corrected_data, status (pending/corrected/dismissed), ai_suggestions.

La tabella "partners" è la destinazione finale: i contatti importati vengono trasferiti qui come partner con company_name, country_code, country_name, city, email, phone, ecc.

COSA PUOI FARE

1. CONSULTARE: Interroga import_logs, imported_contacts, import_errors per dare all'utente il quadro della situazione.
2. TRASFERIRE: Trasferisci contatti selezionati (o tutti i non-trasferiti) dalla staging a partners.
3. CREARE ATTIVITÀ: Crea attività email o chiamata per i contatti importati.
4. ANALIZZARE ERRORI: Consulta gli errori e spiega cosa è andato storto.
5. ELIMINARE: Elimina import log e tutti i dati associati se l'utente lo richiede.
6. SELEZIONARE: Seleziona/deseleziona contatti in batch con criteri specifici.
7. STATISTICHE: Conta, raggruppa, analizza i dati importati.

REGOLE
- Rispondi sempre in italiano
- Quando esegui un'azione, conferma cosa hai fatto con numeri precisi
- Se un'operazione potrebbe essere distruttiva (eliminazione), chiedi conferma PRIMA di eseguirla
- Usa markdown per formattare: tabelle per liste, grassetto per numeri importanti
- Quando mostri contatti, usa tabelle con colonne: Azienda, Nome, Email, Città, Paese`;

const tools = [
  {
    type: "function",
    function: {
      name: "list_imports",
      description: "Lista gli import recenti con statistiche: file_name, total_rows, imported_rows, error_rows, status, data.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Max risultati (default 10)" },
          status: { type: "string", enum: ["pending", "processing", "completed", "failed"], description: "Filtra per stato" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_import_detail",
      description: "Dettaglio completo di un import specifico: log + conteggi contatti + conteggi errori.",
      parameters: {
        type: "object",
        properties: {
          import_log_id: { type: "string", description: "UUID dell'import log" },
        },
        required: ["import_log_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_imported_contacts",
      description: "Cerca tra i contatti importati nello staging. Filtra per import, stato trasferimento, presenza email/telefono, paese, azienda.",
      parameters: {
        type: "object",
        properties: {
          import_log_id: { type: "string", description: "Filtra per import specifico" },
          is_transferred: { type: "boolean", description: "Filtra per stato trasferimento" },
          has_email: { type: "boolean", description: "Ha email" },
          has_phone: { type: "boolean", description: "Ha telefono" },
          company_name: { type: "string", description: "Cerca per nome azienda (parziale)" },
          country: { type: "string", description: "Filtra per paese" },
          limit: { type: "number", description: "Max risultati (default 20)" },
          count_only: { type: "boolean", description: "Solo conteggio" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_import_errors",
      description: "Lista gli errori di un import specifico con dettagli su cosa è andato storto.",
      parameters: {
        type: "object",
        properties: {
          import_log_id: { type: "string", description: "UUID dell'import log" },
          status: { type: "string", enum: ["pending", "corrected", "dismissed"], description: "Filtra per stato errore" },
          limit: { type: "number", description: "Max risultati (default 20)" },
        },
        required: ["import_log_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "transfer_contacts",
      description: "Trasferisci contatti dallo staging alla tabella partners. Puoi trasferire tutti i non-trasferiti di un import, o solo quelli selezionati, o filtrare per criteri.",
      parameters: {
        type: "object",
        properties: {
          import_log_id: { type: "string", description: "Import da cui trasferire" },
          only_selected: { type: "boolean", description: "Solo contatti con is_selected=true (default false)" },
          filter_country: { type: "string", description: "Trasferisci solo contatti di questo paese" },
          filter_has_email: { type: "boolean", description: "Trasferisci solo contatti con email" },
        },
        required: ["import_log_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_activities_from_import",
      description: "Crea attività (email o chiamata) per i contatti di un import. Li trasferisce automaticamente a partners se non ancora trasferiti.",
      parameters: {
        type: "object",
        properties: {
          import_log_id: { type: "string", description: "Import da cui creare attività" },
          activity_type: { type: "string", enum: ["send_email", "phone_call"], description: "Tipo attività" },
          only_selected: { type: "boolean", description: "Solo contatti selezionati (default false, usa tutti i non-trasferiti)" },
          filter_has_email: { type: "boolean", description: "Solo contatti con email (utile per attività email)" },
        },
        required: ["import_log_id", "activity_type"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "select_contacts",
      description: "Seleziona o deseleziona contatti in batch per un import. Utile prima di trasferire o creare attività.",
      parameters: {
        type: "object",
        properties: {
          import_log_id: { type: "string", description: "Import di riferimento" },
          select: { type: "boolean", description: "true = seleziona, false = deseleziona" },
          filter_has_email: { type: "boolean", description: "Applica solo a contatti con email" },
          filter_country: { type: "string", description: "Applica solo a contatti di questo paese" },
          filter_company_name: { type: "string", description: "Applica solo a contatti con questo nome azienda (parziale)" },
        },
        required: ["import_log_id", "select"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_import",
      description: "Elimina un import log e TUTTI i dati associati (contatti staging + errori). OPERAZIONE IRREVERSIBILE. Usa solo dopo conferma esplicita dell'utente.",
      parameters: {
        type: "object",
        properties: {
          import_log_id: { type: "string", description: "UUID dell'import da eliminare" },
        },
        required: ["import_log_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_import_stats",
      description: "Statistiche aggregate sugli import: totale importati, trasferiti, in attesa, errori, per paese, per completezza dati.",
      parameters: {
        type: "object",
        properties: {
          import_log_id: { type: "string", description: "Per un import specifico, oppure ometti per globale" },
        },
        additionalProperties: false,
      },
    },
  },
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TOOL EXECUTION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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

async function executeTool(name: string, args: any): Promise<any> {
  switch (name) {
    case "list_imports": {
      let query = supabase
        .from("import_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(args.limit || 10);
      if (args.status) query = query.eq("status", args.status);
      const { data, error } = await query;
      if (error) return { error: error.message };
      return { imports: data, total: data?.length || 0 };
    }

    case "get_import_detail": {
      const [logRes, contactsRes, errorsRes] = await Promise.all([
        supabase.from("import_logs").select("*").eq("id", args.import_log_id).single(),
        supabase.from("imported_contacts").select("id, company_name, name, email, phone, country, city, is_selected, is_transferred", { count: "exact" }).eq("import_log_id", args.import_log_id).limit(0),
        supabase.from("import_errors").select("id, status", { count: "exact" }).eq("import_log_id", args.import_log_id).limit(0),
      ]);
      if (logRes.error) return { error: logRes.error.message };
      
      // Get breakdowns
      const [transferredRes, selectedRes, withEmailRes, withPhoneRes] = await Promise.all([
        supabase.from("imported_contacts").select("id", { count: "exact" }).eq("import_log_id", args.import_log_id).eq("is_transferred", true).limit(0),
        supabase.from("imported_contacts").select("id", { count: "exact" }).eq("import_log_id", args.import_log_id).eq("is_selected", true).limit(0),
        supabase.from("imported_contacts").select("id", { count: "exact" }).eq("import_log_id", args.import_log_id).not("email", "is", null).limit(0),
        supabase.from("imported_contacts").select("id", { count: "exact" }).eq("import_log_id", args.import_log_id).not("phone", "is", null).limit(0),
      ]);
      
      return {
        log: logRes.data,
        contacts_total: contactsRes.count || 0,
        contacts_transferred: transferredRes.count || 0,
        contacts_selected: selectedRes.count || 0,
        contacts_with_email: withEmailRes.count || 0,
        contacts_with_phone: withPhoneRes.count || 0,
        errors_total: errorsRes.count || 0,
      };
    }

    case "search_imported_contacts": {
      let query = supabase
        .from("imported_contacts")
        .select("id, company_name, name, email, phone, mobile, country, city, is_selected, is_transferred, company_alias, contact_alias", args.count_only ? { count: "exact" } : undefined);
      
      if (args.import_log_id) query = query.eq("import_log_id", args.import_log_id);
      if (args.is_transferred !== undefined) query = query.eq("is_transferred", args.is_transferred);
      if (args.has_email === true) query = query.not("email", "is", null);
      if (args.has_email === false) query = query.is("email", null);
      if (args.has_phone === true) query = query.or("phone.not.is.null,mobile.not.is.null");
      if (args.company_name) query = query.ilike("company_name", `%${args.company_name}%`);
      if (args.country) query = query.ilike("country", `%${args.country}%`);
      
      if (args.count_only) {
        query = query.limit(0);
        const { count, error } = await query;
        if (error) return { error: error.message };
        return { count };
      }
      
      const { data, error } = await query.order("row_number").limit(args.limit || 20);
      if (error) return { error: error.message };
      return { contacts: data, total: data?.length || 0 };
    }

    case "list_import_errors": {
      let query = supabase
        .from("import_errors")
        .select("*")
        .eq("import_log_id", args.import_log_id)
        .order("row_number")
        .limit(args.limit || 20);
      if (args.status) query = query.eq("status", args.status);
      const { data, error } = await query;
      if (error) return { error: error.message };
      return { errors: data, total: data?.length || 0 };
    }

    case "transfer_contacts": {
      let query = supabase
        .from("imported_contacts")
        .select("*")
        .eq("import_log_id", args.import_log_id)
        .eq("is_transferred", false);
      
      if (args.only_selected) query = query.eq("is_selected", true);
      if (args.filter_country) query = query.ilike("country", `%${args.filter_country}%`);
      if (args.filter_has_email) query = query.not("email", "is", null);
      
      const { data: contacts, error } = await query;
      if (error) return { error: error.message };
      if (!contacts || contacts.length === 0) return { transferred: 0, message: "Nessun contatto da trasferire con i criteri specificati." };

      let successCount = 0;
      for (const c of contacts) {
        const countryCode = resolveCountryCode(c.country || "");
        const { data: partner, error: pError } = await supabase
          .from("partners")
          .insert({
            company_name: c.company_name || "Unknown",
            country_code: countryCode || "XX",
            country_name: c.country || "Unknown",
            city: c.city || "Unknown",
            address: c.address,
            phone: c.phone,
            mobile: c.mobile,
            email: c.email,
            company_alias: c.company_alias,
            is_active: true,
          })
          .select()
          .single();

        if (pError) continue;

        if (c.name) {
          await supabase.from("partner_contacts").insert({
            partner_id: partner.id,
            name: c.name,
            email: c.email,
            direct_phone: c.phone,
            mobile: c.mobile,
            contact_alias: c.contact_alias,
            is_primary: true,
          });
        }

        await supabase.from("imported_contacts").update({ is_transferred: true }).eq("id", c.id);
        successCount++;
      }

      return { transferred: successCount, total_candidates: contacts.length, message: `${successCount} contatti trasferiti con successo a partners.` };
    }

    case "create_activities_from_import": {
      let query = supabase
        .from("imported_contacts")
        .select("*")
        .eq("import_log_id", args.import_log_id)
        .eq("is_transferred", false);
      
      if (args.only_selected) query = query.eq("is_selected", true);
      if (args.filter_has_email) query = query.not("email", "is", null);
      
      const { data: contacts, error } = await query;
      if (error) return { error: error.message };
      if (!contacts || contacts.length === 0) return { created: 0, message: "Nessun contatto disponibile." };

      const batchId = `import_ai_${Date.now()}`;
      let count = 0;

      for (const c of contacts) {
        const countryCode = resolveCountryCode(c.country || "");
        const { data: partner, error: pError } = await supabase
          .from("partners")
          .insert({
            company_name: c.company_name || "Unknown",
            country_code: countryCode || "XX",
            country_name: c.country || "Unknown",
            city: c.city || "Unknown",
            phone: c.phone,
            email: c.email,
            company_alias: c.company_alias,
            is_active: true,
          })
          .select()
          .single();

        if (pError) continue;

        let contactId: string | null = null;
        if (c.name) {
          const { data: contact } = await supabase
            .from("partner_contacts")
            .insert({
              partner_id: partner.id,
              name: c.name,
              email: c.email,
              direct_phone: c.phone,
              mobile: c.mobile,
              contact_alias: c.contact_alias,
              is_primary: true,
            })
            .select()
            .single();
          contactId = contact?.id || null;
        }

        await supabase.from("activities").insert({
          partner_id: partner.id,
          source_type: "partner",
          source_id: partner.id,
          activity_type: args.activity_type,
          title: `${args.activity_type === "send_email" ? "Email" : "Chiamata"} - ${c.company_name}`,
          status: "pending",
          priority: "medium",
          selected_contact_id: contactId,
          campaign_batch_id: batchId,
        });

        await supabase.from("imported_contacts").update({ is_transferred: true }).eq("id", c.id);
        count++;
      }

      return { created: count, batch_id: batchId, activity_type: args.activity_type, message: `${count} attività ${args.activity_type === "send_email" ? "email" : "chiamata"} create.` };
    }

    case "select_contacts": {
      let query = supabase
        .from("imported_contacts")
        .select("id")
        .eq("import_log_id", args.import_log_id)
        .eq("is_transferred", false);
      
      if (args.filter_has_email) query = query.not("email", "is", null);
      if (args.filter_country) query = query.ilike("country", `%${args.filter_country}%`);
      if (args.filter_company_name) query = query.ilike("company_name", `%${args.filter_company_name}%`);
      
      const { data, error } = await query;
      if (error) return { error: error.message };
      if (!data || data.length === 0) return { updated: 0, message: "Nessun contatto trovato con i criteri specificati." };

      const ids = data.map((d: any) => d.id);
      // Update in batches
      for (let i = 0; i < ids.length; i += 100) {
        const batch = ids.slice(i, i + 100);
        await supabase.from("imported_contacts").update({ is_selected: args.select }).in("id", batch);
      }

      return { updated: ids.length, selected: args.select, message: `${ids.length} contatti ${args.select ? "selezionati" : "deselezionati"}.` };
    }

    case "delete_import": {
      // Delete errors first, then contacts, then the log
      await supabase.from("import_errors").delete().eq("import_log_id", args.import_log_id);
      await supabase.from("imported_contacts").delete().eq("import_log_id", args.import_log_id);
      const { error } = await supabase.from("import_logs").delete().eq("id", args.import_log_id);
      if (error) return { error: error.message };
      return { deleted: true, message: "Import eliminato con tutti i dati associati." };
    }

    case "get_import_stats": {
      if (args.import_log_id) {
        const { data, error } = await supabase
          .from("imported_contacts")
          .select("country, email, phone, is_transferred, is_selected")
          .eq("import_log_id", args.import_log_id);
        if (error) return { error: error.message };
        
        const stats = {
          total: data?.length || 0,
          transferred: data?.filter((c: any) => c.is_transferred).length || 0,
          selected: data?.filter((c: any) => c.is_selected).length || 0,
          with_email: data?.filter((c: any) => c.email).length || 0,
          with_phone: data?.filter((c: any) => c.phone).length || 0,
          by_country: {} as Record<string, number>,
        };
        for (const c of (data || []) as any[]) {
          const country = c.country || "Sconosciuto";
          stats.by_country[country] = (stats.by_country[country] || 0) + 1;
        }
        return stats;
      }
      
      // Global stats
      const [logsRes, contactsRes, errorsRes] = await Promise.all([
        supabase.from("import_logs").select("id, status", { count: "exact" }).limit(0),
        supabase.from("imported_contacts").select("id, is_transferred", { count: "exact" }).limit(0),
        supabase.from("import_errors").select("id", { count: "exact" }).limit(0),
      ]);
      
      const [transferredRes] = await Promise.all([
        supabase.from("imported_contacts").select("id", { count: "exact" }).eq("is_transferred", true).limit(0),
      ]);

      return {
        total_imports: logsRes.count || 0,
        total_contacts_staging: contactsRes.count || 0,
        total_transferred: transferredRes.count || 0,
        total_errors: errorsRes.count || 0,
      };
    }

    default:
      return { error: `Tool sconosciuto: ${name}` };
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN HANDLER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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
      body: JSON.stringify({ model: "google/gemini-3-flash-preview", messages: allMessages, tools }),
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
        const toolResult = await executeTool(tc.function.name, args);
        console.log(`[import-assistant] Result ${tc.function.name}:`, JSON.stringify(toolResult).substring(0, 500));
        toolResults.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(toolResult) });
      }

      allMessages.push(assistantMessage);
      allMessages.push(...toolResults);

      response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "google/gemini-3-flash-preview", messages: allMessages, tools }),
      });

      if (!response.ok) {
        console.error("AI error on tool response:", response.status, await response.text());
        return new Response(JSON.stringify({ error: "Errore durante l'elaborazione" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      result = await response.json();
      assistantMessage = result.choices?.[0]?.message;
    }

    const finalContent = assistantMessage?.content || "Nessuna risposta";

    // Signal if data was modified so frontend can refresh
    const dataModified = iterations > 0; // If tools were called, data may have changed

    // Consume credits for AI usage
    const userId = claimsData.claims.sub as string;
    if (result.usage) {
      const inputTokens = result.usage.prompt_tokens || 0;
      const outputTokens = result.usage.completion_tokens || 0;
      const totalCredits = Math.max(1, Math.ceil((inputTokens + outputTokens * 3) / 1000));
      await supabase.rpc("deduct_credits", {
        p_user_id: userId,
        p_amount: totalCredits,
        p_operation: "ai_call",
        p_description: `Import Assistant: ${inputTokens} in + ${outputTokens} out tokens (${totalCredits} crediti)`,
      });
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
