/**
 * enrichmentAdapter.ts — Lettura unificata dei dati di arricchimento partner.
 *
 * Riconcilia i 3 motori che scrivono in `partners.enrichment_data` JSONB:
 *   - Base Enrichment        → linkedin_url, logo_url, website_excerpt
 *   - Deep Search Local      → contact_profiles, website_quality_score, reputation, ...
 *   - enrich-partner-website → website_summary, linkedin_summary, deep_search_summary (legacy)
 * + tabella separata `sherlock_investigations` (ultima riga per partner).
 *
 * LOVABLE-72 — Vol. II, sezione Enrichment Unification.
 */
import type { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

type SupabaseClient = ReturnType<typeof createClient>;

export interface ContactProfileLite {
  name?: string | null;
  role?: string | null;
  linkedin?: string | null;
}

export interface WebsiteExcerpt {
  description?: string | null;
  emails?: string[] | null;
  phones?: string[] | null;
}

export interface UnifiedEnrichment {
  base: {
    linkedin_url: string | null;
    logo_url: string | null;
    website_excerpt: WebsiteExcerpt | null;
  };
  deep: {
    contact_profiles: ContactProfileLite[] | null;
    website_quality_score: number | null;
    contact_mentions: unknown[] | null;
    google_maps: unknown | null;
    reputation: unknown | null;
    deep_search_at: string | null;
    deep_search_engine: string | null;
  };
  legacy: {
    website_summary: string | null;
    linkedin_summary: string | null;
    deep_search_summary: string | null;
  };
  sherlock: {
    summary: string | null;
    last_run_at: string | null;
    findings: unknown | null;
  };
  has_any: boolean;
  freshness: {
    base_age_days: number | null;
    deep_age_days: number | null;
    sherlock_age_days: number | null;
  };
}

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86400000);
}

/**
 * Carica una vista unificata dell'arricchimento per un partner.
 * Non lancia: ritorna struttura vuota se il partner manca o la query fallisce.
 */
export async function readUnifiedEnrichment(
  partnerId: string,
  supabase: SupabaseClient,
): Promise<UnifiedEnrichment> {
  let ed: Record<string, unknown> = {};
  try {
    const { data: partner } = await supabase
      .from("partners")
      .select("enrichment_data")
      .eq("id", partnerId)
      .maybeSingle();
    ed = ((partner as { enrichment_data?: Record<string, unknown> } | null)?.enrichment_data || {}) as Record<string, unknown>;
  } catch (e) {
    console.warn("[enrichmentAdapter] partner read failed:", e instanceof Error ? e.message : e);
  }

  let sherlockRow: { summary: string | null; created_at: string | null; findings: unknown } | null = null;
  try {
    const { data } = await supabase
      .from("sherlock_investigations")
      .select("summary, created_at, findings")
      .eq("partner_id", partnerId)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    sherlockRow = data as typeof sherlockRow;
  } catch {
    // Sherlock optional — silently ignore
  }

  const websiteExcerpt = (ed.website_excerpt && typeof ed.website_excerpt === "object")
    ? (ed.website_excerpt as WebsiteExcerpt)
    : null;
  const contactProfilesRaw = ed.contact_profiles;
  const contactProfiles: ContactProfileLite[] | null = Array.isArray(contactProfilesRaw)
    ? (contactProfilesRaw as ContactProfileLite[])
    : null;
  const contactMentions: unknown[] | null = Array.isArray(ed.contact_mentions)
    ? (ed.contact_mentions as unknown[])
    : null;

  const baseLinkedinUrl = typeof ed.linkedin_url === "string" ? ed.linkedin_url : null;
  const baseLogoUrl = typeof ed.logo_url === "string" ? ed.logo_url : null;
  const websiteSummary = typeof ed.website_summary === "string" ? ed.website_summary : null;
  const linkedinSummary = typeof ed.linkedin_summary === "string" ? ed.linkedin_summary : null;
  const deepSearchSummary = typeof ed.deep_search_summary === "string" ? ed.deep_search_summary : null;
  const deepSearchAt = typeof ed.deep_search_at === "string" ? ed.deep_search_at : null;
  const deepSearchEngine = typeof ed.deep_search_engine === "string" ? ed.deep_search_engine : null;
  const websiteQualityScore = typeof ed.website_quality_score === "number" ? ed.website_quality_score : null;
  const baseEnrichedAt = typeof ed.base_enriched_at === "string"
    ? ed.base_enriched_at
    : (typeof ed.website_scraped_at === "string" ? ed.website_scraped_at : null);

  const has_any = !!(
    baseLinkedinUrl || websiteExcerpt || contactProfiles?.length ||
    websiteSummary || linkedinSummary || deepSearchSummary ||
    sherlockRow?.summary
  );

  return {
    base: {
      linkedin_url: baseLinkedinUrl,
      logo_url: baseLogoUrl,
      website_excerpt: websiteExcerpt,
    },
    deep: {
      contact_profiles: contactProfiles,
      website_quality_score: websiteQualityScore,
      contact_mentions: contactMentions,
      google_maps: ed.google_maps ?? null,
      reputation: ed.reputation ?? null,
      deep_search_at: deepSearchAt,
      deep_search_engine: deepSearchEngine,
    },
    legacy: {
      website_summary: websiteSummary,
      linkedin_summary: linkedinSummary,
      deep_search_summary: deepSearchSummary,
    },
    sherlock: {
      summary: sherlockRow?.summary ?? null,
      last_run_at: sherlockRow?.created_at ?? null,
      findings: sherlockRow?.findings ?? null,
    },
    has_any,
    freshness: {
      base_age_days: daysSince(baseEnrichedAt),
      deep_age_days: daysSince(deepSearchAt),
      sherlock_age_days: daysSince(sherlockRow?.created_at ?? null),
    },
  };
}

/**
 * Compone un blocco testuale leggibile dall'AI a partire dallo snapshot unificato.
 * Ordina per priorità informativa e tronca i campi lunghi per non saturare il prompt.
 */
export function formatEnrichmentForPrompt(e: UnifiedEnrichment): string {
  const blocks: string[] = [];

  // 1. Sito (preferenza: website_excerpt strutturato; fallback legacy summary)
  const siteDesc = e.base.website_excerpt?.description || e.legacy.website_summary;
  if (siteDesc) {
    let block = `INFORMAZIONI SITO AZIENDALE:\n${String(siteDesc).slice(0, 800)}`;
    const emails = e.base.website_excerpt?.emails;
    const phones = e.base.website_excerpt?.phones;
    if (Array.isArray(emails) && emails.length) {
      block += `\nEmail trovate: ${emails.slice(0, 5).join(", ")}`;
    }
    if (Array.isArray(phones) && phones.length) {
      block += `\nTelefoni: ${phones.slice(0, 5).join(", ")}`;
    }
    blocks.push(block);
  }

  // 2. LinkedIn (legacy summary ha priorità su URL nudo)
  const linkedinInfo = e.legacy.linkedin_summary
    ? String(e.legacy.linkedin_summary).slice(0, 600)
    : (e.base.linkedin_url ? `LinkedIn azienda: ${e.base.linkedin_url}` : null);
  if (linkedinInfo) blocks.push(`PROFILO LINKEDIN:\n${linkedinInfo}`);

  // 3. Contatti chiave (max 5)
  if (e.deep.contact_profiles?.length) {
    const profiles = e.deep.contact_profiles
      .slice(0, 5)
      .map((c) => {
        const name = c.name ?? "?";
        const role = c.role ?? "?";
        const li = c.linkedin ? ` — ${c.linkedin}` : "";
        return `- ${name} (${role})${li}`;
      })
      .join("\n");
    blocks.push(`CONTATTI CHIAVE:\n${profiles}`);
  }

  // 4. Reputazione
  if (e.deep.reputation) {
    const rep = typeof e.deep.reputation === "string"
      ? e.deep.reputation
      : JSON.stringify(e.deep.reputation);
    blocks.push(`REPUTAZIONE ONLINE:\n${rep.slice(0, 500)}`);
  }

  // 5. Quality score
  if (typeof e.deep.website_quality_score === "number") {
    blocks.push(`QUALITY SCORE SITO: ${e.deep.website_quality_score}/100`);
  }

  // 6. Sherlock summary
  if (e.sherlock.summary) {
    blocks.push(`INDAGINE SHERLOCK:\n${String(e.sherlock.summary).slice(0, 800)}`);
  }

  // 7. Legacy deep search summary (solo se non c'è nulla di meglio)
  if (!siteDesc && !e.deep.contact_profiles?.length && e.legacy.deep_search_summary) {
    blocks.push(`RICERCA APPROFONDITA (legacy):\n${String(e.legacy.deep_search_summary).slice(0, 600)}`);
  }

  return blocks.join("\n\n");
}