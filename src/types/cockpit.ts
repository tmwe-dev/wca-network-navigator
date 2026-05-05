/**
 * Cockpit UI Types - Shared across V1 and V2
 * Previously defined in src/pages/Cockpit.tsx (deleted)
 */

import type { OutreachDebug } from "@/hooks/useOutreachGenerator";
import type { ForgeDebug, JournalistReviewSummary } from "@/v2/hooks/useEmailForge";
import type { OracleContextSummary } from "@/components/email/OracleContextPanel";
import type { ResolvedEmailType } from "@/v2/ui/pages/email-forge/types/contract";

export type ViewMode = "card" | "list";
export type DraftChannel = "email" | "linkedin" | "whatsapp" | "sms" | null;
export type ContactOrigin = "wca" | "report_aziende" | "import" | "bca" | "manual";
export type ScrapingPhase = "idle" | "searching" | "visiting" | "extracting" | "enriching" | "reviewing" | "generating";
export type LinkedInConnectionStatus = "not_connected" | "connected" | "pending" | "unknown";

export interface CockpitFilter {
  id: string;
  label: string;
  type: "search" | "country" | "status" | "language" | "channel" | "priority" | "custom";
}

export interface LinkedInProfileData {
  name?: string;
  headline?: string;
  location?: string;
  about?: string;
  photoUrl?: string;
  profileUrl?: string;
  connectionStatus?: LinkedInConnectionStatus;
}

export interface DraftLink { label: string; url: string }
export interface DraftAttachment { name: string; path: string; size: number; mime: string }

export interface DraftState {
  channel: DraftChannel;
  contactId: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  contactLinkedinUrl: string | null;
  companyName: string | null;
  countryCode: string | null;
  subject: string;
  body: string;
  language: string;
  isGenerating: boolean;
  scrapingPhase: ScrapingPhase;
  linkedinProfile: LinkedInProfileData | null;
  searchLog?: import("@/hooks/useLinkedInLookup").SearchLogEntry[];
  _debug?: OutreachDebug;
  _forgeDebug?: ForgeDebug;
  journalist_review?: JournalistReviewSummary | null;
  type_resolution?: ResolvedEmailType | null;
  context_summary?: OracleContextSummary;
  /** Link che l'AI deve citare nel testo (iniettati nel goal). */
  links?: DraftLink[];
  /** URL immagini già inserite inline nel body (solo per badge counter). */
  inlineImages?: string[];
  /** Allegati da inviare insieme all'email (path nel bucket cockpit-attachments). */
  attachments?: DraftAttachment[];
  /**
   * Quando la bozza è una risposta a una mail entrante, qui c'è il riferimento
   * al messaggio originale (per il pulsante "leggi mail originale" e per
   * impostare i default Oracolo su "contesto_email").
   */
  replySource?: {
    messageId: string;
    subject?: string;
    channelMessageId?: string;
  } | null;
}
