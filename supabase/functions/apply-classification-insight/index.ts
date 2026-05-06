import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";

/**
 * Applica un'insight approvata: append dell'hint al gruppo bersaglio
 * (oppure al prompt operativo "Email Groups Classifier").
 * Hard guard: solo utenti autenticati. Non sovrascrive: append controllato + dedup.
 */
serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;
  const dynCors = getCorsHeaders(req.headers.get("origin"));

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "AUTH_REQUIRED" }), {
        status: 401,
        headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);
    const anon = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await anon.auth.getUser();
    if (userErr || !userData?.user?.id) {
      return new Response(JSON.stringify({ error: "INVALID_TOKEN" }), {
        status: 401,
        headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const body = await req.json();
    const insightId: string | undefined = body.insight_id;
    const overrideText: string | undefined = body.override_change_text;
    if (!insightId) {
      return new Response(JSON.stringify({ error: "insight_id required" }), {
        status: 400,
        headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }

    const { data: insight } = await supabase
      .from("ai_classification_insights")
      .select("*")
      .eq("id", insightId)
      .maybeSingle();
    if (!insight) {
      return new Response(JSON.stringify({ error: "insight not found" }), {
        status: 404,
        headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }
    if (insight.status !== "pending") {
      return new Response(JSON.stringify({ error: "insight not pending", status: insight.status }), {
        status: 409,
        headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }

    const changeText: string = (overrideText && overrideText.trim()) || insight.proposed_change_text;
    let appliedSummary = "";

    if (insight.proposed_target === "group" && insight.proposed_target_id) {
      const { data: group } = await supabase
        .from("email_sender_groups")
        .select("id, classification_hint")
        .eq("id", insight.proposed_target_id)
        .maybeSingle();
      if (!group) {
        return new Response(JSON.stringify({ error: "target group missing" }), {
          status: 404,
          headers: { ...dynCors, "Content-Type": "application/json" },
        });
      }
      const existing: string = (group.classification_hint as string | null) ?? "";
      const trimmed = changeText.trim();
      if (existing.toLowerCase().includes(trimmed.toLowerCase())) {
        appliedSummary = "Hint già presente — nessuna modifica";
      } else {
        const next = existing ? `${existing}\n• ${trimmed}` : `• ${trimmed}`;
        await supabase
          .from("email_sender_groups")
          .update({ classification_hint: next })
          .eq("id", group.id);
        appliedSummary = `Hint aggiunto al gruppo ${insight.proposed_target_name ?? ""}`;
      }
    } else if (insight.proposed_target === "prompt" && insight.proposed_target_id) {
      const { data: prompt } = await supabase
        .from("operative_prompts")
        .select("id, criteria")
        .eq("id", insight.proposed_target_id)
        .maybeSingle();
      if (!prompt) {
        return new Response(JSON.stringify({ error: "target prompt missing" }), {
          status: 404,
          headers: { ...dynCors, "Content-Type": "application/json" },
        });
      }
      const existing: string = (prompt.criteria as string | null) ?? "";
      const trimmed = changeText.trim();
      if (existing.toLowerCase().includes(trimmed.toLowerCase())) {
        appliedSummary = "Regola già presente — nessuna modifica";
      } else {
        const next = existing
          ? `${existing}\n\n## Anti-pattern noti\n- ${trimmed}`
          : `## Anti-pattern noti\n- ${trimmed}`;
        await supabase
          .from("operative_prompts")
          .update({ criteria: next })
          .eq("id", prompt.id);
        appliedSummary = `Regola aggiunta al prompt ${insight.proposed_target_name ?? ""} (nuova versione creata)`;
      }
    } else {
      return new Response(JSON.stringify({ error: "invalid target" }), {
        status: 400,
        headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }

    await supabase
      .from("ai_classification_insights")
      .update({
        status: "applied",
        applied_at: new Date().toISOString(),
        applied_by_user_id: userId,
        applied_change_summary: appliedSummary,
        proposed_change_text: changeText,
      })
      .eq("id", insightId);

    return new Response(JSON.stringify({ ok: true, summary: appliedSummary }), {
      headers: { ...dynCors, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[apply-classification-insight] fatal", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...dynCors, "Content-Type": "application/json" } },
    );
  }
});