/**
 * wcaModifierCalculator.ts — WCA Logistics Value modifier (LOVABLE-93)
 *
 * Calculates bonuses and penalties for WCA-specific capabilities and risk factors.
 * Applies -20 to +30 point adjustments to base quality scores.
 */

import type { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import type { PartnerData, WCAModifierDetails, WCAModifierBonus } from "./qualityTypes";

type SupabaseClient = ReturnType<typeof createClient>;

/**
 * Scans profile markdown, sherlock findings, and sherlock summary for keywords.
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
 * Extracts strategic route highlights from profile and sherlock findings.
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
export async function calculateWCAModifier(
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
