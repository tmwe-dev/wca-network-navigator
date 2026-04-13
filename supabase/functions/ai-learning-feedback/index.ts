/**
 * ai-learning-feedback — Weekly cron that analyzes AI decision patterns
 * and suggests threshold adjustments or new rules.
 * Runs Sunday 05:00 UTC.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { edgeError } from "../_shared/handleEdgeError.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface EmailStats {
  email_address: string;
  user_id: string;
  total: number;
  approved: number;
  rejected: number;
  auto_executed: number;
  accuracy: number;
}

Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;

  const headers = getCorsHeaders(req.headers.get("origin"));

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const sinceDate = new Date(Date.now() - 30 * 86400000).toISOString();

    // 1. Load all decisions from last 30 days
    const { data: decisions, error } = await supabase
      .from("ai_decision_log")
      .select("user_id, email_address, decision_type, was_auto_executed, user_review, confidence, created_at")
      .gte("created_at", sinceDate)
      .limit(5000);

    if (error) throw new Error(error.message);
    if (!decisions?.length) {
      return new Response(JSON.stringify({ processed: 0, suggestions: 0, updated_rates: 0 }), {
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    // 2. Aggregate by email_address + user_id
    const emailStats = new Map<string, EmailStats>();
    for (const d of decisions as any[]) {
      if (!d.email_address) continue;
      const key = `${d.user_id}:${d.email_address}`;
      if (!emailStats.has(key)) {
        emailStats.set(key, {
          email_address: d.email_address, user_id: d.user_id,
          total: 0, approved: 0, rejected: 0, auto_executed: 0, accuracy: 0,
        });
      }
      const s = emailStats.get(key)!;
      s.total++;
      if (d.was_auto_executed) s.auto_executed++;
      if (d.user_review === "approved" || d.user_review === "modified") s.approved++;
      if (d.user_review === "rejected") s.rejected++;
    }

    let suggestions = 0;
    let updatedRates = 0;

    for (const [, stats] of emailStats) {
      if (stats.total < 5) continue;

      const reviewed = stats.approved + stats.rejected;
      stats.accuracy = reviewed > 0 ? stats.approved / reviewed : 0.5;

      // 3. Get current threshold
      const { data: rule } = await supabase
        .from("email_address_rules")
        .select("ai_confidence_threshold, success_rate")
        .eq("user_id", stats.user_id)
        .eq("email_address", stats.email_address)
        .maybeSingle();

      const currentThreshold = (rule as any)?.ai_confidence_threshold || 0.75;

      // 4. Suggest lowering threshold if accuracy >= 90% and threshold > 0.70
      if (stats.accuracy >= 0.90 && currentThreshold > 0.70) {
        await supabase.from("ai_pending_actions").insert({
          user_id: stats.user_id,
          action_type: "adjust_threshold" as any,
          email_address: stats.email_address,
          reasoning: `Accuracy ${Math.round(stats.accuracy * 100)}% su ${reviewed} decisioni. Soglia attuale: ${currentThreshold}. Suggerito abbassamento a ${Math.max(0.60, currentThreshold - 0.05).toFixed(2)}.`,
          confidence: stats.accuracy,
          source: "learning_feedback",
          status: "pending",
          action_payload: { current_threshold: currentThreshold, suggested_threshold: Math.max(0.60, currentThreshold - 0.05) },
        });
        suggestions++;
      }

      // 5. Suggest creating rule if accuracy < 60%
      if (stats.accuracy < 0.60 && !rule) {
        await supabase.from("ai_pending_actions").insert({
          user_id: stats.user_id,
          action_type: "create_rule" as any,
          email_address: stats.email_address,
          reasoning: `Accuracy bassa (${Math.round(stats.accuracy * 100)}%) su ${reviewed} decisioni. Creare regola dedicata con soglia alta e review manuale.`,
          confidence: 1 - stats.accuracy,
          source: "learning_feedback",
          status: "pending",
          action_payload: { suggested_threshold: 0.95, auto_execute: false },
        });
        suggestions++;
      }

      // 6. Update success_rate on email_address_rules
      if (rule) {
        const newRate = Math.round(stats.accuracy * 100);
        if (newRate !== (rule as any).success_rate) {
          await supabase.from("email_address_rules").update({
            success_rate: newRate,
          }).eq("user_id", stats.user_id).eq("email_address", stats.email_address);
          updatedRates++;
        }
      }
    }

    // 7. Aggregate by decision_type for trend analysis
    const byType = new Map<string, { user_id: string; type: string; approved: number; rejected: number }>();
    for (const d of decisions as any[]) {
      const key = `${d.user_id}:${d.decision_type || "unknown"}`;
      if (!byType.has(key)) byType.set(key, { user_id: d.user_id, type: d.decision_type || "unknown", approved: 0, rejected: 0 });
      const s = byType.get(key)!;
      if (d.user_review === "approved" || d.user_review === "modified") s.approved++;
      if (d.user_review === "rejected") s.rejected++;
    }

    // Log warnings for low-accuracy decision types
    for (const [, stats] of byType) {
      const reviewed = stats.approved + stats.rejected;
      if (reviewed < 5) continue;
      const accuracy = stats.approved / reviewed;
      if (accuracy < 0.60) {
        await supabase.from("ai_decision_log").insert({
          user_id: stats.user_id,
          decision_type: "learning_warning",
          ai_reasoning: `Decision type "${stats.type}" ha accuracy ${Math.round(accuracy * 100)}% (${stats.approved}/${reviewed}). Richiede revisione dei prompt o delle regole.`,
          confidence: accuracy,
          was_auto_executed: false,
          input_context: { type: stats.type, approved: stats.approved, rejected: stats.rejected, period: "30d" },
        });
      }
    }

    return new Response(JSON.stringify({
      processed: emailStats.size,
      suggestions,
      updated_rates: updatedRates,
      decision_types_analyzed: byType.size,
    }), { headers: { ...headers, "Content-Type": "application/json" } });

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : JSON.stringify(e);
    console.error("[ai-learning-feedback] Error:", msg);
    return edgeError("INTERNAL_ERROR", msg, undefined, headers);
  }
});
