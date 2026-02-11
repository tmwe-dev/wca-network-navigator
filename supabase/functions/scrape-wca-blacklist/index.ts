import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    if (!FIRECRAWL_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "FIRECRAWL_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("Scraping WCA blacklist page...");

    // Scrape with Firecrawl
    const scrapeRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: "https://www.wcaworld.com/WCAworldBlacklist",
        formats: ["markdown"],
        waitFor: 5000,
      }),
    });

    const scrapeData = await scrapeRes.json();
    if (!scrapeRes.ok) {
      console.error("Firecrawl error:", scrapeData);
      return new Response(
        JSON.stringify({ success: false, error: "Firecrawl scraping failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const markdown = scrapeData.data?.markdown || scrapeData.markdown || "";
    console.log("Markdown length:", markdown.length);

    // Parse markdown table
    const lines = markdown.split("\n");
    const entries: any[] = [];

    for (const line of lines) {
      if (!line.startsWith("|") || line.includes("---") || line.toLowerCase().includes("companyname")) continue;

      const cells = line.split("|").map((c: string) => c.trim()).filter(Boolean);
      if (cells.length < 6) continue;

      const no = parseInt(cells[0]);
      if (isNaN(no)) continue;

      const totalStr = (cells[6] || "0").replace(/[^0-9.-]/g, "");

      entries.push({
        blacklist_no: no,
        company_name: cells[1] || "",
        city: cells[2] || null,
        country: cells[3] || null,
        status: cells[4] || null,
        claims: cells[5] || null,
        total_owed_amount: parseFloat(totalStr) || null,
        source: "auto_scrape",
        matched_partner_id: null,
      });
    }

    console.log(`Parsed ${entries.length} blacklist entries`);

    if (entries.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "No entries found in scraped page" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Delete old auto_scrape entries and insert new
    await supabase.from("blacklist_entries").delete().eq("source", "auto_scrape");

    for (let i = 0; i < entries.length; i += 50) {
      const batch = entries.slice(i, i + 50);
      const { error } = await supabase.from("blacklist_entries").insert(batch);
      if (error) {
        console.error("Insert error:", error);
        throw error;
      }
    }

    // Match with partners
    const { data: allEntries } = await supabase
      .from("blacklist_entries")
      .select("id, company_name, country");
    const { data: partners } = await supabase
      .from("partners")
      .select("id, company_name, country_name");

    let matchCount = 0;
    if (allEntries && partners) {
      for (const entry of allEntries) {
        const entryName = (entry.company_name || "").toLowerCase().trim();
        const entryCountry = (entry.country || "").toLowerCase().trim();

        const match = partners.find((p: any) => {
          const pName = (p.company_name || "").toLowerCase().trim();
          const pCountry = (p.country_name || "").toLowerCase().trim();
          const nameMatch = pName === entryName || pName.includes(entryName) || entryName.includes(pName);
          const countryMatch = pCountry === entryCountry || pCountry.includes(entryCountry) || entryCountry.includes(pCountry);
          return nameMatch && countryMatch;
        });

        if (match) {
          await supabase
            .from("blacklist_entries")
            .update({ matched_partner_id: match.id })
            .eq("id", entry.id);
          matchCount++;
        }
      }
    }

    // Log sync
    await supabase.from("blacklist_sync_log").insert({
      sync_type: "auto_scrape",
      entries_count: entries.length,
      matched_count: matchCount,
    });

    // Update app_settings with last update date
    await supabase
      .from("app_settings")
      .upsert({ key: "blacklist_last_updated", value: new Date().toISOString() }, { onConflict: "key" });

    return new Response(
      JSON.stringify({ success: true, entries_count: entries.length, matched_count: matchCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
