import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const BUDGET_PER_AGENT = 10;
const DELAY_BETWEEN_AGENTS_MS = 3000;

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function isHighStakes(item: any): boolean {
  if (item.lead_status === "in_progress" || item.lead_status === "negotiation") return true;
  if (item.source === "ex_client") return true;
  if (item.rating && item.rating >= 4) return true;
  return false;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Get all users with active agents
    const { data: allAgents } = await supabase.from("agents").select("id, user_id, name, role, territory_codes, is_active").eq("is_active", true);
    if (!allAgents || allAgents.length === 0) {
      return new Response(JSON.stringify({ message: "No active agents" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Group by user
    const userAgents: Record<string, typeof allAgents> = {};
    for (const a of allAgents) {
      if (!userAgents[a.user_id]) userAgents[a.user_id] = [];
      userAgents[a.user_id].push(a);
    }

    const results: any[] = [];

    for (const [userId, agents] of Object.entries(userAgents)) {
      // Process agents sequentially (cascade)
      for (const agent of agents) {
        if (!["outreach", "sales", "account"].includes(agent.role)) continue;

        let actionsCreated = 0;

        // 1. Check for unread replies from contacts in holding pattern
        const { data: unreadMessages } = await supabase.from("channel_messages")
          .select("id, from_address, subject, body_text, partner_id, email_date")
          .eq("user_id", userId).eq("direction", "inbound").is("read_at", null)
          .order("email_date", { ascending: false }).limit(BUDGET_PER_AGENT);

        for (const msg of (unreadMessages || [])) {
          if (actionsCreated >= BUDGET_PER_AGENT) break;

          // Check if this is from a contact in holding pattern
          if (msg.partner_id) {
            const { data: partner } = await supabase.from("partners")
              .select("id, company_name, lead_status, rating")
              .eq("id", msg.partner_id).in("lead_status", ["contacted", "in_progress"]).single();

            if (partner) {
              const stakes = isHighStakes({ ...partner, source: "wca" });
              const taskStatus = stakes ? "proposed" : "pending";

              await supabase.from("agent_tasks").insert({
                agent_id: agent.id, user_id: userId, task_type: "analysis",
                description: `Analizza risposta da ${partner.company_name}: "${msg.subject}". ${stakes ? "⚠️ HIGH-STAKES: richiede approvazione." : "Auto-approvato: esegui follow-up."}`,
                target_filters: { message_id: msg.id, partner_id: partner.id, auto_approved: !stakes } as any,
                status: taskStatus,
              });
              actionsCreated++;
            }
          }
        }

        // 2. Check for overdue follow-ups
        const { data: overdueFups } = await supabase.from("activities")
          .select("id, title, partner_id, source_meta, due_date")
          .eq("user_id", userId).eq("status", "pending").eq("activity_type", "follow_up")
          .lt("due_date", new Date().toISOString().split("T")[0])
          .limit(BUDGET_PER_AGENT - actionsCreated);

        for (const fup of (overdueFups || [])) {
          if (actionsCreated >= BUDGET_PER_AGENT) break;

          let stakes = false;
          if (fup.partner_id) {
            const { data: p } = await supabase.from("partners").select("rating, lead_status").eq("id", fup.partner_id).single();
            if (p) stakes = isHighStakes(p);
          }

          await supabase.from("agent_tasks").insert({
            agent_id: agent.id, user_id: userId, task_type: "follow_up",
            description: `Follow-up scaduto: "${fup.title}". ${stakes ? "⚠️ Richiede approvazione Director." : "Auto-approvato."}`,
            target_filters: { activity_id: fup.id, partner_id: fup.partner_id, auto_approved: !stakes } as any,
            status: stakes ? "proposed" : "pending",
          });
          actionsCreated++;
        }

        results.push({ agent: agent.name, role: agent.role, actions_created: actionsCreated });

        // Cascade delay between agents
        if (actionsCreated > 0) await sleep(DELAY_BETWEEN_AGENTS_MS);
      }
    }

    return new Response(JSON.stringify({ success: true, cycle: new Date().toISOString(), results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("autonomous-cycle error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Errore" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
