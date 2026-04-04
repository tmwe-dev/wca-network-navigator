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
    const results: any = { keyLength: extKey.length };

    // Try fetching partners with data (not just count)
    const { data: p1, error: e1 } = await ext.from("partners").select("id, country_code").limit(5);
    results.partnersSample = p1;
    results.partnersError = e1?.message || null;

    // Try count with range header approach
    const { count: pc, error: e2 } = await ext.from("partners").select("id", { count: "exact", head: true });
    results.partnersCount = pc;
    results.countError = e2?.message || null;

    // Try contacts
    const { data: c1, error: e3 } = await ext.from("partner_contacts").select("id").limit(3);
    results.contactsSample = c1;
    results.contactsError = e3?.message || null;

    // Try networks
    const { data: n1, error: e4 } = await ext.from("partner_networks").select("id").limit(3);
    results.networksSample = n1;
    results.networksError = e4?.message || null;

    // Try a specific country count
    const { data: itData, error: e5 } = await ext.from("partners").select("id").eq("country_code", "IT");
    results.italyPartners = itData?.length || 0;
    results.italyError = e5?.message || null;

    return new Response(JSON.stringify(results, null, 2), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { 
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});
