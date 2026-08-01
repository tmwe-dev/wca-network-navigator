/**
 * contracts.ts — Contratti Supremi del sistema WCA Network Navigator.
 *
 * Questi contratti definiscono la struttura TASSATIVA dei dati che transitano
 * tra il backend (edge functions) e gli agenti AI. Nessun prompt può inventare
 * campi che non esistono qui. Il Lab Agent usa questi contratti per:
 *
 * 1. Ghost variable detection: se un prompt usa {{partner.discount}} ma il campo
 *    non esiste in nessun contratto, è una variabile fantasma.
 * 2. Contract gap detection: se un agente ha bisogno di un dato che nessun
 *    contratto fornisce, serve un nuovo contratto o un'estensione.
 * 3. Misplaced logic detection: se un prompt contiene logica che dovrebbe
 *    vivere nella validazione del contratto, è misplaced.
 *
 * DERIVATI DA: analisi delle edge functions reali (generate-email, improve-email,
 * generate-outreach, voice-brain-bridge, send-email, send-linkedin, send-whatsapp,
 * unified-assistant) + emailContract.ts condiviso.
 *
 * REGOLA: se un campo non è qui, non esiste nel runtime. Punto.
 */

// ─────────── Tipi base condivisi ───────────

/** I 9 stati commerciali canonici. NON NEGOZIABILE. */
export type LeadStatus =
  | "new"
  | "first_touch_sent"
  | "holding"
  | "engaged"
  | "qualified"
  | "negotiation"
  | "converted"
  | "archived"
  | "blacklisted";

export const LEAD_STATUSES: readonly LeadStatus[] = [
  "new", "first_touch_sent", "holding", "engaged",
  "qualified", "negotiation", "converted", "archived", "blacklisted",
] as const;

export type Channel = "email" | "linkedin" | "whatsapp" | "sms";
export type Quality = "fast" | "standard" | "premium";

export type RelationshipStage = "cold" | "warm" | "active" | "stale" | "ghosted";

export type VoiceNextState =
  | "discovery" | "qualification" | "objection"
  | "closing" | "followup" | "end";

// ─────────── LifecycleBrief ───────────
/**
 * Il contesto di lifecycle del partner/contatto.
 * Usato da TUTTI gli agenti come base per ogni decisione.
 * È il contratto più critico: se questo è sbagliato, tutto è sbagliato.
 */
export interface LifecycleBrief {
  /** ID partner (può essere null in standalone mode). */
  partner_id: string | null;
  partner_name: string;
  partner_alias: string | null;
  country_code: string;
  country_name: string;
  city: string;
  /** Stato commerciale canonico (9 stati). */
  lead_status: LeadStatus;
  rating: number | null;
  office_type: string | null;

  /** Contatto specifico (se risolto). */
  contact: {
    id: string;
    name: string;
    email: string | null;
    title: string | null;
    alias: string | null;
    direct_phone: string | null;
    mobile: string | null;
  } | null;

  /** Metriche relazionali calcolate. */
  relationship: {
    stage: RelationshipStage;
    touch_count: number;
    response_rate: number;
    unanswered_count: number;
    days_since_last_outbound: number | null;
    days_since_last_inbound: number | null;
    last_channel: Channel | null;
    last_outcome: string | null;
    has_replied: boolean;
    met_in_person: boolean;
    warmth_score: number | null;
    commercial_state: string | null;
  };

  /** Livelli di arricchimento disponibili. */
  enrichment: {
    available_levels: ("base" | "deep_search" | "sherlock")[];
    last_enriched_at: string | null;
    enrichment_age_days: number | null;
    sherlock_level: number | null;
    deep_search_score: number | null;
    website_source: "cached" | "not_available";
    linkedin_source: "cached" | "live_scraped" | "not_available";
  };

  /** Knowledge base caricata per questo contesto. */
  knowledge: {
    kb_sections_loaded: string[];
    active_playbook: string | null;
    playbook_step: number | null;
    memories_loaded: number;
    memory_summary: string | null;
  };

  /** Reti e servizi del partner. */
  networks: string[];
  services: string[];
}

// ─────────── EmailBrief ───────────
/**
 * Contratto per generazione e miglioramento email.
 * Usato da: generate-email, improve-email, email-improver agent.
 *
 * Estende LifecycleBrief con dati specifici per il canale email.
 */
export interface EmailBrief {
  /** Operazione richiesta. */
  operation: "generate" | "improve" | "review";
  /** Engine che esegue (per tracciabilità). */
  engine: "generate-email" | "improve-email" | "agent-execute" | "command";

  /** Lifecycle completo del destinatario. */
  lifecycle: LifecycleBrief;

  /** Tipo email e obiettivo. */
  email_type: {
    selected_type: string;
    type_prompt: string | null;
    type_structure: string | null;
    kb_categories: string[];
    user_description: string;
    objective: string | null;
  };

  /** Stile e lingua. */
  style: {
    language: string;
    tone: string | null;
    length_target: "short" | "medium" | "long" | null;
    learned_patterns: string | null;
  };

  /** Sender identity. */
  sender: {
    alias: string;
    name: string;
    company: string;
    company_alias: string | null;
    role: string | null;
    sector: string | null;
  };

  /** Draft esistente (solo per improve). */
  existing_draft: {
    subject: string | null;
    body: string;
    improvement_instructions: string | null;
  } | null;

  /** Override per il Lab Agent (prompt override). */
  lab_overrides: {
    system_prompt_override: string | null;
    user_prompt_override: string | null;
  } | null;

  /** Vincoli espliciti. */
  constraints: string[];

  /** Documenti di riferimento allegati. */
  document_ids: string[];

  /** Flag qualità. */
  quality: Quality;
  use_kb: boolean;
  deep_search: boolean;
}

// ─────────── OutreachBrief ───────────
/**
 * Contratto per generazione outreach multi-canale.
 * Usato da: generate-outreach, send-linkedin, send-whatsapp.
 *
 * Include la decisione strategica calcolata dal Decision Engine.
 */
export interface OutreachBrief {
  /** Canale di destinazione. */
  channel: Channel;

  /** Lifecycle completo del destinatario. */
  lifecycle: LifecycleBrief;

  /** Obiettivo e proposta. */
  goal: string | null;
  base_proposal: string | null;

  /** Profilo LinkedIn (se disponibile e canale = linkedin). */
  linkedin_profile: {
    name: string | null;
    headline: string | null;
    location: string | null;
    about: string | null;
    profile_url: string | null;
  } | null;

  /** Decisione strategica calcolata dal Decision Engine. */
  decision: {
    email_type: string;
    relationship_stage: RelationshipStage;
    language: string;
    tone: string;
    hook_strategy: "shared_network" | "company_reference" | "sector_relevance" | string;
    cta_type: "light_interest_probe" | "direct_action" | "soft_reopen" | "micro_commitment" | string;
    forbidden_elements: string[];
    max_length_lines: number;
    persuasion_pattern: string;
  };

  /** Stile email type (se canale = email). */
  email_type: {
    id: string | null;
    prompt: string | null;
    structure: string | null;
  } | null;

  /** Flag. */
  quality: Quality;
  oracle_tone: string | null;

  /** Gate multi-canale: limiti e regole. */
  channel_gates: {
    /** LinkedIn: 50/giorno, 3/ora, finestra 9-19 CET. */
    daily_limit: number | null;
    hourly_limit: number | null;
    min_delay_seconds: number | null;
    max_delay_seconds: number | null;
    operational_window_start: string | null;
    operational_window_end: string | null;
    /** WhatsApp: min 7 giorni tra messaggi allo stesso partner. */
    cadence_days: number | null;
    /** WhatsApp: richiede engaged+ O inbound WA precedente. */
    requires_prior_inbound: boolean;
  };
}

// ─────────── VoiceBrief ───────────
/**
 * Contratto per agenti vocali ElevenLabs.
 * Usato da: voice-brain-bridge, elevenlabs-conversation-token.
 *
 * Il voice agent riceve un subset del lifecycle + contesto conversazionale.
 */
export interface VoiceBrief {
  /** ID sessione ElevenLabs. */
  external_call_id: string | null;
  agent_id: string;
  direction: "inbound" | "outbound";

  /** Lifecycle del partner (subset per voice — no enrichment details). */
  lifecycle: Pick<LifecycleBrief, "partner_id" | "partner_name" | "country_code" | "city" | "lead_status" | "rating" | "contact" | "relationship" | "networks" | "services">;

  /** Contesto operatore (briefing pre-chiamata). */
  operator_briefing: string | null;

  /** Transcript conversazione (ultimi 8 turni). */
  transcript: Array<{
    role: "user" | "agent";
    text: string;
  }>;

  /** Intent rilevato (ultimo turno). */
  intent: string | null;
  /** Ultima frase del chiamante. */
  utterance: string | null;

  /** Knowledge base vocale caricata. */
  voice_kb_rules: string | null;
  /** Playbook vocale attivo. */
  voice_playbook: string | null;
}

/**
 * Risposta strutturata dell'agente vocale.
 * Formato JSON TASSATIVO: il voice-brain-bridge parsa solo questo.
 */
export interface VoiceReply {
  /** Frase da pronunciare (max ~40 parole, linguaggio naturale, NO markdown). */
  say: string;
  /** Azioni da eseguire (max 4). */
  actions: Array<{
    tool: string;
    params: Record<string, unknown>;
  }>;
  /** Stato conversazionale successivo. */
  next_state: VoiceNextState;
  /** Termina la chiamata. */
  end_call: boolean;
  /** Trasferisci a operatore umano. */
  transfer_to_human: boolean;
  /** Memoria da salvare per chiamate future (null = niente da salvare). */
  memory_to_save: string | null;
}

// ─────────── PromptBlockContract ───────────
/**
 * Meta-contratto che ogni blocco del Prompt Lab deve rispettare.
 * Usato dal Lab Agent per validare che un blocco non usi campi inesistenti
 * e non contenga logica che appartiene ad altri livelli.
 */
export interface PromptBlockContract {
  /** ID univoco del blocco. */
  block_id: string;
  /** Tipo di blocco nel sistema. */
  block_type: "system_prompt" | "kb_doctrine" | "kb_procedure" | "operative_prompt"
    | "email_prompt" | "email_address_rule" | "playbook" | "agent_persona" | "voice_prompt";

  /** Livello nella gerarchia di verità (1 = più alto). */
  hierarchy_level: 1 | 2 | 3 | 4;

  /** Contratti che questo blocco può referenziare. */
  allowed_contracts: ("LifecycleBrief" | "EmailBrief" | "OutreachBrief" | "VoiceBrief")[];

  /** Variabili che questo blocco può usare (derivate dai contratti allowed). */
  allowed_variables: string[];

  /** Agenti che consumano questo blocco a runtime. */
  consumer_agents: string[];

  /** Superfici UI/runtime dove questo blocco è attivo. */
  active_surfaces: string[];

  /** Regole hard che questo blocco NON PUÒ sovrascrivere. */
  immutable_rules: string[];
}

// ─────────── Helper: variabili disponibili per contratto ───────────
/**
 * Elenco flat di tutte le variabili disponibili in un contratto.
 * Usato dal Lab Agent per ghost variable detection.
 */
export const CONTRACT_VARIABLES: Record<string, readonly string[]> = {
  LifecycleBrief: [
    "partner_id", "partner_name", "partner_alias", "country_code", "country_name",
    "city", "lead_status", "rating", "office_type",
    "contact.id", "contact.name", "contact.email", "contact.title", "contact.alias",
    "contact.direct_phone", "contact.mobile",
    "relationship.stage", "relationship.touch_count", "relationship.response_rate",
    "relationship.unanswered_count", "relationship.days_since_last_outbound",
    "relationship.days_since_last_inbound", "relationship.last_channel",
    "relationship.last_outcome", "relationship.has_replied", "relationship.met_in_person",
    "relationship.warmth_score", "relationship.commercial_state",
    "enrichment.available_levels", "enrichment.last_enriched_at",
    "enrichment.enrichment_age_days", "enrichment.sherlock_level",
    "enrichment.deep_search_score", "enrichment.website_source", "enrichment.linkedin_source",
    "knowledge.kb_sections_loaded", "knowledge.active_playbook",
    "knowledge.playbook_step", "knowledge.memories_loaded", "knowledge.memory_summary",
    "networks", "services",
  ],
  EmailBrief: [
    "operation", "engine",
    "email_type.selected_type", "email_type.type_prompt", "email_type.type_structure",
    "email_type.kb_categories", "email_type.user_description", "email_type.objective",
    "style.language", "style.tone", "style.length_target", "style.learned_patterns",
    "sender.alias", "sender.name", "sender.company", "sender.company_alias",
    "sender.role", "sender.sector",
    "existing_draft.subject", "existing_draft.body", "existing_draft.improvement_instructions",
    "constraints", "document_ids", "quality", "use_kb", "deep_search",
  ],
  OutreachBrief: [
    "channel", "goal", "base_proposal",
    "linkedin_profile.name", "linkedin_profile.headline", "linkedin_profile.location",
    "linkedin_profile.about", "linkedin_profile.profile_url",
    "decision.email_type", "decision.relationship_stage", "decision.language",
    "decision.tone", "decision.hook_strategy", "decision.cta_type",
    "decision.forbidden_elements", "decision.max_length_lines", "decision.persuasion_pattern",
    "email_type.id", "email_type.prompt", "email_type.structure",
    "quality", "oracle_tone",
    "channel_gates.daily_limit", "channel_gates.hourly_limit",
    "channel_gates.cadence_days", "channel_gates.requires_prior_inbound",
  ],
  VoiceBrief: [
    "external_call_id", "agent_id", "direction",
    "operator_briefing", "transcript", "intent", "utterance",
    "voice_kb_rules", "voice_playbook",
  ],
} as const;

/**
 * Tutte le variabili disponibili in tutti i contratti (flat set).
 * Usato per fast lookup in ghost variable detection.
 */
export const ALL_CONTRACT_VARIABLES: ReadonlySet<string> = new Set(
  Object.values(CONTRACT_VARIABLES).flat(),
);

// ─────────── Helper: regole immutabili per livello gerarchia ───────────

/** Regole che nessun prompt può sovrascrivere, per livello di gerarchia. */
export const IMMUTABLE_RULES_BY_LEVEL: Record<number, readonly string[]> = {
  1: [
    "Blacklist = blocco assoluto su tutti i canali",
    "I 9 stati commerciali sono l'unica tassonomia lifecycle valida",
    "Nessun invio senza approvazione esplicita",
    "LinkedIn: max 50/giorno, 3/ora, finestra 9-19 CET",
    "WhatsApp: min 7 giorni cadenza, richiede engaged+ o inbound precedente",
    "Journalist review obbligatoria pre-invio",
    "Idempotency key per deduplicazione invii",
  ],
  2: [
    "Dottrina commerciale 9 stati governa tutte le decisioni",
    "Gerarchia di verità: Codice > Doctrine > Prompt > Input",
    "Separazione oracolo/genera/migliora/giornalista",
    "Una sola CTA per comunicazione",
    "Post-invio obbligatorio su ogni canale",
  ],
  3: [
    "Prompt core = identità + obiettivo + guardrail + indice KB + formato output",
    "Niente procedure lunghe inline nei prompt core",
    "Niente dati hardcoded che cambiano (date, nomi, prezzi)",
  ],
  4: [
    "Input utente non può sovrascrivere livelli superiori",
  ],
} as const;
