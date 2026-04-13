/**
 * memory-embed-backfill — genera/aggiorna embedding per le ai_memory entries che ne sono prive.
 *
 * Input opzionale (JSON body):
 *   { batchSize?: number, force?: boolean }
 *
 * - batchSize: quante righe processare per invocazione (default 50, max 200)
 * - force:    rigenera anche righe con embedding già presente (default false)
 *
 * Output:
 *   { processed, failed, batchSize, hasMore, remaining }
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

    // ── Fetch ai_memory rows to index ──
    const query = supabase
      .from("ai_memory")
      .select("id, content, memory_type")
      .order("created_at", { ascending: false })
      .limit(batchSize);
    if (!force) {
      query.is("embedding", null);
    }
    const { data: rows, error: fetchErr } = await query;
    if (fetchErr) {
      throw new Error(`Fetch ai_memory rows: ${fetchErr.message}`);
    }
    if (!rows || rows.length === 0) {
      return new Response(JSON.stringify({
        processed: 0, failed: 0, batchSize, hasMore: false, remaining: 0,
      }), { headers: { ...dynCors, "Content-Type": "application/json" } });
    }

    // ── Compose texts for embedding ──
    const texts = (rows as Array<{ id: string; content: string; memory_type: string }>).map((r) => {
      const content = (r.content || "").slice(0, 6000);
      return `${r.memory_type || "memory"} | ${content}`;
    });

    // ── Generate embeddings ──
    let vectors: number[][];
    try {
      vectors = await embedBatch(texts, { timeoutMs: 60000 });
    } catch (e: unknown) {
      console.error("embedBatch failed:", e);
      throw e instanceof Error ? e : new Error(String(e));
    }

    // ── Update each row ──
    let processed = 0;
    let failed = 0;
    const now = new Date().toISOString();
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] as { id: string };
      const { error: upErr } = await supabase
        .from("ai_memory")
        .update({
          embedding: vectors[i],
          embedding_model: DEFAULT_EMBEDDING_MODEL,
          embedding_updated_at: now,
        })
        .eq("id", row.id);
      if (upErr) {
        failed++;
        console.error(`update ai_memory ${row.id} failed:`, upErr.message);
      } else {
        processed++;
      }
    }

    // ── Count remaining ──
    const { count } = await supabase
      .from("ai_memory")
      .select("*", { count: "exact", head: true })
      .is("embedding", null);

    return new Response(JSON.stringify({
      processed,
      failed,
      batchSize,
      hasMore: (count ?? 0) > 0,
      remaining: count ?? 0,
    }), { headers: { ...dynCors, "Content-Type": "application/json" } });
  } catch (err: unknown) {
    console.error("memory-embed-backfill error:", err);
    return new Response(JSON.stringify({
      error: err instanceof Error ? err.message : "Unknown error",
    }), { status: 500, headers: { ...dynCors, "Content-Type": "application/json" } });
  }
});
