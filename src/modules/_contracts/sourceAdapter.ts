/**
 * Source Adapter / Connector — SOLO INTERFACCE.
 *
 * Ogni fonte esterna (WCA Network, Funnemail, Scraper, Research Engine, report azienda)
 * verrà collegata a Navigator tramite un adapter che: preleva, normalizza verso il CDM,
 * risolve l'identità e dichiara la provenienza. Nessun adapter è ancora implementato.
 */
import type { CanonicalEntity, EntityRef, Provenance, SourceSystem } from "./canonical";

export interface FetchPage<TRaw> {
  items: TRaw[];
  cursor?: string;
  hasMore: boolean;
}

export interface IdentityCandidate {
  ref: EntityRef;
  /** 0..1 — punteggio di match dell'identity resolution. */
  score: number;
  reason: string;
}

export interface IdentityResolution {
  /** Match accettato, se sopra soglia. */
  matched?: IdentityCandidate;
  candidates: IdentityCandidate[];
  /** true quando serve una decisione umana. */
  needsReview: boolean;
}

export interface SourceAdapter<TRaw = unknown> {
  readonly source: SourceSystem;
  /** Entità che questo adapter è autorizzato a produrre. */
  readonly owns: CanonicalEntity["kind"][];
  fetch(cursor?: string): Promise<FetchPage<TRaw>>;
  normalize(raw: TRaw): { entity: CanonicalEntity; provenance: Provenance };
  resolveIdentity(entity: CanonicalEntity): Promise<IdentityResolution>;
}
