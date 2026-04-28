/**
 * Prompt Lab — shared types
 */

export type BlockSource =
  | { kind: "app_setting"; key: string }
  | { kind: "kb_entry"; id?: string }
  | { kind: "operative_prompt"; id: string; field: "objective" | "procedure" | "criteria" | "context" | "examples" }
  | { kind: "email_prompt"; id: string; field: "instructions" | "title" }
  | { kind: "email_address_rule"; id: string; field: "custom_prompt" | "notes" }
  | { kind: "playbook"; id: string; field: "prompt_template" | "description" | "trigger_conditions" }
  | { kind: "agent_persona"; id: string; field: "custom_tone_prompt" | "signature_template" | "style_rules" | "vocabulary_do" | "vocabulary_dont" }
  | { kind: "agent"; id: string; field: "system_prompt" }
  | { kind: "ephemeral" };

export interface Block {
  id: string;
  label: string;
  hint?: string;
  content: string;
  improved?: string;
  source: BlockSource;
  dirty: boolean;
}

export interface TabContext {
  tabId: string;
  tabLabel: string;
  blocks: Block[];
}

export type PromptLabTabId =
  | "system_prompt"
  | "kb_doctrine"
  | "operative"
  | "email"
  | "voice"
  | "playbooks"
  | "personas"
  | "capabilities"
  | "simulator"
  | "audit"
  | "routing"
  | "ai_profile"
  | "journalists"
  | "operative_kb"
  | "administrative_kb"
  | "support_kb"
  | "domain_routing"; // LOVABLE-93: coerenza Prompt Lab multi-dominio

export interface PromptLabTabDef {
  id: PromptLabTabId;
  label: string;
  description: string;
  activation: string;
}

export const PROMPT_LAB_TABS: readonly PromptLabTabDef[] = [
  { id: "system_prompt", label: "System Prompt", description: "Blocchi del prompt globale di sistema", activation: "Attivo nel Command Center, AI Assistant, missioni agenti e generazioni operative quando viene assemblato il contesto base dell'AI." },
  { id: "kb_doctrine", label: "KB Doctrine", description: "Voci di knowledge base dottrinali", activation: "Attiva in tutti gli agenti tramite assembler KB: doctrine, system_doctrine, sales_doctrine e procedures diventano regole di governo prima delle azioni." },
  { id: "operative", label: "Operative", description: "Prompt operativi strutturati", activation: "Attivi nei flussi esecutivi: Email Composer, Cockpit, Outreach, Assistenti e missioni che richiamano procedure con objective/procedure/criteria." },
  { id: "email", label: "Email", description: "Tipi, prompt globali e regole indirizzo", activation: "Attivo in Email Intelligence, Email Forge, composizione email, classificazione messaggi e regole specifiche per mittente/destinatario." },
  { id: "voice", label: "Voice / 11Labs", description: "Persona vs prompt vocale ElevenLabs", activation: "Attivo sugli agenti vocali ElevenLabs collegati: modifica il comportamento parlato, il tono, i limiti e la struttura della conversazione voice." },
  { id: "playbooks", label: "Playbooks", description: "Playbook commerciali e workflow", activation: "Attivi quando l'AI deve scegliere una strategia commerciale, una sequenza o un workflow in base alle condizioni di trigger del playbook." },
  { id: "personas", label: "Agent Personas", description: "Personalità agenti (tono, stile, vocabolario)", activation: "Attive sugli agenti associati: definiscono tono, stile, vocabolario e firma usati nelle risposte, email e prompt voice derivati." },
  { id: "capabilities", label: "Agent Capabilities", description: "Tool, timeout, concorrenza, modello per agente", activation: "Attive nell'edge function agent-loop e nei runtime agente: filtrano i tool disponibili, impongono timeout/iterazioni e selezionano il modello AI per ciascun agente. Hard guards di sicurezza restano sempre attivi." },
  { id: "simulator", label: "Simulator", description: "Test agente: vedi prompt, persona, tool e guards prima di eseguire", activation: "Read-only sandbox: assembla per un agente esattamente lo stesso system prompt che userebbe agent-loop, mostra persona, capabilities, prompt operativi caricati, tool whitelist effettiva, hard guards. Dry-run AI opzionale (nessun tool eseguito)." },
  { id: "audit", label: "Audit", description: "Cosa è DB (Prompt Lab) vs Hardcoded per agente e tool", activation: "Read-only. Per ogni agente attivo confronta persona, capabilities, prompt operativi e tool registry tra DB e codice; mostra hard guards immutabili. Usalo per capire dove agire (Prompt Lab) vs cosa richiede una PR." },
  { id: "routing", label: "Routing", description: "Regole DB persona-aware per classificazione e escalation", activation: "Attive in classify-email-response: bias pre-classificazione (hint dominio/categoria/tono) + override post-classificazione (next lead_status, action_type, confidence floor, skip-action). Persona-specifiche battono globali. Hard guards e applyLeadStatusChange restano sempre attivi." },
  { id: "ai_profile", label: "AI Profile", description: "Profilo azienda/utente per AI", activation: "Attivo come contesto aziendale trasversale in prompt email, assistenti, agenti commerciali e generazioni che richiedono identità, obiettivi e stile WCA." },
  { id: "journalists", label: "Giornalisti AI", description: "Caporedattore finale (review editoriale)", activation: "Attivo come review post-generazione su generate-email, improve-email e invii agente (send_email/send_whatsapp). Auto-selezione in base al lead_status." },
  // LOVABLE-93: coerenza Prompt Lab multi-dominio — KB domain-specific
  { id: "operative_kb", label: "Operativo", description: "KB procedure operative per dominio", activation: "Attive nel classify-email-response quando dominio = operative: procedure preventivi, booking, tracking per agents domain-aware." },
  { id: "administrative_kb", label: "Amministrativo", description: "KB procedure amministrative per dominio", activation: "Attive nel classify-email-response quando dominio = administrative: procedure fatture, pagamenti, autorizzazioni." },
  { id: "support_kb", label: "Supporto", description: "KB procedure supporto per dominio", activation: "Attive nel classify-email-response quando dominio = support: procedure reclami, assistenza, escalation." },
  { id: "domain_routing", label: "Routing Dominio", description: "Regole smistamento email per dominio", activation: "Attive nella classificazione email multi-dominio: mapping mittente/contenuto → dominio, priorità, SLA, agente specializzato." },
] as const;

/** Macroarea raggruppante (Livello 1 navigazione Prompt Lab). */
export type PromptLabGroupId = "core_ai" | "communication" | "strategy" | "operations"; // LOVABLE-93

export interface PromptLabGroupDef {
  id: PromptLabGroupId;
  label: string;
  /** lucide-react icon name (mapped in component) */
  icon: "Brain" | "MessageSquare" | "Target" | "Package" | "Receipt" | "LifeBuoy";
  tabs: ReadonlyArray<PromptLabTabId>;
}

export const PROMPT_LAB_GROUPS: readonly PromptLabGroupDef[] = [
  { id: "core_ai", label: "Core AI", icon: "Brain", tabs: ["system_prompt", "kb_doctrine", "ai_profile", "journalists"] },
  { id: "communication", label: "Comunicazione", icon: "MessageSquare", tabs: ["email", "voice", "operative"] },
  { id: "strategy", label: "Strategia", icon: "Target", tabs: ["playbooks", "personas", "capabilities", "simulator", "audit", "routing"] },
  // LOVABLE-93: coerenza Prompt Lab multi-dominio
  { id: "operations", label: "Operazioni", icon: "Package", tabs: ["operative_kb", "administrative_kb", "support_kb", "domain_routing"] },
] as const;

/** Default System Prompt blocks (mirrors supabase/functions/ai-assistant) */
export const DEFAULT_SYSTEM_PROMPT_BLOCKS: ReadonlyArray<{ id: string; label: string; content: string }> = [
  {
    id: "IDENTITY_AND_MISSION",
    label: "Identity & Mission",
    content: "Sei LUCA, Director strategico di WCA Network Navigator. Operi come segretario operativo: pianifichi, non eseguisci alla cieca. Lingua: italiano. Tono: professionale, asciutto, orientato al risultato.",
  },
  {
    id: "REASONING_FRAMEWORK",
    label: "Reasoning Framework",
    content: "Prima di ogni risposta: 1) leggi il contesto disponibile, 2) identifica l'obiettivo dell'operatore, 3) verifica i dati prima di generare azioni, 4) proponi piani e chiedi conferma per azioni irreversibili.",
  },
  {
    id: "INFO_SEARCH_HIERARCHY",
    label: "Info Search Hierarchy",
    content: "Ordine di lettura informazioni: contesto della richiesta → KB doctrine → memoria operatore → dati partner/contatto → enrichment → web. Non inventare dati: se manca, dichiaralo.",
  },
  {
    id: "GOLDEN_RULES",
    label: "Golden Rules",
    content: "1) Mai inventare contatti, email o numeri. 2) Mai inviare comunicazioni senza approvazione esplicita. 3) Rispettare lo stato del lead (Holding Pattern). 4) Sempre citare le fonti dei dati. 5) Errori → trasparenza, mai mascherare.",
  },
  {
    id: "COMMERCIAL_DOCTRINE",
    label: "Commercial Doctrine",
    content: "9 stati lead: new → first_touch_sent → holding → engaged → qualified → negotiation → converted | archived | blacklisted. Avanza solo con segnali concreti (risposta, meeting, conferma scritta).",
  },
  {
    id: "CONTEXT_ENGAGEMENT_RULES",
    label: "Context Engagement Rules",
    content: "Per ogni scope (cockpit/contacts/outreach/strategic/command) applica le regole d'ingaggio specifiche. Consulta KB doctrine/tone-and-format quando il tono va calibrato.",
  },
  {
    id: "KB_LOADING_INSTRUCTION",
    label: "KB Loading Instruction",
    content: "Carica sempre indici KB di categoria 'doctrine' e 'system_doctrine'. Quando una procedura specifica è citata nella richiesta, carica il chapter completo.",
  },
];