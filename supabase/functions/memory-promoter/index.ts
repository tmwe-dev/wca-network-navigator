import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const stats = { promoted_l1_to_l2: 0, promoted_l2_candidate: 0, decayed: 0, pruned: 0 };

    // ── 1. L1 → L2 Promotion ──
    // Criteria: access_count >= 3 AND confidence >= 0.40
    const { data: l1Candidates } = await supabase
      .from("ai_memory")
      .select("id, access_count, confidence")
      .eq("level", 1)
      .gte("access_count", 3)
      .gte("confidence", 0.40);

    if (l1Candidates?.length) {
      const ids = l1Candidates.map((m: any) => m.id);
      await supabase
        .from("ai_memory")
        .update({ level: 2, decay_rate: 0.005, promoted_at: new Date().toISOString() })
        .in("id", ids);
      stats.promoted_l1_to_l2 = ids.length;
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
      const ids = l2Candidates.map((m: any) => m.id);
      await supabase
        .from("ai_memory")
        .update({ pending_promotion: true })
        .in("id", ids);
      stats.promoted_l2_candidate = ids.length;
    }

    // ── 3. Decay: EXPONENTIAL with 3-day grace period ──
    // Formula: confidence × (1 - decay_rate)^(days - 3)
    // L1: decay_rate default 0.02/day, L2: 0.005/day, L3: no decay
    const GRACE_PERIOD_DAYS = 3;
    const { data: decayable } = await supabase
      .from("ai_memory")
      .select("id, confidence, decay_rate, last_accessed_at, created_at, level")
      .in("level", [1, 2])
      .gt("confidence", 0.02);

    if (decayable?.length) {
      const now = Date.now();
      const updates: { id: string; confidence: number }[] = [];

      for (const m of decayable as any[]) {
        const lastAccess = new Date(m.last_accessed_at || m.created_at).getTime();
        const daysSince = Math.max(0, (now - lastAccess) / (1000 * 60 * 60 * 24));
        
        // Grace period: no decay for first 3 days
        if (daysSince <= GRACE_PERIOD_DAYS) continue;

        const effectiveDays = daysSince - GRACE_PERIOD_DAYS;
        // Exponential decay: more gentle, never fully zeroes out
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

    // ── 4. Prune: remove L1 with confidence < 0.02 (lowered threshold) ──
    const { data: prunable } = await supabase
      .from("ai_memory")
      .select("id")
      .eq("level", 1)
      .lt("confidence", 0.02);

    if (prunable?.length) {
      const ids = prunable.map((m: any) => m.id);
      await supabase.from("ai_memory").delete().in("id", ids);
      stats.pruned = ids.length;
    }

    console.log("[memory-promoter] Stats:", JSON.stringify(stats));

    return new Response(JSON.stringify({ success: true, stats }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("memory-promoter error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
