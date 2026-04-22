/**
 * partnerQualityScore.ts — Main orchestrator for partner quality scoring (LOVABLE-93)
 *
 * Calculates 1-5 star rating based on 4 quality dimensions + WCA logistics modifier.
 * Aggiorna automaticamente partners.rating e partners.rating_details.
 */

import type { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import {
  QUALITY_WEIGHTS,
  STAR_THRESHOLDS,
  WCA_MODIFIER_BOUNDS,
  HIGH_RISK_COUNTRIES,
  CAPABILITY_KEYWORDS,
  WCA_BONUS_POINTS,
  WCA_PENALTY_POINTS,
} from "./qualityRules";
import {
  extractFromEnrichment,
  normalizeScore,
  calculateYearsSince,
  isDateInFuture,
  scoreMembershipYears,
  scoreContactQuality,
  scoreDataFreshness,
  scoreToStars,
  clamp,
} from "./qualityHelpers";

type SupabaseClient = ReturnType<typeof createClient>;

// ════════════════════════════════════════════════════════════════════
// TYPES
// ════════════════════════════════════════════════════════════════════

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

// ════════════════════════════════════════════════════════════════════
// CALCULATION ENGINE
// ════════════════════════════════════════════════════════════════════

/**
 * Dimension 1: Profilo e Presenza (weight 0.25)
 * Valuta la completezza e qualità del profilo aziendale.
 */
async function calculateProfilePresence(
  supabase: SupabaseClient,
  partnerId: string,
  partner: PartnerData,
): Promise<QualityDimension> {
  const details: Record<string, DetailScore> = {};
  let totalScore = 0;
  const maxPossibleScore = 100;

  // profile_completeness: raw_profile_markdown
  if (partner.raw_profile_markdown) {
    const len = partner.raw_profile_markdown.length;
    if (len > 500) {
      details.profile_completeness = { score: 20, maxScore: 20, reason: "Profilo molto completo (>500 chars)" };
      totalScore += 20;
    } else if (len > 200) {
      details.profile_completeness = { score: 10, maxScore: 20, reason: "Profilo moderato (200-500 chars)" };
      totalScore += 10;
    } else if (len > 0) {
      details.profile_completeness = { score: 5, maxScore: 20, reason: "Profilo minimo (>0 chars)" };
      totalScore += 5;
    }
  } else {
    details.profile_completeness = { score: 0, maxScore: 20, reason: "Nessun profilo markdown" };
  }

  // profile_quality: AI parsing bonus
  if (partner.ai_parsed_at) {
    details.profile_quality = { score: 10, maxScore: 10, reason: "Profilo analizzato da AI" };
    totalScore += 10;
  } else {
    details.profile_quality = { score: 0, maxScore: 10, reason: "Profilo non ancora parsato" };
  }

  // website_present
  if (partner.website) {
    details.website_present = { score: 10, maxScore: 10, reason: "Sito web presente" };
    totalScore += 10;
  } else {
    details.website_present = { score: 0, maxScore: 10, reason: "Sito web non fornito" };
  }

  // website_quality: enrichment_data.website_quality_score
  const websiteQualityScore = extractFromEnrichment<number>(
    partner.enrichment_data,
    "website_quality_score",
    null,
  );
  if (websiteQualityScore !== null && websiteQualityScore > 0) {
    const score = Math.round((websiteQualityScore / 100) * 20);
    details.website_quality = { score, maxScore: 20, reason: `Score sito web: ${websiteQualityScore}/100` };
    totalScore += score;
  } else {
    details.website_quality = { score: 0, maxScore: 20, reason: "Score qualità sito non disponibile" };
  }

  // linkedin_present
  if (partner.linkedin_url || extractFromEnrichment<string>(partner.enrichment_data, "linkedin_url", null)) {
    details.linkedin_present = { score: 10, maxScore: 10, reason: "LinkedIn azienda presente" };
    totalScore += 10;
  } else {
    details.linkedin_present = { score: 0, maxScore: 10, reason: "LinkedIn non fornito" };
  }

  // logo_present
  if (partner.logo_url) {
    details.logo_present = { score: 5, maxScore: 5, reason: "Logo aziendale presente" };
    totalScore += 5;
  } else {
    details.logo_present = { score: 0, maxScore: 5, reason: "Logo non fornito" };
  }

  // contacts_quality: email + phone = 15pts, email only = 10pts, name only = 5pts
  const { count: contactCount, data: contacts } = await supabase
    .from("partner_contacts")
    .select("*", { count: "exact", head: false })
    .eq("partner_id", partnerId);

  let primaryContactScore = 0;
  if (contacts && contacts.length > 0) {
    const primary = contacts.find((c) => c.is_primary);
    if (primary) {
      if (primary.email && primary.direct_phone) {
        primaryContactScore = 15;
        details.contacts_quality = {
          score: 15,
          maxScore: 15,
          reason: "Contatto primario con email e telefono",
        };
      } else if (primary.email) {
        primaryContactScore = 10;
        details.contacts_quality = {
          score: 10,
          maxScore: 15,
          reason: "Contatto primario con email",
        };
      } else if (primary.name) {
        primaryContactScore = 5;
        details.contacts_quality = {
          score: 5,
          maxScore: 15,
          reason: "Contatto primario con solo nome",
        };
      }
    }
  }
  if (primaryContactScore === 0) {
    details.contacts_quality = { score: 0, maxScore: 15, reason: "Nessun contatto primario" };
  }
  totalScore += primaryContactScore;

  // contact_count: 1 = 5pts, 2-3 = 8pts, 4+ = 10pts
  const contCount = contactCount ?? 0;
  let contactCountScore = 0;
  if (contCount >= 4) {
    contactCountScore = 10;
    details.contact_count = { score: 10, maxScore: 10, reason: `${contCount} contatti (4+)` };
  } else if (contCount === 2 || contCount === 3) {
    contactCountScore = 8;
    details.contact_count = { score: 8, maxScore: 10, reason: `${contCount} contatti (2-3)` };
  } else if (contCount === 1) {
    contactCountScore = 5;
    details.contact_count = { score: 5, maxScore: 10, reason: "1 contatto" };
  } else {
    details.contact_count = { score: 0, maxScore: 10, reason: "Nessun contatto registrato" };
  }
  totalScore += contactCountScore;

  const normalizedScore = Math.round((totalScore / maxPossibleScore) * 100);

  return {
    name: "Profilo e Presenza",
    score: normalizedScore,
    weight: 0.25,
    details,
  };
}

/**
 * Dimension 2: Solidità Aziendale (weight 0.30)
 * Valuta anzianità, networks, certificazioni, multilocazione.
 */
async function calculateBusinessSolidity(
  supabase: SupabaseClient,
  partnerId: string,
  partner: PartnerData,
): Promise<QualityDimension> {
  const details: Record<string, DetailScore> = {};
  let totalScore = 0;
  const maxPossibleScore = 115;

  // membership_years
  let membershipYearsScore = 0;
  if (partner.member_since) {
    const memberSinceDate = new Date(partner.member_since);
    const today = new Date();
    const yearsAsMember = (today.getTime() - memberSinceDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);

    if (yearsAsMember >= 10) {
      membershipYearsScore = 25;
      details.membership_years = {
        score: 25,
        maxScore: 25,
        reason: `${Math.round(yearsAsMember)} anni di membership (10+)`,
      };
    } else if (yearsAsMember >= 5) {
      membershipYearsScore = 20;
      details.membership_years = {
        score: 20,
        maxScore: 25,
        reason: `${Math.round(yearsAsMember)} anni di membership (5-9)`,
      };
    } else if (yearsAsMember >= 3) {
      membershipYearsScore = 15;
      details.membership_years = {
        score: 15,
        maxScore: 25,
        reason: `${Math.round(yearsAsMember)} anni di membership (3-4)`,
      };
    } else if (yearsAsMember >= 1) {
      membershipYearsScore = 10;
      details.membership_years = {
        score: 10,
        maxScore: 25,
        reason: `${Math.round(yearsAsMember)} anni di membership (1-2)`,
      };
    } else if (yearsAsMember > 0) {
      membershipYearsScore = 5;
      details.membership_years = {
        score: 5,
        maxScore: 25,
        reason: `${Math.round(yearsAsMember * 12)} mesi di membership (<1 anno)`,
      };
    }
  }
  if (membershipYearsScore === 0) {
    details.membership_years = { score: 0, maxScore: 25, reason: "Data adesione non disponibile" };
  }
  totalScore += membershipYearsScore;

  // membership_active: membership_expires > now
  if (partner.membership_expires) {
    const expiresDate = new Date(partner.membership_expires);
    const today = new Date();
    if (expiresDate > today) {
      details.membership_active = { score: 10, maxScore: 10, reason: "Membership attiva" };
      totalScore += 10;
    } else {
      details.membership_active = { score: 0, maxScore: 10, reason: "Membership scaduta" };
    }
  } else {
    details.membership_active = { score: 0, maxScore: 10, reason: "Data scadenza non disponibile" };
  }

  // networks_count
  const { count: networkCount } = await supabase
    .from("partner_networks")
    .select("id", { count: "exact", head: true })
    .eq("partner_id", partnerId);

  let networkScore = 0;
  if (networkCount !== null) {
    if (networkCount >= 3) {
      networkScore = 20;
      details.networks_count = {
        score: 20,
        maxScore: 20,
        reason: `${networkCount} network(s) (3+)`,
      };
    } else if (networkCount === 2) {
      networkScore = 15;
      details.networks_count = { score: 15, maxScore: 20, reason: "2 network(s)" };
    } else if (networkCount === 1) {
      networkScore = 10;
      details.networks_count = { score: 10, maxScore: 20, reason: "1 network" };
    } else {
      details.networks_count = { score: 0, maxScore: 20, reason: "Nessun network registrato" };
    }
  }
  totalScore += networkScore;

  // certifications_count
  const { count: certCount } = await supabase
    .from("partner_certifications")
    .select("id", { count: "exact", head: true })
    .eq("partner_id", partnerId);

  let certScore = 0;
  if (certCount !== null) {
    if (certCount >= 3) {
      certScore = 20;
      details.certifications_count = {
        score: 20,
        maxScore: 20,
        reason: `${certCount} certificazioni (3+)`,
      };
    } else if (certCount === 2) {
      certScore = 15;
      details.certifications_count = {
        score: 15,
        maxScore: 20,
        reason: "2 certificazioni",
      };
    } else if (certCount === 1) {
      certScore = 10;
      details.certifications_count = {
        score: 10,
        maxScore: 20,
        reason: "1 certificazione",
      };
    } else {
      details.certifications_count = { score: 0, maxScore: 20, reason: "Nessuna certificazione" };
    }
  }
  totalScore += certScore;

  // office_type
  if (partner.office_type === "head_office") {
    details.office_type = { score: 10, maxScore: 10, reason: "Head office" };
    totalScore += 10;
  } else if (partner.office_type === "branch") {
    details.office_type = { score: 5, maxScore: 10, reason: "Filiale" };
    totalScore += 5;
  } else {
    details.office_type = { score: 0, maxScore: 10, reason: "Tipo ufficio non specificato" };
  }

  // multi_location
  if (partner.has_branches && partner.branch_cities && (partner.branch_cities as unknown[]).length > 0) {
    const branchCount = (partner.branch_cities as unknown[]).length;
    details.multi_location = {
      score: 10,
      maxScore: 10,
      reason: `Multilocazione (${branchCount} filiali)`,
    };
    totalScore += 10;
  } else if (partner.has_branches) {
    details.multi_location = { score: 5, maxScore: 10, reason: "Ha filiali (dati limitati)" };
    totalScore += 5;
  } else {
    details.multi_location = { score: 0, maxScore: 10, reason: "Monolocalità" };
  }

  const normalizedScore = Math.round((totalScore / maxPossibleScore) * 100);

  return {
    name: "Solidità Aziendale",
    score: normalizedScore,
    weight: 0.3,
    details,
  };
}

/**
 * Dimension 3: Servizi e Capacità (weight 0.25)
 * Valuta diversità servizi, specializzazioni, reputazione.
 */
async function calculateServicesCapacity(
  supabase: SupabaseClient,
  partnerId: string,
  partner: PartnerData,
): Promise<QualityDimension> {
  const details: Record<string, DetailScore> = {};
  let totalScore = 0;
  const maxPossibleScore = 100;

  // services_count
  const { count: serviceCount, data: services } = await supabase
    .from("partner_services")
    .select("service_category", { count: "exact", head: false })
    .eq("partner_id", partnerId);

  let serviceScore = 0;
  if (serviceCount !== null) {
    if (serviceCount >= 5) {
      serviceScore = 25;
      details.services_count = {
        score: 25,
        maxScore: 25,
        reason: `${serviceCount} servizi (5+)`,
      };
    } else if (serviceCount === 3 || serviceCount === 4) {
      serviceScore = 20;
      details.services_count = {
        score: 20,
        maxScore: 25,
        reason: `${serviceCount} servizi (3-4)`,
      };
    } else if (serviceCount === 1 || serviceCount === 2) {
      serviceScore = 15;
      details.services_count = {
        score: 15,
        maxScore: 25,
        reason: `${serviceCount} servizi (1-2)`,
      };
    } else {
      details.services_count = { score: 0, maxScore: 25, reason: "Nessun servizio registrato" };
    }
  }
  totalScore += serviceScore;

  // services_diversity: distinct service categories
  let diversityScore = 0;
  if (services && services.length > 0) {
    const uniqueCategories = new Set(services.map((s) => s.service_category)).size;
    if (uniqueCategories >= 4) {
      diversityScore = 15;
      details.services_diversity = {
        score: 15,
        maxScore: 15,
        reason: `${uniqueCategories} categorie diverse (4+)`,
      };
    } else if (uniqueCategories === 2 || uniqueCategories === 3) {
      diversityScore = 10;
      details.services_diversity = {
        score: 10,
        maxScore: 15,
        reason: `${uniqueCategories} categorie diverse (2-3)`,
      };
    } else if (uniqueCategories === 1) {
      diversityScore = 5;
      details.services_diversity = {
        score: 5,
        maxScore: 15,
        reason: "1 categoria di servizio",
      };
    }
  } else {
    details.services_diversity = { score: 0, maxScore: 15, reason: "Nessun servizio" };
  }
  totalScore += diversityScore;

  // certified_specializations: certifications matching services
  const { data: certs } = await supabase
    .from("partner_certifications")
    .select("certification")
    .eq("partner_id", partnerId);

  let certSpecScore = 0;
  if (certs && certs.length > 0 && services && services.length > 0) {
    const certNames = certs.map((c) => (c.certification as string).toLowerCase());
    const serviceNames = services.map((s) => (s.service_category as string).toLowerCase());

    let matchCount = 0;
    for (const cert of certNames) {
      for (const svc of serviceNames) {
        if (cert.includes(svc) || svc.includes(cert)) {
          matchCount++;
          break;
        }
      }
    }
    certSpecScore = Math.min(20, matchCount * 10);
    details.certified_specializations = {
      score: certSpecScore,
      maxScore: 20,
      reason: `${matchCount} certificazione(i) matching su servizi`,
    };
  } else {
    details.certified_specializations = {
      score: 0,
      maxScore: 20,
      reason: "Nessuna certificazione o servizio registrato",
    };
  }
  totalScore += certSpecScore;

  // reputation: enrichment_data.reputation exists
  const hasReputation = extractFromEnrichment<unknown>(
    partner.enrichment_data,
    "reputation",
    null,
  ) !== null;
  if (hasReputation) {
    details.reputation = { score: 15, maxScore: 15, reason: "Dati reputazione disponibili" };
    totalScore += 15;
  } else {
    details.reputation = { score: 0, maxScore: 15, reason: "Dati reputazione non disponibili" };
  }

  // google_maps
  const googleMapsData = extractFromEnrichment<unknown>(partner.enrichment_data, "google_maps", null);
  if (googleMapsData) {
    const hasReviews =
      typeof googleMapsData === "object" &&
      googleMapsData !== null &&
      ("reviews" in googleMapsData || "rating" in googleMapsData);
    if (hasReviews) {
      details.google_maps = { score: 15, maxScore: 15, reason: "Google Maps con recensioni" };
      totalScore += 15;
    } else {
      details.google_maps = {
        score: 10,
        maxScore: 15,
        reason: "Google Maps presente (senza recensioni)",
      };
      totalScore += 10;
    }
  } else {
    details.google_maps = { score: 0, maxScore: 15, reason: "Google Maps non disponibile" };
  }

  const normalizedScore = Math.round((totalScore / maxPossibleScore) * 100);

  return {
    name: "Servizi e Capacità",
    score: normalizedScore,
    weight: 0.25,
    details,
  };
}

/**
 * Dimension 4: Intelligence Profonda (weight 0.20)
 * Valuta investigazioni Sherlock, data freshness, contact profiles.
 */
async function calculateDeepIntelligence(
  supabase: SupabaseClient,
  partnerId: string,
  partner: PartnerData,
): Promise<QualityDimension> {
  const details: Record<string, DetailScore> = {};
  let totalScore = 0;
  const maxPossibleScore = 100;

  // sherlock_completed: Any completed sherlock investigation
  const { data: sherlockInvest } = await supabase
    .from("sherlock_investigations")
    .select("level, findings, summary, created_at")
    .eq("partner_id", partnerId)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(1);

  let sherlockCompletedScore = 0;
  if (sherlockInvest && sherlockInvest.length > 0) {
    sherlockCompletedScore = 20;
    details.sherlock_completed = {
      score: 20,
      maxScore: 20,
      reason: "Indagine Sherlock completata",
    };
  } else {
    details.sherlock_completed = {
      score: 0,
      maxScore: 20,
      reason: "Nessuna indagine Sherlock completata",
    };
  }
  totalScore += sherlockCompletedScore;

  // sherlock_level: Level 3 = 15pts, level 2 = 10pts, level 1 = 5pts
  let sherlockLevelScore = 0;
  if (sherlockInvest && sherlockInvest.length > 0) {
    const level = sherlockInvest[0].level as number;
    if (level === 3) {
      sherlockLevelScore = 15;
      details.sherlock_level = { score: 15, maxScore: 15, reason: "Sherlock Level 3 (profondo)" };
    } else if (level === 2) {
      sherlockLevelScore = 10;
      details.sherlock_level = { score: 10, maxScore: 15, reason: "Sherlock Level 2 (standard)" };
    } else if (level === 1) {
      sherlockLevelScore = 5;
      details.sherlock_level = { score: 5, maxScore: 15, reason: "Sherlock Level 1 (scout)" };
    }
  } else {
    details.sherlock_level = { score: 0, maxScore: 15, reason: "Nessun livello Sherlock" };
  }
  totalScore += sherlockLevelScore;

  // sherlock_findings_depth: findings has 5+ keys = 15pts, 3-4 = 10pts, 1-2 = 5pts
  let findingsDepthScore = 0;
  if (sherlockInvest && sherlockInvest.length > 0) {
    const findings = sherlockInvest[0].findings as Record<string, unknown>;
    if (findings && typeof findings === "object") {
      const findingKeys = Object.keys(findings).length;
      if (findingKeys >= 5) {
        findingsDepthScore = 15;
        details.sherlock_findings_depth = {
          score: 15,
          maxScore: 15,
          reason: `${findingKeys} findings (5+)`,
        };
      } else if (findingKeys === 3 || findingKeys === 4) {
        findingsDepthScore = 10;
        details.sherlock_findings_depth = {
          score: 10,
          maxScore: 15,
          reason: `${findingKeys} findings (3-4)`,
        };
      } else if (findingKeys === 1 || findingKeys === 2) {
        findingsDepthScore = 5;
        details.sherlock_findings_depth = {
          score: 5,
          maxScore: 15,
          reason: `${findingKeys} findings (1-2)`,
        };
      }
    }
  } else {
    details.sherlock_findings_depth = {
      score: 0,
      maxScore: 15,
      reason: "Nessun findings disponibile",
    };
  }
  totalScore += findingsDepthScore;

  // sherlock_summary: summary length > 200 chars = 10pts
  let summaryScore = 0;
  if (sherlockInvest && sherlockInvest.length > 0) {
    const summary = sherlockInvest[0].summary as string;
    if (summary && summary.length > 200) {
      summaryScore = 10;
      details.sherlock_summary = {
        score: 10,
        maxScore: 10,
        reason: `Summary completo (${summary.length} chars)`,
      };
    } else if (summary) {
      summaryScore = 5;
      details.sherlock_summary = {
        score: 5,
        maxScore: 10,
        reason: `Summary breve (${summary.length} chars)`,
      };
    }
  } else {
    details.sherlock_summary = {
      score: 0,
      maxScore: 10,
      reason: "Nessun summary Sherlock",
    };
  }
  totalScore += summaryScore;

  // data_freshness: deep_search_at
  const deepSearchAt = extractFromEnrichment<string>(partner.enrichment_data, "deep_search_at", null);
  let freshnessScore = 0;
  if (deepSearchAt) {
    const deepSearchDate = new Date(deepSearchAt);
    const today = new Date();
    const ageInDays = (today.getTime() - deepSearchDate.getTime()) / (24 * 60 * 60 * 1000);

    if (ageInDays <= 30) {
      freshnessScore = 20;
      details.data_freshness = {
        score: 20,
        maxScore: 20,
        reason: `Deep Search aggiornato (${Math.round(ageInDays)}gg fa)`,
      };
    } else if (ageInDays <= 60) {
      freshnessScore = 15;
      details.data_freshness = {
        score: 15,
        maxScore: 20,
        reason: `Deep Search (${Math.round(ageInDays)}gg fa)`,
      };
    } else if (ageInDays <= 90) {
      freshnessScore = 10;
      details.data_freshness = {
        score: 10,
        maxScore: 20,
        reason: `Deep Search obsoleto (${Math.round(ageInDays)}gg fa)`,
      };
    } else {
      freshnessScore = 5;
      details.data_freshness = {
        score: 5,
        maxScore: 20,
        reason: `Deep Search vecchio (${Math.round(ageInDays)}gg fa)`,
      };
    }
  } else {
    details.data_freshness = { score: 0, maxScore: 20, reason: "Deep Search mai eseguito" };
  }
  totalScore += freshnessScore;

  // contact_profiles_found
  const contactProfiles = extractFromEnrichment<unknown[]>(
    partner.enrichment_data,
    "contact_profiles",
    null,
  );
  let contactProfilesScore = 0;
  if (contactProfiles && Array.isArray(contactProfiles)) {
    const profileCount = contactProfiles.length;
    if (profileCount >= 3) {
      contactProfilesScore = 20;
      details.contact_profiles_found = {
        score: 20,
        maxScore: 20,
        reason: `${profileCount} profili contatti trovati (3+)`,
      };
    } else if (profileCount === 1 || profileCount === 2) {
      contactProfilesScore = 10;
      details.contact_profiles_found = {
        score: 10,
        maxScore: 20,
        reason: `${profileCount} profilo/i contatti trovato/i`,
      };
    }
  } else {
    details.contact_profiles_found = {
      score: 0,
      maxScore: 20,
      reason: "Nessun profilo contatti trovato",
    };
  }
  totalScore += contactProfilesScore;

  const normalizedScore = Math.round((totalScore / maxPossibleScore) * 100);

  return {
    name: "Intelligence Profonda",
    score: normalizedScore,
    weight: 0.2,
    details,
  };
}

// scoreToStars is imported from qualityHelpers

/**
 * Calcola la disponibilità dei dati (percentuale di data sources disponibili).
 */
async function calculateDataCompleteness(
  supabase: SupabaseClient,
  partnerId: string,
  partner: PartnerData,
): Promise<number> {
  const sources: boolean[] = [];

  // Data sources check
  sources.push(!!partner.raw_profile_markdown);
  sources.push(!!partner.ai_parsed_at);
  sources.push(!!partner.website);
  sources.push(!!partner.linkedin_url);
  sources.push(!!partner.logo_url);
  sources.push(!!partner.member_since);
  sources.push(!!partner.membership_expires);
  sources.push(!!partner.has_branches);

  // Enrichment data sources
  const websiteQualityScore = extractFromEnrichment<number>(
    partner.enrichment_data,
    "website_quality_score",
    null,
  );
  sources.push(websiteQualityScore !== null);

  const hasReputation = extractFromEnrichment<unknown>(partner.enrichment_data, "reputation", null) !== null;
  sources.push(hasReputation);

  const googleMapsData = extractFromEnrichment<unknown>(partner.enrichment_data, "google_maps", null);
  sources.push(googleMapsData !== null);

  const contactProfiles = extractFromEnrichment<unknown[]>(
    partner.enrichment_data,
    "contact_profiles",
    null,
  );
  sources.push(contactProfiles !== null && contactProfiles.length > 0);

  const deepSearchAt = extractFromEnrichment<string>(partner.enrichment_data, "deep_search_at", null);
  sources.push(deepSearchAt !== null);

  // DB relations
  const { count: contactCount } = await supabase
    .from("partner_contacts")
    .select("id", { count: "exact", head: true })
    .eq("partner_id", partnerId);
  sources.push(contactCount !== null && contactCount > 0);

  const { count: networkCount } = await supabase
    .from("partner_networks")
    .select("id", { count: "exact", head: true })
    .eq("partner_id", partnerId);
  sources.push(networkCount !== null && networkCount > 0);

  const { count: certCount } = await supabase
    .from("partner_certifications")
    .select("id", { count: "exact", head: true })
    .eq("partner_id", partnerId);
  sources.push(certCount !== null && certCount > 0);

  const { count: serviceCount } = await supabase
    .from("partner_services")
    .select("id", { count: "exact", head: true })
    .eq("partner_id", partnerId);
  sources.push(serviceCount !== null && serviceCount > 0);

  // Sherlock
  const { count: sherlockCount } = await supabase
    .from("sherlock_investigations")
    .select("id", { count: "exact", head: true })
    .eq("partner_id", partnerId)
    .eq("status", "completed");
  sources.push(sherlockCount !== null && sherlockCount > 0);

  const available = sources.filter(Boolean).length;
  const percentage = Math.round((available / sources.length) * 100);
  return percentage;
}

// ════════════════════════════════════════════════════════════════════
// MAIN CALCULATION FUNCTION
// ════════════════════════════════════════════════════════════════════

interface PartnerData {
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
interface WCAModifierBonus {
  type: string;
  points: number;
  reason: string;
}

interface WCAModifierDetails {
  total: number;
  bonuses: WCAModifierBonus[];
  penalties: WCAModifierBonus[];
  route_highlights: string[];
  capability_keywords_found: string[];
}

/**
 * LOVABLE-93: Scans profile markdown, sherlock findings, and sherlock summary for keywords.
 * Returns found flag, matched keywords, and context snippets.
 */
function scanProfileForKeywords(
  profileMarkdown: string | null,
  sherlockFindings: Record<string, unknown> | null,
  sherlockSummary: string | null,
  keywords: string[],
): {
  found: boolean;
  matches: string[];
  context: string[];
} {
  const matches: Set<string> = new Set();
  const context: string[] = [];

  const textSources = [
    profileMarkdown || "",
    JSON.stringify(sherlockFindings) || "",
    sherlockSummary || "",
  ].join(" ");

  const lowerText = textSources.toLowerCase();

  for (const keyword of keywords) {
    const lowerKeyword = keyword.toLowerCase();
    if (lowerText.includes(lowerKeyword)) {
      matches.add(keyword);

      // Extract context (20 chars before/after)
      const index = lowerText.indexOf(lowerKeyword);
      if (index >= 0) {
        const start = Math.max(0, index - 20);
        const end = Math.min(textSources.length, index + lowerKeyword.length + 20);
        context.push(textSources.substring(start, end).trim());
      }
    }
  }

  return {
    found: matches.size > 0,
    matches: Array.from(matches),
    context,
  };
}

/**
 * LOVABLE-93: Extracts strategic route highlights from profile and sherlock findings.
 * Looks for patterns like "Country1-Country2", "direct line to X", etc.
 */
function extractRouteHighlights(
  profileMarkdown: string | null,
  sherlockFindings: Record<string, unknown> | null,
): string[] {
  const routes: Set<string> = new Set();

  const textSources = [profileMarkdown || "", JSON.stringify(sherlockFindings) || ""].join(" ");
  const lowerText = textSources.toLowerCase();

  // Pattern 1: "Country1-Country2" style routes (e.g., "Jordan-Iraq", "Turkey-Russia")
  const routePattern = /[a-z\s]+\-[a-z\s]+(?:\s+(?:direct|linea|via|through))?/gi;
  const matches = textSources.match(routePattern) || [];
  matches.forEach((match) => {
    if (match.length > 5 && match.length < 50) {
      routes.add(match.trim());
    }
  });

  // Pattern 2: "direct line to X" / "linea diretta per X"
  const directLinePatterns = [
    /direct\s+(?:line|service|route)\s+(?:to|via)\s+([a-zA-Z\s]+)(?:,|\.|\s|$)/gi,
    /linea\s+diretta\s+(?:per|a|verso)\s+([a-zA-Z\s]+)(?:,|\.|\s|$)/gi,
    /servizio\s+diretto\s+([a-zA-Z\s\-]+)(?:,|\.|\s|$)/gi,
  ];

  for (const pattern of directLinePatterns) {
    let match;
    while ((match = pattern.exec(textSources)) !== null) {
      const route = match[1]?.trim();
      if (route && route.length > 2 && route.length < 50) {
        routes.add(`Direct route: ${route}`);
      }
    }
  }

  return Array.from(routes);
}

/**
 * LOVABLE-93: Calculates WCA Logistics Value modifier (-20 to +30 points).
 * Applies bonuses for premium capabilities and penalties for limitations.
 */
async function calculateWCAModifier(
  supabase: SupabaseClient,
  partnerId: string,
  partner: PartnerData,
): Promise<{ modifier: number; details: WCAModifierDetails }> {
  let totalModifier = 0;
  const bonuses: WCAModifierBonus[] = [];
  const penalties: WCAModifierBonus[] = [];
  const capabilityKeywordsFound: string[] = [];

  // Fetch related data
  const { data: services } = await supabase
    .from("partner_services")
    .select("service_category")
    .eq("partner_id", partnerId);

  const { data: certs } = await supabase
    .from("partner_certifications")
    .select("certification")
    .eq("partner_id", partnerId);

  const { data: sherlockInvest } = await supabase
    .from("sherlock_investigations")
    .select("findings, summary")
    .eq("partner_id", partnerId)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(1);

  const serviceCategories = services?.map((s) => s.service_category as string) || [];
  const certifications = certs?.map((c) => c.certification as string) || [];
  const sherlockFindings = sherlockInvest?.[0]?.findings as Record<string, unknown> | null;
  const sherlockSummary = sherlockInvest?.[0]?.summary as string | null;

  // ═════════════════════════════════════════════════════════════════════
  // PREMIUM BONUSES
  // ═════════════════════════════════════════════════════════════════════

  // a) Courier/Express services (+8pts)
  if (partner.partner_type === "courier" || serviceCategories.includes("ecommerce")) {
    const points = 8;
    totalModifier += points;
    bonuses.push({
      type: "courier_express",
      points,
      reason: `${partner.partner_type === "courier" ? "partner_type: courier" : "ecommerce services"}`,
    });
  }

  // b) Own fleet (+6pts)
  const fleetKeywords = [
    "own fleet",
    "own trucks",
    "propri mezzi",
    "furgoni",
    "camion di proprietà",
    "own vehicles",
    "proprietary fleet",
  ];
  const fleetScan = scanProfileForKeywords(
    partner.raw_profile_markdown,
    sherlockFindings,
    sherlockSummary,
    fleetKeywords,
  );
  if (fleetScan.found) {
    const points = 6;
    totalModifier += points;
    bonuses.push({
      type: "own_fleet",
      points,
      reason: `Found: '${fleetScan.matches.join("', '")}'`,
    });
    capabilityKeywordsFound.push(...fleetScan.matches);
  }

  // c) Own warehouses (+5pts)
  const warehouseKeywords = [
    "own warehouse",
    "magazzino proprio",
    "magazzino diretto",
    "direct warehouse",
    "storage facility",
    "proprio deposito",
  ];
  const warehouseScan = scanProfileForKeywords(
    partner.raw_profile_markdown,
    sherlockFindings,
    sherlockSummary,
    warehouseKeywords,
  );
  if (warehouseScan.found) {
    const points = 5;
    totalModifier += points;
    bonuses.push({
      type: "own_warehouses",
      points,
      reason: `Found: '${warehouseScan.matches.join("', '")}'`,
    });
    capabilityKeywordsFound.push(...warehouseScan.matches);
  }

  // d) Bonded warehouse (+5pts)
  const bondedKeywords = [
    "bonded warehouse",
    "deposito doganale",
    "magazzino in regime doganale",
    "bonded facility",
  ];
  const bondedScan = scanProfileForKeywords(
    partner.raw_profile_markdown,
    sherlockFindings,
    sherlockSummary,
    bondedKeywords,
  );
  if (bondedScan.found) {
    const points = 5;
    totalModifier += points;
    bonuses.push({
      type: "bonded_warehouse",
      points,
      reason: `Found: '${bondedScan.matches.join("', '")}'`,
    });
    capabilityKeywordsFound.push(...bondedScan.matches);
  }

  // e) Internal customs operations (+6pts)
  const customsKeywords = [
    "customs clearance",
    "sdoganamento",
    "operazioni doganali",
    "dogana interna",
    "in-house customs",
  ];
  const customsScan = scanProfileForKeywords(
    partner.raw_profile_markdown,
    sherlockFindings,
    sherlockSummary,
    customsKeywords,
  );
  const hasCustomsService = serviceCategories.includes("customs_broker");
  const isCustomsBroker = partner.partner_type === "customs_broker";

  if (customsScan.found || hasCustomsService || isCustomsBroker) {
    const points = 6;
    totalModifier += points;
    let reason = "";
    if (isCustomsBroker) {
      reason = "partner_type: customs_broker";
    } else if (hasCustomsService) {
      reason = "customs_broker service";
    } else {
      reason = `Found: '${customsScan.matches.join("', '")}'`;
    }
    bonuses.push({
      type: "internal_customs",
      points,
      reason,
    });
    if (customsScan.matches.length > 0) {
      capabilityKeywordsFound.push(...customsScan.matches);
    }
  }

  // f) Air freight capability (+4pts)
  if (serviceCategories.includes("air_freight") && certifications.includes("IATA")) {
    const points = 4;
    totalModifier += points;
    bonuses.push({
      type: "air_freight_iata",
      points,
      reason: "air_freight service + IATA certification",
    });
  }

  // g) Strategic direct routes (+6pts)
  const routeHighlights = extractRouteHighlights(partner.raw_profile_markdown, sherlockFindings);
  if (routeHighlights.length > 0) {
    const points = 6;
    totalModifier += points;
    bonuses.push({
      type: "strategic_routes",
      points,
      reason: `${routeHighlights.length} direct route(s) identified`,
    });
  }

  // h) Strategic branch locations (+4pts)
  if (partner.has_branches && partner.branch_cities && (partner.branch_cities as unknown[]).length >= 2) {
    const points = 4;
    totalModifier += points;
    bonuses.push({
      type: "strategic_branches",
      points,
      reason: `Multi-location hub (${(partner.branch_cities as unknown[]).length} branches)`,
    });
  }

  // ═════════════════════════════════════════════════════════════════════
  // DOWNGRADE PENALTIES
  // ═════════════════════════════════════════════════════════════════════

  // a) FCL-only operator (-10pts)
  const isFCLOnly =
    serviceCategories.length > 0 &&
    serviceCategories.every((s) => s === "ocean_fcl" || s === "ocean_lcl");
  if (isFCLOnly && serviceCategories.includes("ocean_fcl")) {
    const points = -10;
    totalModifier += points;
    penalties.push({
      type: "fcl_only",
      points,
      reason: "Only ocean freight services (FCL/LCL), limited diversification",
    });
  }

  // b) Young partner from high-risk region (-8pts)
  const highRiskCountries = [
    "IN",
    "BD",
    "PK",
    "NG",
    "GH",
    "KE",
    "TZ",
    "UG",
    "ET",
    "CM",
    "CI",
    "SN",
    "ML",
    "BF",
    "NE",
    "TD",
    "CD",
    "CG",
    "AO",
    "MZ",
    "MG",
    "ZW",
    "ZM",
    "MW",
  ];
  if (partner.member_since) {
    const memberSinceDate = new Date(partner.member_since);
    const today = new Date();
    const yearsAsMember = (today.getTime() - memberSinceDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);

    if (
      yearsAsMember < 5 &&
      partner.country_code &&
      highRiskCountries.includes(partner.country_code) &&
      !partner.has_branches
    ) {
      const points = -8;
      totalModifier += points;
      penalties.push({
        type: "young_high_risk",
        points,
        reason: `Young partner (<5 yrs) from high-risk region (${partner.country_code}), single office`,
      });
    }
  }

  // c) No certifications + young (-5pts)
  if (certifications.length === 0 && partner.member_since) {
    const memberSinceDate = new Date(partner.member_since);
    const today = new Date();
    const yearsAsMember = (today.getTime() - memberSinceDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);

    if (yearsAsMember < 3) {
      const points = -5;
      totalModifier += points;
      penalties.push({
        type: "no_certs_young",
        points,
        reason: "No certifications and very new (<3 years)",
      });
    }
  }

  // Clamp modifier between -20 and +30
  const clampedModifier = Math.max(-20, Math.min(30, totalModifier));

  const details: WCAModifierDetails = {
    total: clampedModifier,
    bonuses,
    penalties,
    route_highlights: routeHighlights,
    capability_keywords_found: Array.from(new Set(capabilityKeywordsFound)),
  };

  return { modifier: clampedModifier, details };
}

/**
 * Calcola lo score di qualità partner per un singolo partner.
 *
 * LOVABLE-93: Partner Quality Score engine
 */
export async function calculatePartnerQuality(
  supabase: SupabaseClient,
  partnerId: string,
): Promise<PartnerQualityResult> {
  // Carica dati partner
  const { data: partnerData, error } = await supabase
    .from("partners")
    .select(
      "id, raw_profile_markdown, ai_parsed_at, website, linkedin_url, logo_url, member_since, membership_expires, office_type, has_branches, branch_cities, enrichment_data, partner_type, country_code",
    )
    .eq("id", partnerId)
    .maybeSingle();

  if (error || !partnerData) {
    throw new Error(`Failed to load partner ${partnerId}: ${error?.message ?? "Not found"}`);
  }

  const partner = partnerData as PartnerData;

  // Calculate all 4 dimensions
  const [dimension1, dimension2, dimension3, dimension4] = await Promise.all([
    calculateProfilePresence(supabase, partnerId, partner),
    calculateBusinessSolidity(supabase, partnerId, partner),
    calculateServicesCapacity(supabase, partnerId, partner),
    calculateDeepIntelligence(supabase, partnerId, partner),
  ]);

  const dimensions = [dimension1, dimension2, dimension3, dimension4];

  // Weighted total score (before WCA modifier)
  const baseScore = Math.round(
    dimension1.score * dimension1.weight +
      dimension2.score * dimension2.weight +
      dimension3.score * dimension3.weight +
      dimension4.score * dimension4.weight,
  );

  // LOVABLE-93: Apply WCA Logistics Value modifier
  const { modifier, details } = await calculateWCAModifier(supabase, partnerId, partner);
  const totalScore = Math.max(0, Math.min(100, baseScore + modifier));

  const stars = scoreToStars(totalScore);

  // Data completeness
  const dataCompleteness = await calculateDataCompleteness(supabase, partnerId, partner);

  const result: PartnerQualityResult = {
    totalScore,
    stars,
    dimensions,
    calculatedAt: new Date().toISOString(),
    dataCompleteness,
    wcaModifier: {
      modifier,
      details,
    },
  };

  return result;
}

/**
 * Salva il risultato dello score nella tabella partners.
 *
 * LOVABLE-93: Partner Quality Score engine
 */
export async function savePartnerQuality(
  supabase: SupabaseClient,
  partnerId: string,
  result: PartnerQualityResult,
): Promise<void> {
  const { error } = await supabase
    .from("partners")
    .update({
      rating: result.stars,
      rating_details: {
        version: "lovable-93-quality-v2",
        totalScore: result.totalScore,
        stars: result.stars,
        dimensions: result.dimensions,
        dataCompleteness: result.dataCompleteness,
        calculatedAt: result.calculatedAt,
        // LOVABLE-93: WCA logistics value modifier
        wca_modifier: result.wcaModifier?.details,
      },
    })
    .eq("id", partnerId);

  if (error) {
    throw new Error(`Failed to save quality score for partner ${partnerId}: ${error.message}`);
  }
}

/**
 * Wrapper conveniente: calcola e salva in una sola chiamata.
 *
 * LOVABLE-93: Partner Quality Score engine
 */
export async function calculateAndSavePartnerQuality(
  supabase: SupabaseClient,
  partnerId: string,
): Promise<PartnerQualityResult> {
  const result = await calculatePartnerQuality(supabase, partnerId);
  await savePartnerQuality(supabase, partnerId, result);
  return result;
}

// Helper functions are imported from qualityHelpers and qualityRules

/**
 * Recalcola la qualità di più partner in batch.
 *
 * LOVABLE-93: Partner Quality Score engine
 */
export async function batchRecalculatePartnerQuality(
  supabase: SupabaseClient,
  partnerIds: string[],
): Promise<Record<string, PartnerQualityResult>> {
  const results: Record<string, PartnerQualityResult> = {};

  for (const partnerId of partnerIds) {
    try {
      const result = await calculateAndSavePartnerQuality(supabase, partnerId);
      results[partnerId] = result;
    } catch (err) {
      console.error(`Failed to calculate quality for partner ${partnerId}:`, err);
      results[partnerId] = {
        totalScore: 0,
        stars: 1,
        dimensions: [],
        calculatedAt: new Date().toISOString(),
        dataCompleteness: 0,
      };
    }
  }

  return results;
}

/**
 * Legacy function for backward compatibility
 */
export async function loadAndCalculateQuality(
  supabase: SupabaseClient,
  partnerId: string,
): Promise<PartnerQualityScore> {
  const result = await calculatePartnerQuality(supabase, partnerId);

  return {
    total_score: result.totalScore,
    star_rating: result.stars,
    dimensions: {
      profilo_e_presenza: result.dimensions[0]?.score ?? 0,
      solidita_aziendale: result.dimensions[1]?.score ?? 0,
      servizi_e_capacita: result.dimensions[2]?.score ?? 0,
      intelligence: result.dimensions[3]?.score ?? 0,
    },
    data_completeness_percent: result.dataCompleteness,
    calculated_at: result.calculatedAt,
  };
}
