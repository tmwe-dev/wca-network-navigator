/**
 * Event envelope condiviso — SOLO TIPI. Nessun bus è implementato.
 */
import type { EntityRef, Provenance, SourceSystem } from "./canonical";

export interface EventEnvelope<TPayload = Record<string, unknown>> {
  eventId: string;
  /** Dominio puntato: "partner.enriched", "contact.merged", "email.received". */
  type: string;
  occurredAt: string;
  source: SourceSystem;
  subjectRef: EntityRef;
  version: number;
  /** Chiave di deduplica lato consumer. */
  idempotencyKey?: string;
  provenance?: Provenance;
  payload: TPayload;
}

export type EventHandler<TPayload = Record<string, unknown>> = (event: EventEnvelope<TPayload>) => Promise<void>;
