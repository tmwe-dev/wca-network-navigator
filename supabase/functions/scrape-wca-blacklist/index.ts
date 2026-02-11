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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Retrieve WCA cookie from app_settings
    const { data: settings } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["wca_session_cookie", "wca_auth_cookie"]);

    const map: Record<string, string> = {};
    for (const s of settings || []) {
      if (s.key && s.value) map[s.key] = s.value;
    }

    const cookie = map["wca_auth_cookie"] || map["wca_session_cookie"] || null;

    if (!cookie) {
      return new Response(
        JSON.stringify({ success: false, error: "WCA session not configured. Please save your WCA cookie in Settings first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Quick authentication test
    console.log("Testing WCA session...");
    const authenticated = await testCookie(cookie);
    if (!authenticated) {
      // Update status
      await supabase.from("app_settings").upsert(
        { key: "wca_session_status", value: "expired", updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );
      return new Response(
        JSON.stringify({ success: false, error: "WCA session expired. Please update your cookie in Settings." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("WCA session active, scraping blacklist page...");

    // 3. Fetch blacklist page with authenticated cookie
    const blRes = await fetch("https://www.wcaworld.com/WCAworldBlacklist", {
      method: "GET",
      headers: {
        "Cookie": cookie,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    const html = await blRes.text();
    console.log("Blacklist page HTML length:", html.length);

    // 4. Parse HTML table
    const entries = parseBlacklistHtml(html);
    console.log(`Parsed ${entries.length} blacklist entries`);

    if (entries.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "No entries found. The page structure may have changed or access was denied." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Delete old auto_scrape entries and insert new
    await supabase.from("blacklist_entries").delete().eq("source", "auto_scrape");

    for (let i = 0; i < entries.length; i += 50) {
      const batch = entries.slice(i, i + 50);
      const { error } = await supabase.from("blacklist_entries").insert(batch);
      if (error) {
        console.error("Insert error:", error);
        throw error;
      }
    }

    // 6. Match with partners
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

    // 7. Log sync
    await supabase.from("blacklist_sync_log").insert({
      sync_type: "auto_scrape",
      entries_count: entries.length,
      matched_count: matchCount,
    });

    // 8. Update last updated date
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

async function testCookie(cookie: string): Promise<boolean> {
  try {
    const res = await fetch("https://www.wcaworld.com/directory/members/86580", {
      method: "GET",
      headers: {
        "Cookie": cookie,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    const html = await res.text();
    const hasEmail = /@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(html);
    const hasPhone = /\+?\d[\d\s\-().]{7,}/.test(html);
    const hasContactSection = /contact.*details|email.*address|phone.*number/i.test(html);
    const hasLoginPrompt = /please\s*log\s*in|sign\s*in\s*to\s*view|login\s*required/i.test(html);
    const hasLogoutLink = /logout|log\s*out|sign\s*out/i.test(html);
    const authenticated = !hasLoginPrompt && (hasEmail || hasPhone || hasContactSection || hasLogoutLink);
    console.log(`Cookie test: hasEmail=${hasEmail}, hasPhone=${hasPhone}, hasLogout=${hasLogoutLink}, hasLoginPrompt=${hasLoginPrompt}, authenticated=${authenticated}`);
    return authenticated;
  } catch (e) {
    console.error("Cookie test error:", e);
    return false;
  }
}

function parseBlacklistHtml(html: string): any[] {
  const entries: any[] = [];

  // Try to find table rows in the HTML
  // Pattern: look for <tr> elements containing <td> cells with blacklist data
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;

  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const rowHtml = rowMatch[1];
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const cells: string[] = [];
    let cellMatch;

    while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
      // Strip HTML tags and decode entities
      const text = cellMatch[1]
        .replace(/<[^>]*>/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      cells.push(text);
    }

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

  return entries;
}
