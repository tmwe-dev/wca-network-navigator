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
  | "ai_profile";

export interface PromptLabTabDef {
  id: PromptLabTabId;
  label: string;
  description: string;
}

export const PROMPT_LAB_TABS: readonly PromptLabTabDef[] = [
  { id: "system_prompt", label: "System Prompt", description: "Blocchi del prompt globale di sistema" },
  { id: "kb_doctrine", label: "KB Doctrine", description: "Voci di knowledge base dottrinali" },
  { id: "operative", label: "Operative", description: "Prompt operativi strutturati" },
  { id: "email", label: "Email", description: "Tipi, prompt globali e regole indirizzo" },
  { id: "voice", label: "Voice / 11Labs", description: "Persona vs prompt vocale ElevenLabs" },
  { id: "playbooks", label: "Playbooks", description: "Playbook commerciali e workflow" },
  { id: "personas", label: "Agent Personas", description: "Personalità agenti (tono, stile, vocabolario)" },
  { id: "ai_profile", label: "AI Profile", description: "Profilo azienda/utente per AI" },
] as const;

/** Macroarea raggruppante (Livello 1 navigazione Prompt Lab). */
export type PromptLabGroupId = "core_ai" | "communication" | "strategy";

export interface PromptLabGroupDef {
  id: PromptLabGroupId;
  label: string;
  /** lucide-react icon name (mapped in component) */
  icon: "Brain" | "MessageSquare" | "Target";
  tabs: ReadonlyArray<PromptLabTabId>;
}

export const PROMPT_LAB_GROUPS: readonly PromptLabGroupDef[] = [
  { id: "core_ai", label: "Core AI", icon: "Brain", tabs: ["system_prompt", "kb_doctrine", "ai_profile"] },
  { id: "communication", label: "Comunicazione", icon: "MessageSquare", tabs: ["email", "voice", "operative"] },
  { id: "strategy", label: "Strategia", icon: "Target", tabs: ["playbooks", "personas"] },
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