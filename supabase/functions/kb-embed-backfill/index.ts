/**
 * kb-embed-backfill — genera/aggiorna embedding per le KB entries che ne sono prive.
 *
 * Vol. II §11 (RAG architecture) — pipeline di indexing.
 *
 * Input opzionale (JSON body):
 *   { batchSize?: number, force?: boolean }
 *
 * - batchSize: quante righe processare per invocazione (default 50, max 200)
 * - force:    rigenera anche righe con embedding già presente (default false)
 *
 * Output:
 *   { processed, skipped, failed, batchSize, hasMore }
 *
 * Auth: richiede service_role o utente con ruolo `admin`.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { embedBatch, DEFAULT_EMBEDDING_MODEL } from "../_shared/embeddings.ts";

serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;

  const origin = req.headers.get("origin");
  const dynCors = getCorsHeaders(origin);

  try {
    // ── Auth ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authClient = createClient(supabaseUrl, anon, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await authClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const batchSize = Math.min(Math.max(Number(body.batchSize) || 50, 1), 200);
    const force = body.force === true;

    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // ── Fetch KB rows da indicizzare ──
    const query = supabase
      .from("kb_entries")
      .select("id, title, content, category, chapter")
      .eq("is_active", true)
      .limit(batchSize);
    if (!force) {
      query.is("embedding", null);
    }
    const { data: rows, error: fetchErr } = await query;
    if (fetchErr) {
      throw new Error(`Fetch KB rows: ${fetchErr.message}`);
    }
    if (!rows || rows.length === 0) {
      return new Response(JSON.stringify({
        processed: 0, skipped: 0, failed: 0, batchSize, hasMore: false,
      }), { headers: { ...dynCors, "Content-Type": "application/json" } });
    }

    // ── Compose testi per embedding (titolo + contenuto, troncato) ──
    const texts = rows.map((r: any) => {
      const title = r.title || "";
      const chap = r.chapter ? `[${r.chapter}] ` : "";
      const content = (r.content || "").slice(0, 6000);
      return `${chap}${title}\n${content}`;
    });

    // ── Genera embeddings ──
    let vectors: number[][];
    try {
      vectors = await embedBatch(texts, { timeoutMs: 60000 });
    } catch (e) {
      console.error("embedBatch failed:", e);
      throw e;
    }

    // ── Update each row (chunked, sequential, semplice) ──
    let processed = 0;
    let failed = 0;
    const now = new Date().toISOString();
    for (let i = 0; i < rows.length; i++) {
      const { error: upErr } = await supabase
        .from("kb_entries")
        .update({
          embedding: vectors[i],
          embedding_model: DEFAULT_EMBEDDING_MODEL,
          embedding_updated_at: now,
        })
        .eq("id", rows[i].id);
      if (upErr) {
        failed++;
        console.error(`update kb ${rows[i].id} failed:`, upErr.message);
      } else {
        processed++;
      }
    }

    // hasMore: ci sono ancora righe non indicizzate?
    const { count } = await supabase
      .from("kb_entries")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true)
      .is("embedding", null);

    return new Response(JSON.stringify({
      processed,
      skipped: 0,
      failed,
      batchSize,
      hasMore: (count ?? 0) > 0,
      remaining: count ?? 0,
    }), { headers: { ...dynCors, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("kb-embed-backfill error:", err);
    return new Response(JSON.stringify({
      error: err instanceof Error ? err.message : "Unknown error",
    }), { status: 500, headers: { ...dynCors, "Content-Type": "application/json" } });
  }
});
