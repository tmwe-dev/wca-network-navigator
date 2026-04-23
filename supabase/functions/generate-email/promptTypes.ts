/**
 * promptTypes.ts — Type definitions for email prompt building.
 */
import type { Quality } from "../_shared/kbSlice.ts";

export interface PartnerData {
  id: string | null;
  company_name: string;
  company_alias: string | null;
  country_code: string;
  country_name: string;
  city: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  profile_description: string | null;
  rating: number | null;
  raw_profile_markdown: string | null;
  enrichment_data?: Record<string, unknown>;
  office_type?: string;
  lead_status?: string;
}

export interface ContactData {
  id: string;
  name: string;
  email: string | null;
  direct_phone: string | null;
  mobile: string | null;
  title: string | null;
  contact_alias: string | null;
}

export interface NetworkRow { network_name: string; }
export interface ServiceRow { service_category: string; }
export interface SocialLinkRow { platform: string; url: string; contact_id: string | null; }

export interface EmailPromptContext {
  partner: PartnerData;
  contact: ContactData | null;
  contactEmail: string | null;
  sourceType: string;
  quality: Quality;
  language?: string;
  goal?: string;
  base_proposal?: string;
  oracle_type?: string;
  oracle_tone?: string;
  use_kb?: boolean;
  email_type_prompt?: string | null;
  email_type_structure?: string | null;
  networks: NetworkRow[];
  services: ServiceRow[];
  socialLinks: SocialLinkRow[];
  settings: Record<string, string>;
  historyContext: string;
  relationshipBlock: string;
  branchBlock: string;
  interlocutorBlock: string;
  metInPersonContext: string;
  cachedEnrichmentContext: string;
  documentsContext: string;
  stylePreferencesContext: string;
  editPatternsContext: string;
  responseInsightsContext: string;
  conversationIntelligenceContext: string;
  salesKBSlice: string;
  salesKBSections: string[];
  signatureBlock: string;
  commercialState?: string;
  touchCount?: number;
  lastChannel?: string;
  lastOutcome?: string;
  daysSinceLastContact?: number;
  warmthScore?: number;
  playbookBlock?: string;
  addressCustomPrompt?: string;
  addressCategory?: string;
  /** LOVABLE-110: Regole e preferenze apprese dal ciclo di feedback. */
  learnedPatterns?: string;
  decisionContext?: {
    action: string;
    autonomy: string;
    channel?: string;
    journalist_role?: string;
    reasoning: string;
    priority: number;
    state: {
      leadStatus: string;
      touchCount: number;
      daysSinceLastOutbound: number;
      enrichmentScore: number;
    };
  };
}

export interface StrategicAdvisorContext {
  emailCategory?: string;
  hasHistory?: boolean;
  followUpCount?: number;
  hasEnrichmentData?: boolean;
  commercialState?: string;
  touchCount?: number;
  dataPoints?: {
    hasWebsite?: boolean;
    hasLinkedin?: boolean;
    contactProfilesCount?: number;
    hasSherlock?: boolean;
    bcaCount?: number;
    historyCount?: number;
    hasReputation?: boolean;
    hasProfileDescription?: boolean;
  };
}

export interface PromptBlock {
  label: string;
  content: string;
}

export interface BuiltPrompts {
  systemPrompt: string;
  userPrompt: string;
  blocks: PromptBlock[];
  systemBlocks: PromptBlock[];
}
