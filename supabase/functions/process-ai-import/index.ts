import "../_shared/llmFetchInterceptor.ts";
/**
 * process-ai-import — AI-powered contact import enrichment Edge Function.
 *
 * Takes an import_log_id, fetches pending imported_contacts, and uses AI to
 * normalize/enrich fields (company names, countries, roles). Processes in batches of 25.
 *
 * @endpoint POST /functions/v1/process-ai-import
 * @auth Required (Bearer token)
 * @rateLimit 10 requests/minute per user
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.3";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimiter.ts";

// deno-lint-ignore no-explicit-any
type SupabaseClient = ReturnType<typeof createClient<any>>;

const BATCH_SIZE = 25;

serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;

  const origin = req.headers.get("origin");
  const dynCors = getCorsHeaders(origin);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "AUTH_REQUIRED" }), { status: 401, headers: { ...dynCors, "Content-Type": "application/json" } });
    }

    const anonClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "AUTH_INVALID" }), { status: 401, headers: { ...dynCors, "Content-Type": "application/json" } });
    }
    const userId = claimsData.claims.sub as string;

    // Rate limit
    const rl = checkRateLimit(`ai-import:${userId}`, { maxTokens: 10, refillRate: 0.1 });
    if (!rl.allowed) return rateLimitResponse(rl, dynCors);


    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { import_log_id, mode, custom_prompt, batch_offset } = await req.json();
    if (!import_log_id) throw new Error("import_log_id is required");

    // Fix errors mode
    if (mode === "fix_errors") {
      return await handleFixErrors(supabase, import_log_id, lovableApiKey, dynCors, custom_prompt, batch_offset || 0);
    }

    // Get import log
    const { data: importLog, error: logError } = await supabase
      .from("import_logs")
      .select("*")
      .eq("id", import_log_id)
      .single();

    if (logError || !importLog) throw new Error("Import log not found");

    // Update status to processing
    await supabase
      .from("import_logs")
      .update({ status: "processing" })
      .eq("id", import_log_id);

    // Get all contacts for this import that haven't been processed yet
    const { data: contacts, error: contactsError } = await supabase
      .from("imported_contacts")
      .select("*")
      .eq("import_log_id", import_log_id)
      .order("row_number", { ascending: true });

    if (contactsError) throw new Error(`Failed to fetch contacts: ${contactsError.message}`);

    const totalBatches = Math.ceil((contacts?.length || 0) / BATCH_SIZE);
    await supabase
      .from("import_logs")
      .update({ total_batches: totalBatches })
      .eq("id", import_log_id);

    let importedCount = 0;
    let errorCount = 0;

    // Process in batches
    for (let i = 0; i < (contacts?.length || 0); i += BATCH_SIZE) {
      const batch = contacts!.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;

      // Update progress
      await supabase
        .from("import_logs")
        .update({ processing_batch: batchNumber })
        .eq("id", import_log_id);

      if (lovableApiKey) {
        try {
          const normalized = await normalizeWithAI(batch, lovableApiKey);
          
          for (let j = 0; j < batch.length; j++) {
            const contact = batch[j];
            const norm = normalized[j];

            if (norm && norm.company_name) {
              const { error: updateError } = await supabase
                .from("imported_contacts")
                .update({
                  company_name: norm.company_name || contact.company_name,
                  name: norm.name || contact.name,
                  email: norm.email || contact.email,
                  phone: norm.phone || contact.phone,
                  mobile: norm.mobile || contact.mobile,
                  country: norm.country || contact.country,
                  city: norm.city || contact.city,
                  address: norm.address || contact.address,
                  zip_code: norm.zip_code || contact.zip_code,
                  company_alias: norm.company_alias || null,
                  contact_alias: norm.contact_alias || null,
                })
                .eq("id", contact.id);

              if (updateError) {
                errorCount++;
                await logImportError(supabase, import_log_id, contact.row_number, "update_failed", updateError.message, contact.raw_data);
              } else {
                importedCount++;
              }
            } else {
              // AI couldn't normalize — log as error
              errorCount++;
              await logImportError(supabase, import_log_id, contact.row_number, "normalization_failed", "AI non ha potuto normalizzare questo record", contact.raw_data);
            }
          }
        } catch (aiError) {
          // AI call failed — mark all batch records as errors
          console.error("AI batch error:", aiError);
          for (const contact of batch) {
            errorCount++;
            await logImportError(supabase, import_log_id, contact.row_number, "ai_error", String(aiError), contact.raw_data);
          }
        }
      } else {
        // No AI key — just validate required fields
        for (const contact of batch) {
          if (!contact.company_name?.trim()) {
            errorCount++;
            await logImportError(supabase, import_log_id, contact.row_number, "missing_field", "company_name mancante", contact.raw_data);
          } else {
            importedCount++;
          }
        }
      }
    }

    // Finalize
    await supabase
      .from("import_logs")
      .update({
        status: "completed",
        imported_rows: importedCount,
        error_rows: errorCount,
        completed_at: new Date().toISOString(),
      })
      .eq("id", import_log_id);

    return new Response(
      JSON.stringify({ success: true, imported: importedCount, errors: errorCount }),
      { headers: { ...dynCors, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("process-ai-import error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...dynCors, "Content-Type": "application/json" } }
    );
  }
});

async function normalizeWithAI(batch: Array<Record<string, unknown>>, apiKey: string): Promise<any[]> {
  const prompt = `Sei un assistente specializzato nella normalizzazione di dati aziendali per un CRM di spedizionieri e freight forwarder.

Per ogni record nel seguente array JSON, normalizza i campi:
- company_name: nome pulito senza suffissi legali ridondanti
- company_alias: versione breve/informale del nome (es. "DHL Express" → "DHL")
- name: nome e cognome del contatto, capitalizzato correttamente
- contact_alias: nome informale del contatto (es. "Giuseppe Rossi" → "Giuseppe")
- email: validata e lowercase
- phone: con prefisso internazionale se mancante (basato sul country)
- mobile: con prefisso internazionale
- country: nome completo del paese in inglese
- city: capitalizzata correttamente
- address: formattata in modo standard
- zip_code: validato per il paese

Rispondi SOLO con un array JSON valido, stesso numero di elementi dell'input. Se un campo non è recuperabile, usa null.`;

  const records = batch.map((c) => c.raw_data || {
    company_name: c.company_name,
    name: c.name,
    email: c.email,
    phone: c.phone,
    mobile: c.mobile,
    country: c.country,
    city: c.city,
    address: c.address,
    zip_code: c.zip_code,
  });

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: JSON.stringify(records) },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "return_normalized_contacts",
            description: "Returns the array of normalized contact records",
            parameters: {
              type: "object",
              properties: {
                contacts: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      company_name: { type: "string" },
                      company_alias: { type: "string" },
                      name: { type: "string" },
                      contact_alias: { type: "string" },
                      email: { type: "string" },
                      phone: { type: "string" },
                      mobile: { type: "string" },
                      country: { type: "string" },
                      city: { type: "string" },
                      address: { type: "string" },
                      zip_code: { type: "string" },
                    },
                  },
                },
              },
              required: ["contacts"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "return_normalized_contacts" } },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AI gateway error ${response.status}: ${text}`);
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) throw new Error("No tool call in AI response");

  const parsed = JSON.parse(toolCall.function.arguments);
  return parsed.contacts || [];
}

async function logImportError(
  supabase: SupabaseClient,
  importLogId: string,
  rowNumber: number,
  errorType: string,
  errorMessage: string,
  rawData: unknown
) {
  await supabase.from("import_errors").insert({
    import_log_id: importLogId,
    row_number: rowNumber,
    error_type: errorType,
    error_message: errorMessage,
    raw_data: rawData,
  });
}

async function handleFixErrors(supabase: SupabaseClient, importLogId: string, lovableApiKey: string | undefined, dynCors: Record<string, string>, customPrompt?: string, batchOffset: number = 0) {
  if (!lovableApiKey) {
    return new Response(JSON.stringify({ error: "LOVABLE_API_KEY non configurata" }), {
      status: 500, headers: { ...dynCors, "Content-Type": "application/json" },
    });
  }

  const FIX_BATCH_SIZE = 15;

  // Get pending errors with offset for batch processing
  const { data: errors, error: fetchErr } = await supabase
    .from("import_errors")
    .select("*")
    .eq("import_log_id", importLogId)
    .eq("status", "pending")
    .order("row_number", { ascending: true })
    .range(batchOffset, batchOffset + FIX_BATCH_SIZE - 1);

  if (fetchErr) throw new Error(fetchErr.message);
  if (!errors || errors.length === 0) {
    return new Response(JSON.stringify({ corrected: 0, dismissed: 0, has_more: false, next_offset: batchOffset }), {
      headers: { ...dynCors, "Content-Type": "application/json" },
    });
  }

  // Count total remaining
  const { count: totalPending } = await supabase
    .from("import_errors")
    .select("id", { count: "exact", head: true })
    .eq("import_log_id", importLogId)
    .eq("status", "pending");

  const defaultPrompt = `Sei un assistente specializzato nella correzione di dati aziendali per un CRM di freight forwarder.

Per ogni record nel seguente array, prova a correggere e completare i dati mancanti o invalidi.
Ogni record ha raw_data (dati originali) e error_message (cosa è andato storto).

Rispondi con un array dove ogni elemento ha:
- corrected: true/false (se sei riuscito a correggere)
- data: oggetto con i campi corretti (company_name, name, email, phone, mobile, country, city, address, zip_code)
  Se non riesci a correggere, data può essere null.`;

  const prompt = customPrompt 
    ? `${customPrompt}\n\nRispondi con un array dove ogni elemento ha:\n- corrected: true/false\n- data: oggetto con i campi corretti (company_name, name, email, phone, mobile, country, city, address, zip_code). Se non riesci, data = null.`
    : defaultPrompt;

  const records = errors.map((e: Record<string, unknown>) => ({
    row_number: e.row_number,
    raw_data: e.raw_data,
    error_message: e.error_message,
    error_type: e.error_type,
  }));

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: JSON.stringify(records) },
      ],
      tools: [{
        type: "function",
        function: {
          name: "return_corrections",
          description: "Returns correction results for each error",
          parameters: {
            type: "object",
            properties: {
              results: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    corrected: { type: "boolean" },
                    data: {
                      type: "object",
                      properties: {
                        company_name: { type: "string" },
                        name: { type: "string" },
                        email: { type: "string" },
                        phone: { type: "string" },
                        mobile: { type: "string" },
                        country: { type: "string" },
                        city: { type: "string" },
                        address: { type: "string" },
                        zip_code: { type: "string" },
                      },
                    },
                  },
                  required: ["corrected"],
                },
              },
            },
            required: ["results"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "return_corrections" } },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AI error ${response.status}: ${text}`);
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) throw new Error("No tool call in AI response");

  const parsed = JSON.parse(toolCall.function.arguments);
  const results = parsed.results || [];

  let correctedCount = 0;
  let dismissedCount = 0;

  for (let i = 0; i < errors.length; i++) {
    const err = errors[i];
    const result = results[i];

    if (result?.corrected && result.data) {
      await supabase.from("imported_contacts").insert({
        import_log_id: importLogId,
        row_number: err.row_number,
        company_name: result.data.company_name || null,
        name: result.data.name || null,
        email: result.data.email || null,
        phone: result.data.phone || null,
        mobile: result.data.mobile || null,
        country: result.data.country || null,
        city: result.data.city || null,
        address: result.data.address || null,
        zip_code: result.data.zip_code || null,
        raw_data: err.raw_data,
      });

      await supabase.from("import_errors").update({
        status: "corrected",
        corrected_data: result.data,
        ai_suggestions: customPrompt ? { custom_prompt: customPrompt } : null,
        attempted_corrections: (err.attempted_corrections || 0) + 1,
      }).eq("id", err.id);

      correctedCount++;
    } else {
      await supabase.from("import_errors").update({
        status: "dismissed",
        attempted_corrections: (err.attempted_corrections || 0) + 1,
      }).eq("id", err.id);

      dismissedCount++;
    }
  }

  const remainingAfter = (totalPending || 0) - errors.length;
  const hasMore = remainingAfter > 0;

  return new Response(JSON.stringify({ 
    corrected: correctedCount, 
    dismissed: dismissedCount, 
    has_more: hasMore,
    remaining: remainingAfter,
    next_offset: 0, // Always 0 since we process "pending" status and they change after processing
    total_pending_before: totalPending || 0,
  }), {
    headers: { ...dynCors, "Content-Type": "application/json" },
  });
}
