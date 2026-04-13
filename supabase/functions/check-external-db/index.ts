import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";


Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;

  const origin = req.headers.get("origin");
  const dynCors = getCorsHeaders(origin);

  try {
    const extUrl = "https://dlldkrzoxvjxpgkkttxu.supabase.co";
    const extKey = Deno.env.get("WCA_EXTERNAL_SUPABASE_KEY");
    if (!extKey) throw new Error("WCA_EXTERNAL_SUPABASE_KEY not set");

    const headers: Record<string, string> = {
      "apikey": extKey,
      "Authorization": `Bearer ${extKey}`,
      "Content-Type": "application/json",
    };

    const queryTable = new URL(req.url).searchParams.get("table");
    let bodyTable: string | null = null;
    if (req.method !== "GET") {
      const rawBody = await req.text();
      if (rawBody) {
        try {
          const parsedBody = JSON.parse(rawBody);
          if (typeof parsedBody?.table === "string") bodyTable = parsedBody.table;
        } catch {
          bodyTable = null;
        }
      }
    }
    const targetTable = queryTable || bodyTable;

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

    let tableDetails: Record<string, unknown> | null = null;
    if (targetTable && tableNames.includes(targetTable)) {
      const sampleRes = await fetch(`${extUrl}/rest/v1/${targetTable}?select=*&limit=1`, { headers });
      const sampleRows = sampleRes.ok ? await sampleRes.json() : [];
      const sampleRow = Array.isArray(sampleRows) && sampleRows.length > 0 ? sampleRows[0] : null;

      const openApiPath = schema.paths?.[`/${targetTable}`]?.get;
      const responseSchema = openApiPath?.responses?.["200"]?.content?.["application/json"]?.schema;
      const itemSchema = responseSchema?.items || null;

      tableDetails = {
        table: targetTable,
        columns: itemSchema?.properties ? Object.keys(itemSchema.properties) : (sampleRow ? Object.keys(sampleRow) : []),
        sampleRow,
      };
    }

    return new Response(JSON.stringify({ tables: tableNames, counts: tableCounts, tableDetails }, null, 2), { 
      headers: { ...dynCors, "Content-Type": "application/json" } 
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { 
      status: 500, headers: { ...dynCors, "Content-Type": "application/json" } 
    });
  }
});
