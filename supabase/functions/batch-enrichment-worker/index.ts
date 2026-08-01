import "../_shared/llmFetchInterceptor.ts";
/**
 * Batch Enrichment Worker — arricchisce automaticamente i partner senza enrichment_data.
 *
 * Eseguito ogni 30 minuti via pg_cron.
 * - Pesca N partner con website e enrichment_data vuoto/null
 * - Per ognuno invoca enrich-partner-website (fire-and-forget)
 * - Rate-limit: 10s tra chiamate (rispetta AI gateway)
 * - Wall-clock cap: 50s totale
 * - Skip se già arricchito
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { cronPausedResponse } from "../_shared/cronGate.ts";

// Audit Sez.1 — F: batch + sleep adattivo per migliorare throughput cron.
const BATCH_SIZE = 8;
const RATE_LIMIT_MS = 10_000;
const WALL_CLOCK_CAP_MS = 50_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

Deno.serve(async (req: Request) => {
  const pre = corsPreflight(req);
  if (pre) return pre;

  const origin = req.headers.get("origin");
  const dynCors = getCorsHeaders(origin);

  // Auth: accetta service role o anon (cron usa anon inline)
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...dynCors, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  {
    const paused = await cronPausedResponse(supabase, "batch-enrichment-worker");
    if (paused) return paused;
  }

  const startedAt = Date.now();
  const log = {
    selected: 0,
    enriched: 0,
    skipped: 0,
    errors: [] as Array<{ partnerId: string; error: string }>,
  };

  try {
    // Check global pause flag (rispetta lo switch utente)
    const { data: pauseSetting } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "ai_automations_paused")
      .maybeSingle();
    if (pauseSetting?.value === "true") {
      return new Response(
        JSON.stringify({ paused: true, message: "AI automations paused" }),
        { headers: { ...dynCors, "Content-Type": "application/json" } },
      );
    }

    // Pick N partner senza enrichment_data, ordinati per rating DESC
    const { data: partners, error: pickErr } = await supabase
      .from("partners")
      .select("id, website, enrichment_data")
      .or("enrichment_data.is.null,enrichment_data.eq.{}")
      .not("website", "is", null)
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("rating", { ascending: false, nullsFirst: false })
      .limit(BATCH_SIZE);

    if (pickErr) throw pickErr;
    if (!partners || partners.length === 0) {
      return new Response(
        JSON.stringify({ message: "No partners to enrich", ...log }),
        { headers: { ...dynCors, "Content-Type": "application/json" } },
      );
    }

    log.selected = partners.length;

    for (const partner of partners) {
      // Wall clock cap
      if (Date.now() - startedAt > WALL_CLOCK_CAP_MS) {
        console.log("[batch-enrichment] wall-clock cap reached, exiting");
        break;
      }

      // (F) Re-check rimosso: la SELECT iniziale ha già filtrato per
      // enrichment_data NULL/{}. Risparmio: 1 query per partner.
      const callStart = Date.now();
      try {
        // Invoca enrich-partner-website senza userId → no consumo crediti utente,
        // usa LOVABLE_API_KEY del progetto.
        const resp = await fetch(`${supabaseUrl}/functions/v1/enrich-partner-website`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${anonKey}`, // no user JWT → bypassa BYOK/credit check
          },
          body: JSON.stringify({ partnerId: partner.id }),
        });

        if (!resp.ok) {
          const txt = await resp.text();
          log.errors.push({ partnerId: partner.id, error: `HTTP ${resp.status}: ${txt.slice(0, 200)}` });
          console.error(`[batch-enrichment] partner ${partner.id} failed: ${resp.status} ${txt.slice(0, 200)}`);
        } else {
          log.enriched++;
          console.log(`[batch-enrichment] partner ${partner.id} enriched`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log.errors.push({ partnerId: partner.id, error: msg });
        console.error(`[batch-enrichment] partner ${partner.id} exception: ${msg}`);
      }

      // (F) Rate limit adattivo: se la chiamata ha già impiegato >= RATE_LIMIT_MS,
      // la finestra è di fatto rispettata → skip sleep. Cap globale wall-clock invariato.
      const callElapsed = Date.now() - callStart;
      const remainingWindow = RATE_LIMIT_MS - callElapsed;
      if (
        remainingWindow > 0 &&
        Date.now() - startedAt + remainingWindow < WALL_CLOCK_CAP_MS
      ) {
        await sleep(remainingWindow);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        duration_ms: Date.now() - startedAt,
        ...log,
      }),
      { headers: { ...dynCors, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[batch-enrichment] fatal:", msg);
    return new Response(
      JSON.stringify({ error: msg, ...log }),
      { status: 500, headers: { ...dynCors, "Content-Type": "application/json" } },
    );
  }
});
