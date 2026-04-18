/**
 * promptBuilder.ts — System + User prompt composition for generate-email.
 * Extracted from index.ts for modularity (Prompt #59).
 */
import type { Quality } from "../_shared/kbSlice.ts";
import { getLanguageHint, isLikelyPersonName } from "../_shared/textUtils.ts";

// ── Types ──

export interface PartnerData {
  id: string | null;
  company_name: string;
  company_alias: string | null;
  country_code: string;
  country_name: string;
  city: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  profile_description: string | null;
  rating: number | null;
  raw_profile_markdown: string | null;
  enrichment_data?: Record<string, unknown>;
  office_type?: string;
  lead_status?: string;
}

export interface ContactData {
  id: string;
  name: string;
  email: string | null;
  direct_phone: string | null;
  mobile: string | null;
  title: string | null;
  contact_alias: string | null;
}

export interface NetworkRow { network_name: string; }
export interface ServiceRow { service_category: string; }
export interface SocialLinkRow { platform: string; url: string; contact_id: string | null; }

export interface EmailPromptContext {
  partner: PartnerData;
  contact: ContactData | null;
  contactEmail: string | null;
  sourceType: string;
  quality: Quality;
  language?: string;
  goal?: string;
  base_proposal?: string;
  oracle_type?: string;
  oracle_tone?: string;
  use_kb?: boolean;
  networks: NetworkRow[];
  services: ServiceRow[];
  socialLinks: SocialLinkRow[];
  settings: Record<string, string>;
  // Contextual blocks (pre-built by contextAssembler)
  historyContext: string;
  relationshipBlock: string;
  branchBlock: string;
  interlocutorBlock: string;
  metInPersonContext: string;
  cachedEnrichmentContext: string;
  documentsContext: string;
  stylePreferencesContext: string;
  editPatternsContext: string;
  responseInsightsContext: string;
  conversationIntelligenceContext: string;
  salesKBSlice: string;
  salesKBSections: string[];
  signatureBlock: string;
  // Commercial state context (holding pattern awareness)
  commercialState?: string;
  touchCount?: number;
  lastChannel?: string;
  lastOutcome?: string;
  daysSinceLastContact?: number;
  warmthScore?: number;
}

// ── Helpers ──

function getProfileTruncation(quality: Quality): { description: number; rawProfile: number } {
  if (quality === "fast") return { description: 200, rawProfile: 0 };
  if (quality === "standard") return { description: 500, rawProfile: 1000 };
  return { description: 1000, rawProfile: 3000 };
}

export function buildStrategicAdvisor(context: {
  emailCategory?: string;
  hasHistory?: boolean;
  followUpCount?: number;
  hasEnrichmentData?: boolean;
  commercialState?: string;
  touchCount?: number;
}): string {
  const phaseContext = context.commercialState
    ? `\n- Fase commerciale: ${context.commercialState} (touch #${context.touchCount || 0})`
    : "";
  const tc = context.touchCount ?? 0;
  const toneGuide = tc === 0
    ? "\n- PRIMO CONTATTO: tono freddo-professionale, breve, CTA basso impegno"
    : tc <= 3
      ? "\n- FOLLOW-UP INIZIALE: tono cordiale, riferirsi a scambi precedenti, aggiungere valore"
      : "\n- RELAZIONE ATTIVA: tono da collega, personalizzazione alta, NON ripetere presentazione";

  return `
# STRATEGIC ADVISOR — Contesto per Decisione Autonoma

Hai accesso a una Knowledge Base di tecniche di vendita, negoziazione e comunicazione B2B.
Seleziona autonomamente le tecniche più appropriate in base al contesto sottostante.

## Contesto:
- Tipo email: ${context.emailCategory || "generico"}
- Storia interazioni disponibile: ${context.hasHistory ? "SÌ" : "NO"}
- Tentativo follow-up: ${context.followUpCount ? `#${context.followUpCount}` : "N/A"}
- Dati enrichment disponibili: ${context.hasEnrichmentData ? "SÌ" : "NO"}${phaseContext}${toneGuide}

## Guardrail:
- Se c'è storia interazioni → non ripetere approcci già usati
- Se dati enrichment scarsi → resta generico ma vero
- Ogni comunicazione deve portare VALORE NUOVO
- Adattare il tono alla fase della relazione (mai forzare familiarità in FASE 1-2)
`;
}

export function getModel(quality: Quality): string {
  return quality === "fast"
    ? "google/gemini-2.5-flash-lite"
    : "google/gemini-3-flash-preview";
}

// ── Main builder ──

export function buildEmailPrompts(ctx: EmailPromptContext): { systemPrompt: string; userPrompt: string } {
  const {
    partner, contact, contactEmail, quality, settings, networks, services, socialLinks,
    historyContext, relationshipBlock, branchBlock, interlocutorBlock,
    metInPersonContext, cachedEnrichmentContext, documentsContext,
    stylePreferencesContext, editPatternsContext, responseInsightsContext,
    conversationIntelligenceContext,
    salesKBSlice, salesKBSections, _signatureBlock,
    goal, base_proposal, oracle_type, oracle_tone, use_kb, language,
    commercialState, touchCount, lastChannel, lastOutcome, daysSinceLastContact, warmthScore,
  } = ctx;

  // Resolve names
  let recipientName = "";
  if (contact) {
    const alias = contact.contact_alias;
    const name = contact.name;
    if (alias && isLikelyPersonName(alias)) recipientName = alias;
    else if (name && isLikelyPersonName(name)) recipientName = name;
  }
  const recipientCompany = partner.company_alias || partner.company_name;
  const senderAlias = settings.ai_contact_alias || settings.ai_contact_name || "";
  const senderCompanyAlias = settings.ai_company_alias || settings.ai_company_name || "";

  const trunc = getProfileTruncation(quality);

  // LinkedIn context (premium only)
  let linkedinContext = "";
  if (quality === "premium") {
    const companyLinkedIn = socialLinks.find((l) => l.platform === "linkedin" && !l.contact_id);
    const contactLinkedIn = contact
      ? socialLinks.find((l) => l.platform === "linkedin" && l.contact_id === contact.id)
      : null;
    if (companyLinkedIn || contactLinkedIn) {
      linkedinContext = "\nLINKEDIN:\n";
      if (companyLinkedIn) linkedinContext += `- Azienda: ${companyLinkedIn.url}\n`;
      if (contactLinkedIn) linkedinContext += `- Contatto: ${contactLinkedIn.url}\n`;
    }
  }

  const partnerContext = `
AZIENDA DESTINATARIA:
- Nome: ${recipientCompany}${partner.company_name !== recipientCompany ? ` (ragione sociale: ${partner.company_name})` : ""}
- Città: ${partner.city}, ${partner.country_name} (${partner.country_code})
${quality !== "fast" ? `- Sito web: ${partner.website || "N/A"}` : ""}
- Email: ${contactEmail}
${quality !== "fast" ? `- Rating: ${partner.rating ? `${partner.rating}/5` : "N/A"}` : ""}
- Network: ${networks.map((n) => n.network_name).join(", ") || "N/A"}
${quality !== "fast" ? `- Servizi: ${services.map((s) => s.service_category.replace(/_/g, " ")).join(", ") || "N/A"}` : ""}
${trunc.description > 0 && partner.profile_description ? `- Descrizione: ${partner.profile_description.substring(0, trunc.description)}` : ""}
${trunc.rawProfile > 0 && partner.raw_profile_markdown ? `\nPROFILO COMPLETO (estratto):\n${partner.raw_profile_markdown.substring(0, trunc.rawProfile)}` : ""}
${linkedinContext}`;

  const contactContext = contact ? `
CONTATTO DESTINATARIO:
${recipientName ? `- Nome persona: ${recipientName}` : `- Nome persona: non disponibile`}
- Ruolo: ${contact.title || "N/A"}
- Email: ${contact.email || contactEmail}
${quality !== "fast" ? `- Telefono: ${contact.direct_phone || contact.mobile || "N/A"}` : ""}
` : `NOTA: Nessun contatto selezionato.`;

  const emailCategory = oracle_type || "primo_contatto";
  const prevActCount = historyContext ? (historyContext.match(/\[/g) || []).length : 0;

  const strategicAdvisor = buildStrategicAdvisor({
    emailCategory,
    hasHistory: !!historyContext,
    followUpCount: prevActCount,
    hasEnrichmentData: !!cachedEnrichmentContext,
    commercialState,
    touchCount,
  });

  const senderContext = `
MITTENTE (TU):
- Nome da usare: ${senderAlias}
- Azienda: ${senderCompanyAlias}
- Ruolo: ${settings.ai_contact_role || "N/A"}
- Email: ${settings.ai_email_signature || "N/A"}
${quality !== "fast" ? `- Telefono: ${settings.ai_phone_signature || "N/A"}` : ""}
- Settore: ${settings.ai_sector || "freight_forwarding"}
- Network: ${settings.ai_networks || "N/A"}

KNOWLEDGE BASE AZIENDALE:
${use_kb !== false ? (settings.ai_knowledge_base || "Non configurata") : "(Knowledge Base disattivata dall'utente)"}
${use_kb !== false && salesKBSlice ? `\n# ARSENAL STRATEGICO (${salesKBSections.join(", ") || "legacy"}):\nLeggi ATTENTAMENTE queste tecniche e APPLICALE nel messaggio.\n\n${salesKBSlice}\n` : ""}
STILE DI COMUNICAZIONE:
- Tono: ${oracle_tone || settings.ai_tone || "professionale"}
- Lingua: ${settings.ai_language || "italiano"}
${settings.ai_style_instructions ? `- Istruzioni: ${settings.ai_style_instructions}` : ""}
${settings.ai_sector_notes ? `- Note settoriali: ${settings.ai_sector_notes}` : ""}
`;

  const detected = getLanguageHint(partner.country_code);
  const effectiveLanguage = language || detected.language;

  const systemPrompt = `Sei un esperto stratega di vendita B2B nel settore della logistica e del freight forwarding internazionale.
Hai accesso a una Knowledge Base di tecniche — seleziona autonomamente quelle più adatte al contesto.

${strategicAdvisor}

## Formato output:
- Prima riga: "Subject: ..." (testo puro)
- Corpo in HTML semplice (<p>, <br>, <strong>, <ul>/<li>)
- La firma viene aggiunta automaticamente — non includerla.

## Guardrail:
- Lingua: ${effectiveLanguage} (${partner.country_code} → ${detected.languageLabel})
- Usa alias/nome breve nel saluto, mai nome completo
- Zero allucinazioni: usa SOLO dati forniti`;

  // Commercial state context (holding pattern + tone modulation)
  let commercialBlock = "";
  if (commercialState !== undefined || touchCount !== undefined) {
    const tc = touchCount || 0;
    const ws = warmthScore ?? 0;
    const toneInstruction = tc === 0
      ? "PRIMO CONTATTO: Tono freddo-professionale. Breve. CTA basso impegno. NON vendere."
      : tc <= 3 && ws < 50
      ? "FOLLOW-UP INIZIALE: Tono cordiale. Riferirsi al contatto precedente. Aggiungere valore. NON ripetere presentazione."
      : tc > 3 && ws < 50
      ? "NURTURING: Tono amichevole. Focus su insight di valore. Mostrare competenza."
      : "RELAZIONE CALDA: Tono da collega/amico professionale. Personalizzazione alta. Proposte concrete.";
    commercialBlock = `\n--- STATO COMMERCIALE ---
- Fase: ${(commercialState || "new").toUpperCase()}
- Contatti totali inviati: ${tc}
- Ultimo canale: ${lastChannel || "nessuno"}
- Ultimo esito: ${lastOutcome || "n/a"}
- Giorni dall'ultimo contatto: ${daysSinceLastContact ?? "n/a"}
- Calore relazione: ${ws}/100

ISTRUZIONI TONO: ${toneInstruction}
`;
  }

  const userPrompt = `${senderContext}

${partnerContext}

${contactContext}
${interlocutorBlock}
${relationshipBlock}
${historyContext}
${branchBlock}
${metInPersonContext}
${cachedEnrichmentContext}
${documentsContext}
${stylePreferencesContext}
${editPatternsContext}
${responseInsightsContext}
${conversationIntelligenceContext}
${commercialBlock}
GOAL DELLA COMUNICAZIONE:
${goal || "Presentazione aziendale e proposta di collaborazione"}

PROPOSTA DI BASE:
${base_proposal || "Proposta generica di collaborazione nel settore freight forwarding"}

Genera l'email completa con oggetto e corpo. Applica le tecniche dalla Knowledge Base.`;

  return { systemPrompt, userPrompt };
}
