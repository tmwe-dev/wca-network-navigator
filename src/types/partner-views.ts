/**
 * Shared Partner view-model types for UI components.
 * These replace `Record<string, any>` across partner components.
 */
import type { Json } from "@/integrations/supabase/types";

/** Service relation from Supabase join */
export interface PartnerServiceView { service_category: string }

/** Certification relation from Supabase join */
export interface PartnerCertificationView { certification: string }

/** Network relation from Supabase join */
export interface PartnerNetworkView {
  id: string;
  network_name: string;
  expires?: string | null;
}

/** Contact relation from Supabase join */
export interface PartnerContactView {
  id: string;
  name: string;
  title?: string | null;
  email?: string | null;
  direct_phone?: string | null;
  mobile?: string | null;
  is_primary?: boolean | null;
  contact_alias?: string | null;
  [key: string]: unknown;
}

/** Interaction from Supabase join */
export interface PartnerInteractionView {
  id: string;
  interaction_type: string;
  title: string;
  notes?: string | null;
  created_at: string;
}

/** Reminder from Supabase join */
export interface PartnerReminderView {
  id: string;
  title: string;
  remind_at: string;
  completed: boolean;
}

/** Enrichment data shape stored as JSON in partners.enrichment_data */
export interface EnrichmentData {
  deep_search_at?: string;
  linkedin_url?: string;
  facebook_url?: string;
  instagram_url?: string;
  whatsapp_url?: string;
  company_linkedin_url?: string;
  company_website?: string;
  logo_url?: string;
  website_quality_score?: number;
  confidence?: string;
  tokens_used?: {
    credits_consumed: number;
    prompt?: number;
    completion?: number;
  };
  company_profile?: {
    awards?: Array<string | Record<string, unknown>>;
    specialties?: string[];
    recent_news?: string;
    founded_year?: number;
    employee_count_estimate?: number;
  };
  contact_profile?: {
    background?: string;
    languages?: string[];
    interests?: string[];
    seniority?: string;
    linkedin_title?: string;
    other_companies?: string[];
  };
  [key: string]: unknown;
}

/**
 * Partner view-model used in UI components.
 * Covers all fields accessed across PartnerCard, PartnerListItem,
 * PartnerDetailCompact, PartnerDetailFull, PartnerDetailHeader, PartnerDetailInfo.
 */
export interface PartnerViewModel {
  id: string;
  wca_id: number | null;
  company_name: string;
  company_alias?: string | null;
  country_code: string;
  country_name: string;
  city: string;
  office_type?: string | null;
  address?: string | null;
  phone?: string | null;
  fax?: string | null;
  mobile?: string | null;
  emergency_phone?: string | null;
  email?: string | null;
  website?: string | null;
  member_since?: string | null;
  membership_expires?: string | null;
  profile_description?: string | null;
  has_branches?: boolean | null;
  branch_cities?: unknown;
  partner_type?: string | null;
  is_active?: boolean | null;
  is_favorite?: boolean | null;
  lead_status?: string;
  logo_url?: string | null;
  rating?: number | null;
  rating_details?: Json | null;
  enrichment_data?: EnrichmentData | null;
  enriched_at?: string | null;
  raw_profile_html?: string | null;
  raw_profile_markdown?: string | null;
  ai_parsed_at?: string | null;
  interaction_count?: number;
  last_interaction_at?: string | null;
  converted_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  user_id?: string | null;
  // Relations from Supabase joins
  partner_services?: PartnerServiceView[];
  partner_certifications?: PartnerCertificationView[];
  partner_networks?: PartnerNetworkView[];
  partner_contacts?: PartnerContactView[];
  interactions?: PartnerInteractionView[];
  reminders?: PartnerReminderView[];
}
