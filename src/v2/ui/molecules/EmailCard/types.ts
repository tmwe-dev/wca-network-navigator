/**
 * EmailCard — modello dati logic-less per la card email standardizzata.
 * Costruito dal hook (es. useFunnemailInbox) a partire da ChannelMessage +
 * snapshot Funnemail (folder, decision, partner, sender intel).
 */
import type { FunnemailJobStatus } from "@/data/funnemailStatuses";

export interface EmailCardEntity {
  id: string;
  /** Azienda mittente (UPPERCASE, fallback al brand del dominio). */
  company: string;
  /** Nome persona estratto (es. "Mario Rossi"). */
  personName?: string | null;
  /** Ruolo del mittente (se noto). */
  personRole?: string | null;
  /** Indirizzo email completo. */
  fromAddress: string | null;
  /** Telefono opzionale (per quick-action). */
  phone?: string | null;
  /** Codice ISO paese (2 lettere). */
  countryCode?: string | null;
  /** Città partner. */
  city?: string | null;
  /** Oggetto pulito (senza Re:/Fwd:). */
  subject: string;
  /** Preview testo (2 righe, già pulito). */
  preview?: string | null;
  /** Data email per recency. */
  dateIso?: string | null;
  /** Cartella Funnemail corrente (label). */
  folderLabel?: string | null;
  folderIcon?: string | null;
  /** Categoria AI suggerita. */
  aiSuggestion?: string | null;
  /** Urgency normalizzata. */
  urgency?: "critical" | "high" | "normal" | "low" | null;
  /** Email assegnata all'agenda. */
  goesToAgenda?: boolean;
  /** Mail non letta. */
  unread?: boolean;
  /** Allegati presenti. */
  hasAttachments?: boolean;
  /** In holding pattern. */
  inHolding?: boolean;
  /** Score 0-100 lead. */
  score?: number | null;
  /** Job status (lavorazione). */
  jobStatus?: FunnemailJobStatus | null;
}

export interface EmailCardCallbacks {
  onOpen?: (id: string) => void;
  onReclassify?: (id: string) => void;
  onMarkRead?: (id: string) => void;
  onArchive?: (id: string) => void;
  onAddToAgenda?: (id: string) => void;
}