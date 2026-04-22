/**
 * qualityTypes.ts — Type definitions for partner quality scoring
 *
 * Exports all interfaces and types for the partner quality calculation engine.
 */

export interface DetailScore {
  score: number;
  maxScore: number;
  reason: string;
}

export interface QualityDimension {
  name: string;
  score: number; // 0-100
  weight: number; // 0-1, sum = 1
  details: Record<string, DetailScore>;
}

export interface PartnerQualityResult {
  totalScore: number; // 0-100, after WCA modifier applied
  stars: number; // 1-5
  dimensions: QualityDimension[];
  calculatedAt: string;
  dataCompleteness: number; // 0-100, percentage of available data
  // LOVABLE-93: WCA logistics value modifier
  wcaModifier?: {
    modifier: number; // -20 to +30
    details: WCAModifierDetails;
  };
}

// Legacy interface for backward compatibility
export interface PartnerQualityScore {
  total_score: number;
  star_rating: number;
  dimensions: {
    profilo_e_presenza: number;
    solidita_aziendale: number;
    servizi_e_capacita: number;
    intelligence: number;
  };
  data_completeness_percent: number;
  calculated_at: string;
}

export interface PartnerData {
  id: string;
  raw_profile_markdown: string | null;
  ai_parsed_at: string | null;
  website: string | null;
  linkedin_url: string | null;
  logo_url: string | null;
  member_since: string | null;
  membership_expires: string | null;
  office_type: string;
  has_branches: boolean;
  branch_cities: unknown;
  enrichment_data: Record<string, unknown> | null;
  partner_type?: string | null;
  country_code?: string | null;
}

// LOVABLE-93: WCA logistics value modifier
export interface WCAModifierBonus {
  type: string;
  points: number;
  reason: string;
}

export interface WCAModifierDetails {
  total: number;
  bonuses: WCAModifierBonus[];
  penalties: WCAModifierBonus[];
  route_highlights: string[];
  capability_keywords_found: string[];
}
