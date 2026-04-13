import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";


Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;

  const origin = req.headers.get("origin");
  const dynCors = getCorsHeaders(origin);

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "AUTH_REQUIRED" }), {
        status: 401, headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }
    const anonClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "AUTH_INVALID" }), {
        status: 401, headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }
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
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...dynCors, "Content-Type": "application/json" } }
    );
  }
});
