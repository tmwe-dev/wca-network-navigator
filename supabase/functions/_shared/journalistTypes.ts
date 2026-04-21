// === Giornalisti AI — Tipi (LOVABLE-80 v2) ===

export type JournalistRole =
  | "rompighiaccio"
  | "risvegliatore"
  | "chiusore"
  | "accompagnatore";

export type ReviewVerdict = "pass" | "pass_with_edits" | "warn" | "block";

export type ReviewMode =
  | "review_and_correct"
  | "review_only"
  | "silent_audit";

export type ReviewChannel = "email" | "whatsapp" | "linkedin" | "voice_script";

export interface JournalistConfig {
  role: JournalistRole;
  label: string;
  prompt: string;
  tone: string;
  rules: string;
  kb_sources: string;
  donts: string;
}

export interface JournalistSelection {
  role: JournalistRole;
  label: string;
  reasoning: string;
  /** true = auto-selezione, false = override utente */
  auto: boolean;
}

export interface JournalistReviewInput {
  /** Testo prodotto dal motore AI (draft o output di improve) */
  final_draft: string;
  /** Brief strutturato dal resolver (tipo, descrizione, obiettivo) */
  resolved_brief: {
    email_type?: string;
    email_description?: string;
    objective?: string;
    playbook_active?: string;
  };
  /** Canale di output */
  channel: ReviewChannel;
  /** Stato commerciale */
  commercial_state: {
    lead_status: string;
    relationship_phase?: string;
    touch_count?: number;
    last_outcome?: string;
    days_since_last_inbound?: number;
    has_active_conversation?: boolean;
  };
  partner: {
    id: string | null;
    company_name?: string | null;
    country?: string | null;
  };
  contact?: {
    name?: string | null;
    role?: string | null;
  };
  history_summary?: string;
  kb_summary?: string;
  memory_summary?: string;
  enrichment_summary?: string;
  /** Vincoli passati dal sistema */
  constraints?: string[];
}

export interface JournalistWarning {
  type:
    | "brief_mismatch"
    | "phase_skip"
    | "tone_violation"
    | "unverifiable_claim"
    | "fake_urgency"
    | "flattery"
    | "channel_mismatch"
    | "type_history_conflict";
  description: string;
  severity: "info" | "warning" | "blocking";
  upstream_fix?: string;
}

export interface JournalistEdit {
  type:
    | "tone"
    | "rhythm"
    | "redundancy"
    | "technicality"
    | "aggression"
    | "cta_clarity"
    | "length"
    | "channel_format"
    | "role_voice";
  original_fragment: string;
  edited_fragment: string;
  reason: string;
}

export interface JournalistReviewOutput {
  journalist: JournalistSelection;
  verdict: ReviewVerdict;
  /** Testo finale (= draft originale se pass, = corretto se pass_with_edits, = draft se block) */
  edited_text: string;
  warnings: JournalistWarning[];
  edits: JournalistEdit[];
  reasoning_summary: string;
  /** Punteggio qualità 0-100; -1 = review non eseguita (errore) */
  quality_score: number;
}