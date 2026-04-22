import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";

serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;
  const origin = req.headers.get("origin");
  const dynCors = getCorsHeaders(origin);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const stats = { promoted_to_5: 0, promoted_to_7: 0, deactivated: 0 };

    // ── 1. Auto-generated entries: priority 3 → 5 after 5 accesses ──
    const { data: candidates3to5 } = await supabase
      .from("kb_entries")
      .select("id, access_count, tags")
      .eq("is_active", true)
      .eq("priority", 3)
      .gte("access_count", 5)
      .overlaps("tags", ["auto_generated"]);

    if (candidates3to5?.length) {
      const ids = (candidates3to5 as Array<{ id: string }>).map(e => e.id);
      await supabase
        .from("kb_entries")
        .update({ priority: 5 })
        .in("id", ids);
      stats.promoted_to_5 = ids.length;
    }

    // ── 2. Auto-generated entries: priority 5 → 7 after 15 accesses ──
    const { data: candidates5to7 } = await supabase
      .from("kb_entries")
      .select("id, access_count, tags")
      .eq("is_active", true)
      .eq("priority", 5)
      .gte("access_count", 15)
      .overlaps("tags", ["auto_generated"]);

    if (candidates5to7?.length) {
      for (const entry of candidates5to7 as Array<{ id: string; tags: string[] }>) {
        const currentTags = entry.tags || [];
        const newTags = currentTags.filter(t => t !== "auto_generated").concat(["validated"]);
        await supabase
          .from("kb_entries")
          .update({ priority: 7, tags: newTags })
          .eq("id", entry.id);
      }
      stats.promoted_to_7 = candidates5to7.length;
    }

    // ── 3. Deactivate stale entries: auto_generated + priority 3 + zero accesses after 30 days ──
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: stale } = await supabase
      .from("kb_entries")
      .select("id")
      .eq("is_active", true)
      .eq("priority", 3)
      .eq("access_count", 0)
      .overlaps("tags", ["auto_generated"])
      .lt("created_at", thirtyDaysAgo);

    if (stale?.length) {
      const ids = (stale as Array<{ id: string }>).map(e => e.id);
      await supabase
        .from("kb_entries")
        .update({ is_active: false })
        .in("id", ids);
      stats.deactivated = ids.length;
    }


    return new Response(JSON.stringify({ success: true, stats }), {
      headers: { ...dynCors, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...dynCors, "Content-Type": "application/json" } },
    );
  }
});
