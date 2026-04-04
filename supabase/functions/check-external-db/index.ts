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

    const headers: Record<string, string> = {
      "apikey": extKey,
      "Authorization": `Bearer ${extKey}`,
      "Content-Type": "application/json",
    };

    // Get the OpenAPI spec to extract all table names
    const schemaRes = await fetch(`${extUrl}/rest/v1/`, { headers });
    const schema = await schemaRes.json();
    
    const tableNames = Object.keys(schema.paths || {})
      .filter(p => p !== "/")
      .map(p => p.replace("/", ""));

    // Get counts for each table
    const tableCounts: Record<string, number | string> = {};
    for (const t of tableNames) {
      try {
        const r = await fetch(`${extUrl}/rest/v1/${t}?select=*`, { 
          headers: { ...headers, "Prefer": "count=exact", "Range": "0-0" } 
        });
        const range = r.headers.get("content-range");
        tableCounts[t] = range || `status:${r.status}`;
      } catch {
        tableCounts[t] = "error";
      }
    }

    return new Response(JSON.stringify({ tables: tableNames, counts: tableCounts }, null, 2), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { 
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});
