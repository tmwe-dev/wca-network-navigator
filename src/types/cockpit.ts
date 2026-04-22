/**
 * Cockpit UI Types - Shared across V1 and V2
 * Previously defined in src/pages/Cockpit.tsx (deleted)
 */

import type { OutreachDebug } from "@/hooks/useOutreachGenerator";

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
}
