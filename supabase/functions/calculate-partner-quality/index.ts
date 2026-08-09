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
import { requireInternalOrUser } from "../_shared/internalAuth.ts";
import { edgeErrorWithStatus } from "../_shared/handleEdgeError.ts";



Deno.serve(async (req) => {
  // Handle CORS
  const pre = corsPreflight(req);
  if (pre) return pre;

  const origin = req.headers.get("origin");
  const dynCors = getCorsHeaders(origin);
  // Auth condiviso: JWT utente oppure chiamata interna server-to-server.
  const auth = await requireInternalOrUser(req, null, dynCors);
  if (auth.kind === "error") return auth.response;

  try {
    const { partnerId, batch } = await req.json();

    if (!partnerId && !batch) {
      return edgeErrorWithStatus("VALIDATION_ERROR", "Either partnerId or batch array is required", 400, { ...dynCors, "Content-Type": "application/json" });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return edgeErrorWithStatus("INTERNAL_ERROR", "Supabase credentials not configured", 500, { ...dynCors, "Content-Type": "application/json" });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Single partner calculation
    if (partnerId) {
      const result = await calculatePartnerQuality(supabase, partnerId);
      await savePartnerQuality(supabase, partnerId, result);

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
        } catch {
          results[pId] = {
            stars: 1,
            totalScore: 0,
            dataCompleteness: 0,
          };
          failureCount++;
        }
      }

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

    return edgeErrorWithStatus("VALIDATION_ERROR", "Invalid request parameters", 400, { ...dynCors, "Content-Type": "application/json" });
  } catch (error) {
    return edgeErrorWithStatus("INTERNAL_ERROR", error instanceof Error ? error.message : "Unknown error",, 500, { "Content-Type": "application/json" });
  }
});
