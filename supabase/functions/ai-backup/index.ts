import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";

serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;
  const origin = req.headers.get("origin");
  const cors = getCorsHeaders(origin);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const stats = { kb_entries: 0, memories: 0, operative_prompts: 0, app_settings: 0, agent_personas: 0, users: 0, size_bytes: 0 };
    const timestamp = new Date().toISOString().split("T")[0];

    // Get all users with profiles
    const { data: users } = await supabase
      .from("profiles")
      .select("id")
      .limit(100);

    for (const user of users || []) {
      const userId = user.id;
      const backup: Record<string, unknown> = {
        exported_at: new Date().toISOString(),
        user_id: userId,
      };

      // Export KB entries (user-specific + shared)
      const { data: kbEntries } = await supabase
        .from("kb_entries")
        .select("*")
        .or(`user_id.eq.${userId},user_id.is.null`)
        .eq("is_active", true);
      backup.kb_entries = kbEntries || [];
      stats.kb_entries += (kbEntries || []).length;

      // Export AI memories (all levels)
      const { data: memories } = await supabase
        .from("ai_memory")
        .select("*")
        .eq("user_id", userId);
      backup.memories = memories || [];
      stats.memories += (memories || []).length;

      // Export operative prompts
      const { data: prompts } = await supabase
        .from("operative_prompts")
        .select("*")
        .eq("user_id", userId)
        .eq("is_active", true);
      backup.operative_prompts = prompts || [];
      stats.operative_prompts += (prompts || []).length;

      // Export app settings (profilo AI, tone, prompt email, ecc.)
      const { data: settings } = await supabase
        .from("app_settings")
        .select("*")
        .eq("user_id", userId);
      backup.app_settings = settings || [];
      stats.app_settings += (settings || []).length;

      // Export agent personas (voce/stile per agente)
      const { data: personas } = await supabase
        .from("agent_personas")
        .select("*")
        .eq("user_id", userId);
      backup.agent_personas = personas || [];
      stats.agent_personas += (personas || []).length;

      // Serialize and upload
      const content = JSON.stringify(backup, null, 2);
      const bytes = new TextEncoder().encode(content);
      stats.size_bytes += bytes.length;

      const path = `${userId}/backup-${timestamp}.json`;
      const { error: uploadError } = await supabase.storage
        .from("ai-backups")
        .upload(path, bytes, {
          contentType: "application/json",
          upsert: true,
        });

      if (uploadError) {
        console.error(`Backup upload failed for ${userId}:`, uploadError.message);
      } else {
        stats.users++;
      }
    }

    // Cleanup: keep only last 4 backups per user (28 days)
    for (const user of users || []) {
      const { data: files } = await supabase.storage
        .from("ai-backups")
        .list(user.id, { sortBy: { column: "created_at", order: "desc" } });

      if (files && files.length > 4) {
        const toDelete = files.slice(4).map((f) => `${user.id}/${f.name}`);
        await supabase.storage.from("ai-backups").remove(toDelete);
      }
    }

    console.log("[ai-backup] Stats:", JSON.stringify(stats));
    return json({ success: true, stats });
  } catch (e: unknown) {
    console.error("ai-backup error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
