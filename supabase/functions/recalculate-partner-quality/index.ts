/**
 * recalculate-partner-quality — Batch recalculation of Partner Quality Scores.
 * LOVABLE-93: Edge function for TASK 1 (auto-calculate after enrichment).
 *
 * Usage:
 *   POST /functions/v1/recalculate-partner-quality
 *   { "partner_id": "..." } — single partner
 *   { } — batch all partners (max 50 per invocation)
 *
 * Returns: { processed, updated, errors, details }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";

interface BatchResult {
  processed: number;
  updated: number;
  errors: number;
  details: Array<{ partner_id: string; status: "success" | "error"; message?: string }>;
  rate_limited_at?: number;
}

Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;

  const origin = req.headers.get("origin");
  const dynCors = getCorsHeaders(origin);

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405, headers: { ...dynCors, "Content-Type": "application/json" } }
      );
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let payload = {} as Record<string, string | null>;
    try {
      payload = await req.json();
    } catch {
      // OK if no body
    }

    const partnerIdParam = payload.partner_id as string | undefined;
    const batchSize = 50;
    const result: BatchResult = {
      processed: 0,
      updated: 0,
      errors: 0,
      details: [],
    };

    // Single partner mode
    if (partnerIdParam) {
      try {
        const { loadAndCalculateQuality, savePartnerQuality } = await import("../_shared/partnerQualityScore.ts");
        const quality = await loadAndCalculateQuality(supabase, partnerIdParam);
        await savePartnerQuality(supabase, partnerIdParam, quality);
        result.processed = 1;
        result.updated = 1;
        result.details.push({
          partner_id: partnerIdParam,
          status: "success",
          message: `Score: ${quality.total_score}/100 (${quality.star_rating}★)`,
        });
      } catch (e) {
        result.processed = 1;
        result.errors = 1;
        result.details.push({
          partner_id: partnerIdParam,
          status: "error",
          message: e instanceof Error ? e.message : String(e),
        });
      }
    } else {
      // Batch mode: fetch all partners
      const { data: partners, error: listErr } = await supabase
        .from("partners")
        .select("id")
        .limit(batchSize);

      if (listErr || !partners) {
        return new Response(
          JSON.stringify({ error: "Failed to fetch partners" }),
          { status: 500, headers: { ...dynCors, "Content-Type": "application/json" } }
        );
      }

      const { loadAndCalculateQuality, savePartnerQuality } = await import("../_shared/partnerQualityScore.ts");

      for (const partner of partners as Array<{ id: string }>) {
        result.processed++;
        try {
          const quality = await loadAndCalculateQuality(supabase, partner.id);
          await savePartnerQuality(supabase, partner.id, quality);
          result.updated++;
          result.details.push({
            partner_id: partner.id,
            status: "success",
            message: `Score: ${quality.total_score}/100`,
          });
        } catch (e) {
          result.errors++;
          result.details.push({
            partner_id: partner.id,
            status: "error",
            message: e instanceof Error ? e.message : String(e),
          });
        }
      }

      if (partners.length >= batchSize) {
        result.rate_limited_at = batchSize;
      }
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...dynCors, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
