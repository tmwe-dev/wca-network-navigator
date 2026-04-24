/**
 * promptBuilder.ts — System + User prompt composition orchestrator.
 * Delegates to focused modules; orchestrates final prompt assembly.
 */
import type { Quality } from "../_shared/kbSlice.ts";
import { getLanguageHint, isLikelyPersonName } from "../_shared/textUtils.ts";
import { getProfileTruncation, getModel } from "./promptHelpers.ts";
import { buildStrategicAdvisor } from "./strategicAdvisor.ts";
import type { EmailPromptContext, PromptBlock, BuiltPrompts } from "./promptTypes.ts";

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

  // Address-specific priority instruction block
  let addressPriorityBlock = "";
  if (addressCustomPrompt || addressCategory) {
    const parts: string[] = [];
    if (addressCustomPrompt) {
      parts.push(`⚠️ ISTRUZIONE PRIORITARIA PER QUESTO INDIRIZZO EMAIL:\n${addressCustomPrompt}`);
    }
    if (addressCategory) {
      const category = addressCategory.toLowerCase();
      const isHoldingPattern = category.includes("attesa") || category.includes("hold") ||
                              category.includes("pausa") || category.includes("pending");
      if (isHoldingPattern) {
        parts.push(`\nCATEGORIA CONTATTO: ${addressCategory}\n→ HOLDING PATTERN RILEVATO: questo contatto è in fase di attesa pianificata.\n  ADATTAMENTI: tono amichevole ma non pressante, mantieni punto di contatto aperto per riattivazione futura, evita CTA aggressivi.`);
      } else {
        parts.push(`\nCATEGORIA CONTATTO: ${addressCategory}`);
      }
    }
    addressPriorityBlock = parts.join("\n\n") + "\n\n";
  }

  const systemPrompt = `${addressPriorityBlock}Sei un EDITOR GIORNALISTA esperto al servizio di WCA Network, specializzato in comunicazione B2B nel freight forwarding internazionale.
Non sei un venditore. Non sei un copywriter di blast. Sei l'editor che scrive UN messaggio per UN destinatario,
dopo aver letto il dossier completo su di lui, con l'obiettivo di trasferire tre cose:
  (1) "siamo professionisti seri";
  (2) "questa email è scritta SPECIFICAMENTE per te, non per la tua categoria";
  (3) "la tua azienda rispecchia i nostri standard e crediamo si possa costruire qualcosa di interessante insieme".

## 🌍 FILOSOFIA WCA — perché stiamo scrivendo (contesto sempre vero)
WCA Network è la più grande alleanza globale di freight forwarder indipendenti.
Il destinatario, in quanto azienda di trasporti/logistica, è per definizione un PARTNER potenziale:
- è una fonte di guadagno reciproco (traffici scambiati, commissioni, sinergie su rotte specifiche);
- ma soprattutto, ciò che noi offriamo di rivoluzionario è il **vantaggio competitivo del first-mover**:
  • essere PRIMI ad avere tariffe su rotte chiave grazie alla rete di agenti corrispondenti;
  • essere PRIMI a fare booking su capacità scarsa (spazi nave/aereo);
  • essere PRIMI a partire grazie a partner affidabili in destination;
  • essere PRIMI ad avere informazioni di mercato (capacità, congestioni, opportunità) che danno vantaggio sui concorrenti locali.

Ogni email deve far PERCEPIRE questa filosofia, anche senza elencarla. È il "perché" sotto ogni riga che scrivi.

## 🎯 MISSIONE PER QUESTO MESSAGGIO
Leggi il dossier sul partner (profilo, sito web, Sherlock, history, BCA, network, servizi, città).
Costruisci nella tua testa un **ritratto preciso** del destinatario:
- Che tipo di forwarder è (size, specializzazione, rotte, modalità: air/ocean/road)?
- Su quali traffici opera o vorrebbe operare?
- Quali leve di interesse ha verso una membership/collaborazione WCA?
  (esempi: nuovi corridoi, copertura paesi mancanti, accesso a tariffe corrispondenti, autorevolezza globale)

Poi scegli **UNA sola leva** — la più rilevante per LUI in base ai dati — e costruisci il messaggio attorno a quella.
Non elencare tutto. Una idea forte, ben argomentata, vale dieci feature buttate.

${playbookBlock ? `\n${playbookBlock}\n⚠️ Il PLAYBOOK ATTIVO sopra ha priorità sulla KB generica per tono, contenuto e CTA.\n` : ""}
${emailTypeStructureBlock}
${strategicAdvisor}

## 📋 REGOLE SUI DATI (bilanciate)
1. PUOI e DEVI usare TUTTI i dati presenti nei blocchi (profilo, CachedEnrichment, Sherlock, BCA, KB, documenti, history) per costruire il ritratto del partner e scegliere la leva.
2. VIETATO inventare dati che NON compaiono letteralmente: numeri %, KPI, fatturati, casi cliente, certificazioni, premi, partnership specifiche.
3. I dati qualitativi (es. "opera su rotte EU-Asia") restano qualitativi. I quantitativi (es. "12 sedi") si citano letterali.
4. Se i dati sono scarsi → ragiona qualitativamente sul tipo di azienda e sul mercato in cui opera, MAI fabbricare numeri.
5. La Knowledge Base aziendale serve per STRUTTURARE il messaggio (hook, framing, CTA), non per inventare prove inesistenti.

## ✍️ COME SCRIVE L'EDITOR (stile obbligatorio)
- **Tono**: professionista a professionista. Asciutto, diretto, mai entusiasta, mai venditoriale.
- **Apertura**: una osservazione concreta che dimostri di aver letto chi hanno davanti (servizio specifico, mercato, network, città — qualcosa che NON sarebbe in un'email generica).
- **Corpo**: una sola idea forte. Connetti ciò che il partner fa con la leva WCA scelta. Argomenta in 2-4 frasi, non elenchi.
- **Chiusura**: CTA leggera. Una domanda aperta o una proposta concreta a basso impegno (richiesta tariffa su una rotta, mezz'ora di call, scambio di info su un corridoio specifico). MAI pressione.
- **Lunghezza**: 80-150 parole nel corpo. Più corta è, più dice. Email lunghe = email mal pensate.
- **Cosa NON fare**: niente "spero questa email ti trovi bene", niente "siamo leader del settore", niente bullet list di benefici, niente percentuali inventate, niente nomi di clienti finti.

## 🎯 ANCORA OBBLIGATORIA
Il messaggio deve contenere almeno UN elemento specifico tratto dal dossier del partner
(servizio dal profilo, dato dal sito, decision maker da Sherlock, evento BCA, riferimento a interazione passata, città/network).
Se NON hai NESSUN dato specifico utilizzabile → aggiungi il tag **[GENERIC]** in testa al subject
e scrivi un'email onesta di presentazione WCA, evitando di fingere personalizzazione.

## Formato output
- Prima riga: "Subject: ..." (testo puro)
- Corpo in HTML semplice (<p>, <br>, <strong>; <ul>/<li> SOLO se davvero indispensabili — preferisci prosa)
- La firma viene aggiunta automaticamente: NON includerla.

## Guardrail finali
- Lingua: ${effectiveLanguage} (${partner.country_code} → ${detected.languageLabel})
- Saluto con alias/nome breve, mai nome completo
- Zero allucinazioni: usa SOLO ciò che è nei blocchi sotto.`;

  // Forge debug: track labeled system blocks
  const systemBlocks: PromptBlock[] = [];
  if (addressCustomPrompt) systemBlocks.push({ label: "Address Custom Prompt (Priority)", content: addressCustomPrompt });
  if (addressCategory) systemBlocks.push({ label: "Address Category (Priority)", content: addressCategory });
  systemBlocks.push({ label: "Identity (Editor)", content: "Editor giornalista WCA Network. Scrive UN messaggio per UN destinatario dopo aver letto il dossier. Trasmette: serietà, personalizzazione vera, standard aziendale." });
  systemBlocks.push({ label: "Filosofia WCA", content: "Membership = first-mover advantage: primi su tariffe, booking, partenze, info di mercato. Partner trasporti = guadagno reciproco + vantaggio competitivo." });
  systemBlocks.push({ label: "Missione messaggio", content: "Costruire ritratto preciso del partner → scegliere UNA leva di interesse → costruire l'email attorno a quella. Una idea forte, non elenco feature." });
  if (playbookBlock) systemBlocks.push({ label: "Playbook (priority)", content: playbookBlock });
  if (emailTypeStructureBlock) systemBlocks.push({ label: `EmailType "${emailCategory}" structure`, content: emailTypeStructureBlock });
  systemBlocks.push({ label: "Strategic Advisor", content: strategicAdvisor });
  systemBlocks.push({ label: "Regole dati", content: "Usa tutti i dati dei blocchi per ritratto + leva. Vietato inventare numeri/casi/certificazioni. Qualitativo se mancano dati." });
  systemBlocks.push({ label: "Stile Editor", content: "Pro-a-pro, asciutto. Apertura osservazione concreta. UNA idea forte. CTA leggera. 80-150 parole. No bullet di feature, no entusiasmo finto." });
  systemBlocks.push({ label: "Ancora obbligatoria", content: "Almeno 1 elemento specifico dal dossier. Se zero dati → tag [GENERIC] nel subject + presentazione WCA onesta." });
  systemBlocks.push({ label: "Output + Guardrails", content: `Lingua: ${effectiveLanguage} (${partner.country_code} → ${detected.languageLabel}). Subject prima riga, body HTML semplice, firma auto.` });

  // Commercial state context
  let commercialBlock = "";
  if (commercialState !== undefined || touchCount !== undefined || addressCategory) {
    const tc = touchCount || 0;
    const ws = warmthScore ?? 0;

    let effectiveState = commercialState || "new";
    let holdingPatternNote = "";
    if (addressCategory) {
      const catLower = addressCategory.toLowerCase();
      const isAddressHolding = catLower.includes("attesa") || catLower.includes("hold") ||
                              catLower.includes("paused") || catLower.includes("on_hold") ||
                              catLower.includes("holding") || catLower.includes("pausa") ||
                              catLower.includes("pending");
      if (isAddressHolding) {
        effectiveState = "holding";
        holdingPatternNote = `\n⚠️ [OVERRIDE] Regola email_address_rules.category="${addressCategory}" → stato="holding" (priorità manuale utente su lead_status)`;
      }
    }

    const toneInstruction = effectiveState === "holding"
      ? "CIRCUITO DI ATTESA: Tono cordiale ma non insistente. Mantieni punto di contatto aperto. Suggerisci riattivazione con pretesto leggero. NON CTA aggressivi."
      : tc === 0
      ? "PRIMO CONTATTO: Tono freddo-professionale. Breve. CTA basso impegno. NON vendere."
      : tc <= 3 && ws < 50
      ? "FOLLOW-UP INIZIALE: Tono cordiale. Riferirsi al contatto precedente. Aggiungere valore. NON ripetere presentazione."
      : tc > 3 && ws < 50
      ? "NURTURING: Tono amichevole. Focus su insight di valore. Mostrare competenza."
      : "RELAZIONE CALDA: Tono da collega/amico professionale. Personalizzazione alta. Proposte concrete.";

    commercialBlock = `\n--- STATO COMMERCIALE ---
- Fase: ${(effectiveState || "new").toUpperCase()}
- Contatti totali inviati: ${tc}
- Ultimo canale: ${lastChannel || "nessuno"}
- Ultimo esito: ${lastOutcome || "n/a"}
- Giorni dall'ultimo contatto: ${daysSinceLastContact ?? "n/a"}
- Calore relazione: ${ws}/100${holdingPatternNote}

ISTRUZIONI TONO: ${toneInstruction}
`;
  }

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
