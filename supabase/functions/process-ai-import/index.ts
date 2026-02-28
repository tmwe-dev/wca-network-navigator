import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BATCH_SIZE = 25;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { import_log_id } = await req.json();
    if (!import_log_id) throw new Error("import_log_id is required");

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
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("process-ai-import error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function normalizeWithAI(batch: any[], apiKey: string): Promise<any[]> {
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
  supabase: any,
  importLogId: string,
  rowNumber: number,
  errorType: string,
  errorMessage: string,
  rawData: any
) {
  await supabase.from("import_errors").insert({
    import_log_id: importLogId,
    row_number: rowNumber,
    error_type: errorType,
    error_message: errorMessage,
    raw_data: rawData,
  });
}
