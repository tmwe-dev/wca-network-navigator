/**
 * dimensionCalculators.ts — Individual dimension scoring for client quality.
 *
 * Calculates 4 dimensions:
 * 1. Seniority (time as client)
 * 2. Industry (logistics relevance)
 * 3. Geography (market development)
 * 4. Engagement (interaction recency & completeness)
 */

export interface DimensionScore {
  score: number; // 0-100
  details: Record<string, any>;
}

export interface ClientData {
  id: string;
  company_name?: string;
  contact_name?: string;
  name?: string;
  email?: string;
  phone?: string;
  country?: string;
  city?: string;
  lead_status?: string;
  created_at?: string;
  last_interaction_at?: string;
  tags?: string[] | string;
  notes?: string;
  job_title?: string;
  position?: string;
  industry?: string;
  enrichment_data?: Record<string, any>;
  raw_data?: Record<string, any>;
  converted_at?: string;
}

// ════════════════════════════════════════════════════════════════════
// INDUSTRY MAPPING
// ════════════════════════════════════════════════════════════════════

interface IndustryMap {
  [key: string]: number; // industry key -> base score (90-100, 70-89, etc.)
}

export const INDUSTRY_SCORING: IndustryMap = {
  // High value (90-100pts): automotive, pharmaceutical, electronics, oil_gas, chemicals, machinery, aerospace
  automotive: 100,
  "auto": 100,
  "automotive_supplier": 95,
  "car_manufacturing": 100,
  "vehicle": 95,
  pharmaceutical: 100,
  "pharma": 100,
  "medicine": 95,
  "drug": 95,
  electronics: 95,
  "electronic_components": 95,
  "semiconductor": 100,
  "computer_hardware": 90,
  oil_gas: 100,
  "energy": 95,
  "oil": 100,
  "gas": 100,
  "petroleum": 100,
  chemicals: 95,
  "chemical": 95,
  "specialty_chemicals": 100,
  machinery: 95,
  "industrial_machinery": 95,
  "machinery_equipment": 95,
  aerospace: 100,
  "aviation": 95,
  "aircraft": 100,
  "defense": 95,

  // Medium-high (70-89pts): food_beverage, textiles, consumer_goods, agriculture, construction, mining
  food_beverage: 80,
  "food": 80,
  "beverage": 75,
  "food_production": 80,
  "wine": 75,
  textiles: 75,
  "textile": 75,
  "apparel": 70,
  "clothing": 70,
  "fashion": 70,
  consumer_goods: 75,
  "cpg": 75,
  "consumer_products": 75,
  "household": 70,
  agriculture: 75,
  "agri": 75,
  "farm": 75,
  "farming": 75,
  construction: 75,
  "build": 75,
  "building": 75,
  "construction_materials": 80,
  mining: 75,
  "mine": 75,
  "extraction": 75,

  // Medium (50-69pts): retail, ecommerce, technology, healthcare
  retail: 60,
  "retail_commerce": 60,
  "store": 55,
  ecommerce: 65,
  "e_commerce": 65,
  "online_retail": 65,
  "marketplace": 60,
  technology: 55,
  "tech": 55,
  "software": 55,
  "it": 55,
  "ict": 55,
  healthcare: 60,
  "health": 60,
  "medical": 60,
  "hospital": 60,
  "clinic": 60,

  // Lower (30-49pts): services, finance, education, government, nonprofit
  services: 40,
  "service": 40,
  "consulting": 40,
  "professional_services": 45,
  finance: 35,
  "financial": 35,
  "banking": 35,
  "insurance": 35,
  education: 40,
  "school": 40,
  "university": 40,
  "training": 40,
  government: 30,
  "public": 30,
  "admin": 30,
  nonprofit: 35,
  "ngo": 35,
  "charity": 35,

  // Default for unknown
  unknown: 20,
};

// ════════════════════════════════════════════════════════════════════
// GEOGRAPHY MAPPING
// ════════════════════════════════════════════════════════════════════

interface CountryTierMap {
  [countryCode: string]: number; // ISO country code -> score (90-100, 70-89, etc.)
}

export const COUNTRY_TIER_SCORING: CountryTierMap = {
  // Tier 1 — Developed logistics markets (90-100pts)
  "US": 100, "CA": 95, "DE": 100, "GB": 100, "FR": 95, "IT": 90, "NL": 100, "BE": 95,
  "CH": 100, "AT": 95, "JP": 100, "KR": 95, "AU": 95, "SG": 100, "HK": 100, "AE": 90,
  "SE": 95, "NO": 95, "DK": 95, "FI": 95,

  // Tier 2 — Emerging strong markets (70-89pts)
  "CN": 80, "IN": 75, "BR": 80, "MX": 80, "TR": 75, "PL": 80, "CZ": 80, "RO": 75,
  "TH": 75, "MY": 75, "VN": 70, "SA": 75, "QA": 75, "KW": 75, "ZA": 75, "IL": 80,
  "NZ": 85, "IE": 95, "PT": 85, "ES": 90,

  // Tier 3 — Developing markets (50-69pts)
  "ID": 60, "PH": 60, "BD": 55, "PK": 55, "NG": 50, "KE": 55, "EG": 55, "MA": 60,
  "TN": 55, "CO": 60, "PE": 60, "CL": 65, "AR": 65, "UA": 55, "KZ": 60, "UZ": 55,

  // Tier 4 — Frontier markets (30-49pts) — default for all others
};

function getCountryScore(country?: string): number {
  if (!country) return 40;
  const countryCode = country.toUpperCase().trim();
  return COUNTRY_TIER_SCORING[countryCode] ?? 40;
}

// ════════════════════════════════════════════════════════════════════
// DIMENSION CALCULATORS
// ════════════════════════════════════════════════════════════════════

/**
 * Dimension 1: Seniority / Anzianità (weight 25%)
 * Calcola in base a created_at, first interaction, converted_at.
 */
export function calculateSeniority(client: ClientData): DimensionScore {
  const details: Record<string, any> = {};
  let score = 10; // default for < 3 months

  let referenceDate: Date | null = null;

  if (client.converted_at) {
    referenceDate = new Date(client.converted_at);
    details.type = "converted";
  } else if (client.created_at) {
    referenceDate = new Date(client.created_at);
    details.type = "created";
  }

  if (referenceDate) {
    const today = new Date();
    const yearsAsClient = (today.getTime() - referenceDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    const monthsAsClient = yearsAsClient * 12;

    details.yearsAsClient = Math.round(yearsAsClient * 10) / 10;
    details.monthsAsClient = Math.round(monthsAsClient);
    details.referenceDate = referenceDate.toISOString();

    if (yearsAsClient >= 5) {
      score = 100;
      details.band = "5+ anni";
    } else if (yearsAsClient >= 3) {
      score = 80;
      details.band = "3-5 anni";
    } else if (yearsAsClient >= 1) {
      score = 60;
      details.band = "1-3 anni";
    } else if (monthsAsClient >= 6) {
      score = 40;
      details.band = "6-12 mesi";
    } else if (monthsAsClient >= 3) {
      score = 25;
      details.band = "3-6 mesi";
    } else {
      score = 10;
      details.band = "< 3 mesi";
    }
  } else {
    details.band = "sconosciuto";
  }

  return { score, details };
}

/**
 * Dimension 2: Industry Sector / Settore Merceologico (weight 25%)
 * Score based on logistics relevance and typical shipping volume.
 */
export function calculateIndustry(client: ClientData): DimensionScore {
  const details: Record<string, any> = {};
  let score = 20; // default for unknown

  let industry: string | null = null;

  // 1. Check direct industry field
  if (client.industry) {
    industry = client.industry.toLowerCase().trim();
  }

  // 2. Check in tags
  if (!industry && client.tags) {
    const tagsArray = Array.isArray(client.tags) ? client.tags : String(client.tags).split(",");
    for (const tag of tagsArray) {
      const cleanTag = tag.toLowerCase().trim();
      if (INDUSTRY_SCORING[cleanTag]) {
        industry = cleanTag;
        details.foundIn = "tags";
        break;
      }
    }
  }

  // 3. Check in notes/raw_data
  if (!industry && client.notes) {
    const notesLower = client.notes.toLowerCase();
    for (const industryKey of Object.keys(INDUSTRY_SCORING)) {
      if (notesLower.includes(industryKey)) {
        industry = industryKey;
        details.foundIn = "notes";
        break;
      }
    }
  }

  // 4. Check enrichment_data
  if (!industry && client.enrichment_data) {
    if (client.enrichment_data.industry) {
      industry = client.enrichment_data.industry.toLowerCase().trim();
      details.foundIn = "enrichment_data";
    }
  }

  if (industry) {
    score = INDUSTRY_SCORING[industry] ?? 20;
    details.industry = industry;
    details.score_reason = `${industry}: ${score}pts`;
  } else {
    details.industry = null;
    details.score_reason = "Industry not specified";
  }

  return { score, details };
}

/**
 * Dimension 3: Geography / Posizione Geografica (weight 25%)
 * Based on country development and logistics market maturity.
 */
export function calculateGeography(client: ClientData): DimensionScore {
  const details: Record<string, any> = {};

  const country = client.country || "";
  const countryCode = country.toUpperCase().trim();
  const score = getCountryScore(countryCode);

  details.country = country || null;
  details.countryCode = countryCode || null;

  // Determine tier
  if (score >= 90) {
    details.tier = "Tier 1 - Developed logistics markets";
  } else if (score >= 70) {
    details.tier = "Tier 2 - Emerging strong markets";
  } else if (score >= 50) {
    details.tier = "Tier 3 - Developing markets";
  } else {
    details.tier = "Tier 4 - Frontier markets";
  }

  if (client.city) {
    details.city = client.city;
  }

  return { score, details };
}

/**
 * Dimension 4: Engagement / Coinvolgimento (weight 25%)
 * Based on recency, contact completeness, and lead status.
 */
export function calculateEngagement(client: ClientData): DimensionScore {
  const details: Record<string, any> = {};
  let score = 0;

  // Recent interaction (up to 30pts)
  if (client.last_interaction_at) {
    const lastInteraction = new Date(client.last_interaction_at);
    const today = new Date();
    const daysAgo = (today.getTime() - lastInteraction.getTime()) / (24 * 60 * 60 * 1000);

    details.daysLastInteraction = Math.round(daysAgo);

    if (daysAgo <= 30) {
      score += 30;
      details.interaction_band = "within 30 days";
    } else if (daysAgo <= 90) {
      score += 20;
      details.interaction_band = "within 90 days";
    } else if (daysAgo <= 180) {
      score += 10;
      details.interaction_band = "within 180 days";
    } else {
      details.interaction_band = "older than 180 days";
    }
  } else {
    details.interaction_band = "no interaction recorded";
  }

  // Contact completeness (up to 20pts)
  const hasEmail = Boolean(client.email);
  const hasPhone = Boolean(client.phone);

  if (hasEmail && hasPhone) {
    score += 20;
    details.contact_completeness = "email + phone";
  } else if (hasEmail) {
    score += 10;
    details.contact_completeness = "email only";
  } else if (hasPhone) {
    score += 5;
    details.contact_completeness = "phone only";
  } else {
    details.contact_completeness = "no contact";
  }

  // Lead status (up to 25pts)
  const leadStatus = (client.lead_status || "").toLowerCase().trim();
  if (leadStatus === "converted") {
    score += 25;
    details.lead_status = "converted";
  } else if (leadStatus === "negotiation" || leadStatus === "in_progress") {
    score += 20;
    details.lead_status = leadStatus;
  } else if (leadStatus === "qualified" || leadStatus === "contacted") {
    score += 15;
    details.lead_status = leadStatus;
  } else if (leadStatus === "engaged") {
    score += 10;
    details.lead_status = leadStatus;
  } else {
    details.lead_status = leadStatus || "unknown";
  }

  return { score: Math.min(score, 100), details };
}

// ════════════════════════════════════════════════════════════════════
// LEGACY PARTNER QUALITY DIMENSIONS (stub — implementation refactored away)
// ════════════════════════════════════════════════════════════════════
// These four functions exist for backward compatibility with
// qualityOrchestrator.ts. The real partner-quality logic has been
// superseded by the client-quality engine above. Each returns a
// neutral QualityDimension so callers compile and run without errors.

import type { QualityDimension, PartnerData } from "./qualityTypes.ts";

function neutralDimension(name: string, weight: number): QualityDimension {
  return {
    name,
    score: 0,
    weight,
    details: {},
  };
}

export async function calculateProfilePresence(
  _supabase: unknown,
  _partnerId: string,
  _partner: PartnerData,
): Promise<QualityDimension> {
  return neutralDimension("Profile Presence", 0.25);
}

export async function calculateBusinessSolidity(
  _supabase: unknown,
  _partnerId: string,
  _partner: PartnerData,
): Promise<QualityDimension> {
  return neutralDimension("Business Solidity", 0.25);
}

export async function calculateServicesCapacity(
  _supabase: unknown,
  _partnerId: string,
  _partner: PartnerData,
): Promise<QualityDimension> {
  return neutralDimension("Services & Capacity", 0.25);
}

export async function calculateDeepIntelligence(
  _supabase: unknown,
  _partnerId: string,
  _partner: PartnerData,
): Promise<QualityDimension> {
  return neutralDimension("Deep Intelligence", 0.25);
}
