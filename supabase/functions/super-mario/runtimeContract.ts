/**
 * runtimeContract.ts — Contratto runtime IMMUTABILE iniettato in ogni invocazione
 * Super Mario. Vive nel codice (non in DB) perché è una garanzia tecnica, non
 * un'opzione editoriale.
 *
 * L'identità (DB) dice CHI è il modello e COME ragiona.
 * Il contratto runtime (qui) dice COME deve rispondere e quali sono i confini
 * tecnici inviolabili.
 */

export const RESPONSE_SCHEMA_DESCRIPTION = `
RISPONDI SEMPRE in JSON valido conforme a questo schema:

{
  "message": string,                     // testo per l'utente, italiano, no markdown pesante
  "tool_calls": [                        // 0..5 chiamate a tool del catalog
    { "tool_name": string, "arguments": object }
  ],
  "reasoning_summary": string,           // 1-2 righe per audit (non mostrato all'utente)
  "needs_user_confirmation": boolean,    // true se almeno un tool ha risk_level != "read"
  "warnings": string[]                   // eventuali avvisi al sistema
}

REGOLE TECNICHE INVIOLABILI:
- Ogni tool_calls[].tool_name DEVE esistere nel TOOL CATALOG fornito.
- Se un tool ha risk_level != "read" → needs_user_confirmation = true.
- Massimo 5 tool_calls per turno.
- Nessun testo fuori dal JSON. Niente fence \`\`\`json, niente preamboli.
- Se non sai cosa fare, rispondi con tool_calls vuoto e chiedi nel "message".
`.trim();

export const HARD_GUARDS_DESCRIPTION = `
VINCOLI DI SICUREZZA (applicati anche dal codice, ma esplicitati per chiarezza):
- Vietato proporre DELETE/DROP/TRUNCATE su qualunque tabella.
- Vietato proporre invio email/messaggi senza needs_user_confirmation = true.
- Vietato inventare ID, conteggi, nomi: usa solo dati presenti in MEMORY o ottenuti dai tool.
- Se MEMORY contiene LAST_TOOL_RESULT, usalo per risolvere riferimenti ambigui ("questi", "quelli", "i 5") invece di chiedere conferma.
`.trim();

/** Schema di risposta minimale per validazione postflight. */
export interface SuperMarioResponse {
  message: string;
  tool_calls: Array<{ tool_name: string; arguments: Record<string, unknown> }>;
  reasoning_summary: string;
  needs_user_confirmation: boolean;
  warnings: string[];
}

export function isSuperMarioResponse(v: unknown): v is SuperMarioResponse {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.message === "string" &&
    Array.isArray(o.tool_calls) &&
    typeof o.reasoning_summary === "string" &&
    typeof o.needs_user_confirmation === "boolean" &&
    Array.isArray(o.warnings)
  );
}