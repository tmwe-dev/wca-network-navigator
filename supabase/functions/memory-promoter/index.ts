import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { embedBatch, DEFAULT_EMBEDDING_MODEL } from "../_shared/embeddings.ts";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";

interface MemoryRow {
  id: string;
  content: string;
  memory_type: string;
  access_count: number;
  confidence: number;
  decay_rate: number;
  last_accessed_at: string | null;
  created_at: string;
  level: number;
  pending_promotion: boolean;
  promoted_at: string | null;
  feedback: string | null;
  embedding: unknown;
}

/** Generate embeddings for memory rows that lack them */
async function generateEmbeddingsForRows(
  supabase: ReturnType<typeof createClient>,
  rows: Array<{ id: string; content: string; memory_type: string }>,
): Promise<number> {
  if (rows.length === 0) return 0;
  const texts = rows.map((r) => `${r.memory_type || "memory"} | ${(r.content || "").slice(0, 6000)}`);
  try {
    const vectors = await embedBatch(texts, { timeoutMs: 60000 });
    const now = new Date().toISOString();
    let count = 0;
    for (let i = 0; i < rows.length; i++) {
      const { error } = await supabase
        .from("ai_memory")
        .update({ embedding: vectors[i], embedding_model: DEFAULT_EMBEDDING_MODEL, embedding_updated_at: now })
        .eq("id", rows[i].id);
      if (!error) count++;
      else console.warn(`embed update ${rows[i].id} failed:`, error.message);
    }
    return count;
  } catch (e: unknown) {
    console.warn("generateEmbeddingsForRows failed:", e instanceof Error ? e.message : String(e));
    return 0;
  }
}

serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;
  const origin = req.headers.get("origin");
  const dynCors = getCorsHeaders(origin);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const stats = { promoted_l1_to_l2: 0, promoted_l2_candidate: 0, promoted_l2_to_l3: 0, decayed: 0, pruned: 0, embeddings_generated: 0, conflicts_detected: 0 };

    // ── 1. L1 → L2 Promotion ──
    // Criteria: access_count >= 3 AND confidence >= 0.40
    const { data: l1Candidates } = await supabase
      .from("ai_memory")
      .select("id, access_count, confidence, content, memory_type, embedding")
      .eq("level", 1)
      .gte("access_count", 3)
      .gte("confidence", 0.40);

    if (l1Candidates?.length) {
      const ids = (l1Candidates as MemoryRow[]).map((m) => m.id);
      await supabase
        .from("ai_memory")
        .update({ level: 2, decay_rate: 0.005, promoted_at: new Date().toISOString() })
        .in("id", ids);
      stats.promoted_l1_to_l2 = ids.length;

      // Generate embeddings for newly promoted L2 memories without one
      const needEmbed = (l1Candidates as MemoryRow[]).filter((m) => !m.embedding);
      if (needEmbed.length > 0) {
        const embedded = await generateEmbeddingsForRows(supabase, needEmbed);
        stats.embeddings_generated += embedded;
      }
    }

    // ── 2. L2 → L3 Candidate (pending_promotion) ──
    // Criteria: access_count >= 8 AND confidence >= 0.70
    const { data: l2Candidates } = await supabase
      .from("ai_memory")
      .select("id")
      .eq("level", 2)
      .eq("pending_promotion", false)
      .gte("access_count", 8)
      .gte("confidence", 0.70);

    if (l2Candidates?.length) {
      const ids = (l2Candidates as Array<{ id: string }>).map((m) => m.id);
      await supabase
        .from("ai_memory")
        .update({ pending_promotion: true })
        .in("id", ids);
      stats.promoted_l2_candidate = ids.length;
    }

    // ── 2b. L2 → L3 Execution ──
    // Promote memories that have been pending for >= 7 days and have no negative feedback
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: l2ToPromote } = await supabase
      .from("ai_memory")
      .select("id, content, memory_type, feedback, embedding, promoted_at, user_id")
      .eq("level", 2)
      .eq("pending_promotion", true)
      .or(`promoted_at.is.null,promoted_at.lt.${sevenDaysAgo}`);

    if (l2ToPromote?.length) {
      const eligible = (l2ToPromote as (MemoryRow & { user_id: string })[]).filter((m) => m.feedback !== "negative");
      if (eligible.length > 0) {
        // ── Conflict detection before promotion ──
        for (const mem of eligible) {
          if (!mem.embedding) continue;
          try {
            const { data: conflicts } = await supabase.rpc("match_ai_memory_enhanced", {
              query_embedding: mem.embedding,
              match_count: 3,
              match_threshold: 0.85,
              filter_user_id: mem.user_id || null,
              filter_levels: [3],
              filter_types: null,
            });
            if (conflicts && conflicts.length > 0) {
              stats.conflicts_detected += conflicts.length;
              console.warn("[memory-promoter] L3 conflict detected:", {
                newMemoryId: mem.id,
                conflictingL3: (conflicts as Array<{ id: string; similarity: number; content: string }>).map((r) => ({
                  id: r.id,
                  similarity: r.similarity,
                  content: r.content.slice(0, 100),
                })),
              });
              // Create conflict alert as L1 memory
              await supabase.from("ai_memory").insert({
                user_id: mem.user_id,
                content: `CONFLITTO RILEVATO: La memoria '${mem.content.slice(0, 80)}' (sim: ${Math.round((conflicts as Array<{ similarity: number }>)[0].similarity * 100)}%) è simile a L3 esistente '${(conflicts as Array<{ content: string }>)[0].content.slice(0, 80)}'. Verificare quale è corretta.`,
                memory_type: "decision",
                tags: ["conflict_detected", "l3_review"],
                importance: 8,
                source: "conflict_detector",
                level: 1,
                confidence: 1,
              });
            }
          } catch (conflictErr: unknown) {
            console.warn("[memory-promoter] Conflict check failed for", mem.id, ":", conflictErr instanceof Error ? conflictErr.message : String(conflictErr));
          }
        }

        const ids = eligible.map((m) => m.id);
        await supabase
          .from("ai_memory")
          .update({ level: 3, decay_rate: 0, promoted_at: new Date().toISOString(), pending_promotion: false })
          .in("id", ids);
        stats.promoted_l2_to_l3 = ids.length;

        // Generate embeddings for newly promoted L3 memories without one
        const needEmbed = eligible.filter((m) => !m.embedding);
        if (needEmbed.length > 0) {
          const embedded = await generateEmbeddingsForRows(supabase, needEmbed);
          stats.embeddings_generated += embedded;
        }
      }
    }

    // ── 3. Decay: EXPONENTIAL with 3-day grace period ──
    const GRACE_PERIOD_DAYS = 3;
    const { data: decayable } = await supabase
      .from("ai_memory")
      .select("id, confidence, decay_rate, last_accessed_at, created_at, level")
      .in("level", [1, 2])
      .gt("confidence", 0.02);

    if (decayable?.length) {
      const now = Date.now();
      const updates: { id: string; confidence: number }[] = [];

      for (const m of decayable as MemoryRow[]) {
        const lastAccess = new Date(m.last_accessed_at || m.created_at).getTime();
        const daysSince = Math.max(0, (now - lastAccess) / (1000 * 60 * 60 * 24));

        if (daysSince <= GRACE_PERIOD_DAYS) continue;

        const effectiveDays = daysSince - GRACE_PERIOD_DAYS;
        const newConfidence = m.confidence * Math.pow(1 - m.decay_rate, effectiveDays);
        const rounded = Math.round(newConfidence * 1000) / 1000;

        if (rounded < m.confidence) {
          updates.push({ id: m.id, confidence: Math.max(0, rounded) });
        }
      }

      for (const u of updates) {
        await supabase
          .from("ai_memory")
          .update({ confidence: u.confidence })
          .eq("id", u.id);
      }
      stats.decayed = updates.length;
    }

    // ── 4. Prune: remove L1 with confidence < 0.02 ──
    const { data: prunable } = await supabase
      .from("ai_memory")
      .select("id")
      .eq("level", 1)
      .lt("confidence", 0.02);

    if (prunable?.length) {
      const ids = (prunable as Array<{ id: string }>).map((m) => m.id);
      await supabase.from("ai_memory").delete().in("id", ids);
      stats.pruned = ids.length;
    }

    console.log("[memory-promoter] Stats:", JSON.stringify(stats));

    return new Response(JSON.stringify({ success: true, stats }), {
      headers: { ...dynCors, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    console.error("memory-promoter error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...dynCors, "Content-Type": "application/json" } }
    );
  }
});
