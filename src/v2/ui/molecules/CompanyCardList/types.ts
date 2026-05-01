/**
 * Contratto dati condiviso per CompanyCardList.
 * Le tre sorgenti (WCA Partner, Contatti CRM, Biglietti) producono
 * CompanyEntity[] tramite i propri hook adapter in src/v2/hooks/companyList/.
 */

export type CompanySource = "wca" | "crm" | "bca";

export interface ContactChannels {
  email: boolean;
  whatsapp: boolean;
  linkedin: boolean;
  phone: boolean;
}

export interface ContactEntity {
  id: string;
  name: string;
  role?: string | null;
  email?: string | null;
  phone?: string | null;
  channels: ContactChannels;
  unreadCount?: number;
  /** True se il contatto è nel circuito di attesa (Holding Pattern). */
  inHolding?: boolean;
  /**
   * Identificatore opzionale dell'azienda di appartenenza (utile per merge).
   */
  companyId?: string | null;
  /**
   * Payload originale per chi vuole aprire il drawer di dettaglio.
   */
  raw?: unknown;
}

export interface CompanyBadge {
  label: string;
  tone: "wca" | "neutral" | "primary";
}

export interface CompanyEntity {
  id: string;
  name: string;
  city?: string | null;
  countryCode?: string | null;
  source: CompanySource;
  badge?: CompanyBadge;
  contactsCount: number;
  /**
   * Quando undefined indica che i contatti sono caricati on-expand
   * (lazy). Quando array (anche vuoto) sono già pronti.
   */
  contacts?: ContactEntity[];
  meta?: {
    wcaYears?: number;
    holding?: boolean;
    logoUrl?: string | null;
  };
  /**
   * Score sintetico 0-100 (rating WCA, lead score CRM, match confidence BCA).
   * Quando assente la pill score non viene mostrata.
   */
  score?: number | null;
  /**
   * Referente principale da mostrare in sub-header (riga 2 dell'header).
   * Per WCA: primo `partner_contacts`. Per CRM: primo contatto del gruppo.
   * Per BCA: `contact_name + position` del biglietto.
   */
  primaryContact?: { name: string; role?: string | null } | null;
  /**
   * Canali di contatto aggregati a livello azienda (per la riga compatta).
   * Indipendente da quelli dei singoli `contacts`.
   */
  channels?: ContactChannels & { website?: boolean };
  /** True se l'azienda ha almeno un biglietto BCA collegato. */
  hasBca?: boolean;
  /**
   * Payload originale per le azioni (apertura drawer, ⋯).
   */
  raw?: unknown;
}

export interface CompanyCardListCallbacks {
  /** Apertura del drawer di dettaglio per la company. */
  onOpenCompany?: (company: CompanyEntity) => void;
  /** Apertura del drawer di dettaglio per un singolo contatto. */
  onOpenContact?: (contact: ContactEntity, company: CompanyEntity) => void;
  /** Lazy-load dei contatti quando la card viene espansa. */
  onExpand?: (company: CompanyEntity) => void;
}