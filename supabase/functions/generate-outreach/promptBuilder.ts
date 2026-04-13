/**
 * promptBuilder.ts — System + User prompt composition for generate-outreach.
 * Extracted from index.ts for modularity (Prompt #59).
 */
import type { Quality } from "../_shared/kbSlice.ts";
import { getLanguageHint, isLikelyPersonName, cleanCompanyName } from "../_shared/textUtils.ts";

export type Channel = "email" | "linkedin" | "whatsapp" | "sms";

export interface OutreachPromptContext {
  channel: Channel;
  quality: Quality;
  contact_name?: string;
  contact_email?: string;
  company_name?: string;
  country_code: string;
  language?: string;
  goal?: string;
  base_proposal?: string;
  oracle_tone?: string;
  email_type_id?: string;
  email_type_prompt?: string;
  email_type_structure?: string;
  settings: Record<string, string>;
  // Pre-built context blocks
  enrichmentSnippet: string;
  interlocutorBlock: string;
  relationshipBlock: string;
  branchBlock: string;
  metInPersonContext: string;
  salesKBSlice: string;
  salesKBSections: string[];
  commercialLevers: string;
  // Decision/readiness
  decision: Record<string, unknown>;
  readinessTotal: number;
}

export function getModel(quality: Quality): string {
  return quality === "fast"
    ? "google/gemini-2.5-flash-lite"
    : "google/gemini-3-flash-preview";
}

export function buildOutreachPrompts(ctx: OutreachPromptContext): { systemPrompt: string; userPrompt: string } {
  const {
    channel: ch, quality, contact_name, contact_email, company_name, country_code,
    language, goal, base_proposal, oracle_tone, email_type_id, email_type_prompt, email_type_structure,
    settings, enrichmentSnippet, interlocutorBlock, relationshipBlock, branchBlock, metInPersonContext,
    salesKBSlice, salesKBSections, commercialLevers, decision, readinessTotal,
  } = ctx;

  let recipientName = "";
  if (contact_name && isLikelyPersonName(contact_name)) recipientName = contact_name;

  const senderAlias = settings.ai_contact_alias || settings.ai_contact_name || "";
  const senderCompanyAlias = settings.ai_company_alias || settings.ai_company_name || "";

  const detected = getLanguageHint(country_code);
  const effectiveLanguage = language || detected.language;

  const channelContext = `Canale: ${ch.toUpperCase()}`;

  const senderContext = `
MITTENTE (TU):
- Nome: ${senderAlias}
- Azienda: ${senderCompanyAlias}
- Ruolo: ${settings.ai_contact_role || "N/A"}
- Email: ${settings.ai_email_signature || "N/A"}
- Settore: ${settings.ai_sector || "freight_forwarding"}
- Network: ${settings.ai_networks || "N/A"}

KNOWLEDGE BASE AZIENDALE:
${settings.ai_knowledge_base || "Non configurata"}
${salesKBSlice ? `\n# ARSENAL STRATEGICO (${salesKBSections.join(", ") || "legacy"}):\nApplica queste tecniche nel messaggio.\n\n${salesKBSlice}\n` : ""}
STILE:
- Tono: ${settings.ai_tone || "professionale"}
`;

  const cleanedCompany = cleanCompanyName(company_name || "");
  const recipientContext = `
DESTINATARIO:
- Azienda: ${cleanedCompany || company_name || "N/A"}
- Paese: ${country_code || "N/A"}
${recipientName ? `- Nome persona: ${recipientName}` : `- Nome persona: non disponibile`}
${contact_email ? `- Email: ${contact_email}` : ""}
`;

  const intelligenceBlock = enrichmentSnippet
    ? `\nINTELLIGENCE DESTINATARIO (dati verificati dal database — USA QUESTI, non inventare):
${enrichmentSnippet}
`
    : `\nATTENZIONE: Nessun dato arricchito disponibile per questo destinatario. Usa SOLO le informazioni base fornite. NON inventare dettagli, presentazioni, eventi o fatti specifici.
`;

  const systemPrompt = `Sei un esperto stratega di vendita B2B nel settore logistica e freight forwarding internazionale.
Hai accesso a una Knowledge Base di tecniche di vendita e negoziazione — usala autonomamente per scegliere strategia, tono e struttura.

${channelContext}

CONTESTO:
- Lingua suggerita: ${effectiveLanguage} (${country_code} → ${detected.languageLabel})
- ${ch === "email" ? "FORMATO OBBLIGATORIO: la prima riga DEVE essere 'Subject: <oggetto email>' seguita da una riga vuota e poi il corpo HTML. La firma viene aggiunta automaticamente dal sistema." : ""}

GUARDRAIL:
- Scrivi nella lingua del paese destinatario
- Zero allucinazioni: usa SOLO dati forniti, mai inventare fatti
- Usa alias/nome breve nel saluto, mai nome completo
${ch === "email" ? "- La prima riga dell'output DEVE essere 'Subject: <oggetto>' — SEMPRE, senza eccezioni" : ""}
${readinessTotal < 30 ? `\nATTENZIONE INTERNA: readiness score basso (${readinessTotal}/100). Genera in modo più neutro e conservativo. Evita affermazioni specifiche su servizi o capabilities del mittente che non sono confermate dai dati.` : ""}

DECISION OBJECT (decisione già presa — esegui, non ridecidere):
${JSON.stringify(decision, null, 2)}

${email_type_prompt ? `STRUTTURA EMAIL OBBLIGATORIA (tipo: ${email_type_id}):\n${email_type_prompt}\n\nFORMATO: ${email_type_structure || "hook → corpo → CTA"}\n` : ""}`;

  const userPrompt = `${senderContext}
${recipientContext}
${interlocutorBlock}
${relationshipBlock}
${branchBlock}
${metInPersonContext}
${intelligenceBlock}
GOAL: ${goal || "Proposta di collaborazione nel freight forwarding"}

PROPOSTA: ${base_proposal || "Collaborazione logistica internazionale"}
${commercialLevers ? `\nLEVE COMMERCIALI CONFIGURATE:\n${commercialLevers}\n` : ""}
Genera il messaggio completo per il canale ${ch.toUpperCase()}. Applica le tecniche dalla Knowledge Base.`;

  return { systemPrompt, userPrompt };
}
