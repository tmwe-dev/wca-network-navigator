/**
 * clientQualityScore.ts — Sistema di valutazione della qualità clienti finali (LOVABLE-93)
 *
 * Calcola uno score 0-100 per clienti finali (imported_contacts e business_cards).
 * SEPARATO dal partner quality score — applica a clienti, non a partner/forwarders WCA.
 *
 * Dimensioni di valutazione (0-100 ciascuna, peso 25% ognuna):
 *   1. Seniority / Anzianità (25%) — tempo come cliente (created_at, converted_at, last_interaction_at)
 *   2. Industry Sector / Settore Merceologico (25%) — rilevanza logistica e volume spedizioni
 *   3. Geography / Posizione Geografica (25%) — sviluppo mercato logistico per paese
 *   4. Engagement / Coinvolgimento (25%) — contatti, lead status, interazioni recenti
 *
 * Tier mapping:
 *   0-25 → Bronze
 *   26-50 → Silver
 *   51-75 → Gold
 *   76-100 → Platinum
 *
 * Aggiorna imported_contacts.client_quality_score (JSONB) o business_cards.client_quality_score.
 */

import type { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

type SupabaseClient = ReturnType<typeof createClient>;

// ════════════════════════════════════════════════════════════════════
// TYPES
// ════════════════════════════════════════════════════════════════════

export interface DimensionScore {
  score: number; // 0-100
  details: Record<string, any>;
}

export interface ClientQualityResult {
  totalScore: number; // 0-100
  tier: "bronze" | "silver" | "gold" | "platinum";
  dimensions: {
    seniority: DimensionScore;
    industry: DimensionScore;
    geography: DimensionScore;
    engagement: DimensionScore;
  };
  calculatedAt: string;
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

const INDUSTRY_SCORING: IndustryMap = {
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

const COUNTRY_TIER_SCORING: CountryTierMap = {
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
 *
 * 5+ years: 100pts
 * 3-5 years: 80pts
 * 1-3 years: 60pts
 * 6-12 months: 40pts
 * 3-6 months: 25pts
 * < 3 months: 10pts
 */
function calculateSeniority(client: ClientData): DimensionScore {
  const details: Record<string, any> = {};
  let score = 10; // default for < 3 months

  // Try to get the earliest date (converted_at or created_at)
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
function calculateIndustry(client: ClientData): DimensionScore {
  const details: Record<string, any> = {};
  let score = 20; // default for unknown

  // Try to find industry from multiple sources
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
function calculateGeography(client: ClientData): DimensionScore {
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
function calculateEngagement(client: ClientData): DimensionScore {
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

  // Note: interaction count would require querying activities/channel_messages table
  // For now, lead_status covers this dimension well

  return { score: Math.min(score, 100), details };
}

// ════════════════════════════════════════════════════════════════════
// MAIN CALCULATION FUNCTION
// ════════════════════════════════════════════════════════════════════

/**
 * Calcola il client quality score per un cliente finale.
 *
 * LOVABLE-93: Client Quality Score engine
 */
export async function calculateClientQuality(
  supabase: SupabaseClient,
  clientId: string,
  sourceType: "imported_contact" | "business_card",
): Promise<ClientQualityResult> {
  // Load client data
  const table = sourceType === "imported_contact" ? "imported_contacts" : "business_cards";

  const { data: clientData, error } = await supabase
    .from(table)
    .select("*")
    .eq("id", clientId)
    .maybeSingle();

  if (error || !clientData) {
    throw new Error(`Failed to load ${sourceType} ${clientId}: ${error?.message ?? "Not found"}`);
  }

  const client = clientData as ClientData;

  // Calculate all 4 dimensions
  const seniority = calculateSeniority(client);
  const industry = calculateIndustry(client);
  const geography = calculateGeography(client);
  const engagement = calculateEngagement(client);

  // Weighted total score (each dimension: 25%)
  const totalScore = Math.round(
    seniority.score * 0.25 +
      industry.score * 0.25 +
      geography.score * 0.25 +
      engagement.score * 0.25,
  );

  // Determine tier
  let tier: "bronze" | "silver" | "gold" | "platinum";
  if (totalScore >= 76) {
    tier = "platinum";
  } else if (totalScore >= 51) {
    tier = "gold";
  } else if (totalScore >= 26) {
    tier = "silver";
  } else {
    tier = "bronze";
  }

  const result: ClientQualityResult = {
    totalScore,
    tier,
    dimensions: {
      seniority,
      industry,
      geography,
      engagement,
    },
    calculatedAt: new Date().toISOString(),
  };

  return result;
}

// ════════════════════════════════════════════════════════════════════
// SAVE FUNCTION
// ════════════════════════════════════════════════════════════════════

/**
 * Salva il client quality score nei campi JSONB dei clienti.
 *
 * LOVABLE-93: Client Quality Score engine
 */
export async function saveClientQuality(
  supabase: SupabaseClient,
  clientId: string,
  sourceType: "imported_contact" | "business_card",
  result: ClientQualityResult,
): Promise<void> {
  const table = sourceType === "imported_contact" ? "imported_contacts" : "business_cards";

  const { error } = await supabase
    .from(table)
    .update({
      client_quality_score: {
        version: "lovable-93-client-quality-v1",
        totalScore: result.totalScore,
        tier: result.tier,
        dimensions: {
          seniority: result.dimensions.seniority,
          industry: result.dimensions.industry,
          geography: result.dimensions.geography,
          engagement: result.dimensions.engagement,
        },
        calculatedAt: result.calculatedAt,
      },
    })
    .eq("id", clientId);

  if (error) {
    throw new Error(`Failed to save client quality for ${sourceType} ${clientId}: ${error.message}`);
  }
}

/**
 * Wrapper conveniente: calcola e salva in una sola chiamata.
 *
 * LOVABLE-93: Client Quality Score engine
 */
export async function calculateAndSaveClientQuality(
  supabase: SupabaseClient,
  clientId: string,
  sourceType: "imported_contact" | "business_card",
): Promise<ClientQualityResult> {
  const result = await calculateClientQuality(supabase, clientId, sourceType);
  await saveClientQuality(supabase, clientId, sourceType, result);
  return result;
}

// ════════════════════════════════════════════════════════════════════
// FORMATTING FOR PROMPT / DISPLAY
// ════════════════════════════════════════════════════════════════════

/**
 * Formatta il client quality score in formato leggibile per i prompt.
 *
 * LOVABLE-93: Client Quality Score engine
 */
export function formatClientQualityForPrompt(result: ClientQualityResult): string {
  const tierEmoji = {
    bronze: "🥉",
    silver: "🥈",
    gold: "🥇",
    platinum: "💎",
  };

  const lines = [
    `QUALITÀ CLIENTE: ${tierEmoji[result.tier]} ${result.tier.toUpperCase()} (${result.totalScore}/100)`,
    `- Anzianità: ${result.dimensions.seniority.score}/100 (${result.dimensions.seniority.details.band || "sconosciuto"})`,
    `- Settore: ${result.dimensions.industry.score}/100 (${result.dimensions.industry.details.industry || "sconosciuto"})`,
    `- Geografia: ${result.dimensions.geography.score}/100 (${result.dimensions.geography.details.tier})`,
    `- Coinvolgimento: ${result.dimensions.engagement.score}/100 (${result.dimensions.engagement.details.lead_status || "unknown"})`,
  ];

  return lines.join("\n");
}

/**
 * Versione semplificata del formatting (una riga sola).
 *
 * LOVABLE-93: Client Quality Score engine
 */
export function formatClientQualityShort(result: ClientQualityResult): string {
  const tierEmoji = {
    bronze: "🥉",
    silver: "🥈",
    gold: "🥇",
    platinum: "💎",
  };

  return `${tierEmoji[result.tier]} ${result.tier.toUpperCase()} (${result.totalScore}/100)`;
}
