/**
 * save-correction-memory — Persists user corrections as L1 memories
 * for the continuous learning loop.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { edgeError, extractErrorMessage } from "../_shared/handleEdgeError.ts";

serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;
  const origin = req.headers.get("origin");
  const dynCors = getCorsHeaders(origin);

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return edgeError("AUTH_REQUIRED", "Unauthorized", 401, dynCors);
    }
    const token = authHeader.replace("Bearer ", "");
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return edgeError("AUTH_INVALID", "Unauthorized", 401, dynCors);
    }
    const userId = claimsData.claims.sub as string;

    const body = await req.json();
    const { correction_type, original_value, corrected_value, email_address, context, domain } = body;

    if (!correction_type || !context) {
      return new Response(JSON.stringify({ error: "correction_type and context required" }), {
        status: 400,
        headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }

    // 1. Save L1 memory with high importance
    // LOVABLE-93: coerenza Prompt Lab multi-dominio — track domain in tags
    const tags = ["correzione_utente", correction_type, `da_${original_value || "unknown"}`, `a_${corrected_value || "unknown"}`];
    if (domain) {
      tags.push(`domain:${domain}`);
    }
    await supabase.from("ai_memory").insert({
      user_id: userId,
      memory_type: "decision",
      content: context,
      tags: tags,
      level: 1,
      importance: 5,
      confidence: 0.8,
      decay_rate: 0.005,
      source: "user_correction",
    });

    // 2. Update interaction count for this email address
    if (email_address) {
      const { data: existing } = await supabase
        .from("email_address_rules")
        .select("id, interaction_count")
        .eq("email_address", email_address.toLowerCase())
        .eq("user_id", userId)
        .maybeSingle();

      if (existing) {
        await supabase.from("email_address_rules")
          .update({
            category: corrected_value || undefined,
            interaction_count: (existing.interaction_count || 0) + 1,
            last_interaction_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
      }
    }

    // 3. Log in supervisor_audit_log
    await supabase.from("supervisor_audit_log").insert({
      user_id: userId,
      actor_type: "user",
      action_category: "threshold_adjusted",
      action_detail: `Correzione: ${correction_type} da "${original_value || ""}" a "${corrected_value || ""}"`,
      target_type: "rule",
      target_label: email_address || correction_type,
      decision_origin: "manual",
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...dynCors, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    console.error("save-correction-memory error:", extractErrorMessage(e));
    return edgeError("INTERNAL_ERROR", extractErrorMessage(e), 500, dynCors);
  }
});
