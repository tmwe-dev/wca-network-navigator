import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TARGET_COLUMNS = [
  "company_name", "name", "email", "phone", "mobile",
  "country", "city", "address", "zip_code", "note", "origin",
  "company_alias", "contact_alias",
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) throw new Error("LOVABLE_API_KEY not configured");

    const { sample_rows, input_type, raw_text } = await req.json();

    let prompt: string;
    let userContent: string;

    if (input_type === "paste") {
      prompt = `Sei un assistente specializzato nell'estrazione di dati strutturati da testo libero.
Il testo può contenere elenchi di aziende, tabelle copiate, email con contatti, ecc.

Estrai i dati e strutturali come array di oggetti con queste colonne destinazione:
${TARGET_COLUMNS.join(", ")}

Analizza il testo e:
1. Identifica ogni riga/entità (azienda o contatto)
2. Mappa i dati trovati alle colonne destinazione
3. Se un campo non è presente, usa null
4. Genera un column_mapping vuoto (non applicabile per testo libero)
5. Valuta la confidence (0-1) basata su quanto i dati sono chiari`;

      userContent = raw_text || "";
    } else {
      prompt = `Sei un assistente specializzato nel mapping di colonne CSV/Excel verso un formato standard CRM per spedizionieri.

Le colonne destinazione sono: ${TARGET_COLUMNS.join(", ")}

Ricevi un campione di righe dal file dell'utente. Ogni riga è un oggetto con le chiavi originali del file (già normalizzate in lowercase con underscore). Le chiavi possono avere suffissi numerici (_2, _3) quando nel file originale c'erano colonne duplicate.

REGOLE IMPORTANTI per strutture a doppia entità (es. file TMW con contatto + azienda nella stessa riga):
- Se trovi chiavi come "name" e "name_2", la prima "name" è il CONTATTO (→ name), la seconda "name_2" è l'AZIENDA (→ company_name)
- Se trovi "alias" e "alias_2", la prima è contact_alias, la seconda è company_alias
- "cell" → mobile
- "position" → note (ruolo/posizione del contatto)
- Se c'è solo una colonna "country" e due entità, usa quella per il campo country

Devi:
1. Analizzare le chiavi del file sorgente e i valori di esempio
2. Creare un mapping: chiave_sorgente → colonna_destinazione (una chiave sorgente può mappare a una sola destinazione)
3. Applicare il mapping alle righe campione per generare parsed_rows
4. Valutare la confidence (0-1) del mapping
5. Segnalare warnings per colonne non mappabili

Esempi di mapping comuni:
- "ragione_sociale" / "azienda" / "company" → company_name
- "nome" / "contatto" / "referente" → name
- "mail" / "e_mail" / "email_address" → email
- "telefono" / "tel" / "phone_number" → phone
- "cellulare" / "cell" / "mobile_phone" → mobile
- "paese" / "nazione" / "country" → country
- "citta" / "città" / "city" → city
- "indirizzo" / "via" / "address" → address
- "cap" / "zip" / "postal_code" → zip_code
- "company_alias" / "alias_2" → company_alias
- "contact_alias" / "alias" → contact_alias`;

      userContent = JSON.stringify(sample_rows || []);
    }

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
          { role: "user", content: userContent },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_import_structure",
              description: "Returns the analyzed import structure with column mapping, parsed rows, and data quality report",
              parameters: {
                type: "object",
                properties: {
                  column_mapping: {
                    type: "object",
                    description: "Mapping from source column names to target column names",
                    additionalProperties: { type: "string" },
                  },
                  parsed_rows: {
                    type: "array",
                    description: "Parsed rows with target column names",
                    items: {
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
                        note: { type: "string" },
                        origin: { type: "string" },
                        company_alias: { type: "string" },
                        contact_alias: { type: "string" },
                      },
                    },
                  },
                  confidence: {
                    type: "number",
                    description: "Confidence score 0-1",
                  },
                  warnings: {
                    type: "array",
                    items: { type: "string" },
                    description: "Warnings about unmapped columns or issues",
                  },
                  unmapped_columns: {
                    type: "array",
                    items: { type: "string" },
                    description: "List of source columns that could not be mapped to any target column",
                  },
                  data_quality: {
                    type: "object",
                    description: "Quality report based on the sample rows",
                    properties: {
                      sample_size: { type: "number" },
                      with_company_name: { type: "number" },
                      with_name: { type: "number" },
                      with_email: { type: "number" },
                      with_phone: { type: "number" },
                      with_country: { type: "number" },
                    },
                  },
                },
                required: ["column_mapping", "parsed_rows", "confidence", "warnings", "unmapped_columns", "data_quality"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_import_structure" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit superato, riprova tra poco." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Crediti AI esauriti." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      throw new Error(`AI gateway error ${response.status}: ${text}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in AI response");

    const result = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("analyze-import-structure error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
