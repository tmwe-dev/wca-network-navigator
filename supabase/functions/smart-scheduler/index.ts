/**
 * smart-scheduler — Daily cron that proposes auto-scheduled follow-ups.
 * Analyzes stale contacts and hot leads, creates ai_pending_actions for user review.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const dynCors = getCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: dynCors });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { data: users } = await supabase.from("profiles").select("user_id");
    let totalProposals = 0;

    for (const user of users || []) {
      const userId = user.user_id;
      const fourteenDaysAgo = new Date(Date.now() - 14 * 86400000).toISOString();

      // 1. Stale contacts (last interaction > 14 days, in holding pattern)
      const { data: staleContacts } = await supabase
        .from("imported_contacts")
        .select("id, name, email, company_name, country, lead_score")
        .eq("user_id", userId)
        .in("lead_status", ["first_touch_sent", "holding", "engaged"])
        .lt("last_interaction_at", fourteenDaysAgo)
        .not("email", "is", null)
        .order("lead_score", { ascending: false })
        .limit(10);

      // 2. Hot new leads (never contacted, high score)
      const { data: hotLeads } = await supabase
        .from("imported_contacts")
        .select("id, name, email, company_name, country, lead_score")
        .eq("user_id", userId)
        .eq("lead_status", "new")
        .not("email", "is", null)
        .gte("lead_score", 50)
        .order("lead_score", { ascending: false })
        .limit(10);

      // 3. Load response patterns for timing optimization
      const { data: patterns } = await supabase
        .from("response_patterns")
        .select("country_code, channel, avg_response_time_hours")
        .eq("user_id", userId);

      const patternMap = new Map<string, number>();
      for (const p of patterns || []) {
        patternMap.set(`${p.country_code}_${p.channel}`, p.avg_response_time_hours || 999);
      }

      const allContacts = [...(staleContacts || []), ...(hotLeads || [])];
      if (allContacts.length === 0) continue;

      // Deduplicate by id
      const seen = new Set<string>();
      const proposals: Record<string, unknown>[] = [];

      for (const contact of allContacts) {
        if (seen.has(contact.id)) continue;
        seen.add(contact.id);

        const avgTime = patternMap.get(`${contact.country}_email`) ?? 999;
        const bestChannel = avgTime < 48 ? "email" : "whatsapp";
        const isStale = staleContacts?.some(c => c.id === contact.id) ?? false;

        // Schedule for next Tue-Thu at 9am
        const scheduledDate = new Date();
        while ([0, 1, 5, 6].includes(scheduledDate.getDay())) {
          scheduledDate.setDate(scheduledDate.getDate() + 1);
        }
        scheduledDate.setHours(9, 0, 0, 0);

        proposals.push({
          user_id: userId,
          action_type: "auto_schedule_outreach",
          confidence: Math.min(0.85, (contact.lead_score || 0) / 100),
          reasoning: isStale
            ? `Ultima interazione > 14 giorni. Lead score: ${contact.lead_score}. Canale: ${bestChannel}.`
            : `Nuovo contatto ad alto potenziale (score: ${contact.lead_score}). Mai contattato.`,
          status: "pending",
          suggested_content: `Follow-up ${contact.name || contact.company_name} via ${bestChannel}`,
          email_address: contact.email,
          source: "smart-scheduler",
          action_payload: {
            contact_id: contact.id,
            contact_name: contact.name,
            company: contact.company_name,
            channel: bestChannel,
            scheduled_date: scheduledDate.toISOString(),
            reason: isStale ? "follow_up_stale" : "hot_lead_new",
          },
        });
      }

      if (proposals.length > 0) {
        await supabase.from("ai_pending_actions").insert(proposals);

        await supabase.from("supervisor_audit_log").insert({
          user_id: userId,
          actor_type: "system",
          actor_name: "smart-scheduler",
          action_category: "ai_auto_executed",
          action_detail: `Proposti ${proposals.length} follow-up automatici`,
          decision_origin: "system_cron",
          metadata: { proposal_count: proposals.length },
        });

        totalProposals += proposals.length;
      }
    }

    return new Response(
      JSON.stringify({ success: true, totalProposals }),
      { status: 200, headers: { ...dynCors, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[smart-scheduler] Error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...dynCors, "Content-Type": "application/json" } },
    );
  }
});
