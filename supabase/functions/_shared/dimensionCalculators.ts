/**
 * dimensionCalculators.ts — Quality dimension calculation functions
 *
 * Implements the 4 quality dimensions: Profile Presence, Business Solidity,
 * Services Capacity, and Deep Intelligence.
 */

import type { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { extractFromEnrichment } from "./qualityHelpers";
import type { QualityDimension, PartnerData } from "./qualityTypes";

type SupabaseClient = ReturnType<typeof createClient>;

/**
 * Dimension 1: Profilo e Presenza (weight 0.25)
 * Valuta la completezza e qualità del profilo aziendale.
 */
export async function calculateProfilePresence(
  supabase: SupabaseClient,
  partnerId: string,
  partner: PartnerData,
): Promise<QualityDimension> {
  const details: Record<string, any> = {};
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
export async function calculateBusinessSolidity(
  supabase: SupabaseClient,
  partnerId: string,
  partner: PartnerData,
): Promise<QualityDimension> {
  const details: Record<string, any> = {};
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
export async function calculateServicesCapacity(
  supabase: SupabaseClient,
  partnerId: string,
  partner: PartnerData,
): Promise<QualityDimension> {
  const details: Record<string, any> = {};
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
export async function calculateDeepIntelligence(
  supabase: SupabaseClient,
  partnerId: string,
  partner: PartnerData,
): Promise<QualityDimension> {
  const details: Record<string, any> = {};
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
