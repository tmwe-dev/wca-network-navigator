/**
 * deduplicate-partners — Finds and merges duplicate partner records.
 *
 * Groups partners by normalized company_name + country_code, identifies duplicates,
 * and merges them by keeping the most data-rich record as primary.
 *
 * @endpoint POST /functions/v1/deduplicate-partners
 * @auth Required (Bearer token)
 * @rateLimit 5 requests/minute per user
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimiter.ts";
import { requireAuth, isAuthError } from "../_shared/authGuard.ts";
import { edgeErrorWithStatus } from "../_shared/handleEdgeError.ts";
import { trackUsage } from "../_shared/usageTrack.ts";

Deno.serve(async (req) => {
  trackUsage("deduplicate-partners", "quarantine", { note: "Q2 bonifica, scadenza 2026-10-02" });
  const pre = corsPreflight(req);
  if (pre) return pre;

  const origin = req.headers.get("origin");
  const dynCors = getCorsHeaders(origin);

  try {
    // Auth check — E2.1: authGuard terse (contratto HTTP byte-identico al pre-E2).
    const auth = await requireAuth(req, dynCors, { errorFormat: "terse" });
    if (isAuthError(auth)) return auth;
    const userId = auth.userId;

    // Rate limit
    const rl = checkRateLimit(`dedup:${userId}`, { maxTokens: 5, refillRate: 0.1 });
    if (!rl.allowed) return rateLimitResponse(rl, dynCors);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Find duplicates by company_name + country_code
    const { data: allPartners, error: fetchErr } = await supabase
      .from("partners")
      .select(
        "id, company_name, country_code, city, wca_id, logo_url, enrichment_data, raw_profile_html, member_since, rating, email, phone, website, created_at",
      )
      .eq("is_active", true)
      .order("created_at", { ascending: true });

    if (fetchErr) throw fetchErr;

    // Group by company_name + country_code
    const groups: Record<string, Array<Record<string, unknown>>> = {};
    for (const p of allPartners || []) {
      const key = `${p.company_name.toLowerCase().trim()}|${p.country_code}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    }

    const duplicateGroups = Object.entries(groups).filter(([_, v]) => v.length > 1);
    const log: string[] = [];
    let totalMerged = 0;
    let totalDeleted = 0;

    type ScoredPartner = Record<string, unknown> & {
      score: number;
      id: string;
      company_name: string;
      country_code: string;
    };
    for (const [key, members] of duplicateGroups) {
      // Score each member: higher = more complete
      const scored: ScoredPartner[] = members.map((m: Record<string, unknown>) => {
        let score = 0;
        if (m.logo_url) score += 10;
        if (m.enrichment_data) score += 10;
        if (m.raw_profile_html) score += 5;
        if (m.email) score += 3;
        if (m.phone) score += 3;
        if (m.website) score += 3;
        if (m.rating) score += 2;
        if (m.member_since) score += 2;
        if (m.wca_id) score += 1;
        return { ...m, score } as ScoredPartner;
      });

      scored.sort((a, b) => b.score - a.score);
      const keeper = scored[0];
      const toDelete = scored.slice(1);
      const deleteIds = toDelete.map((d) => d.id);

      // Move relations from duplicates to keeper
      const relationTables = [
        "partner_contacts",
        "partner_services",
        "partner_networks",
        "partner_certifications",
        "partner_social_links",
        "interactions",
        "activities",
        "reminders",
      ];

      for (const table of relationTables) {
        const { error: updateErr } = await supabase
          .from(table)
          .update({ partner_id: keeper.id })
          .in("partner_id", deleteIds);
        if (updateErr) {
          log.push(`WARN: ${table} update failed for ${key}: ${updateErr.message}`);
        }
      }

      // Update campaign_jobs
      await supabase.from("campaign_jobs").update({ partner_id: keeper.id }).in("partner_id", deleteIds);

      // Update blacklist entries
      await supabase
        .from("blacklist_entries")
        .update({ matched_partner_id: keeper.id })
        .in("matched_partner_id", deleteIds);

      // Update email campaign queue
      await supabase.from("email_campaign_queue").update({ partner_id: keeper.id }).in("partner_id", deleteIds);

      // Now soft-delete duplicates
      const { error: delErr } = await supabase.from("partners").update({ is_active: false }).in("id", deleteIds);

      if (delErr) {
        log.push(`ERROR: delete failed for ${key}: ${delErr.message}`);
      } else {
        totalMerged++;
        totalDeleted += deleteIds.length;
        log.push(
          `MERGED: "${scored[0].company_name}" (${scored[0].country_code}) — kept ${keeper.id}, deactivated ${deleteIds.length} dupes`,
        );
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        duplicateGroupsFound: duplicateGroups.length,
        totalMerged,
        totalDeleted,
        log,
      }),
      { headers: { ...dynCors, "Content-Type": "application/json" } },
    );
  } catch (err: unknown) {
    return edgeErrorWithStatus("INTERNAL_ERROR", err instanceof Error ? err.message : String(err), 500, {
      ...dynCors,
      "Content-Type": "application/json",
    });
  }
});
