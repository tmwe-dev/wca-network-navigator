import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { getSecurityHeaders } from "../_shared/securityHeaders.ts";


Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;

  const origin = req.headers.get("origin");
  const dynCors = getCorsHeaders(origin);

  try {
    const extUrl = "https://dlldkrzoxvjxpgkkttxu.supabase.co";
    const extKey = Deno.env.get("WCA_EXTERNAL_SUPABASE_KEY");
    if (!extKey) {
      return new Response(
        JSON.stringify({ success: false, error: "WCA_EXTERNAL_SUPABASE_KEY not configured" }),
        { status: 500, headers: { ...dynCors, "Content-Type": "application/json" } }
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

    if (!userId) {
      return new Response(
        JSON.stringify({ success: false, error: "Authentication required" }),
        { status: 401, headers: { ...dynCors, "Content-Type": "application/json" } }
      );
    }

    // Fetch all from external DB with pagination
    let allCards: Array<Record<string, unknown>> = [];
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
          { status: 500, headers: { ...dynCors, "Content-Type": "application/json" } }
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
        { headers: { ...dynCors, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${allCards.length} cards in external DB`);

    // Get existing cards to avoid duplicates (match by external_id stored in raw_data)
    const { data: existingCards } = await localSb
      .from("business_cards")
      .select("id, raw_data")
      .eq("user_id", userId);

    const existingExtIds = new Set<string>();
    const existingByExtId = new Map<string, string>();
    if (existingCards) {
      for (const c of existingCards) {
        const extId = (c.raw_data as Record<string, unknown> | null)?.external_id;
        if (extId) {
          existingExtIds.add(String(extId));
          existingByExtId.set(String(extId), c.id);
        }
      }
    }

    // Upsert into local DB in batches
    let upserted = 0;
    let skipped = 0;
    const batchSize = 50;

    for (let i = 0; i < allCards.length; i += batchSize) {
      const batch = allCards.slice(i, i + batchSize).map((card: Record<string, unknown>) => {
        const extId = String(card.id);
        const existingId = existingByExtId.get(extId);
        return {
          ...(existingId ? { id: existingId } : {}),
          user_id: userId,
          company_name: card.company_name || null,
          contact_name: card.contact_name || card.name || null,
          email: card.email || null,
          phone: card.phone || null,
          mobile: card.mobile || null,
          position: card.position || card.role || null,
          event_name: card.event_name || card.event || null,
          met_at: card.met_at || null,
          location: card.location || null,
          notes: card.notes || null,
          photo_url: card.photo_url || null,
          tags: card.tags || [],
          raw_data: { ...((card.raw_data as Record<string, unknown>) || {}), external_id: card.id },
          created_at: card.created_at,
        };
      });

      // Split into updates (existing) and inserts (new)
      const toUpdate = batch.filter((b: Record<string, unknown>) => b.id);
      const toInsert = batch.filter((b: Record<string, unknown>) => !b.id);

      if (toUpdate.length > 0) {
        const { error: updateErr } = await localSb
          .from("business_cards")
          .upsert(toUpdate, { onConflict: "id" });
        if (updateErr) {
          console.error(`Batch ${i} update error:`, updateErr);
        } else {
          upserted += toUpdate.length;
        }
      }

      if (toInsert.length > 0) {
        // Check which ones are truly new
        const newInserts = toInsert.filter((b: Record<string, unknown>) => {
          const extId = String((b.raw_data as Record<string, unknown> | null)?.external_id);
          return !existingExtIds.has(extId);
        });

        if (newInserts.length > 0) {
          const { error: insertErr } = await localSb
            .from("business_cards")
            .insert(newInserts);
          if (insertErr) {
            console.error(`Batch ${i} insert error:`, insertErr);
          } else {
            upserted += newInserts.length;
            newInserts.forEach((b: Record<string, unknown>) => {
              existingExtIds.add(String((b.raw_data as Record<string, unknown> | null)?.external_id));
            });
          }
        } else {
          skipped += toInsert.length;
        }
      }
    }

    console.log(`Upserted ${upserted}, skipped ${skipped} cards`);

    return new Response(
      JSON.stringify({ success: true, upserted, skipped, total: allCards.length }),
      { headers: { ...dynCors, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Sync error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...dynCors, "Content-Type": "application/json" } }
    );
  }
});
