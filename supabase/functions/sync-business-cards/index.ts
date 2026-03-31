import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const extUrl = "https://dlldkrzoxvjxpgkkttxu.supabase.co";
    const extKey = Deno.env.get("WCA_EXTERNAL_SUPABASE_KEY");
    if (!extKey) {
      return new Response(
        JSON.stringify({ success: false, error: "WCA_EXTERNAL_SUPABASE_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const extSb = createClient(extUrl, extKey);

    const localUrl = Deno.env.get("SUPABASE_URL")!;
    const localKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const localSb = createClient(localUrl, localKey);

    // Get auth user for user_id
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    if (authHeader) {
      const anonSb = createClient(localUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
      const { data: { user } } = await anonSb.auth.getUser(authHeader.replace("Bearer ", ""));
      userId = user?.id ?? null;
    }

    // Fetch all from external DB with pagination
    let allCards: any[] = [];
    let page = 0;
    const pageSize = 1000;

    while (true) {
      const { data: batch, error: batchErr } = await extSb
        .from("wca_business_cards")
        .select("*")
        .order("created_at", { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (batchErr) {
        console.error("Error fetching external cards:", batchErr);
        return new Response(
          JSON.stringify({ success: false, error: batchErr.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (batch && batch.length > 0) {
        allCards = allCards.concat(batch);
        if (batch.length < pageSize) break;
        page++;
      } else {
        break;
      }
    }

    if (allCards.length === 0) {
      return new Response(
        JSON.stringify({ success: true, upserted: 0, message: "No cards in external DB" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${allCards.length} cards in external DB`);

    // Upsert into local DB in batches
    let upserted = 0;
    const batchSize = 50;

    for (let i = 0; i < allCards.length; i += batchSize) {
      const batch = allCards.slice(i, i + batchSize).map((card: any) => ({
        id: card.id,
        user_id: userId || card.user_id,
        company_name: card.company_name,
        contact_name: card.contact_name,
        email: card.email,
        phone: card.phone,
        mobile: card.mobile,
        position: card.position,
        event_name: card.event_name,
        met_at: card.met_at,
        location: card.location,
        notes: card.notes,
        photo_url: card.photo_url,
        tags: card.tags,
        raw_data: card.raw_data,
        created_at: card.created_at,
      }));

      const { error: upsertErr } = await localSb
        .from("business_cards")
        .upsert(batch, { onConflict: "id" });

      if (upsertErr) {
        console.error(`Batch ${i} error:`, upsertErr);
      } else {
        upserted += batch.length;
      }
    }

    console.log(`Upserted ${upserted} cards`);

    return new Response(
      JSON.stringify({ success: true, upserted, total: allCards.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Sync error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
