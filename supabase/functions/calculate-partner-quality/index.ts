/**
 * calculate-partner-quality/index.ts
 *
 * Edge function per il calcolo automatico del Partner Quality Score.
 * Richiamato dopo:
 * - Completamento enrichment (Deep Search)
 * - Completamento investigazione Sherlock
 * - Aggiornamento profilo partner
 * - Batch recalculation manuale
 *
 * LOVABLE-93: Partner Quality Score engine
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { calculatePartnerQuality, savePartnerQuality } from "../_shared/partnerQualityScore.ts";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  // Handle CORS
  const pre = corsPreflight(req);
  if (pre) return pre;

  const origin = req.headers.get("origin");
  const dynCors = getCorsHeaders(origin);

  try {
    const { partnerId, batch } = await req.json();

    if (!partnerId && !batch) {
      return new Response(
        JSON.stringify({ error: "Either partnerId or batch array is required" }),
        { status: 400, headers: { ...dynCors, "Content-Type": "application/json" } },
      );
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({ error: "Supabase credentials not configured" }),
        { status: 500, headers: { ...dynCors, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Single partner calculation
    if (partnerId) {
      console.log(`[LOVABLE-93] Calculating quality score for partner: ${partnerId}`);

      const result = await calculatePartnerQuality(supabase, partnerId);
      await savePartnerQuality(supabase, partnerId, result);

      console.log(
        `[LOVABLE-93] Quality score calculated: ${result.stars}★ (${result.totalScore}/100)`,
      );

      return new Response(
        JSON.stringify({
          success: true,
          partnerId,
          result: {
            stars: result.stars,
            totalScore: result.totalScore,
            dataCompleteness: result.dataCompleteness,
          },
        }),
        { status: 200, headers: { ...dynCors, "Content-Type": "application/json" } },
      );
    }

    // Batch calculation
    if (batch && Array.isArray(batch)) {
      console.log(`[LOVABLE-93] Starting batch quality score calculation for ${batch.length} partners`);

      const results: Record<
        string,
        {
          stars: number;
          totalScore: number;
          dataCompleteness: number;
        }
      > = {};

      let successCount = 0;
      let failureCount = 0;

      for (const pId of batch) {
        try {
          const result = await calculatePartnerQuality(supabase, pId);
          await savePartnerQuality(supabase, pId, result);
          results[pId] = {
            stars: result.stars,
            totalScore: result.totalScore,
            dataCompleteness: result.dataCompleteness,
          };
          successCount++;
        } catch (err) {
          console.error(`[LOVABLE-93] Failed to calculate quality for ${pId}:`, err);
          results[pId] = {
            stars: 1,
            totalScore: 0,
            dataCompleteness: 0,
          };
          failureCount++;
        }
      }

      console.log(
        `[LOVABLE-93] Batch completed: ${successCount} success, ${failureCount} failed`,
      );

      return new Response(
        JSON.stringify({
          success: true,
          batch_size: batch.length,
          success_count: successCount,
          failure_count: failureCount,
          results,
        }),
        { status: 200, headers: { ...dynCors, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid request parameters" }),
      { status: 400, headers: { ...dynCors, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[LOVABLE-93] Error in calculate-partner-quality:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
