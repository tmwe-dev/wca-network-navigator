import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const extKey = Deno.env.get("WCA_EXTERNAL_SUPABASE_KEY")!;
  const ext = createClient("https://dlldkrzoxvjxpgkkttxu.supabase.co", extKey);

  const { data, error } = await ext
    .from("wca_partners")
    .select("country_code")
    .not("country_code", "is", null);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const counts: Record<string, number> = {};
  (data || []).forEach((r: any) => {
    counts[r.country_code] = (counts[r.country_code] || 0) + 1;
  });

  return new Response(JSON.stringify({ total: data?.length || 0, countries: counts }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
