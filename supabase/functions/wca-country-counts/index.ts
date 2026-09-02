import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { requireAuth, isAuthError } from "../_shared/authGuard.ts";
import { createLogger } from "../_shared/structuredLogger.ts";
import { edgeErrorWithStatus } from "../_shared/handleEdgeError.ts";
import { trackUsage } from "../_shared/usageTrack.ts";

const log = createLogger("wca-country-counts");

Deno.serve(async (req) => {
  trackUsage("wca-country-counts", "quarantine", { note: "Q2 bonifica, scadenza 2026-10-02" });
  const pre = corsPreflight(req);
  if (pre) return pre;

  const origin = req.headers.get("origin");
  const dynCors = getCorsHeaders(origin);

  try {
    // Auth check — contratto invariato: { error: "AUTH_REQUIRED" | "AUTH_INVALID" }, 401.
    const auth = await requireAuth(req, dynCors, { errorFormat: "terse" });
    if (isAuthError(auth)) return auth;
    const extKey = Deno.env.get("WCA_EXTERNAL_SUPABASE_KEY")!;
    const ext = createClient("https://dlldkrzoxvjxpgkkttxu.supabase.co", extKey);

    // Fetch all country_code values using pagination to avoid 1000 row limit
    const counts: Record<string, number> = {};
    let offset = 0;
    const PAGE = 1000;

    while (true) {
      const { data, error } = await ext
        .from("wca_profiles")
        .select("country_code")
        .not("country_code", "is", null)
        .range(offset, offset + PAGE - 1);

      if (error) throw new Error(error.message);
      if (!data || data.length === 0) break;

      data.forEach((r: Record<string, unknown>) => {
        counts[r.country_code] = (counts[r.country_code] || 0) + 1;
      });

      if (data.length < PAGE) break;
      offset += PAGE;
    }

    const total = Object.values(counts).reduce((a, b) => a + b, 0);

    return new Response(JSON.stringify({ total, countries: counts }), {
      headers: { ...dynCors, "Content-Type": "application/json" },
    });
  } catch (err) {
    log.error("country_counts_failed", err);
    return edgeErrorWithStatus("INTERNAL_ERROR", err instanceof Error ? err.message : "Unknown error", 500, {
      ...dynCors,
      "Content-Type": "application/json",
    });
  }
});
