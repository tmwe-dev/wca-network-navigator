/**
 * DAL — contratto tipizzato per relazioni ASSENTI dallo schema live.
 *
 * Alcune feature del prodotto sono state scritte contro tabelle che non sono
 * mai state provisionate in `public` (verificato via information_schema). Il
 * pattern precedente le interrogava comunque tramite un query builder untyped
 * e degradava sull'errore PostgREST 42P01. Questo è doppiamente sbagliato:
 *  - introduce un boundary `any` in tutto il DAL;
 *  - produce round-trip di rete garantiti a fallire su ogni render.
 *
 * Il contratto onesto è: NON interrogare una relazione inesistente. Le letture
 * restituiscono un fallback esplicito (pagina navigabile, stato vuoto), le
 * scritture falliscono in modo chiuso con un errore riconoscibile.
 *
 * Quando una relazione viene realmente creata a DB, va rimossa da
 * `ABSENT_RELATIONS` e i call site migrati al client tipizzato.
 */
import { createLogger } from "@/lib/log";

const log = createLogger("dal:unavailable-schema");

/**
 * Relazioni referenziate dal codice applicativo ma assenti da `public`.
 * Verificato su information_schema: nessuna di queste esiste a DB.
 */
export const ABSENT_RELATIONS = [
  // Modulo Report Aziende (mai provisionato)
  "ra_prospects",
  "ra_contacts",
  "ra_interactions",
  "ra_scraping_jobs",
  // Funnemail eval — batch runs storici
  "funnemail_eval_batch_runs",
  "funnemail_eval_dataset",
] as const;

export type AbsentRelation = (typeof ABSENT_RELATIONS)[number];

/** Errore sollevato quando una scrittura punta a una relazione assente. */
export class SchemaUnavailableError extends Error {
  readonly code = "SCHEMA_UNAVAILABLE";
  readonly relation: AbsentRelation;

  constructor(relation: AbsentRelation) {
    super(
      `La relazione "${relation}" non esiste nello schema del database: ` +
        `la funzionalità non è disponibile finché la tabella non viene creata.`,
    );
    this.name = "SchemaUnavailableError";
    this.relation = relation;
  }
}

export function isSchemaUnavailableError(error: unknown): error is SchemaUnavailableError {
  return error instanceof SchemaUnavailableError;
}

/**
 * Lettura da relazione assente: nessuna query, fallback esplicito.
 * Il tipo del fallback fissa il contratto di ritorno del chiamante.
 */
export function unavailableRead<T>(relation: AbsentRelation, fallback: T): T {
  log.debug("read skipped: relation absent from live schema", { relation });
  return fallback;
}

/** Scrittura su relazione assente: fail closed, nessuna query. */
export function unavailableWrite(relation: AbsentRelation): never {
  throw new SchemaUnavailableError(relation);
}