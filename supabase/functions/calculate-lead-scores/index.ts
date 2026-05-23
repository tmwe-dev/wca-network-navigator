/**
 * calculate-lead-scores — Batch lead scoring Edge Function.
 *
 * Calculates a numeric lead_score for all imported_contacts based on data completeness,
 * interaction history, and engagement signals. Runs in batches of 500.
 *
 * Audit Sez.2:
 *  - Filtra `deleted_at IS NULL` (no scoring soft-deleted).
 *  - Filtra `lead_score_updated_at` stale (>24h) salvo `force=true` nel body.
 *  - Bulk UPSERT (1 round-trip per batch) invece di N+1 UPDATE.
 *
 * @endpoint POST /functions/v1/calculate-lead-scores
 * @auth Required (Bearer token)
 * @rateLimit 10 requests/minute per user
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimiter.ts";

Deno.serve(async (req: Request) => {
  const pre = corsPreflight(req);
  if (pre) return pre;

  const origin = req.headers.get("origin");
  const dynCors = getCorsHeaders(origin);

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "AUTH_REQUIRED" }), {
        status: 401, headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }
    const anonClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "AUTH_INVALID" }), {
        status: 401, headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    // Rate limit
    const rl = checkRateLimit(`lead-scores:${userId}`, { maxTokens: 10, refillRate: 0.2 });
    if (!rl.allowed) return rateLimitResponse(rl, dynCors);

    // Opzionale: body { force?: boolean } per ricalcolare tutto.
    let force = false;
    try {
      const body = await req.json().catch(() => null);
      if (body && typeof body === "object" && body !== null && (body as { force?: boolean }).force === true) {
        force = true;
      }
    } catch (_e) { /* no body */ }
    const STALE_HOURS = 24;
    const staleCutoff = new Date(Date.now() - STALE_HOURS * 3600_000).toISOString();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // Fetch all contacts in batches
    let offset = 0;
    const batchSize = 500;
    let totalUpdated = 0;

    while (true) {
      let query = admin
        .from("imported_contacts")
        .select("id, email, phone, mobile, interaction_count, last_interaction_at, lead_status, origin, created_at")
        .is("deleted_at", null);
      if (!force) {
        // OR: lead_score_updated_at è null o più vecchio della soglia.
        query = query.or(`lead_score_updated_at.is.null,lead_score_updated_at.lt.${staleCutoff}`);
      }
      const { data: contacts, error } = await query.range(offset, offset + batchSize - 1);

      if (error) throw error;
      if (!contacts || contacts.length === 0) break;

      // Fetch interactions for these contacts
      const contactIds = contacts.map(c => c.id);
      const { data: interactions } = await admin
        .from("contact_interactions")
        .select("contact_id, interaction_type")
        .in("contact_id", contactIds);

      // Fetch business card matches
      const { data: businessCards } = await admin
        .from("business_cards")
        .select("matched_contact_id")
        .in("matched_contact_id", contactIds)
        .not("matched_contact_id", "is", null);

      const interactionsByContact = new Map<string, string[]>();
      for (const i of interactions || []) {
        const list = interactionsByContact.get(i.contact_id) || [];
        list.push(i.interaction_type);
        interactionsByContact.set(i.contact_id, list);
      }

      const bcSet = new Set((businessCards || []).map(bc => bc.matched_contact_id));

      const now = Date.now();
      const nowIso = new Date().toISOString();
      const updates: Array<{
        id: string;
        lead_score: number;
        lead_score_breakdown: Record<string, number>;
        lead_score_updated_at: string;
      }> = [];

      for (const c of contacts) {
        let score = 0;
        const breakdown: Record<string, number> = {};

        // Has email? +15
        if (c.email) { score += 15; breakdown["Email"] = 15; }

        // Has phone? +10
        if (c.phone || c.mobile) { score += 10; breakdown["Telefono"] = 10; }

        // Interactions > 5? +15
        if ((c.interaction_count || 0) > 5) { score += 15; breakdown["Interazioni 5+"] = 15; }

        // Check interaction types
        const types = interactionsByContact.get(c.id) || [];
        if (types.includes("email_sent") && types.some(t => t === "email_received" || t === "email_reply")) {
          score += 25; breakdown["Risposta email"] = 25;
        }
        if (types.includes("meeting")) { score += 20; breakdown["Meeting"] = 20; }

        // Business card? +10
        if (bcSet.has(c.id)) { score += 10; breakdown["Biglietto visita"] = 10; }

        // Recency
        if (c.last_interaction_at) {
          const daysSince = (now - new Date(c.last_interaction_at).getTime()) / 86400000;
          if (daysSince < 7) { score += 15; breakdown["Recente <7gg"] = 15; }
          else if (daysSince < 30) { score += 10; breakdown["Recente <30gg"] = 10; }
          else if (daysSince < 90) { score += 5; breakdown["Recente <90gg"] = 5; }
        }

        // Status bonus
        if (c.lead_status === "negotiation" || c.lead_status === "converted") {
          score += 20; breakdown["Status avanzato"] = 20;
        }

        // Origin bonus
        if (c.origin && c.origin.toLowerCase().includes("incontro")) {
          score += 15; breakdown["Incontro personale"] = 15;
        }

        score = Math.min(score, 100);

        updates.push({
          id: c.id,
          lead_score: score,
          lead_score_breakdown: breakdown,
          lead_score_updated_at: nowIso,
        });
      }

      // Parallel UPDATE con concurrency cap (chunk 25) — N round-trip ma in parallelo.
      // Upsert non praticabile: imported_contacts ha colonne NOT NULL non incluse nello scoring.
      const CONCURRENCY = 25;
      for (let i = 0; i < updates.length; i += CONCURRENCY) {
        const slice = updates.slice(i, i + CONCURRENCY);
        const results = await Promise.all(
          slice.map((u) =>
            admin
              .from("imported_contacts")
              .update({
                lead_score: u.lead_score,
                lead_score_breakdown: u.lead_score_breakdown,
                lead_score_updated_at: u.lead_score_updated_at,
              })
              .eq("id", u.id)
              .then((r) => (r.error ? 0 : 1)),
          ),
        );
        totalUpdated += results.reduce((a, b) => a + b, 0);
      }

      offset += batchSize;
      if (contacts.length < batchSize) break;
    }

    return new Response(JSON.stringify({ success: true, updated: totalUpdated }), {
      headers: { ...dynCors, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...dynCors, "Content-Type": "application/json" },
    });
  }
});
