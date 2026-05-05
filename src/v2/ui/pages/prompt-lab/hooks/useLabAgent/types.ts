import type { Block } from "../../types";
import type { OutcomeType } from "../useProposalProcessing";

export interface LabChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface UnifiedAssistantResponse {
  content?: string;
  structured?: Record<string, unknown>;
}

export interface ImproveOptions {
  block: Block;
  instruction?: string;
  tabLabel?: string;
  /** Stringa "Dove si attiva" del tab (PROMPT_LAB_TABS[].activation). */
  tabActivation?: string;
  /** Altri blocchi dello stesso tab (per evitare contraddizioni). */
  nearbyBlocks?: ReadonlyArray<Block>;
  /** Obiettivo dichiarato dall'utente per questa specifica iterazione. */
  goal?: string;
  /** Briefing strutturato dalla checklist guidata (override su goal libero). */
  briefing?: BriefingPayload;
}

/**
 * Payload della checklist guidata pre-generazione.
 * Raccoglie obiettivo + contesto + target + vincoli per ancorare il modello
 * a contenuti coerenti con lo scopo dichiarato (no derive generaliste).
 */
export interface BriefingPayload {
  /** Obiettivo concreto del blocco (cosa deve ottenere quando eseguito). */
  goal: string;
  /** Quando/dove viene attivato nel runtime. */
  contextOfUse: string;
  /** Canale target: voice_agent | email | whatsapp | linkedin | internal_ai | kb_governance | multi_channel. */
  targetChannel: string;
  /** Audience: cold_lead | warm_lead | holding_pattern | existing_partner | internal_team | system_actor. */
  audience: string;
  /** Lingua output: it | en | auto. */
  language: string;
  /** Tipo CTA: none | meeting | reply | info | qualify | close. */
  ctaType: string;
  /** Cosa il blocco DEVE includere. */
  mustHave: string;
  /** Cosa il blocco non deve mai includere. */
  mustNotHave: string;
  /** Vincoli extra (lunghezza, tono, formato). */
  extraConstraints: string;
}

/** Risultato parsato dalla risposta del Lab Agent in modalità global_improve */
export interface ParsedImproveResult {
  text: string;
  outcomeType: OutcomeType;
  architecturalNote?: string;
}