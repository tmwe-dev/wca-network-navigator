/**
 * decision-dashboard — Edge function per Decision Engine + Approval Flow.
 *
 * Endpoints (via query param `action`):
 *   - evaluate: valuta un partner e restituisce azioni raccomandate
 *   - execute: valuta + processa azioni tramite approval flow
 *   - dashboard: sommario coda approvazioni
 *   - undo: annulla azione nella finestra di undo
 *   - approve: approva azione pending
 *   - reject: rifiuta azione pending
 *   - expire: pulizia azioni scadute (per cron)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { edgeError } from "../_shared/handleEdgeError.ts";
import { evaluatePartner } from "../_shared/decisionEngine.ts";
import {
  processAllDecisionActions,
  undoAction,
  getApprovalDashboard,
  expireStaleActions,
} from "../_shared/approvalFlow.ts";
import type { AutonomyLevel } from "../_shared/decisionEngine.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight(req);
  const corsHeaders = getCorsHeaders(req);

  try {
    const authHeader = req.headers.get("authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Auth: estrai user da JWT
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Non autorizzato" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = user.id;

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "dashboard";

    let body: Record<string, unknown> = {};
    if (req.method === "POST") {
      body = await req.json();
    }

    switch (action) {
      // ── Evaluate partner (read-only) ──
      case "evaluate": {
        const partnerId = String(body.partner_id || url.searchParams.get("partner_id") || "");
        if (!partnerId) {
          return new Response(JSON.stringify({ error: "partner_id richiesto" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { state, actions } = await evaluatePartner(supabase, partnerId, userId);
        return new Response(JSON.stringify({ state, actions }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ── Execute: evaluate + process through approval flow ──
      case "execute": {
        const partnerId = String(body.partner_id || "");
        if (!partnerId) {
          return new Response(JSON.stringify({ error: "partner_id richiesto" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const autonomyOverride = body.autonomy as AutonomyLevel | undefined;
        const { state, actions } = await evaluatePartner(supabase, partnerId, userId, autonomyOverride);
        const results = await processAllDecisionActions(supabase, userId, partnerId, actions);
        return new Response(JSON.stringify({ state, actions, approval_results: results }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ── Dashboard summary ──
      case "dashboard": {
        const dashboard = await getApprovalDashboard(supabase, userId);
        return new Response(JSON.stringify(dashboard), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ── Undo action ──
      case "undo": {
        const actionId = String(body.action_id || "");
        if (!actionId) {
          return new Response(JSON.stringify({ error: "action_id richiesto" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const result = await undoAction(supabase, actionId, userId);
        return new Response(JSON.stringify(result), {
          status: result.success ? 200 : 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ── Approve action ──
      case "approve": {
        const actionId = String(body.action_id || "");
        if (!actionId) {
          return new Response(JSON.stringify({ error: "action_id richiesto" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { error } = await supabase
          .from("ai_pending_actions")
          .update({ status: "approved", executed_at: new Date().toISOString() })
          .eq("id", actionId)
          .eq("user_id", userId);
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ── Reject action ──
      case "reject": {
        const actionId = String(body.action_id || "");
        const reason = body.reason ? String(body.reason) : null;
        if (!actionId) {
          return new Response(JSON.stringify({ error: "action_id richiesto" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const updatePayload: Record<string, unknown> = { status: "rejected" };
        if (reason) updatePayload.reasoning = reason;
        const { error } = await supabase
          .from("ai_pending_actions")
          .update(updatePayload)
          .eq("id", actionId)
          .eq("user_id", userId);
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ── Expire stale actions (cron) ──
      case "expire": {
        const result = await expireStaleActions(supabase);
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: `Azione non riconosciuta: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (err) {
    return edgeError(err, corsHeaders);
  }
});
