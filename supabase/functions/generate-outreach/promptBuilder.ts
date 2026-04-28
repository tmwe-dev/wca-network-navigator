/**
 * promptBuilder.ts — System + User prompt composition for generate-outreach.
 * Extracted from index.ts for modularity (Prompt #59).
 */
import type { Quality } from "../_shared/kbSlice.ts";
import { getLanguageHint, isLikelyPersonName, cleanCompanyName } from "../_shared/textUtils.ts";
import {
  buildAddressPriorityBlock,
  buildCommercialStateBlock,
} from "../_shared/prompts/promptParts.ts";

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
  conversationIntelligenceContext: string;
  salesKBSlice: string;
  salesKBSections: string[];
  commercialLevers: string;
  // Decision/readiness
  decision: Record<string, unknown>;
  readinessTotal: number;
  // Commercial state context (holding pattern awareness)
  commercialState?: string;
  touchCount?: number;
  lastChannel?: string;
  lastOutcome?: string;
  daysSinceLastContact?: number;
  warmthScore?: number;
  // Fix 3.2: active playbook (governs tone/content/CTA)
  playbookBlock?: string;
  // Fix 3.3: honest channel declaration (full vs limited context)
  channelDeclaration?: string;
  // Fix (email_address_rules propagation)
  addressCustomPrompt?: string;
  addressCategory?: string;
  // LOVABLE-93: Decision Engine pre-computed context block
  decisionEngineBlock?: string;
}

export function getModel(quality: Quality): string {
  return quality === "fast"
    ? "google/gemini-2.5-flash-lite"
    : "google/gemini-3-flash-preview";
}

export function buildOutreachPrompts(ctx: OutreachPromptContext): { systemPrompt: string; userPrompt: string } {
  const {
    channel: ch, _quality, contact_name, contact_email, company_name, country_code,
    language, goal, base_proposal, _oracle_tone, email_type_id, email_type_prompt, email_type_structure,
    settings, enrichmentSnippet, interlocutorBlock, relationshipBlock, branchBlock, metInPersonContext,
    conversationIntelligenceContext, salesKBSlice, salesKBSections, commercialLevers, decision, readinessTotal,
    commercialState, touchCount, lastChannel, lastOutcome, daysSinceLastContact, warmthScore,
    playbookBlock, channelDeclaration, addressCustomPrompt, addressCategory,
  } = ctx;

  let recipientName = "";
  if (contact_name && isLikelyPersonName(contact_name)) recipientName = contact_name;

  const senderAlias = settings.ai_contact_alias || settings.ai_contact_name || "";
  const senderCompanyAlias = settings.ai_company_alias || settings.ai_company_name || "";

  const detected = getLanguageHint(country_code);
  const effectiveLanguage = language || detected.language;

  // ── Address-specific priority instruction block (shared module) ──
  const addressPriorityBlock = buildAddressPriorityBlock({ addressCustomPrompt, addressCategory });

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
${conversationIntelligenceContext}
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

  // System prompt minimale: identità + contesto operativo dinamico.
  // TUTTE le doctrine (filosofia WCA, language rules, anti-ripetizione, WA gate,
  // zero allucinazioni, lunghezze) vivono nel Prompt Lab DB e vengono iniettate
  // dal loader unificato (operativePromptsLoader). Non duplicarle qui.
  const systemPrompt = `${addressPriorityBlock}${channelDeclaration ? channelDeclaration + "\n\n" : ""}Sei un editor giornalista al servizio di WCA Network. Scrivi UN messaggio per UN destinatario specifico, basandoti sul dossier che ti viene passato.

${channelContext}
Lingua suggerita: ${effectiveLanguage} (${country_code} → ${detected.languageLabel}).
${ch === "email" ? "Formato output: la prima riga DEVE essere 'Subject: <oggetto>' seguita da una riga vuota e dal corpo HTML. La firma è aggiunta dal sistema." : ""}

${playbookBlock ? `${playbookBlock}\n` : ""}
DECISION OBJECT (già presa a monte — esegui, non ridecidere):
${JSON.stringify(decision, null, 2)}
${readinessTotal < 30 ? `\nReadiness score basso (${readinessTotal}/100): preferisci tono neutro e conservativo.` : ""}
${email_type_prompt ? `\nStruttura email (tipo: ${email_type_id}):\n${email_type_prompt}\nFormato: ${email_type_structure || "hook → corpo → CTA"}\n` : ""}`;

  // Commercial state context — shared module (by_state strategy = mappa esplicita 9-stati)
  const commercialBlock = buildCommercialStateBlock({
    commercialState,
    touchCount,
    lastChannel,
    lastOutcome,
    daysSinceLastContact,
    warmthScore,
    toneStrategy: "by_state",
  });

  const userPrompt = `${senderContext}
${recipientContext}
${interlocutorBlock}
${relationshipBlock}
${branchBlock}
${metInPersonContext}
${intelligenceBlock}
${commercialBlock}
GOAL: ${goal || "Proposta di collaborazione nel freight forwarding"}

PROPOSTA: ${base_proposal || "Collaborazione logistica internazionale"}
${commercialLevers ? `\nLEVE COMMERCIALI CONFIGURATE:\n${commercialLevers}\n` : ""}${ctx.decisionEngineBlock ? `\n${ctx.decisionEngineBlock}\n` : ""}
Genera il messaggio completo per il canale ${ch.toUpperCase()}. Applica le tecniche dalla Knowledge Base.`;

  return { systemPrompt, userPrompt };
}
