/**
 * promptRubrics — rubriche di valutazione esplicite per ogni tipo di blocco del Prompt Lab.
 *
 * Le rubriche dicono al modello (e al validatore post-output) cosa rende un blocco "buono"
 * per quella specifica funzione runtime: must-have, must-not, lunghezza target, struttura,
 * esempi positivi e negativi.
 *
 * Risolve il gap "il modello non sa cosa va bene/no": invece di una frase generica
 * tipo "migliora", riceve criteri operativi specifici per quel kind di sorgente.
 */
import type { BlockSource } from "./types";

export interface PromptRubric {
  /** Nome leggibile (es. "System Prompt globale", "Voice Agent ElevenLabs"). */
  kindLabel: string;
  /** Descrizione runtime di alto livello. */
  purpose: string;
  /** Lunghezza obiettivo in caratteri (range minimo/massimo). */
  targetLengthChars: { min: number; max: number };
  /** Cosa DEVE contenere o rispettare. */
  mustHave: string[];
  /** Cosa NON deve mai contenere/fare. */
  mustNotHave: string[];
  /** Struttura suggerita (sezioni, ordine). */
  structure: string;
  /** Esempio positivo (≤200 char). */
  goodExample: string;
  /** Esempio negativo + motivo. */
  badExample: { text: string; why: string };
}

/**
 * Resolver: dato un BlockSource, ritorna la rubrica corretta.
 * Caso speciale: se source è agent_persona+custom_tone_prompt e il tab è "voice",
 * usa la rubrica voce (gestito a livello chiamante via `forceVoiceRubric`).
 */
export function resolveRubric(source: BlockSource, opts?: { forceVoice?: boolean }): PromptRubric {
  if (opts?.forceVoice) return RUBRIC_VOICE;

  switch (source.kind) {
    case "app_setting":
      // System prompt blocks o email_oracle_types
      if (source.key === "system_prompt_blocks") return RUBRIC_SYSTEM_PROMPT_BLOCK;
      if (source.key === "email_oracle_types") return RUBRIC_EMAIL_TYPE;
      return RUBRIC_GENERIC;
    case "kb_entry":
      return RUBRIC_KB_DOCTRINE;
    case "operative_prompt":
      return RUBRIC_OPERATIVE[source.field] ?? RUBRIC_GENERIC;
    case "email_prompt":
      return source.field === "instructions" ? RUBRIC_EMAIL_INSTRUCTIONS : RUBRIC_GENERIC;
    case "email_address_rule":
      return source.field === "custom_prompt" ? RUBRIC_EMAIL_ADDRESS_RULE : RUBRIC_NOTES;
    case "playbook":
      if (source.field === "prompt_template") return RUBRIC_PLAYBOOK_PROMPT;
      if (source.field === "description") return RUBRIC_PLAYBOOK_DESCRIPTION;
      return RUBRIC_GENERIC;
    case "agent_persona":
      if (source.field === "custom_tone_prompt") return RUBRIC_PERSONA_TONE;
      if (source.field === "signature_template") return RUBRIC_SIGNATURE;
      return RUBRIC_GENERIC;
    case "agent":
      return RUBRIC_AGENT_SYSTEM_PROMPT;
    default:
      return RUBRIC_GENERIC;
  }
}

/** Trasforma una rubrica in stringa da iniettare nel prompt utente. */
export function rubricToPromptSection(r: PromptRubric): string {
  return `=== RUBRICA DI VALUTAZIONE PER QUESTO BLOCCO (${r.kindLabel}) ===
Funzione runtime: ${r.purpose}
Lunghezza obiettivo: ${r.targetLengthChars.min}-${r.targetLengthChars.max} caratteri.
Struttura attesa: ${r.structure}

DEVE contenere/rispettare:
${r.mustHave.map((x) => `  • ${x}`).join("\n")}

NON deve mai contenere:
${r.mustNotHave.map((x) => `  ✗ ${x}`).join("\n")}

Esempio BUONO: «${r.goodExample}»
Esempio CATTIVO: «${r.badExample.text}» — perché: ${r.badExample.why}`;
}

/** Validatore deterministico post-output. Ritorna lista violazioni vuote se ok. */
export function validateAgainstRubric(text: string, r: PromptRubric): string[] {
  const issues: string[] = [];
  const len = text.trim().length;
  if (len < r.targetLengthChars.min) {
    issues.push(`troppo corto: ${len} char (minimo ${r.targetLengthChars.min})`);
  }
  if (len > r.targetLengthChars.max) {
    issues.push(`troppo lungo: ${len} char (massimo ${r.targetLengthChars.max})`);
  }
  // Validazione voce: niente markdown bullet/heading aggressivi che rovinano TTS.
  if (r.kindLabel.toLowerCase().includes("voice")) {
    if (/^\s*[-*]\s/m.test(text) || /^\s*#{1,6}\s/m.test(text)) {
      issues.push("contiene markdown bullet/heading: degrada la prosodia TTS");
    }
  }
  // Email: deve avere almeno una CTA implicita (verbo all'imperativo o domanda).
  if (r.kindLabel.toLowerCase().includes("email") && !/\?|risponda|conferm|fissi|prenoti|scelga|mi dica|valuti/i.test(text)) {
    issues.push("nessuna CTA riconoscibile (domanda o verbo d'azione)");
  }
  return issues;
}

// ─────────── RUBRICHE ───────────

const RUBRIC_SYSTEM_PROMPT_BLOCK: PromptRubric = {
  kindLabel: "System Prompt globale (blocco)",
  purpose: "Componente del prompt assemblato in tutti gli agenti AI prima di ogni generazione (LUCA, Director, agenti commerciali).",
  targetLengthChars: { min: 80, max: 600 },
  mustHave: [
    "Istruzioni operative o regole di governo, non descrizioni decorative",
    "Riferimento esplicito a comportamenti misurabili",
    "Coerenza con la dottrina commerciale 9 stati",
  ],
  mustNotHave: [
    "Esempi conversazionali lunghi (vanno in operative_prompts)",
    "Frasi vaghe tipo \"sii utile\", \"fai del tuo meglio\"",
    "Riferimenti a tool che non esistono in agent-execute",
  ],
  structure: "Una/due frasi di regola seguite da elenco numerato di vincoli quando servono più clausole.",
  goodExample: "Mai inviare comunicazioni senza approvazione esplicita. Per email: bozza → review → invio. Per WhatsApp: solo se lead_status >= engaged.",
  badExample: { text: "Sii sempre gentile e prova a fare del tuo meglio.", why: "non operativo, non misurabile, nessun vincolo" },
};

const RUBRIC_KB_DOCTRINE: PromptRubric = {
  kindLabel: "KB Doctrine entry",
  purpose: "Voce knowledge base caricata dall'assembler in tutti gli agenti come regola di governo prima delle azioni.",
  targetLengthChars: { min: 100, max: 1200 },
  mustHave: [
    "Una REGOLA centrale chiara in apertura",
    "Una PROCEDURA o condizione di applicazione",
    "Almeno un caso edge o eccezione",
  ],
  mustNotHave: [
    "Tono narrativo o discorsivo da articolo",
    "Duplicazione di altre voci doctrine già presenti",
    "Riferimenti a pagine UI specifiche (cambia il prodotto)",
  ],
  structure: "REGOLA: <una frase>\\nPROCEDURA: <step o condizione>\\nECCEZIONE: <quando non si applica>",
  goodExample: "REGOLA: Nessun outbound a partner blacklisted. PROCEDURA: pre-send check su blacklist_entries.matched_partner_id. ECCEZIONE: solo email di chiarimento legale autorizzata da admin.",
  badExample: { text: "È importante essere sempre cauti con i partner sospetti.", why: "non specifica trigger, procedura né eccezione" },
};

const RUBRIC_OPERATIVE: Record<"objective" | "procedure" | "criteria" | "context" | "examples", PromptRubric> = {
  objective: {
    kindLabel: "Operative Prompt — Objective",
    purpose: "Dichiarazione di scopo del prompt operativo, letta da Email Composer/Cockpit/Outreach.",
    targetLengthChars: { min: 40, max: 250 },
    mustHave: ["Verbo d'azione + risultato osservabile", "Stakeholder destinatario"],
    mustNotHave: ["Procedura passo-passo (va in 'procedure')", "Condizioni (vanno in 'criteria')"],
    structure: "Una frase: «Permettere a [chi] di [cosa] per [risultato]».",
    goodExample: "Permettere all'agente commerciale di generare un primo-contatto via email che ottenga risposta entro 7 giorni.",
    badExample: { text: "Generare email.", why: "manca chi ne beneficia, manca il risultato misurabile" },
  },
  procedure: {
    kindLabel: "Operative Prompt — Procedure",
    purpose: "Step-by-step che l'AI deve seguire per produrre l'output richiesto.",
    targetLengthChars: { min: 100, max: 800 },
    mustHave: ["Step numerati o ordinati", "Ogni step ha un output verificabile"],
    mustNotHave: ["Frasi tipo \"se necessario\" senza condizione", "Salti di logica non spiegati"],
    structure: "1) <azione> → <output>\\n2) <azione> → <output>\\n...",
    goodExample: "1) Leggi partner.country e contatto.role 2) Carica KB doctrine per quel paese 3) Componi subject in lingua locale 4) Body con CTA singola.",
    badExample: { text: "Fai una bella email personalizzata.", why: "nessuno step, nessun output verificabile" },
  },
  criteria: {
    kindLabel: "Operative Prompt — Criteria",
    purpose: "Criteri di accettazione che l'output deve soddisfare prima di essere mostrato all'operatore.",
    targetLengthChars: { min: 60, max: 500 },
    mustHave: ["Almeno 3 criteri verificabili", "Almeno una condizione di rifiuto"],
    mustNotHave: ["Criteri soggettivi non misurabili"],
    structure: "Lista di check binari: «✓ subject < 60 char», «✓ una sola CTA», «✗ non contiene placeholder non risolti».",
    goodExample: "✓ subject ≤ 60 char, ✓ una sola CTA, ✓ tono coerente con persona, ✗ niente {{placeholder}} residui.",
    badExample: { text: "Deve essere bella e convincente.", why: "non verificabile" },
  },
  context: {
    kindLabel: "Operative Prompt — Context",
    purpose: "Contesto di business da iniettare quando il prompt è eseguito.",
    targetLengthChars: { min: 60, max: 600 },
    mustHave: ["Riferimenti ai dati DB rilevanti (campi/tabelle)", "Vincoli temporali/territoriali se applicabili"],
    mustNotHave: ["Informazioni statiche che cambiano (date, nomi persone)"],
    structure: "Quali tabelle leggere, quali filtri applicare, quale stato del lead considerare.",
    goodExample: "Leggi partners.country, partners.last_contact_at, partner_contacts.role. Considera solo lead in stato holding o engaged.",
    badExample: { text: "Considera il contesto attuale.", why: "non dice quale contesto né quali dati" },
  },
  examples: {
    kindLabel: "Operative Prompt — Examples",
    purpose: "Esempi few-shot di output corretti per guidare il modello.",
    targetLengthChars: { min: 100, max: 1500 },
    mustHave: ["Almeno 2 esempi completi input→output", "Coerenza con criteria"],
    mustNotHave: ["Esempi che violano i criteria del prompt stesso"],
    structure: "INPUT: <…>\\nOUTPUT: <…>\\n---\\nINPUT: <…>\\nOUTPUT: <…>",
    goodExample: "INPUT: partner FR, primo contatto. OUTPUT subject: \"Optimisation logistique pour {{company}}\" body: ...",
    badExample: { text: "Esempio: scrivere bene.", why: "nessun input, nessun output strutturato" },
  },
};

const RUBRIC_EMAIL_TYPE: PromptRubric = {
  kindLabel: "Email Type prompt",
  purpose: "Definisce TIPO di email (cold, follow-up, holding, recovery) e ne governa generazione in Email Forge.",
  targetLengthChars: { min: 80, max: 500 },
  mustHave: ["Tipo email esplicito", "Tono", "Struttura corpo (apertura/valore/CTA)", "Una sola CTA"],
  mustNotHave: ["Più di una CTA", "Promesse commerciali non autorizzate", "Markdown nel corpo"],
  structure: "TIPO: <…>\\nTONO: <…>\\nSTRUTTURA: hook → valore → CTA singola\\nVINCOLI: <…>",
  goodExample: "TIPO: follow-up dopo silenzio 7gg. TONO: professionale, curioso. STRUTTURA: 1 frase hook su loro contesto, 1 frase valore concreto, 1 domanda chiusa. VINCOLI: ≤80 parole, no allegati.",
  badExample: { text: "Email gentile per riprendere contatti.", why: "nessuna struttura, nessun vincolo, nessuna CTA" },
};

const RUBRIC_EMAIL_INSTRUCTIONS: PromptRubric = {
  kindLabel: "Email Prompt globale (instructions)",
  purpose: "Istruzioni di composizione email applicate a tutti i template di quel tipo.",
  targetLengthChars: { min: 80, max: 600 },
  mustHave: ["Indicazione di lingua/tono", "Lunghezza target del corpo", "Regola CTA"],
  mustNotHave: ["Esempi (vanno in operative_prompt examples)", "Riferimenti a destinatari specifici"],
  structure: "Lista di regole brevi e non ambigue.",
  goodExample: "Lingua: stessa del destinatario. Tono: pari-pari, no superiorità. Corpo ≤80 parole. Esattamente 1 CTA. Subject ≤60 char senza emoji.",
  badExample: { text: "Scrivi email belle e personalizzate.", why: "vago, nessun limite, nessun vincolo CTA" },
};

const RUBRIC_EMAIL_ADDRESS_RULE: PromptRubric = {
  kindLabel: "Email Address Rule (custom_prompt)",
  purpose: "Override applicato quando mittente/destinatario corrisponde a un'email specifica.",
  targetLengthChars: { min: 40, max: 400 },
  mustHave: ["Quando si applica", "Cosa cambia rispetto al default"],
  mustNotHave: ["Re-enunciazione di tutto il prompt globale (deve solo override)"],
  structure: "QUANDO: <trigger>\\nOVERRIDE: <cosa cambia>",
  goodExample: "QUANDO: destinatario @procurement.*. OVERRIDE: tono più formale, niente claim commerciali, includere SLA.",
  badExample: { text: "Sii sempre gentile.", why: "nessun trigger, nessun override specifico" },
};

const RUBRIC_PLAYBOOK_PROMPT: PromptRubric = {
  kindLabel: "Commercial Playbook — Prompt template",
  purpose: "Template di prompt usato dall'AI quando le trigger_conditions del playbook matchano il lead.",
  targetLengthChars: { min: 150, max: 1000 },
  mustHave: ["Trigger riassunto", "Strategia in 1-3 frasi", "Azioni concrete", "Vincoli o KPI"],
  mustNotHave: ["Contenuto duplicato di altri playbook", "Strategia che bypassa lo stato del lead"],
  structure: "TRIGGER: <quando>\\nSTRATEGIA: <come>\\nAZIONI: <step>\\nVINCOLI: <limiti>",
  goodExample: "TRIGGER: lead engaged senza risposta da 14gg. STRATEGIA: prova canale alternativo (WhatsApp se autorizzato). AZIONI: 1) verifica gate WA 2) bozza msg breve 3) attendi 48h. VINCOLI: max 1 tentativo.",
  badExample: { text: "Riprova fino a quando risponde.", why: "viola dottrina cadenze, nessun limite" },
};

const RUBRIC_PLAYBOOK_DESCRIPTION: PromptRubric = {
  kindLabel: "Commercial Playbook — Descrizione",
  purpose: "Descrizione human-readable del playbook, mostrata all'operatore in lista playbook.",
  targetLengthChars: { min: 30, max: 200 },
  mustHave: ["Una frase che dice cosa fa e quando si attiva"],
  mustNotHave: ["Dettagli implementativi", "Lista azioni"],
  structure: "Una/due frasi descrittive.",
  goodExample: "Recupera lead engaged silenti da 14gg con un singolo messaggio breve sul canale alternativo autorizzato.",
  badExample: { text: "Playbook commerciale.", why: "non dice cosa fa né quando si attiva" },
};

const RUBRIC_PERSONA_TONE: PromptRubric = {
  kindLabel: "Agent Persona — Custom Tone Prompt (testo)",
  purpose: "Definisce tono e stile dell'agente per tutte le generazioni TESTUALI (email, chat, WA). NON usato per voce.",
  targetLengthChars: { min: 80, max: 500 },
  mustHave: ["Tono in 1-2 aggettivi", "Esempi di apertura/chiusura", "Vocabolario sì/no"],
  mustNotHave: ["Istruzioni voice/TTS (struttura # Personality, # Tone, etc.)", "Pronunce fonetiche"],
  structure: "TONO: <…>\\nAPERTURE: <es.>\\nCHIUSURE: <es.>\\nVOCABOLARIO SÌ/NO: <…>",
  goodExample: "TONO: diretto, professionale, mai paternalistico. APERTURE: \"Buongiorno [Nome],\". CHIUSURE: \"Resto a disposizione.\". SÌ: opportunità, valore. NO: \"vorrei proporle\", \"in bocca al lupo\".",
  badExample: { text: "Sii amichevole.", why: "monodimensionale, nessun esempio operativo" },
};

const RUBRIC_VOICE: PromptRubric = {
  kindLabel: "Voice Agent ElevenLabs (prompt vocale)",
  purpose: "Prompt installato nell'agente ElevenLabs: governa conversazione vocale TTS/ASR in tempo reale.",
  targetLengthChars: { min: 400, max: 4000 },
  mustHave: [
    "Sezione # Personality",
    "Sezione # Environment",
    "Sezione # Tone (con istruzioni di prosodia: volume, ritmo)",
    "Sezione # Goal",
    "Sezione # Tools (lista tool concessi)",
    "Sezione # Guardrails",
    "Sezione # Pronunciation & Language (sigle, numeri cifra-per-cifra)",
    "Sezione # When to end the call (con chiamata esplicita a end_call tool)",
  ],
  mustNotHave: [
    "Markdown bullet `- ` o `* ` (degradano la prosodia TTS)",
    "Heading ## o ### (solo # singolo per le sezioni canoniche)",
    "Tabelle markdown",
    "Frasi lunghe oltre ~25 parole (rompono il respiro)",
    "Acronimi non spiegati foneticamente (es. TMWE va spiegato come \"Ti Em dabliu i\")",
  ],
  structure: "# Personality / # Environment / # Tone / # Goal / # Tools / # Guardrails / # Pronunciation & Language / # When to end the call. Vedi template Aurora/Bruce/Robin in docs/PROMPT_11LABS_*.md.",
  goodExample: "# Personality\\nSei Bruce, consulente senior TMWE. Non sei un call center, sei un professionista.\\n# Tone\\n- Voce calma, profonda. Volume e ritmo stabili.\\n# When to end the call\\nALWAYS call `end_call` tool when il cliente dice \"grazie arrivederci\".",
  badExample: { text: "* Sei un agente vocale\\n* Devi essere gentile\\n## Regole\\n- Non urlare", why: "usa bullet markdown e heading ## che ElevenLabs interpreta male, manca la struttura canonica # Personality/# Environment, manca # When to end the call" },
};

const RUBRIC_AGENT_SYSTEM_PROMPT: PromptRubric = {
  kindLabel: "Agent System Prompt (specifico agente)",
  purpose: "System prompt dedicato di un singolo agente, prevale sul globale per le sue generazioni.",
  targetLengthChars: { min: 200, max: 2500 },
  mustHave: ["Identità agente", "Scope (cosa può/non può fare)", "Riferimento ai tool disponibili", "Regole specifiche del ruolo"],
  mustNotHave: ["Duplicazione del system prompt globale", "Regole che contraddicono la dottrina 9 stati"],
  structure: "RUOLO\\nSCOPE\\nTOOL DISPONIBILI\\nREGOLE\\nDOTTRINA SPECIFICA",
  goodExample: "RUOLO: agente commerciale per partner FR/BE. SCOPE: outbound email + follow-up. TOOL: send_email, schedule_followup. REGOLE: francese sempre, mai inviare prima delle 9 locali.",
  badExample: { text: "Sei un agente AI utile.", why: "nessuna identità, nessuno scope, nessun tool, nessuna regola" },
};

const RUBRIC_SIGNATURE: PromptRubric = {
  kindLabel: "Agent Persona — Signature template",
  purpose: "Template firma email dell'agente.",
  targetLengthChars: { min: 30, max: 400 },
  mustHave: ["Nome", "Ruolo", "Riferimento azienda"],
  mustNotHave: ["Disclaimer legali lunghi (vanno gestiti separatamente)", "Immagini inline base64"],
  structure: "Nome\\nRuolo — Azienda\\nContatto",
  goodExample: "Marco Rossi\\nKey Account — TMWE\\nm.rossi@tmwe.it · +39 02 1234567",
  badExample: { text: "Cordiali saluti", why: "nessun nome, nessun ruolo, nessun contatto" },
};

const RUBRIC_NOTES: PromptRubric = {
  kindLabel: "Note libere",
  purpose: "Annotazioni interne, non eseguite a runtime.",
  targetLengthChars: { min: 10, max: 1000 },
  mustHave: ["Chiarezza per il lettore umano"],
  mustNotHave: ["Istruzioni operative AI (vanno nei prompt)"],
  structure: "Testo libero conciso.",
  goodExample: "Cliente preferisce risposte mattutine; evitare chiamate dopo le 17.",
  badExample: { text: "Boh.", why: "non utilizzabile" },
};

const RUBRIC_GENERIC: PromptRubric = {
  kindLabel: "Blocco generico",
  purpose: "Sorgente non categorizzata.",
  targetLengthChars: { min: 20, max: 2000 },
  mustHave: ["Chiarezza", "Coerenza con il resto del sistema"],
  mustNotHave: ["Frasi vuote o decorative"],
  structure: "Testo strutturato in modo leggibile.",
  goodExample: "Regola operativa chiara con condizione e azione.",
  badExample: { text: "Vario.", why: "non porta valore" },
};

/** Helper per il chiamante: detecta se un blocco è "voce" guardando tab + source + label. */
export function isVoiceBlock(args: { tabLabel?: string; source: BlockSource; label?: string }): boolean {
  const tab = (args.tabLabel ?? "").toLowerCase();
  if (tab.includes("voice") || tab.includes("11lab") || tab.includes("eleven")) return true;
  if (args.source.kind === "agent_persona" && args.source.field === "custom_tone_prompt") {
    // Persona può essere voice o testo: se la label menziona voce, è voce.
    const lbl = (args.label ?? "").toLowerCase();
    if (lbl.includes("voice") || lbl.includes("voc") || lbl.includes("11lab")) return true;
  }
  return false;
}