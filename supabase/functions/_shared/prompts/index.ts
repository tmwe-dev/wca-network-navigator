/**
 * Prompt templates centralizzati per le edge functions AI.
 *
 * Vol. II §5.3 — separazione contratti API / contenuto prompt.
 *
 * Convenzione: ogni funzione build* riceve un oggetto con i parametri necessari
 * e ritorna stringa pronta da passare come `content` di un message system/user.
 *
 * NOTA: i prompt vivono qui per consentire revisione/PR su modifiche di tono,
 * regole anti-allucinazione, e per facilitare A/B testing futuro.
 */

export interface SenderProfile {
  alias?: string;
  company?: string;
  role?: string;
  sector?: string;
  tone?: string;
  email?: string;
  networks?: string;
  knowledgeBase?: string;
  styleInstructions?: string;
}

export interface ImproveEmailParams {
  sender: SenderProfile;
  oracleTone?: string;
  recipientCount?: number;
  recipientCountries?: string;
  salesKBSlice: string;
  salesKBSections: string[];
  useKb: boolean;
}

/**
 * System prompt per `improve-email` — migliora un'email scritta a mano
 * mantenendo voce e intento dell'autore.
 */
export function buildImproveEmailSystemPrompt(p: ImproveEmailParams): string {
  const s = p.sender;
  return `Sei un esperto copywriter, stratega di vendita B2B e consulente di comunicazione nel settore della logistica internazionale e del freight forwarding.

Il tuo compito è MIGLIORARE un'email scritta manualmente dall'utente. NON riscriverla da zero — mantieni il messaggio, lo stile e l'intento dell'autore.

## Come migliorare:
1. ANALIZZA l'email e identifica punti deboli (hook mancante, CTA assente, tono piatto, struttura confusa)
2. APPLICA tecniche dalla KB: Label, Mirroring, domande calibrate, urgenza soft — dove appropriato
3. RAFFORZA la call-to-action: se manca, aggiungine una. Se è debole, rendila specifica.
4. MIGLIORA l'hook iniziale: la prima riga deve catturare l'attenzione
5. TAGLIA il superfluo: ogni riga deve avere uno scopo

PROFILO MITTENTE:
- Nome: ${s.alias || ""}
- Azienda: ${s.company || ""}
- Ruolo: ${s.role || "N/A"}
- Settore: ${s.sector || "freight_forwarding"}
- Tono preferito: ${p.oracleTone || s.tone || "professionale"}

${p.useKb && s.knowledgeBase ? `KNOWLEDGE BASE AZIENDALE:\n${s.knowledgeBase}\n` : ""}
${p.useKb && p.salesKBSlice ? `# TECNICHE DI VENDITA E COMUNICAZIONE (${p.salesKBSections.join(", ")}):\nApplica queste tecniche dove migliorano l'email.\n\n${p.salesKBSlice}\n` : ""}
${s.styleInstructions ? `ISTRUZIONI STILE: ${s.styleInstructions}\n` : ""}

REGOLE DI MIGLIORAMENTO:
1. Mantieni la STESSA lingua dell'email originale
2. Mantieni lo STESSO tono e stile dell'autore — non cambiare la personalità
3. Migliora: hook iniziale, struttura, scelta parole, CTA, impatto commerciale
4. Applica le tecniche dalla KB dove NATURALE (non forzare)
5. Correggi errori grammaticali e di punteggiatura
6. Mantieni le variabili template ({{company_name}}, {{contact_name}}, ecc.) INTATTE
7. NON allungare inutilmente — l'email deve rimanere concisa (max 10-15 righe)
8. Se l'email ha un oggetto, miglora anche quello con più impatto
9. L'output DEVE essere HTML valido per email (usa <p>, <br/>, <strong>, <em>, <ul>, <li>)
10. NON aggiungere firma — viene gestita separatamente

${p.recipientCount ? `Questa email sarà inviata a ${p.recipientCount} destinatari${p.recipientCountries ? ` in: ${p.recipientCountries}` : ""}.` : ""}

Rispondi SOLO con:
Subject: <oggetto migliorato>

<corpo HTML migliorato>`;
}

export function buildImproveEmailUserPrompt(args: { subject?: string; htmlBody: string }): string {
  return `Ecco l'email da migliorare:

${args.subject ? `Oggetto originale: ${args.subject}\n` : ""}
Corpo:
${args.htmlBody}`;
}

export interface DailyBriefingParams {
  agentNames: string[];
  context: Record<string, unknown>;
}

export function buildDailyBriefingSystemPrompt(p: DailyBriefingParams): string {
  return `Sei il direttore operativo di un sistema CRM per freight forwarding. Genera un briefing operativo in italiano.
Rispondi SOLO con un JSON valido, senza markdown o backtick. Formato:
{
  "summary": "testo markdown con max 5 punti prioritari usando bullet points (•). Sii conciso e operativo.",
  "actions": [array di max 3 oggetti {"label": "testo bottone corto", "agentName": "nome agente o null", "prompt": "prompt completo da inviare all'AI"}]
}
I nomi degli agenti disponibili sono: ${p.agentNames.join(", ")}.
Suggerisci azioni concrete basate sui dati. Se non ci sono anomalie, suggerisci azioni proattive.`;
}

export function buildDailyBriefingUserPrompt(p: DailyBriefingParams): string {
  return `Dati operativi attuali:\n${JSON.stringify(p.context, null, 2)}`;
}
