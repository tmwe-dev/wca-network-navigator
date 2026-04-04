import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const extUrl = "https://dlldkrzoxvjxpgkkttxu.supabase.co";
    const extKey = Deno.env.get("WCA_EXTERNAL_SUPABASE_KEY");
    if (!extKey) throw new Error("WCA_EXTERNAL_SUPABASE_KEY not set");

    const ext = createClient(extUrl, extKey);

    // Count partners
    const { count: partnerCount } = await ext.from("partners").select("*", { count: "exact", head: true });

    // Count contacts
    const { count: contactCount } = await ext.from("partner_contacts").select("*", { count: "exact", head: true });

    // Count networks  
    const { count: networkCount } = await ext.from("partner_networks").select("*", { count: "exact", head: true });

    // Top countries
    const { data: sample } = await ext.from("partners").select("country_code").limit(10000);
    const cc: Record<string, number> = {};
    sample?.forEach((r: any) => { cc[r.country_code] = (cc[r.country_code] || 0) + 1; });
    const topCountries = Object.entries(cc).sort((a, b) => b[1] - a[1]).slice(0, 15);

    return new Response(JSON.stringify({
      external: { partners: partnerCount, contacts: contactCount, networks: networkCount, countries: Object.keys(cc).length, topCountries },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
