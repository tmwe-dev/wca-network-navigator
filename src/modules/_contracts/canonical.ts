/**
 * Canonical Data Model (CDM) — SOLO TIPI.
 *
 * Nessun runtime, nessun import da parte del codice esistente: questo file definisce il
 * vocabolario condiviso verso cui i moduli e i servizi esterni convergeranno.
 * Non modificare le tabelle esistenti sulla base di questi tipi senza un batch dedicato.
 */

/** Sorgente autorevole di un dato. */
export type SourceSystem =
  | "navigator"
  | "wca-network"
  | "funnemail"
  | "scraper"
  | "research-engine"
  | "company-report"
  | "manual";

/** Ogni record importato deve trasportare la sua provenienza. */
export interface Provenance {
  source: SourceSystem;
  /** Identificativo del record nel sistema sorgente. */
  sourceId: string;
  fetchedAt: string;
  /** 0..1 — affidabilità della sorgente per quel campo/record. */
  confidence: number;
  /** URL o riferimento umano-leggibile all'origine. */
  reference?: string;
}

/** Riferimento stabile a un'entità canonica ("contact:uuid"). */
export type EntityRef = `${CanonicalEntityKind}:${string}`;

export type CanonicalEntityKind =
  | "company"
  | "contact"
  | "partner"
  | "relationship"
  | "interaction"
  | "research"
  | "opportunity"
  | "task";

export interface CanonicalBase {
  id: string;
  kind: CanonicalEntityKind;
  provenance: Provenance[];
  createdAt: string;
  updatedAt: string;
}

export interface Company extends CanonicalBase {
  kind: "company";
  legalName: string;
  normalizedName: string;
  country?: string;
  city?: string;
  website?: string;
  vatNumber?: string;
  externalRefs?: Partial<Record<SourceSystem, string>>;
}

export interface Contact extends CanonicalBase {
  kind: "contact";
  fullName?: string;
  email?: string;
  phone?: string;
  linkedinUrl?: string;
  role?: string;
  companyId?: string;
  /** Record sorgente fusi in questa identità canonica. */
  mergedFrom?: EntityRef[];
}

export interface Partner extends CanonicalBase {
  kind: "partner";
  companyId: string;
  network?: string;
  services?: string[];
  status?: string;
}

export type RelationshipKind = "works_at" | "partner_of" | "referred_by" | "same_group";

export interface Relationship extends CanonicalBase {
  kind: "relationship";
  type: RelationshipKind;
  from: EntityRef;
  to: EntityRef;
}

export type CommunicationChannel = "email" | "whatsapp" | "linkedin" | "call" | "meeting" | "note";

export interface Interaction extends CanonicalBase {
  kind: "interaction";
  channel: CommunicationChannel;
  direction: "inbound" | "outbound";
  occurredAt: string;
  subjectRef: EntityRef;
  summary?: string;
  externalId?: string;
}

export interface ResearchSnapshot extends CanonicalBase {
  kind: "research";
  subjectRef: EntityRef;
  topic: string;
  data: Record<string, unknown>;
  expiresAt?: string;
}

export interface Opportunity extends CanonicalBase {
  kind: "opportunity";
  subjectRef: EntityRef;
  stage: string;
  value?: number;
  currency?: string;
}

export interface Task extends CanonicalBase {
  kind: "task";
  subjectRef: EntityRef;
  title: string;
  dueAt?: string;
  status: "open" | "done" | "cancelled";
}

export type CanonicalEntity =
  | Company
  | Contact
  | Partner
  | Relationship
  | Interaction
  | ResearchSnapshot
  | Opportunity
  | Task;
