/**
 * Contratti tipizzati per il tracking delle attività.
 * Fonte di verità: Documento 2, §2 regola 3 — "Prima si decide dove vive la verità dei dati"
 * Un unico enum, un unico schema — nessuna stringa libera.
 */

/** Tipi di attività tracciabili nel sistema */
export type ActivityType = "send_email" | "whatsapp_message" | "linkedin_message" | "phone_call";

/** Tipi di sorgente per il tracking */
export type SourceType = "partner" | "imported_contact" | "business_card";

/** Parametri per tracciare un'attività — contratto unico per tutto il sistema */
export interface TrackActivityParams {
  activityType: ActivityType;
  title: string;
  sourceId: string;
  sourceType: SourceType;
  partnerId?: string;
  emailSubject?: string;
  description?: string;
}
