/**
 * MessageIntelligenceResult — Contratto canonico (B0 osservabilità).
 *
 * Shape unico prodotto dall'orchestratore `classify-inbound-message` e
 * persistito su `reply_classifications` (estensioni canoniche pianificate B1).
 * File typing-only: nessun import runtime, nessun coupling. Serve come
 * riferimento tipizzato per i consumer futuri (UI hook v2, edge stages).
 *
 * Regola d'oro: produttore unico = classify-inbound-message.
 * Consumer leggono da reply_classifications (o vista message_intelligence_v).
 */

export type MessageChannel = "email" | "whatsapp" | "linkedin";

export type MessageSentiment = "positive" | "neutral" | "negative";

export type MessageUrgency = "critical" | "high" | "normal" | "low";

export interface MessageIntelligencePolicyAction {
  action_type: string;
  params?: Record<string, unknown>;
}

export interface MessageIntelligenceTriage {
  needs_alert: boolean;
  reason?: string;
}

export interface MessageIntelligenceResult {
  /** channel_messages.id — identificatore canonico messaggio. */
  message_id: string;
  user_id: string;
  channel: MessageChannel;

  /** Classificazione base — già presente in reply_classifications oggi. */
  classification: string;
  confidence: number;
  sentiment: MessageSentiment;
  urgency: MessageUrgency;
  intent: string;
  reasoning: string;
  model: string;

  /** Estensioni canoniche (B1+) — oggi sparse su altre tabelle. */
  category?: string | null;
  sender_group_id?: string | null;
  folder_hint?: string | null;
  policy_plan?: MessageIntelligencePolicyAction[];
  triage?: MessageIntelligenceTriage | null;

  /** Correlation id deterministico = message_id. */
  correlation_id: string;

  version: 1;
}