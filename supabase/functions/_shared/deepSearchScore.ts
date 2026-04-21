/**
 * deepSearchScore.ts — Score di qualità Deep Search (LOVABLE-88).
 *
 * Calcola un punteggio 0-100 che misura quanto il sistema "conosce" un partner.
 * Visibile a: UI partner detail, agent context, journalist review, email contract.
 *
 * Componenti del punteggio:
 *   - Base enrichment (website, LinkedIn, logo): 0-15
 *   - Deep Search (contatti, reputation, maps): 0-30
 *   - Sherlock investigations: 0-20
 *   - Message history (interazioni): 0-15
 *   - KB entries (pattern appresi): 0-10
 *   - Freshness penalty: -0 a -20
 *
 * Auto-suggest enrichment se score < 40.
 */

import type { UnifiedEnrichment } from "./enrichmentAdapter.ts";

export interface DeepSearchScoreResult {
  /** Score complessivo 0-100 */
  score: number;
  /** Livello qualitativo */
  level: "excellent" | "good" | "fair" | "poor" | "minimal";
  /** Breakdown per area */
  breakdown: {
    base: number;
    deep: number;
    sherlock: number;
    history: number;
    kb: number;
    freshness_penalty: number;
  };
  /** Suggerimenti per migliorare lo score */
  suggestions: string[];
  /** True se score < 40 e si consiglia auto-enrichment */
  auto_enrich_suggested: boolean;
  /** Aree mancanti */
  missing_areas: string[];
}

export interface ScoreContext {
  enrichment: UnifiedEnrichment;
  interactionCount: number;
  kbEntryCount: number;
  hasActiveConversation: boolean;
}

/**
 * Calcola lo score di qualità Deep Search per un partner.
 */
export function calculateDeepSearchScore(
  ctx: ScoreContext,
): DeepSearchScoreResult {
  const breakdown = {
    base: 0,
    deep: 0,
    sherlock: 0,
    history: 0,
    kb: 0,
    freshness_penalty: 0,
  };
  const suggestions: string[] = [];
  const missingAreas: string[] = [];
  const e = ctx.enrichment;

  // === BASE ENRICHMENT (0-15) ===
  if (e.base.linkedin_url) breakdown.base += 5;
  else missingAreas.push("linkedin_url");

  if (e.base.logo_url) breakdown.base += 3;

  if (e.base.website_excerpt) {
    breakdown.base += 4;
    if (e.base.website_excerpt.emails?.length) breakdown.base += 2;
    if (e.base.website_excerpt.phones?.length) breakdown.base += 1;
  } else {
    missingAreas.push("website_data");
    suggestions.push("Avvia scraping sito web per ottenere dati aziendali");
  }

  // === DEEP SEARCH (0-30) ===
  if (e.deep.contact_profiles?.length) {
    const profiles = e.deep.contact_profiles.length;
    breakdown.deep += Math.min(10, profiles * 3); // max 10 per contatti
  } else {
    missingAreas.push("contact_profiles");
    suggestions.push("Esegui Deep Search per trovare contatti chiave");
  }

  if (e.deep.website_quality_score !== null && e.deep.website_quality_score > 0) {
    breakdown.deep += Math.min(8, Math.round(e.deep.website_quality_score * 0.08));
  } else {
    missingAreas.push("website_quality");
  }

  if (e.deep.reputation) breakdown.deep += 5;
  else missingAreas.push("reputation");

  if (e.deep.google_maps) breakdown.deep += 4;

  if (e.deep.contact_mentions?.length) {
    breakdown.deep += Math.min(3, e.deep.contact_mentions.length);
  }

  if (!e.deep.deep_search_at) {
    suggestions.push("Deep Search mai eseguito per questo partner");
  }

  // === SHERLOCK (0-20) ===
  if (e.sherlock.summary) {
    breakdown.sherlock += 10;
    if (e.sherlock.findings) {
      const findings = e.sherlock.findings;
      if (typeof findings === "object" && findings !== null) {
        const keys = Object.keys(findings);
        breakdown.sherlock += Math.min(10, keys.length * 2);
      }
    }
  } else {
    missingAreas.push("sherlock_investigation");
    suggestions.push("Avvia investigazione Sherlock per analisi approfondita");
  }

  // === HISTORY (0-15) ===
  if (ctx.interactionCount > 0) {
    breakdown.history += Math.min(10, ctx.interactionCount * 2);
  } else {
    missingAreas.push("interaction_history");
  }
  if (ctx.hasActiveConversation) breakdown.history += 5;

  // === KB (0-10) ===
  if (ctx.kbEntryCount > 0) {
    breakdown.kb += Math.min(10, ctx.kbEntryCount * 3);
  }

  // === FRESHNESS PENALTY (0 to -20) ===
  const deepAge = e.freshness.deep_age_days;
  const sherlockAge = e.freshness.sherlock_age_days;

  if (deepAge !== null && deepAge > 30) {
    const penalty = Math.min(10, Math.floor((deepAge - 30) / 15));
    breakdown.freshness_penalty -= penalty;
    if (deepAge > 60)
      suggestions.push(`Deep Search obsoleto (${deepAge}gg fa) — riesegui`);
  }
  if (sherlockAge !== null && sherlockAge > 60) {
    const penalty = Math.min(10, Math.floor((sherlockAge - 60) / 30));
    breakdown.freshness_penalty -= penalty;
  }

  // === TOTALE ===
  const rawScore =
    breakdown.base +
    breakdown.deep +
    breakdown.sherlock +
    breakdown.history +
    breakdown.kb +
    breakdown.freshness_penalty;

  const score = Math.max(0, Math.min(100, rawScore));

  const level: DeepSearchScoreResult["level"] =
    score >= 80
      ? "excellent"
      : score >= 60
      ? "good"
      : score >= 40
      ? "fair"
      : score >= 20
      ? "poor"
      : "minimal";

  const autoEnrichSuggested = score < 40;
  if (autoEnrichSuggested && suggestions.length === 0) {
    suggestions.push("Score basso — avvia arricchimento automatico");
  }

  return {
    score,
    level,
    breakdown,
    suggestions,
    auto_enrich_suggested: autoEnrichSuggested,
    missing_areas: missingAreas,
  };
}

/**
 * Carica il contesto e calcola lo score per un partner.
 * Funzione di convenienza one-shot per agenti e UI.
 */
// deno-lint-ignore no-explicit-any
export async function getPartnerDeepSearchScore(
  supabase: any,
  partnerId: string,
  userId: string,
): Promise<DeepSearchScoreResult> {
  // Importa dinamicamente per evitare circular dependency
  const { readUnifiedEnrichment } = await import("./enrichmentAdapter.ts");
  const enrichment = await readUnifiedEnrichment(partnerId, supabase);

  // Conta interazioni
  const { count: interactionCount } = await supabase
    .from("interactions")
    .select("id", { count: "exact", head: true })
    .eq("partner_id", partnerId);

  // Conta KB entries relative a questo partner
  const { count: kbCount } = await supabase
    .from("kb_entries")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .contains("tags", [`partner_${partnerId}`]);

  // Check conversazione attiva
  const { count: activeConvo } = await supabase
    .from("activities")
    .select("id", { count: "exact", head: true })
    .eq("partner_id", partnerId)
    .eq("user_id", userId)
    .eq("status", "pending")
    .eq("activity_type", "follow_up");

  return calculateDeepSearchScore({
    enrichment,
    interactionCount: interactionCount ?? 0,
    kbEntryCount: kbCount ?? 0,
    hasActiveConversation: (activeConvo ?? 0) > 0,
  });
}

/**
 * Formatta lo score come stringa per inclusione nei prompt AI.
 */
export function formatScoreForPrompt(result: DeepSearchScoreResult): string {
  const emoji =
    result.level === "excellent"
      ? "🟢"
      : result.level === "good"
      ? "🟡"
      : result.level === "fair"
      ? "🟠"
      : "🔴";

  return [
    `DEEP SEARCH SCORE: ${result.score}/100 ${emoji} (${result.level})`,
    `Base: ${result.breakdown.base}/15 | Deep: ${result.breakdown.deep}/30 | Sherlock: ${result.breakdown.sherlock}/20 | History: ${result.breakdown.history}/15 | KB: ${result.breakdown.kb}/10`,
    result.missing_areas.length > 0
      ? `MANCANTE: ${result.missing_areas.join(", ")}`
      : "",
    result.auto_enrich_suggested
      ? "⚠️ Score basso — arricchimento consigliato prima di generare comunicazioni"
      : "",
    result.suggestions.length > 0
      ? `SUGGERIMENTI: ${result.suggestions.join("; ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}
