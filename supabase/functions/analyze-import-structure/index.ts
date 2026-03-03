import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Exact target schema — these are the ONLY columns in our imported_contacts table
const TARGET_SCHEMA = {
  company_name: "Nome dell'azienda (es. 'Global Logistics Srl')",
  name: "Nome del contatto/persona (es. 'Mario Rossi')",
  email: "Indirizzo email",
  phone: "Numero di telefono fisso",
  mobile: "Numero di cellulare",
  country: "Paese (es. 'Italy', 'Germany')",
  city: "Città",
  address: "Indirizzo completo",
  zip_code: "Codice postale / CAP",
  note: "Note, commenti, ruolo/posizione del contatto",
  origin: "Origine/provenienza del contatto",
  company_alias: "Alias/codice alternativo dell'azienda",
  contact_alias: "Alias/codice alternativo del contatto",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) throw new Error("LOVABLE_API_KEY not configured");

    const { sample_rows, input_type, raw_text } = await req.json();

    let prompt: string;
    let userContent: string;

    const schemaDescription = Object.entries(TARGET_SCHEMA)
      .map(([col, desc]) => `  - "${col}": ${desc}`)
      .join("\n");

    if (input_type === "paste") {
      prompt = `Sei un assistente specializzato nell'estrazione di dati strutturati da testo libero.

Il testo può contenere elenchi di aziende, tabelle copiate, email con contatti, biglietti da visita, ecc.

La tabella di destinazione ha ESATTAMENTE queste colonne:
${schemaDescription}

Analizza il testo e:
1. Identifica ogni riga/entità (azienda o contatto)
2. Mappa i dati trovati alle colonne destinazione
3. Se un campo non è presente, usa null
4. Genera un column_mapping vuoto (non applicabile per testo libero)
5. Valuta la confidence (0-1) basata su quanto i dati sono chiari e completi`;

      userContent = raw_text || "";
    } else {
      prompt = `Sei un assistente specializzato nel mapping di colonne da file CSV/Excel verso il nostro database CRM per spedizionieri.

## SCHEMA TABELLA DESTINAZIONE
La tabella "imported_contacts" ha ESATTAMENTE queste colonne:
${schemaDescription}

## DATI IN INPUT
Ricevi un campione di righe dal file dell'utente. Ogni riga è un oggetto JSON con le chiavi originali del file (già normalizzate in lowercase con underscore). Le chiavi possono avere suffissi numerici (_2, _3) quando nel file originale c'erano colonne duplicate con lo stesso nome.

## OBIETTIVO PRINCIPALE
IL TUO COMPITO PRIMARIO è popolare "column_mapping". Questo dizionario è OBBLIGATORIO e NON DEVE MAI essere vuoto.
Per OGNI chiave sorgente che contiene dati utili, DEVI inserire un'entry nel column_mapping con:
- chiave = nome esatto della colonna sorgente (come appare nei dati JSON)
- valore = nome della colonna destinazione dallo schema

## REGOLE DI MAPPING
1. Analizza ATTENTAMENTE sia i nomi delle chiavi che i VALORI di esempio nelle righe
2. Match diretto: "email" → "email", "phone" → "phone", "country" → "country", "city" → "city", "address" → "address", "origin" → "origin"
3. Per strutture con entità doppie (contatto + azienda nella stessa riga):
   - "name" (nome persona) → "name"
   - "name_2" (nome azienda) → "company_name" 
   - "alias" → "contact_alias"
   - "alias_2" → "company_alias"
   - "company_alias" → "company_alias"
4. "cell" / "cellulare" / "mobile" → "mobile"
5. "position" / "ruolo" / "posizione" / "title" → "note" (concatena ruolo/posizione nelle note)
6. "tel" / "telefono" / "phone" → "phone"
7. Quando "country" e "country_2" esistono entrambi, mappa "country" → "country" (sono lo stesso paese)
8. "cap" / "zip_code" → "zip_code"
9. Chiavi non mappabili (es. "id", "created_at", "status", "stato", campi "meta_*", "agent_id", "completed", "scheduled_contact", "has_actions", suffissi _2 ridondanti) vanno in unmapped_columns

## REGOLA CRITICA
NON lasciare MAI column_mapping vuoto. Se nel file ci sono colonne come "name", "email", "phone", "country", "city", "address", "origin", "alias", "name_2", queste DEVONO apparire nel column_mapping.
parsed_rows è SECONDARIO — serve solo come anteprima. Il column_mapping è ciò che il sistema usa per trasformare TUTTE le righe del file.`;

      userContent = JSON.stringify(sample_rows || [], null, 2);
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
              description: "Returns the analyzed import structure with column mapping and parsed sample rows",
              parameters: {
                type: "object",
                properties: {
                  column_mapping: {
                    type: "object",
                    description: "Mapping from EVERY mappable source column name to ONE target column name. Keys are source column names exactly as they appear in the data, values are target column names from the schema.",
                    additionalProperties: { type: "string" },
                  },
                  parsed_rows: {
                    type: "array",
                    description: "The sample rows transformed using the column_mapping. Each row should have target column names as keys.",
                    items: {
                      type: "object",
                      properties: {
                        company_name: { type: "string", nullable: true },
                        name: { type: "string", nullable: true },
                        email: { type: "string", nullable: true },
                        phone: { type: "string", nullable: true },
                        mobile: { type: "string", nullable: true },
                        country: { type: "string", nullable: true },
                        city: { type: "string", nullable: true },
                        address: { type: "string", nullable: true },
                        zip_code: { type: "string", nullable: true },
                        note: { type: "string", nullable: true },
                        origin: { type: "string", nullable: true },
                        company_alias: { type: "string", nullable: true },
                        contact_alias: { type: "string", nullable: true },
                      },
                    },
                  },
                  confidence: {
                    type: "number",
                    description: "Confidence score 0-1. 0.9+ if key columns found, 0.5-0.8 if partial, below 0.5 if poor match",
                  },
                  warnings: {
                    type: "array",
                    items: { type: "string" },
                    description: "Warnings about ambiguous mappings or data quality issues",
                  },
                  unmapped_columns: {
                    type: "array",
                    items: { type: "string" },
                    description: "Source columns that could NOT be mapped to any target column (meta fields, IDs, etc.)",
                  },
                },
                required: ["column_mapping", "parsed_rows", "confidence", "warnings", "unmapped_columns"],
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
    
    // Log for debugging
    console.log("[analyze-import-structure] column_mapping keys:", Object.keys(result.column_mapping || {}));
    console.log("[analyze-import-structure] confidence:", result.confidence);
    console.log("[analyze-import-structure] unmapped:", result.unmapped_columns);

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
