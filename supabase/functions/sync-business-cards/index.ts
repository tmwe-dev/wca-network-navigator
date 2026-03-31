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
    // External DB (WCA engine)
    const extUrl = "https://dlldkrzoxvjxpgkkttxu.supabase.co";
    const extKey = Deno.env.get("WCA_EXTERNAL_SUPABASE_KEY");
    if (!extKey) {
      return new Response(
        JSON.stringify({ success: false, error: "WCA_EXTERNAL_SUPABASE_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const extSb = createClient(extUrl, extKey);

    // Local DB
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

    // Fetch all business cards from external DB
    const { data: extCards, error: extErr } = await extSb
      .from("business_cards")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000);

    if (extErr) {
      console.error("Error fetching external cards:", extErr);
      return new Response(
        JSON.stringify({ success: false, error: extErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!extCards || extCards.length === 0) {
      return new Response(
        JSON.stringify({ success: true, upserted: 0, message: "No cards in external DB" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${extCards.length} cards in external DB`);

    // Upsert into local DB in batches
    let upserted = 0;
    const batchSize = 50;

    for (let i = 0; i < extCards.length; i += batchSize) {
      const batch = extCards.slice(i, i + batchSize).map((card: any) => ({
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
      JSON.stringify({ success: true, upserted, total: extCards.length }),
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
