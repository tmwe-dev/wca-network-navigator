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
  // Fix 1+2: structured email-type metadata propagated from Composer
  email_type_prompt?: string | null;
  email_type_structure?: string | null;
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
  // Fix 3.2: active playbook (governs tone/content/CTA)
  playbookBlock?: string;
  // LOVABLE-93: Decision Engine context injected into generation
  decisionContext?: {
    action: string;
    autonomy: string;
    channel?: string;
    journalist_role?: string;
    reasoning: string;
    priority: number;
    state: {
      leadStatus: string;
      touchCount: number;
      daysSinceLastOutbound: number;
      enrichmentScore: number;
    };
  };
}

// ── Helpers ──

function getProfileTruncation(quality: Quality): { description: number; rawProfile: number } {
  // LOVABLE-77: alzati i limiti — Standard ora 800/2500, Premium 1500/5000.
  // Razionale: Gemini 3 Flash supporta 1M token; meglio dare contesto ricco che tagliare.
  if (quality === "fast") return { description: 200, rawProfile: 0 };
  if (quality === "standard") return { description: 800, rawProfile: 2500 };
  return { description: 1500, rawProfile: 5000 };
}

export interface StrategicAdvisorContext {
  emailCategory?: string;
  hasHistory?: boolean;
  followUpCount?: number;
  hasEnrichmentData?: boolean;
  commercialState?: string;
  touchCount?: number;
  // LOVABLE-77: data points disponibili (aiutano l'AI a scegliere su cosa ancorare il messaggio)
  dataPoints?: {
    hasWebsite?: boolean;
    hasLinkedin?: boolean;
    contactProfilesCount?: number;
    hasSherlock?: boolean;
    bcaCount?: number;
    historyCount?: number;
    hasReputation?: boolean;
    hasProfileDescription?: boolean;
  };
}

export function buildStrategicAdvisor(context: StrategicAdvisorContext): string {
  const phaseContext = context.commercialState
    ? `\n- Fase commerciale: ${context.commercialState} (touch #${context.touchCount || 0})`
    : "";
  const tc = context.touchCount ?? 0;
  const toneGuide = tc === 0
    ? "\n- PRIMO CONTATTO: tono freddo-professionale, breve, CTA basso impegno"
    : tc <= 3
      ? "\n- FOLLOW-UP INIZIALE: tono cordiale, riferirsi a scambi precedenti, aggiungere valore"
      : "\n- RELAZIONE ATTIVA: tono da collega, personalizzazione alta, NON ripetere presentazione";

  // LOVABLE-77: blocco "Data points disponibili" — guida l'AI a scegliere ancore concrete
  const dp = context.dataPoints || {};
  const availableAnchors: string[] = [];
  if (dp.hasProfileDescription) availableAnchors.push("profilo partner (servizi/network/città)");
  if (dp.hasWebsite) availableAnchors.push("sito web (analizzato)");
  if (dp.hasLinkedin) availableAnchors.push("LinkedIn azienda");
  if ((dp.contactProfilesCount ?? 0) > 0) availableAnchors.push(`${dp.contactProfilesCount} decision maker da Deep Search`);
  if (dp.hasSherlock) availableAnchors.push("indagine Sherlock");
  if ((dp.bcaCount ?? 0) > 0) availableAnchors.push(`${dp.bcaCount} incontro/i di persona`);
  if ((dp.historyCount ?? 0) > 0) availableAnchors.push(`${dp.historyCount} touch precedenti`);
  if (dp.hasReputation) availableAnchors.push("reputazione online");

  const totalAnchors = availableAnchors.length;
  const dataPointsBlock = totalAnchors > 0
    ? `
## DATA POINTS DISPONIBILI PER QUESTO PARTNER (${totalAnchors})
${availableAnchors.map((a) => `- ✓ ${a}`).join("\n")}

→ USA ALMENO ${Math.min(2, totalAnchors)} di questi data points come ancore concrete nel messaggio.
→ Cita un servizio specifico letto dal sito, un nome di decision maker da Sherlock, un evento BCA, un servizio di profilo. NON restare generico.
`
    : `
## DATA POINTS DISPONIBILI: NESSUNO
⚠️ Non hai dati specifici su questo partner. Aggiungi tag [GENERIC] nel subject e procedi con presentazione standard onesta.
`;

  return `
# STRATEGIC ADVISOR — Contesto per Decisione Autonoma

Sei un EDITOR GIORNALISTA esperto, non un copywriter generico.
Il tuo lavoro: leggere TUTTO il dossier sul partner (profilo, sito, Sherlock, history, BCA, network),
farti un'idea precisa di chi è l'azienda e di cosa fa, e scrivere un messaggio che dimostri
— senza dirlo esplicitamente — che hai studiato chi hai davanti e che non è un blast generico.

## Contesto:
- Tipo email: ${context.emailCategory || "generico"}
- Storia interazioni disponibile: ${context.hasHistory ? "SÌ" : "NO"}
- Tentativo follow-up: ${context.followUpCount ? `#${context.followUpCount}` : "N/A"}
- Dati enrichment disponibili: ${context.hasEnrichmentData ? "SÌ" : "NO"}${phaseContext}${toneGuide}
${dataPointsBlock}
## Metodo dell'editor:
1. LEGGI: profilo + enrichment + Sherlock + history. Costruisci nella tua testa un ritratto del partner:
   che servizi fa, su che rotte, in che mercato opera, cosa lo distingue, dove può crescere.
2. CONNETTI: collega ciò che il partner fa con ciò che WCA Network offre come vantaggio competitivo
   (vedi sezione "Filosofia WCA" nel system prompt). Trova UNA leva di interesse reale per LUI.
3. SCRIVI: messaggio breve, asciutto, da professionista a professionista. Mai vendita aggressiva,
   mai entusiasmo finto, mai elenchi puntati di feature. Una sola idea forte, ben argomentata.

## Guardrail:
- Se c'è storia interazioni → non ripetere approcci già usati
- Se dati scarsi → resta qualitativo ma vero (NON inventare numeri, %, casi cliente, certificazioni)
- Le tecniche della KB servono a STRUTTURARE (hook, framing, CTA), non a fabbricare prove inesistenti
- Adatta il tono alla fase della relazione (mai forzare familiarità nei primi contatti)
`;
}

export function getModel(quality: Quality): string {
  return quality === "fast"
    ? "google/gemini-2.5-flash-lite"
    : "google/gemini-3-flash-preview";
}

// ── Main builder ──

export interface PromptBlock {
  label: string;
  content: string;
}

export interface BuiltPrompts {
  systemPrompt: string;
  userPrompt: string;
  /** Forge debug: labeled blocks composing the user prompt (in order) */
  blocks: PromptBlock[];
  /** Forge debug: labeled blocks composing the system prompt */
  systemBlocks: PromptBlock[];
}

export function buildEmailPrompts(ctx: EmailPromptContext): BuiltPrompts {
  const {
    partner, contact, contactEmail, quality, settings, networks, services, socialLinks,
    historyContext, relationshipBlock, branchBlock, interlocutorBlock,
    metInPersonContext, cachedEnrichmentContext, documentsContext,
    stylePreferencesContext, editPatternsContext, responseInsightsContext,
    conversationIntelligenceContext,
    salesKBSlice, salesKBSections, _signatureBlock,
    goal, base_proposal, oracle_type, oracle_tone, use_kb, language,
    email_type_prompt, email_type_structure,
    commercialState, touchCount, lastChannel, lastOutcome, daysSinceLastContact, warmthScore,
    playbookBlock,
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

  // Fix 3 (Gap C): no hardcoded fallback — derive from touchCount/commercialState if oracle_type is missing
  const tcFallback = touchCount ?? 0;
  const inferredCategory = tcFallback === 0 ? "primo_contatto" : "follow_up";
  const emailCategory = oracle_type || inferredCategory;
  const prevActCount = historyContext ? (historyContext.match(/\[/g) || []).length : 0;

  // LOVABLE-77: estrai data points dai blocchi caricati per guidare l'AI
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

  // Fix 2 (Gap B): explicit "EMAIL TYPE STRUCTURE" block in system prompt — parallel to Playbook
  const emailTypeStructureBlock = (email_type_prompt || email_type_structure) ? `
# TIPO EMAIL "${emailCategory}" — STRUTTURA E ISTRUZIONI OBBLIGATORIE
${email_type_prompt ? `\n## Istruzioni operative del tipo:\n${email_type_prompt}\n` : ""}${email_type_structure ? `\n## Struttura tattica richiesta:\n${email_type_structure}\n` : ""}
⚠️ Questa struttura è VINCOLANTE: rispetta sezioni, ordine, vincoli di lunghezza e CTA prescritte.
` : "";

  const systemPrompt = `Sei un EDITOR GIORNALISTA esperto al servizio di WCA Network, specializzato in comunicazione B2B nel freight forwarding internazionale.
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

  // Forge debug: track labeled system blocks (for /v2/ai-staff/email-forge)
  const systemBlocks: PromptBlock[] = [];
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

  const goalBlock = `GOAL DELLA COMUNICAZIONE:
${goal || "Presentazione aziendale e proposta di collaborazione"}

PROPOSTA DI BASE:
${base_proposal || "Proposta generica di collaborazione nel settore freight forwarding"}

Genera l'email completa con oggetto e corpo. Applica le tecniche dalla Knowledge Base.`;

  // Forge debug: assemble user prompt as labeled blocks (in order)
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

  // LOVABLE-93: Decision Engine context — informa l'AI della raccomandazione del motore
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
