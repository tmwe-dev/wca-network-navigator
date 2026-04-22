import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { logSupervisorAudit } from "../_shared/supervisorAudit.ts";

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

    const { mission_id, user_id } = await req.json();
    if (!mission_id || !user_id) return json({ error: "mission_id and user_id required" }, 400);

    // Get mission
    const { data: mission } = await supabase
      .from("outreach_missions")
      .select("channel, status")
      .eq("id", mission_id)
      .single();

    if (!mission || mission.status !== "active") {
      return json({ error: "Mission not active" }, 400);
    }

    // Get slot config (user-specific first, then defaults)
    const { data: config } = await supabase
      .from("mission_slot_config")
      .select("*")
      .or(`user_id.eq.${user_id},user_id.eq.00000000-0000-0000-0000-000000000000`)
      .eq("channel", mission.channel)
      .order("user_id", { ascending: false })
      .limit(1)
      .single();

    const maxConcurrent = config?.concurrent_slots || 5;

    // Acquire slot
    const { data: actionId } = await supabase.rpc("acquire_mission_slot", {
      p_mission_id: mission_id,
      p_channel: mission.channel,
      p_user_id: user_id,
      p_max_concurrent: maxConcurrent,
    });

    if (!actionId) {
      const { data: snapshot } = await supabase.rpc("update_mission_progress", {
        p_mission_id: mission_id,
      });
      return json({ status: "no_slot", message: "All slots busy or no pending actions", progress: snapshot });
    }

    // Get action details
    const { data: action } = await supabase
      .from("mission_actions")
      .select("*")
      .eq("id", actionId)
      .single();

    // Null check on action
    if (!action) {
      await supabase.rpc("release_mission_slot", {
        p_action_id: actionId,
        p_success: false,
        p_error: "Action not found after acquisition",
      }).catch(e =>
        console.error("[mission-executor] Failed to release slot after action not found:", e)
      );
      return json({ error: "Action not found" }, 500);
    }

    // Execute based on channel
    let success = false;
    let error: string | null = null;

    let slotAcquired = true;
    try {
      const partnerId = (action.metadata as Record<string, unknown>)?.partner_id;
      if (!partnerId) throw new Error("No partner_id in action metadata");

      const headers = {
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      };

      if (mission.channel === "email") {
        const res = await fetch(`${supabaseUrl}/functions/v1/generate-email`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            partner_id: partnerId,
            email_type: (action.metadata as Record<string, unknown>)?.email_type || "outreach",
            mission_id,
            action_id: actionId,
          }),
        });
        success = res.ok;
        if (!success) error = await res.text();
      } else {
        const res = await fetch(`${supabaseUrl}/functions/v1/generate-outreach`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            partner_ids: [partnerId],
            channel: mission.channel,
            mission_id,
            action_id: actionId,
          }),
        });
        success = res.ok;
        if (!success) error = await res.text();
      }
    } catch (e: unknown) {
      success = false;
      error = e instanceof Error ? e.message : "Unknown execution error";
      console.error("[mission-executor] Execution failed:", e);
    } finally {
      // Always release slot, even on crash
      if (slotAcquired) {
        await supabase.rpc("release_mission_slot", {
          p_action_id: actionId,
          p_success: success,
          p_error: error,
        }).catch(e =>
          console.error("[mission-executor] Failed to release slot:", e)
        );
      }
    }

    // Update progress
    const { data: snapshot } = await supabase.rpc("update_mission_progress", {
      p_mission_id: mission_id,
    });

    // Auto-complete mission
    const progress = snapshot as Record<string, number> | null;
    if (progress && (progress.completed + progress.failed) >= progress.total) {
      await supabase
        .from("outreach_missions")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", mission_id);
    }

    // Supervisor audit (fire-and-forget)
    const partnerId = (action.metadata as Record<string, unknown>)?.partner_id as string | undefined;
    const targetEmail = (action.metadata as Record<string, unknown>)?.email as string | undefined;
    logSupervisorAudit(supabase, {
      user_id, actor_type: "system",
      action_category: success ? "mission_completed" : "mission_failed",
      action_detail: `Mission action ${mission.channel}: ${success ? "completata" : "fallita"}`,
      target_type: "mission", target_id: mission_id,
      partner_id: partnerId, email_address: targetEmail,
      decision_origin: "system_trigger",
      metadata: { channel: mission.channel, error, action_id: actionId },
    });

    return json({
      status: success ? "completed" : "failed",
      action_id: actionId,
      error,
      progress: snapshot,
    });
  } catch (e: unknown) {
    console.error("mission-executor error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
