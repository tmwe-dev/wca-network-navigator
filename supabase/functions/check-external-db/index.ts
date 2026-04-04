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

    // Direct REST call to list tables via RPC or information_schema
    const headers: Record<string, string> = {
      "apikey": extKey,
      "Authorization": `Bearer ${extKey}`,
      "Content-Type": "application/json",
    };

    // Try to get the OpenAPI schema which lists all tables
    const schemaRes = await fetch(`${extUrl}/rest/v1/`, { headers });
    const schemaText = await schemaRes.text();
    
    // Also try rpc
    const rpcRes = await fetch(`${extUrl}/rest/v1/rpc/`, { headers });
    const rpcStatus = rpcRes.status;

    // Try different possible table names
    const tableNames = ["partners", "wca_partners", "members", "companies", "profiles", "contacts", "wca_members"];
    const tableResults: Record<string, any> = {};
    
    for (const t of tableNames) {
      const r = await fetch(`${extUrl}/rest/v1/${t}?limit=1`, { headers });
      tableResults[t] = { status: r.status, ok: r.ok };
      if (r.ok) {
        const data = await r.json();
        tableResults[t].sample = data;
        // Also get count
        const cr = await fetch(`${extUrl}/rest/v1/${t}?select=*`, { 
          headers: { ...headers, "Prefer": "count=exact", "Range": "0-0" } 
        });
        tableResults[t].contentRange = cr.headers.get("content-range");
      }
    }

    return new Response(JSON.stringify({ 
      schemaStatus: schemaRes.status,
      schemaLength: schemaText.length,
      // Extract paths/definitions from OpenAPI if available
      schemaPaths: schemaText.substring(0, 500),
      rpcStatus,
      tableResults 
    }, null, 2), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { 
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});
