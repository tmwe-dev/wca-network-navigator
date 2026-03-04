import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TARGET_SCHEMA = {
  company_name: "Nome dell'azienda (es. 'Global Logistics Srl', 'DHL Express')",
  name: "Nome e cognome della persona di contatto (es. 'Mario Rossi')",
  email: "Indirizzo email (es. 'mario@azienda.com')",
  phone: "Numero di telefono fisso dell'ufficio",
  mobile: "Numero di cellulare personale",
  country: "Paese/nazione (es. 'Italy', 'Germany', 'United States')",
  city: "Città (es. 'Milano', 'Hamburg', 'New York')",
  address: "Indirizzo stradale completo",
  zip_code: "Codice postale / CAP (es. '20100', '10115')",
  note: "Qualsiasi informazione aggiuntiva: ruolo/posizione della persona, commenti, note varie",
  origin: "Origine/provenienza del contatto (es. nome di un network, fiera, segnalazione)",
  company_alias: "Codice identificativo alternativo dell'azienda (es. codice interno, ID network)",
  contact_alias: "Codice identificativo alternativo del contatto/persona",
};

const TARGET_FIELDS = Object.keys(TARGET_SCHEMA);

const CONTEXT_PROMPT = `## CHI SIAMO
Sei un analista dati che lavora per una piattaforma CRM specializzata nel settore spedizioni e logistica (freight forwarding).
Le aziende di spedizioni usano questa piattaforma per gestire la propria rubrica di contatti commerciali: clienti, fornitori, partner, agenti.

## COSA FACCIAMO
Gli utenti caricano file (CSV, Excel, TXT) contenenti rubriche di contatti che servono per attività commerciali:
- Invio email promozionali e di presentazione
- Telefonate commerciali
- Messaggi WhatsApp
- Gestione relazioni con partner internazionali

I file possono provenire da qualsiasi fonte: export di altri CRM, rubriche Excel fatte a mano, export da directory di settore, liste contatti da fiere, ecc. Non conosciamo in anticipo il formato.

## LA NOSTRA TABELLA
I contatti importati vengono salvati nella tabella "imported_contacts" che ha ESATTAMENTE questi campi:
${Object.entries(TARGET_SCHEMA).map(([col, desc]) => `  - "${col}": ${desc}`).join("\n")}

## IL TUO COMPITO
Ricevi un campione di ~50 righe da un file di formato sconosciuto. Ogni riga è un oggetto JSON con le chiavi originali del file (normalizzate in lowercase con underscore).

Devi:
1. LEGGERE attentamente i VALORI contenuti nelle righe, non solo i nomi delle chiavi
2. Per ogni chiave sorgente, decidere in quale campo della nostra tabella inseriresti quei dati
3. Restituire il column_mapping come ARRAY di coppie {source, target}
4. Se una colonna sorgente non corrisponde a nessun campo della nostra tabella, inserirla in unmapped_columns
5. Se hai dubbi su dove mettere un campo, usa la tua migliore ipotesi e aggiungi un warning

## COME RAGIONARE
- Guarda i VALORI: se una colonna contiene "Milano", "Roma", "Hamburg" → è una città
- Se contiene "+39 02 1234567" → è un telefono
- Se contiene "mario@azienda.com" → è un'email
- Se contiene "Srl", "GmbH", "Ltd", "Inc" → è un nome azienda
- Se contiene "Mario Rossi", "John Smith" → è un nome persona
- Se contiene "IT", "DE", "US" o "Italy", "Germany" → è un paese
- Se contiene "Sales Manager", "Director", "Responsabile" → è un ruolo, va in "note"
- Se contiene un codice numerico o alfanumerico che sembra un ID → potrebbe essere company_alias o contact_alias
- Se più colonne sorgente contengono lo stesso tipo di dato (es. due colonne con nomi), usa il contesto per distinguere persona vs azienda

## REGOLE
- Il column_mapping NON DEVE MAI essere vuoto se il file contiene dati utili
- Ogni campo destinazione può essere mappato da AL MASSIMO una colonna sorgente
- Se hai dubbi, mappa comunque e segnala nei warnings
- La confidence deve riflettere quanto sei sicuro del mapping complessivo`;

const PASTE_PROMPT = `## CHI SIAMO
Sei un analista dati che lavora per una piattaforma CRM nel settore spedizioni/logistica (freight forwarding).

## COSA FACCIAMO  
Gli utenti incollano testo libero contenente contatti commerciali: elenchi di aziende, tabelle copiate, email con contatti, biglietti da visita, appunti da fiere.

## LA NOSTRA TABELLA
${Object.entries(TARGET_SCHEMA).map(([col, desc]) => `  - "${col}": ${desc}`).join("\n")}

## IL TUO COMPITO
Analizza il testo, identifica ogni entità (azienda o contatto), e mappa i dati trovati ai campi della nostra tabella.
Genera un column_mapping vuoto (non applicabile per testo libero) e popola parsed_rows con i dati estratti.`;

// Convert array of {source, target} to dict {source: target}
function arrayMappingToDict(arr: unknown): Record<string, string> {
  const dict: Record<string, string> = {};
  if (!Array.isArray(arr)) return dict;
  for (const item of arr) {
    if (item && typeof item === "object" && typeof item.source === "string" && typeof item.target === "string") {
      if (TARGET_FIELDS.includes(item.target)) {
        dict[item.source] = item.target;
      }
    }
  }
  return dict;
}

// Fallback: derive mapping from parsed_rows by matching values against source sample
function deriveMappingFromParsedRows(
  sampleRows: Record<string, unknown>[],
  parsedRows: Record<string, unknown>[]
): Record<string, string> {
  const dict: Record<string, string> = {};
  if (!sampleRows?.length || !parsedRows?.length) return dict;

  const sourceKeys = Object.keys(sampleRows[0] || {});

  for (const targetField of TARGET_FIELDS) {
    if (dict[targetField]) continue; // already found via another source key

    // Collect non-empty values for this target field across parsed rows
    const targetValues: string[] = [];
    for (const pr of parsedRows.slice(0, 5)) {
      const v = pr[targetField];
      if (v && typeof v === "string" && v.trim()) targetValues.push(v.trim());
    }
    if (!targetValues.length) continue;

    // Find which source key contains these values
    for (const srcKey of sourceKeys) {
      // Check if already mapped
      if (Object.values(dict).includes(targetField)) break;
      if (dict[srcKey]) continue;

      let matches = 0;
      for (let i = 0; i < Math.min(sampleRows.length, parsedRows.length, 5); i++) {
        const srcVal = String(sampleRows[i]?.[srcKey] ?? "").trim();
        const tgtVal = String(parsedRows[i]?.[targetField] ?? "").trim();
        if (srcVal && tgtVal && srcVal === tgtVal) matches++;
      }
      if (matches >= 1) {
        dict[srcKey] = targetField;
        break;
      }
    }
  }
  return dict;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) throw new Error("LOVABLE_API_KEY not configured");

    const { sample_rows, input_type, raw_text } = await req.json();

    const isPaste = input_type === "paste";
    const prompt = isPaste ? PASTE_PROMPT : CONTEXT_PROMPT;
    const userContent = isPaste ? (raw_text || "") : JSON.stringify(sample_rows || [], null, 2);

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
                    type: "array",
                    description: "Array of mappings from source column to target column. Each item has 'source' (original header) and 'target' (one of our imported_contacts fields). MUST NOT be empty for file imports.",
                    items: {
                      type: "object",
                      properties: {
                        source: { type: "string", description: "Exact key name from the source data" },
                        target: { type: "string", description: "Target field name in imported_contacts table" },
                      },
                      required: ["source", "target"],
                    },
                  },
                  parsed_rows: {
                    type: "array",
                    description: "Preview: first 5 rows transformed using the mapping, with target column names as keys.",
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
                    description: "0-1. High (0.9+) if key fields like company_name/name/email found. Medium (0.5-0.8) if partial. Low (<0.5) if poor match.",
                  },
                  warnings: {
                    type: "array",
                    items: { type: "string" },
                    description: "Doubts about specific mappings, e.g. 'La colonna X potrebbe essere sia phone che mobile, ho scelto phone'",
                  },
                  unmapped_columns: {
                    type: "array",
                    items: { type: "string" },
                    description: "Source columns that don't match any target field (IDs, timestamps, status flags, etc.)",
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

    // Convert array mapping to dict
    let columnMappingDict = arrayMappingToDict(result.column_mapping);

    console.log("[analyze-import-structure] AI returned column_mapping entries:", Array.isArray(result.column_mapping) ? result.column_mapping.length : "not-array");
    console.log("[analyze-import-structure] Converted dict keys:", Object.keys(columnMappingDict));

    // Fallback: if dict is empty but parsed_rows has data, derive mapping
    if (Object.keys(columnMappingDict).length === 0 && result.parsed_rows?.length > 0 && !isPaste) {
      console.log("[analyze-import-structure] column_mapping empty, deriving from parsed_rows...");
      columnMappingDict = deriveMappingFromParsedRows(sample_rows || [], result.parsed_rows);
      console.log("[analyze-import-structure] Derived mapping keys:", Object.keys(columnMappingDict));
    }

    const finalResult = {
      column_mapping: columnMappingDict,
      parsed_rows: result.parsed_rows || [],
      confidence: result.confidence ?? 0.5,
      warnings: result.warnings || [],
      unmapped_columns: result.unmapped_columns || [],
    };

    console.log("[analyze-import-structure] Final mapping:", JSON.stringify(finalResult.column_mapping));
    console.log("[analyze-import-structure] confidence:", finalResult.confidence);

    return new Response(JSON.stringify(finalResult), {
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
