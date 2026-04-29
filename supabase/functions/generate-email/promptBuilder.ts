/**
 * promptBuilder.ts — System + User prompt composition orchestrator.
 * Delegates to focused modules; orchestrates final prompt assembly.
 */
import type { Quality } from "../_shared/kbSlice.ts";
import { getLanguageHint, isLikelyPersonName } from "../_shared/textUtils.ts";
import { getProfileTruncation, getModel } from "./promptHelpers.ts";
import { buildStrategicAdvisor } from "./strategicAdvisor.ts";
import type { EmailPromptContext, PromptBlock, BuiltPrompts } from "./promptTypes.ts";
import {
  buildAddressPriorityBlock,
  buildCommercialStateBlock,
} from "../_shared/prompts/promptParts.ts";

export type { PartnerData, ContactData, NetworkRow, ServiceRow, SocialLinkRow, EmailPromptContext, StrategicAdvisorContext, PromptBlock, BuiltPrompts } from "./promptTypes.ts";
export { getModel };

export function buildEmailPrompts(ctx: EmailPromptContext): BuiltPrompts {
  const {
    partner, contact, contactEmail, quality, settings, networks, services, socialLinks,
    historyContext, relationshipBlock, branchBlock, interlocutorBlock,
    metInPersonContext, cachedEnrichmentContext, documentsContext,
    stylePreferencesContext, editPatternsContext, responseInsightsContext,
    conversationIntelligenceContext,
    salesKBSlice, salesKBSections, signatureBlock: _signatureBlock,
    goal, base_proposal, oracle_type, oracle_tone, use_kb, language,
    email_type_prompt, email_type_structure,
    commercialState, touchCount, lastChannel, lastOutcome, daysSinceLastContact, warmthScore,
    playbookBlock, addressCustomPrompt, addressCategory,
    operativePromptsBlock, operativePromptsApplied,
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

  // Infer category from touchCount/commercialState if oracle_type is missing
  const tcFallback = touchCount ?? 0;
  const inferredCategory = tcFallback === 0 ? "primo_contatto" : "follow_up";
  const emailCategory = oracle_type || inferredCategory;
  const prevActCount = historyContext ? (historyContext.match(/\[/g) || []).length : 0;

  // LOVABLE-77: extract data points from loaded blocks
  const ce = cachedEnrichmentContext || "";
  const dataPoints = {
    hasWebsite: /INFORMAZIONI SITO AZIENDALE/i.test(ce),
    hasLinkedin: /PROFILO LINKEDIN/i.test(ce),
    contactProfilesCount: (ce.match(/CONTATTI CHIAVE/i) ? (ce.match(/^- /gm) || []).length : 0),
    hasSherlock: /INDAGINE SHERLOCK/i.test(ce),
    bcaCount: metInPersonContext ? (metInPersonContext.match(/Evento:/gi) || []).length : 0,
    historyCount: prevActCount,
    hasReputation: /REPUTAZIONE ONLINE/i.test(ce),
    hasProfileDescription: !!partner.profile_description,
  };

  const strategicAdvisor = buildStrategicAdvisor({
    emailCategory,
    hasHistory: !!historyContext,
    followUpCount: prevActCount,
    hasEnrichmentData: !!cachedEnrichmentContext,
    commercialState,
    touchCount,
    dataPoints,
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

  // Email type structure block
  const emailTypeStructureBlock = (email_type_prompt || email_type_structure) ? `
# TIPO EMAIL "${emailCategory}" — STRUTTURA E ISTRUZIONI OBBLIGATORIE
${email_type_prompt ? `\n## Istruzioni operative del tipo:\n${email_type_prompt}\n` : ""}${email_type_structure ? `\n## Struttura tattica richiesta:\n${email_type_structure}\n` : ""}
⚠️ Questa struttura è VINCOLANTE: rispetta sezioni, ordine, vincoli di lunghezza e CTA prescritte.
` : "";

  // Address-specific priority instruction block (shared module)
  const addressPriorityBlock = buildAddressPriorityBlock({ addressCustomPrompt, addressCategory });

  // System prompt minimale: identità + missione + dossier + contesto.
  // L'identità del MITTENTE è dinamica: viene da app_settings (ai_company_name / ai_contact_*)
  // e NON è hardcoded. Le regole di stile/lunghezza/tono vivono nel Prompt Lab DB (scope "email").
  const senderCompanyForPrompt = senderCompanyAlias || "(azienda mittente non configurata in Settings)";
  const systemPrompt = `${addressPriorityBlock}Sei l'editor che scrive UN messaggio email per UN destinatario, AL SERVIZIO ESCLUSIVO di "${senderCompanyForPrompt}" (questo è il MITTENTE — vedi blocco "Mittente" nel dossier per ruolo, recapiti, settore e knowledge base aziendale).

REGOLA IDENTITÀ (NON NEGOZIABILE):
- Tu rappresenti "${senderCompanyForPrompt}". MAI firmare, citare o lasciare intendere altre aziende come mittente.
- MAI usare nomi di network, alleanze o brand di terzi come identità del mittente, anche se compaiono nel dossier o nella KB. Quei nomi sono CONTESTO, non firma.
- Tutti i pronomi "noi/nostro/la nostra azienda" si riferiscono ESCLUSIVAMENTE a "${senderCompanyForPrompt}".

Leggi il dossier sotto, costruisci nella tua testa il ritratto del destinatario, scegli UNA leva di interesse rilevante per lui, e scrivi. Le regole vincolanti su stile, lunghezza, dati e copywriting arrivano dal Prompt Lab qui sotto — applica quelle.

${operativePromptsBlock ? `\n${operativePromptsBlock}\n` : ""}${playbookBlock ? `\n${playbookBlock}\n` : ""}${emailTypeStructureBlock}${strategicAdvisor}

## Formato di output (l'app fa il parse)
- Prima riga: \`Subject: ...\`
- Corpo in HTML semplice (<p>, <br>, <strong>; <ul>/<li> solo se servono davvero)
- NIENTE firma (la aggiunge il sistema)
- Lingua: ${effectiveLanguage} (${partner.country_code} → ${detected.languageLabel})`;

  // Forge debug: track labeled system blocks
  const systemBlocks: PromptBlock[] = [];
  if (addressCustomPrompt) systemBlocks.push({ label: "Address Custom Prompt (Priority)", content: addressCustomPrompt });
  if (addressCategory) systemBlocks.push({ label: "Address Category (Priority)", content: addressCategory });
  systemBlocks.push({ label: "Identity (Editor)", content: `Editor che scrive a nome di "${senderCompanyForPrompt}". UN messaggio per UN destinatario dopo aver letto il dossier. Trasmette: serietà, personalizzazione vera, standard aziendale del mittente.` });
  systemBlocks.push({ label: "Identità mittente — VINCOLANTE", content: `Mittente esclusivo: "${senderCompanyForPrompt}". Mai firmare/citare altre aziende, network o alleanze come identità del mittente.` });
  systemBlocks.push({ label: "Missione messaggio", content: "Costruire ritratto preciso del partner → scegliere UNA leva di interesse → costruire l'email attorno a quella. Una idea forte, non elenco feature." });
  if (operativePromptsBlock) {
    const appliedLabel = operativePromptsApplied && operativePromptsApplied.length > 0
      ? ` [${operativePromptsApplied.join(" • ")}]`
      : "";
    systemBlocks.push({ label: `Prompt Lab — Operative Prompts (priority)${appliedLabel}`, content: operativePromptsBlock });
  }
  if (playbookBlock) systemBlocks.push({ label: "Playbook (priority)", content: playbookBlock });
  if (emailTypeStructureBlock) systemBlocks.push({ label: `EmailType "${emailCategory}" structure`, content: emailTypeStructureBlock });
  systemBlocks.push({ label: "Strategic Advisor", content: strategicAdvisor });
  systemBlocks.push({ label: "Regole dati", content: "Usa tutti i dati dei blocchi per ritratto + leva. Vietato inventare numeri/casi/certificazioni. Qualitativo se mancano dati." });
  systemBlocks.push({ label: "Stile Editor", content: "Pro-a-pro, asciutto. Apertura osservazione concreta. UNA idea forte. CTA leggera. 80-150 parole. No bullet di feature, no entusiasmo finto." });
  systemBlocks.push({ label: "Ancora obbligatoria", content: `Almeno 1 elemento specifico dal dossier. Se zero dati → tag [GENERIC] nel subject + presentazione onesta di "${senderCompanyForPrompt}".` });
  systemBlocks.push({ label: "Output + Guardrails", content: `Lingua: ${effectiveLanguage} (${partner.country_code} → ${detected.languageLabel}). Subject prima riga, body HTML semplice, firma auto.` });

  // Commercial state context (shared module, by_warmth strategy = legacy generate-email tone heuristic)
  const commercialBlock = buildCommercialStateBlock({
    commercialState,
    touchCount,
    lastChannel,
    lastOutcome,
    daysSinceLastContact,
    warmthScore,
    addressCategory,
    toneStrategy: "by_warmth",
  });

  const goalBlock = `GOAL DELLA COMUNICAZIONE:
${goal || "Presentazione aziendale e proposta di collaborazione"}

PROPOSTA DI BASE:
${base_proposal || "Proposta generica di collaborazione nel settore freight forwarding"}

Genera l'email completa con oggetto e corpo. Applica le tecniche dalla Knowledge Base.`;

  // Assemble user prompt blocks
  const blocks: PromptBlock[] = [];
  blocks.push({ label: "Mittente", content: senderContext });
  blocks.push({ label: "Partner", content: partnerContext });
  blocks.push({ label: "Contatto", content: contactContext });
  if (interlocutorBlock) blocks.push({ label: "Interlocutor", content: interlocutorBlock });
  if (relationshipBlock) blocks.push({ label: "Relationship", content: relationshipBlock });
  if (historyContext) blocks.push({ label: "History", content: historyContext });
  if (branchBlock) blocks.push({ label: "Branch", content: branchBlock });
  if (metInPersonContext) blocks.push({ label: "MetInPerson", content: metInPersonContext });
  if (cachedEnrichmentContext) blocks.push({ label: "CachedEnrichment", content: cachedEnrichmentContext });
  if (documentsContext) blocks.push({ label: "Documents", content: documentsContext });
  if (stylePreferencesContext) blocks.push({ label: "StylePrefs", content: stylePreferencesContext });
  if (editPatternsContext) blocks.push({ label: "EditPatterns", content: editPatternsContext });
  if (responseInsightsContext) blocks.push({ label: "ResponseInsights", content: responseInsightsContext });
  if (conversationIntelligenceContext) blocks.push({ label: "ConvIntel", content: conversationIntelligenceContext });
  if (commercialBlock) blocks.push({ label: "CommercialBlock", content: commercialBlock });

  // LOVABLE-110: Learned patterns (preferenze e regole dal ciclo di apprendimento)
  if (ctx.learnedPatterns) {
    blocks.push({
      label: "LearnedPatterns",
      content: `REGOLE E PREFERENZE APPRESE (rispettale obbligatoriamente):\n${ctx.learnedPatterns}`,
    });
  }

  // Decision engine context
  if (ctx.decisionContext && ctx.decisionContext.action !== "no_action") {
    const dc = ctx.decisionContext;
    const journalistHint = dc.journalist_role
      ? `\n- Giornalista suggerito: ${dc.journalist_role} (adatta tono e strategia a questo ruolo)`
      : "";
    const decisionBlock = `
DECISION ENGINE (raccomandazione automatica del sistema):
- Azione raccomandata: ${dc.action} (priorità: ${dc.priority}/5)
- Motivo: ${dc.reasoning}
- Stato: lead_status="${dc.state.leadStatus}", ${dc.state.touchCount} contatti precedenti, ${dc.state.daysSinceLastOutbound} giorni dall'ultimo invio
- Livello arricchimento: ${dc.state.enrichmentScore}/100${journalistHint}

⚠️ Tieni conto di queste informazioni per calibrare tono, urgenza e contenuto dell'email.`;
    blocks.push({ label: "DecisionEngine", content: decisionBlock });
  }

  blocks.push({ label: "Goal + BaseProposal", content: goalBlock });

  const userPrompt = blocks.map((b) => b.content).join("\n");

  return { systemPrompt, userPrompt, blocks, systemBlocks };
}
