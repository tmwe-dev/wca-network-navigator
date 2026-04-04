import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const extKey = Deno.env.get("WCA_EXTERNAL_SUPABASE_KEY")!;
  const ext = createClient("https://dlldkrzoxvjxpgkkttxu.supabase.co", extKey);

  const results: Record<string, any> = {};

  for (const table of ["wca_partners", "wca_partner_contacts", "wca_partner_networks", "partner_contacts", "partner_networks"]) {
    const { data, error } = await ext.from(table).select("*").limit(1);
    results[table] = error ? { error: error.message } : { columns: Object.keys(data?.[0] || {}), sample: data?.[0] };
  }

  // Also get counts
  for (const table of ["wca_partners", "partner_contacts", "partner_networks"]) {
    const { count } = await ext.from(table).select("*", { count: "exact", head: true });
    if (results[table] && !results[table].error) results[table].count = count;
  }

  return new Response(JSON.stringify(results, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
